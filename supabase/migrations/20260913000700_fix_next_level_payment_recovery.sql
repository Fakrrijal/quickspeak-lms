-- Rejected next-level payments remain historical records.
-- A new request creates a fresh payment_pending enrollment using the
-- package type selected by the student, so package choice and price remain
-- consistent with the new invoice.
-- Feature branch only; not applied to production yet.

CREATE OR REPLACE FUNCTION public.request_next_level_enrollment(
    p_package_type text
)
RETURNS TABLE (
    enrollment_id uuid,
    level_id uuid,
    package_type text,
    price integer,
    session_limit integer,
    enrollment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_next_level public.levels%ROWTYPE;
    v_existing public.enrollments%ROWTYPE;
    v_new_enrollment public.enrollments%ROWTYPE;
    v_has_result boolean := false;
    v_price integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_package_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid package type'
            USING ERRCODE = '22023';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active'
    FOR UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.student_level_results AS slr
        WHERE slr.student_id = v_student.id
          AND slr.level_id = v_student.level_id
    )
    INTO v_has_result;

    IF NOT v_has_result THEN
        RAISE EXCEPTION 'Current level must be completed by a teacher first'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT l.*
    INTO v_next_level
    FROM public.levels AS l
    JOIN public.levels AS current_level
      ON current_level.id = v_student.level_id
    WHERE l.level_number = current_level.level_number + 1
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The current level has no next level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT e.*
    INTO v_existing
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_next_level.id
      AND e.status IN (
          'pending',
          'payment_pending',
          'payment_submitted',
          'payment_approved',
          'teacher_assignment',
          'active'
      )
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Student already has an enrollment in progress for the next level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT CASE p_package_type
        WHEN 'private' THEN ps.private_registration_fee
        WHEN 'semi_private' THEN ps.semi_private_registration_fee
    END::integer
    INTO v_price
    FROM public.payment_settings AS ps
    WHERE ps.is_active
    ORDER BY ps.updated_at DESC
    LIMIT 1;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Active payment settings are not configured for this package type'
            USING ERRCODE = 'P0001';
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
        v_next_level.id,
        p_package_type,
        v_price,
        8,
        'payment_pending'
    )
    RETURNING * INTO v_new_enrollment;

    RETURN QUERY
    SELECT
        v_new_enrollment.id,
        v_new_enrollment.level_id,
        v_new_enrollment.package_type,
        v_new_enrollment.price,
        v_new_enrollment.session_limit,
        v_new_enrollment.status;
END;
$$;

REVOKE ALL ON FUNCTION public.request_next_level_enrollment(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.request_next_level_enrollment(text)
TO authenticated;
