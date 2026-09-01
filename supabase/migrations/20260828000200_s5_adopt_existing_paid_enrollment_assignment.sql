-- S5 Explicit Existing Membership Adoption
-- Explicitly adopts one valid existing teaching-group membership for a paid enrollment.

CREATE OR REPLACE FUNCTION public.admin_adopt_existing_paid_enrollment_assignment(
    p_enrollment_id uuid
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
    v_membership public.teaching_group_students%ROWTYPE;
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_teacher public.teachers%ROWTYPE;
    v_student_membership_count integer;
    v_group_membership_count integer;
    v_max_capacity integer;
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
        RAISE EXCEPTION 'Enrollment is not eligible for existing assignment adoption'
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

    SELECT COUNT(*)::integer
    INTO v_student_membership_count
    FROM public.teaching_group_students AS tgs
    WHERE tgs.student_id = v_student.id;

    IF v_student_membership_count = 0 THEN
        RAISE EXCEPTION 'Student has no teaching-group membership to adopt'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_student_membership_count > 1 THEN
        RAISE EXCEPTION 'Student has multiple teaching-group memberships; adoption is ambiguous'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_membership
    FROM public.teaching_group_students AS tgs
    WHERE tgs.student_id = v_student.id
    FOR UPDATE;

    SELECT *
    INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = v_membership.teaching_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group for existing membership not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_teaching_group.is_active THEN
        RAISE EXCEPTION 'Teaching group for existing membership is inactive'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.level_id <> v_enrollment.level_id THEN
        RAISE EXCEPTION 'Existing membership teaching group level does not match enrollment level'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.group_type <> v_enrollment.package_type THEN
        RAISE EXCEPTION 'Existing membership teaching group type does not match enrollment package'
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

    SELECT COUNT(*)::integer
    INTO v_group_membership_count
    FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = v_teaching_group.id;

    IF v_teaching_group.group_type = 'private' THEN
        v_max_capacity := 1;
    ELSE
        v_max_capacity := 4;
    END IF;

    IF v_group_membership_count > v_max_capacity THEN
        RAISE EXCEPTION 'Teaching group exceeds its capacity'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.status = 'payment_approved' THEN
        UPDATE public.enrollments
        SET status = 'teacher_assignment'
        WHERE id = v_enrollment.id
        RETURNING * INTO v_enrollment;
    END IF;

    RETURN QUERY
    SELECT
        v_enrollment.id,
        v_student.id,
        v_teaching_group.id,
        v_teacher.id,
        v_enrollment.status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adopt_existing_paid_enrollment_assignment(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_adopt_existing_paid_enrollment_assignment(uuid)
TO authenticated;
