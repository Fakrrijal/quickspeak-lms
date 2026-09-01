-- S5 Paid Enrollment Teacher Assignment
-- Assign a paid enrollment to a compatible teaching group atomically.

CREATE OR REPLACE FUNCTION public.admin_assign_paid_enrollment_to_teaching_group(
    p_enrollment_id uuid,
    p_teaching_group_id uuid
)
RETURNS TABLE (
    enrollment_id uuid,
    student_id uuid,
    teaching_group_id uuid,
    teacher_id uuid,
    enrollment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_enrollment public.enrollments%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_teacher public.teachers%ROWTYPE;
    v_current_count integer;
    v_max_capacity integer;
    v_same_group_membership_exists boolean;
    v_other_group_membership_exists boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.id = p_enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_enrollment.status NOT IN ('payment_approved', 'teacher_assignment') THEN
        RAISE EXCEPTION 'Enrollment is not eligible for teacher assignment'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_student
    FROM public.students AS s
    WHERE s.id = v_enrollment.student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment student not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_student.is_active THEN
        RAISE EXCEPTION 'Enrollment student is not active'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_teaching_group.is_active THEN
        RAISE EXCEPTION 'Teaching group is inactive'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.level_id <> v_teaching_group.level_id THEN
        RAISE EXCEPTION 'Enrollment level does not match teaching group level'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.package_type <> v_teaching_group.group_type THEN
        RAISE EXCEPTION 'Enrollment package does not match teaching group type'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.group_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid teaching group type'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_teacher
    FROM public.teachers AS t
    WHERE t.id = v_teaching_group.teacher_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group teacher not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_teacher.is_active THEN
        RAISE EXCEPTION 'Teaching group teacher is inactive'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher.id
      AND tl.level_id = v_enrollment.level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group teacher is not eligible for enrollment level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        WHERE tgs.student_id = v_student.id
          AND tgs.teaching_group_id = v_teaching_group.id
    )
    INTO v_same_group_membership_exists;

    SELECT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        WHERE tgs.student_id = v_student.id
          AND tgs.teaching_group_id <> v_teaching_group.id
    )
    INTO v_other_group_membership_exists;

    IF v_other_group_membership_exists THEN
        RAISE EXCEPTION 'Student already belongs to another teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.status = 'teacher_assignment' THEN
        IF v_same_group_membership_exists THEN
            RETURN QUERY
            SELECT
                v_enrollment.id,
                v_student.id,
                v_teaching_group.id,
                v_teacher.id,
                v_enrollment.status;
            RETURN;
        END IF;

        RAISE EXCEPTION 'Enrollment was already assigned to a different or missing teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_same_group_membership_exists THEN
        RAISE EXCEPTION 'Student is already in the requested teaching group; membership cannot be linked to this payment-approved enrollment'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*)::integer
    INTO v_current_count
    FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = v_teaching_group.id;

    IF v_teaching_group.group_type = 'private' THEN
        v_max_capacity := 1;
    ELSE
        v_max_capacity := 4;
    END IF;

    IF v_current_count >= v_max_capacity THEN
        RAISE EXCEPTION 'Teaching group is at capacity'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.teaching_group_students (
        teaching_group_id,
        student_id
    )
    VALUES (
        v_teaching_group.id,
        v_student.id
    );

    UPDATE public.enrollments
    SET status = 'teacher_assignment'
    WHERE id = v_enrollment.id
    RETURNING * INTO v_enrollment;

    RETURN QUERY
    SELECT
        v_enrollment.id,
        v_student.id,
        v_teaching_group.id,
        v_teacher.id,
        v_enrollment.status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_paid_enrollment_to_teaching_group(uuid, uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_assign_paid_enrollment_to_teaching_group(uuid, uuid)
TO authenticated;
