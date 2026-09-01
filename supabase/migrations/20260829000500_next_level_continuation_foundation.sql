-- Next-Level Continuation Foundation
-- Completion remains derived from authoritative attendance. This migration adds
-- a secure continuation request path and records the teaching-group assignment
-- for each enrollment so previous level relationships remain attributable.

CREATE TABLE IF NOT EXISTS public.enrollment_teaching_group_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL
        REFERENCES public.enrollments(id)
        ON DELETE RESTRICT,
    teaching_group_id uuid NOT NULL
        REFERENCES public.teaching_groups(id)
        ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT enrollment_teaching_group_assignments_enrollment_id_key
        UNIQUE (enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_teaching_group_assignments_teaching_group_id
    ON public.enrollment_teaching_group_assignments(teaching_group_id);

ALTER TABLE public.enrollment_teaching_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_student_continuation_status()
RETURNS TABLE (
    enrollment_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    package_type text,
    session_limit integer,
    valid_present_count integer,
    is_completed boolean,
    next_level_id uuid,
    next_level_name text,
    next_level_number integer,
    continuation_available boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.id
    INTO v_student_id
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'::public.user_role
      AND p.status = 'active'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH current_enrollment AS (
        SELECT e.id, e.level_id, e.package_type, e.session_limit, l.name, l.level_number
        FROM public.enrollments AS e
        JOIN public.levels AS l
            ON l.id = e.level_id
        WHERE e.student_id = v_student_id
          AND e.status = 'active'
        ORDER BY l.level_number DESC, e.created_at DESC, e.id DESC
        LIMIT 1
    ),
    completion AS (
        SELECT
            ce.*,
            (
                SELECT count(*)::integer
                FROM public.attendance AS a
                JOIN public.meetings AS m
                    ON m.id = a.meeting_id
                WHERE m.enrollment_id = ce.id
                  AND a.teacher_status = 'present'
            ) AS present_count
        FROM current_enrollment AS ce
    )
    SELECT
        c.id,
        c.level_id,
        c.name,
        c.level_number,
        c.package_type,
        c.session_limit,
        c.present_count,
        c.present_count = c.session_limit,
        nl.id,
        nl.name,
        nl.level_number,
        c.present_count = c.session_limit AND nl.id IS NOT NULL
    FROM completion AS c
    LEFT JOIN public.levels AS nl
        ON nl.level_number = c.level_number + 1;
END;
$$;

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
    v_current_enrollment public.enrollments%ROWTYPE;
    v_current_level_number integer;
    v_next_level public.levels%ROWTYPE;
    v_present_count integer;
    v_existing_next public.enrollments%ROWTYPE;
    v_new_enrollment public.enrollments%ROWTYPE;
    v_price integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'::public.user_role
      AND p.status = 'active'::public.user_status
    FOR UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_package_type = 'private' THEN
        v_price := 180000;
    ELSIF p_package_type = 'semi_private' THEN
        v_price := 150000;
    ELSE
        RAISE EXCEPTION 'Invalid package type'
            USING ERRCODE = '22023';
    END IF;

    SELECT e.*
    INTO v_current_enrollment
    FROM public.enrollments AS e
    JOIN public.levels AS l
        ON l.id = e.level_id
    WHERE e.student_id = v_student.id
      AND e.status = 'active'
    ORDER BY l.level_number DESC, e.created_at DESC, e.id DESC
    LIMIT 1
    FOR UPDATE OF e;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No current enrollment is available for continuation'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT l.level_number
    INTO v_current_level_number
    FROM public.levels AS l
    WHERE l.id = v_current_enrollment.level_id
    FOR KEY SHARE;

    SELECT count(*)::integer
    INTO v_present_count
    FROM public.attendance AS a
    JOIN public.meetings AS m
        ON m.id = a.meeting_id
    WHERE m.enrollment_id = v_current_enrollment.id
      AND a.teacher_status = 'present';

    IF v_present_count <> v_current_enrollment.session_limit THEN
        RAISE EXCEPTION 'Current enrollment has not completed its required present sessions'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT l.*
    INTO v_next_level
    FROM public.levels AS l
    WHERE l.level_number = v_current_level_number + 1
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The current level has no next level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT e.*
    INTO v_existing_next
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_next_level.id
      AND e.status IN (
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
        IF v_existing_next.status = 'payment_rejected' THEN
            RETURN QUERY
            SELECT
                v_existing_next.id,
                v_existing_next.level_id,
                v_existing_next.package_type,
                v_existing_next.price,
                v_existing_next.session_limit,
                v_existing_next.status;
            RETURN;
        END IF;

        RAISE EXCEPTION 'Student already has an enrollment in progress for the next level'
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
    ON CONFLICT (enrollment_id) DO NOTHING;

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

REVOKE ALL ON TABLE public.enrollment_teaching_group_assignments FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_my_student_continuation_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_student_continuation_status() TO authenticated;

REVOKE ALL ON FUNCTION public.request_next_level_enrollment(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_next_level_enrollment(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_assign_paid_enrollment_to_teaching_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_paid_enrollment_to_teaching_group(uuid, uuid) TO authenticated;
