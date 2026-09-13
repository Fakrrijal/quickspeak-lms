-- Allow a new enrollment to explicitly target the level the student intends to pay for.
-- Registration data remains informational; the enrollment is the source of truth
-- for level/package used by payment and teaching-group assignment.

CREATE OR REPLACE FUNCTION public.create_student_enrollment(
    p_level_id uuid,
    p_package_type text
)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_level public.levels%ROWTYPE;
    v_existing_enrollment public.enrollments%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_price integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = auth.uid()
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_profile.role <> 'student'::public.user_role THEN
        RAISE EXCEPTION 'Only students can create enrollments' USING ERRCODE = '42501';
    END IF;

    IF v_profile.status <> 'active'::public.user_status THEN
        RAISE EXCEPTION 'Student account is not active' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_student
    FROM public.students
    WHERE profile_id = auth.uid()
      AND is_active
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student record is required' USING ERRCODE = 'P0002';
    END IF;

    IF p_package_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid package type' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_level
    FROM public.levels
    WHERE id = p_level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected learning level was not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_package_type = 'private' THEN
        SELECT private_registration_fee::integer INTO v_price
        FROM public.payment_settings
        WHERE is_active
        ORDER BY updated_at DESC
        LIMIT 1
        FOR KEY SHARE;
    ELSE
        SELECT semi_private_registration_fee::integer INTO v_price
        FROM public.payment_settings
        WHERE is_active
        ORDER BY updated_at DESC
        LIMIT 1
        FOR KEY SHARE;
    END IF;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Active payment settings were not found' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_existing_enrollment
    FROM public.enrollments
    WHERE student_id = v_student.id
      AND level_id = p_level_id
      AND status IN (
          'pending',
          'payment_pending',
          'payment_submitted',
          'payment_rejected',
          'payment_approved',
          'teacher_assignment',
          'active'
      )
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Student already has an enrollment in progress for the selected level' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.enrollments (
        student_id,
        level_id,
        package_type,
        price,
        session_limit,
        status
    )
    VALUES (
        v_student.id,
        p_level_id,
        p_package_type,
        v_price,
        8,
        'payment_pending'
    )
    RETURNING * INTO v_enrollment;

    RETURN v_enrollment;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_student_enrollment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_student_enrollment(uuid, text) TO authenticated;
