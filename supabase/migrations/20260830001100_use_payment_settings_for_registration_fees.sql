-- Registration fees are administrator-managed. Preserve the selected amount on
-- the enrollment so later changes do not alter an existing invoice.
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_price_check;

ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_price_check CHECK (price > 0);

ALTER TABLE public.payment_settings
  ADD CONSTRAINT payment_settings_private_registration_fee_whole_positive_rupiah
    CHECK (private_registration_fee = trunc(private_registration_fee) AND private_registration_fee > 0),
  ADD CONSTRAINT payment_settings_semi_private_registration_fee_whole_positive_rupiah
    CHECK (semi_private_registration_fee = trunc(semi_private_registration_fee) AND semi_private_registration_fee > 0);

CREATE OR REPLACE FUNCTION public.create_student_enrollment(
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
    v_existing_enrollment public.enrollments%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_price integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_profile
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

    SELECT * INTO v_student
    FROM public.students
    WHERE profile_id = auth.uid()
    FOR KEY SHARE;

    IF NOT FOUND OR NOT v_student.is_active THEN
        RAISE EXCEPTION 'Active student record is required';
    END IF;

    IF p_package_type = 'private' THEN
        SELECT private_registration_fee::integer INTO v_price
        FROM public.payment_settings
        WHERE is_active
        FOR KEY SHARE;
    ELSIF p_package_type = 'semi_private' THEN
        SELECT semi_private_registration_fee::integer INTO v_price
        FROM public.payment_settings
        WHERE is_active
        FOR KEY SHARE;
    ELSE
        RAISE EXCEPTION 'Invalid package type';
    END IF;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Active payment settings were not found';
    END IF;

    SELECT * INTO v_existing_enrollment
    FROM public.enrollments
    WHERE student_id = v_student.id
      AND level_id = v_student.level_id
      AND status IN ('pending', 'payment_pending', 'payment_submitted', 'payment_rejected', 'payment_approved', 'teacher_assignment', 'active')
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Student already has an enrollment in progress for the current level';
    END IF;

    INSERT INTO public.enrollments (student_id, level_id, package_type, price, session_limit, status)
    VALUES (v_student.id, v_student.level_id, p_package_type, v_price, 8, 'payment_pending')
    RETURNING * INTO v_enrollment;

    RETURN v_enrollment;
END;
$function$;
