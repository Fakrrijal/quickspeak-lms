CREATE OR REPLACE FUNCTION public.create_student_enrollment(
    p_package_type TEXT
)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_existing_enrollment public.enrollments%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_price INTEGER;
BEGIN
    -- 1. User must be authenticated.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Load and validate profile.
    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = auth.uid()
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    IF v_profile.role <> 'student'::public.user_role THEN
        RAISE EXCEPTION 'Only students can create enrollments';
    END IF;

    IF v_profile.status <> 'active'::public.user_status THEN
        RAISE EXCEPTION 'Student account is not active';
    END IF;

    -- 3. Load Student record.
    SELECT *
    INTO v_student
    FROM public.students
    WHERE profile_id = auth.uid()
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found';
    END IF;

    IF NOT v_student.is_active THEN
        RAISE EXCEPTION 'Student record is inactive';
    END IF;

    -- 4. Validate package type and determine server-side price.
    IF p_package_type = 'private' THEN
        v_price := 180000;
    ELSIF p_package_type = 'semi_private' THEN
        v_price := 150000;
    ELSE
        RAISE EXCEPTION 'Invalid package type';
    END IF;

    -- 5. Prevent duplicate in-progress enrollment
    --    for the same student and current level.
    SELECT *
    INTO v_existing_enrollment
    FROM public.enrollments
    WHERE student_id = v_student.id
      AND level_id = v_student.level_id
      AND status IN (
          'pending',
          'payment_pending',
          'payment_submitted',
          'payment_rejected',
          'payment_approved',
          'teacher_assignment',
          'active'
      )
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION
            'Student already has an enrollment in progress for the current level';
    END IF;

    -- 6. Create enrollment.
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
        v_student.level_id,
        p_package_type,
        v_price,
        8,
        'payment_pending'
    )
    RETURNING * INTO v_enrollment;

    RETURN v_enrollment;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_student_enrollment(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_student_enrollment(TEXT)
TO authenticated;