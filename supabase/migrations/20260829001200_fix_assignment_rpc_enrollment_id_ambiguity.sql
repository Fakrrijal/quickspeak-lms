-- Resolve the PL/pgSQL output-variable/table-column ambiguity in the
-- enrollment assignment conflict target without changing assignment behavior.

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
    v_assignment public.enrollment_teaching_group_assignments%ROWTYPE;
    v_has_assignment boolean := false;
    v_current_count integer;
    v_max_capacity integer;
    v_same_group_membership_exists boolean;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.id = p_enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_enrollment.status NOT IN ('payment_approved', 'teacher_assignment', 'active') THEN
        RAISE EXCEPTION 'Enrollment is not eligible for teacher assignment' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_student
    FROM public.students AS s
    WHERE s.id = v_enrollment.student_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_student.is_active THEN
        RAISE EXCEPTION 'Enrollment student is not active' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_teaching_group.is_active THEN
        RAISE EXCEPTION 'Teaching group is inactive or not found' USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.level_id <> v_teaching_group.level_id
       OR v_enrollment.package_type <> v_teaching_group.group_type THEN
        RAISE EXCEPTION 'Teaching group does not match enrollment level or package' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_teacher
    FROM public.teachers AS t
    WHERE t.id = v_teaching_group.teacher_id
    FOR KEY SHARE;

    IF NOT FOUND OR NOT v_teacher.is_active THEN
        RAISE EXCEPTION 'Teaching group teacher is inactive or not found' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher.id
      AND tl.level_id = v_enrollment.level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group teacher is not eligible for enrollment level' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_assignment
    FROM public.enrollment_teaching_group_assignments AS etga
    WHERE etga.enrollment_id = v_enrollment.id
    FOR UPDATE;

    v_has_assignment := FOUND;

    IF v_has_assignment AND v_assignment.teaching_group_id <> v_teaching_group.id THEN
        RAISE EXCEPTION 'Enrollment is already assigned to a different teaching group' USING ERRCODE = 'P0001';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        WHERE tgs.student_id = v_student.id
          AND tgs.teaching_group_id = v_teaching_group.id
    ) INTO v_same_group_membership_exists;

    IF v_enrollment.status = 'active' THEN
        IF NOT v_has_assignment AND NOT v_same_group_membership_exists THEN
            RAISE EXCEPTION 'Active enrollment does not have the requested teaching group membership' USING ERRCODE = 'P0001';
        END IF;

        RETURN QUERY SELECT v_enrollment.id, v_student.id, v_teaching_group.id, v_teacher.id, v_enrollment.status;
        RETURN;
    END IF;

    IF NOT v_same_group_membership_exists THEN
        SELECT count(*)::integer INTO v_current_count
        FROM public.teaching_group_students AS tgs
        WHERE tgs.teaching_group_id = v_teaching_group.id;

        v_max_capacity := CASE v_teaching_group.group_type
            WHEN 'private' THEN 1
            WHEN 'semi_private' THEN 4
            ELSE 0
        END;

        IF v_current_count >= v_max_capacity THEN
            RAISE EXCEPTION 'Teaching group is at capacity' USING ERRCODE = 'P0001';
        END IF;

        INSERT INTO public.teaching_group_students (teaching_group_id, student_id)
        VALUES (v_teaching_group.id, v_student.id);
    END IF;

    INSERT INTO public.enrollment_teaching_group_assignments (enrollment_id, teaching_group_id)
    VALUES (v_enrollment.id, v_teaching_group.id)
    ON CONFLICT ON CONSTRAINT enrollment_teaching_group_assignments_enrollment_id_key DO NOTHING;

    UPDATE public.enrollments
    SET status = 'active'
    WHERE id = v_enrollment.id
      AND status IN ('payment_approved', 'teacher_assignment')
    RETURNING * INTO v_enrollment;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment could not be activated from teacher assignment' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_enrollment.id, v_student.id, v_teaching_group.id, v_teacher.id, v_enrollment.status;
END;
$$;
