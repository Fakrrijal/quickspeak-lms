-- Active Enrollment Assignment Reconciliation
-- Provides an explicit, admin-only path for reconciling active enrollments
-- that have a valid group membership but no enrollment-specific assignment.

CREATE OR REPLACE FUNCTION public.admin_get_active_enrollment_assignment_exceptions()
RETURNS TABLE (
    enrollment_id uuid,
    student_id uuid,
    student_code text,
    student_display_name text,
    level_id uuid,
    level_name text,
    level_number integer,
    package_type text,
    teaching_group_id uuid,
    teaching_group_name text,
    teacher_id uuid,
    teacher_code text,
    assignment_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        s.id,
        s.student_code,
        sp.full_name,
        l.id,
        l.name,
        l.level_number,
        e.package_type,
        tg.id,
        tg.name,
        t.id,
        t.teacher_code,
        'missing'::text
    FROM public.enrollments AS e
    JOIN public.students AS s
        ON s.id = e.student_id
       AND s.is_active
    JOIN public.profiles AS sp
        ON sp.id = s.profile_id
       AND sp.role = 'student'::public.user_role
       AND sp.status = 'active'::public.user_status
    JOIN public.levels AS l
        ON l.id = e.level_id
    JOIN public.teaching_group_students AS tgs
        ON tgs.student_id = s.id
    JOIN public.teaching_groups AS tg
        ON tg.id = tgs.teaching_group_id
       AND tg.is_active
       AND tg.level_id = e.level_id
       AND tg.group_type = e.package_type
    JOIN public.teachers AS t
        ON t.id = tg.teacher_id
       AND t.is_active
    WHERE e.status = 'active'
      AND NOT EXISTS (
          SELECT 1
          FROM public.enrollment_teaching_group_assignments AS etga
          WHERE etga.enrollment_id = e.id
      )
    ORDER BY l.level_number, e.created_at, e.id, tg.name, tg.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reconcile_active_enrollment_teaching_group_assignment(
    p_enrollment_id uuid,
    p_teaching_group_id uuid
)
RETURNS TABLE (
    enrollment_id uuid,
    teaching_group_id uuid
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
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_enrollment_id IS NULL OR p_teaching_group_id IS NULL THEN
        RAISE EXCEPTION 'Enrollment and teaching group are required'
            USING ERRCODE = '22023';
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

    IF v_enrollment.status <> 'active' THEN
        RAISE EXCEPTION 'Only active enrollments can be reconciled'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_student
    FROM public.students AS s
    WHERE s.id = v_enrollment.student_id
    FOR KEY SHARE;

    IF NOT FOUND OR NOT v_student.is_active THEN
        RAISE EXCEPTION 'Enrollment student is not active'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_teaching_group.is_active THEN
        RAISE EXCEPTION 'Teaching group is inactive or not found'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.level_id <> v_enrollment.level_id
       OR v_teaching_group.group_type <> v_enrollment.package_type THEN
        RAISE EXCEPTION 'Teaching group does not match enrollment level or package'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_teacher
    FROM public.teachers AS t
    WHERE t.id = v_teaching_group.teacher_id
    FOR KEY SHARE;

    IF NOT FOUND OR NOT v_teacher.is_active THEN
        RAISE EXCEPTION 'Teaching group teacher is inactive or not found'
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

    SELECT *
    INTO v_assignment
    FROM public.enrollment_teaching_group_assignments AS etga
    WHERE etga.enrollment_id = v_enrollment.id
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Enrollment already has a teaching group assignment'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.teaching_group_students AS tgs
    WHERE tgs.student_id = v_student.id
      AND tgs.teaching_group_id = v_teaching_group.id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student is not a member of the selected teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.enrollment_teaching_group_assignments (
        enrollment_id,
        teaching_group_id
    )
    VALUES (
        v_enrollment.id,
        v_teaching_group.id
    );

    RETURN QUERY
    SELECT v_enrollment.id, v_teaching_group.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_active_enrollment_assignment_exceptions()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reconcile_active_enrollment_teaching_group_assignment(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_get_active_enrollment_assignment_exceptions()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_active_enrollment_teaching_group_assignment(uuid, uuid)
TO authenticated;
