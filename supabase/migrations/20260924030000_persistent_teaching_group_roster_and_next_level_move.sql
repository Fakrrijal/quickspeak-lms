-- Persistent Teaching Group roster model and explicit next-level move.
-- Teaching groups remain visible independently from active enrollments.
-- Next-level assignment moves current membership atomically while preserving
-- historical enrollment-to-group assignments.

CREATE OR REPLACE FUNCTION public.admin_assign_next_level_enrollment_to_teaching_group(
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
    v_current_level public.levels%ROWTYPE;
    v_enrollment_level public.levels%ROWTYPE;
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_teacher public.teachers%ROWTYPE;
    v_assignment public.enrollment_teaching_group_assignments%ROWTYPE;
    v_target_membership_exists boolean;
    v_target_member_count integer;
    v_max_capacity integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
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
        RAISE EXCEPTION 'Enrollment is not eligible for next-level assignment'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_student
    FROM public.students AS s
    WHERE s.id = v_enrollment.student_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_student.is_active THEN
        RAISE EXCEPTION 'Enrollment student is not active'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_student.level_id IS NULL THEN
        RAISE EXCEPTION 'Student current level is not set'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_current_level
    FROM public.levels AS l
    WHERE l.id = v_student.level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student current level was not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_enrollment_level
    FROM public.levels AS l
    WHERE l.id = v_enrollment.level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment level was not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_enrollment_level.level_number <> v_current_level.level_number + 1 THEN
        RAISE EXCEPTION 'Enrollment is not for the immediate next level'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.enrollments AS e
        WHERE e.student_id = v_student.id
          AND e.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Student already has an active enrollment'
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

    IF v_teaching_group.level_id <> v_enrollment.level_id
       OR v_teaching_group.group_type <> v_enrollment.package_type THEN
        RAISE EXCEPTION 'Teaching group does not match enrollment level or package'
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

    SELECT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        WHERE tgs.teaching_group_id = v_teaching_group.id
          AND tgs.student_id = v_student.id
    )
    INTO v_target_membership_exists;

    PERFORM 1
    FROM public.teaching_group_students AS tgs
    WHERE tgs.student_id = v_student.id
    FOR UPDATE;

    DELETE FROM public.teaching_group_students
    WHERE student_id = v_student.id
      AND teaching_group_id <> v_teaching_group.id;

    SELECT count(*)::integer
    INTO v_target_member_count
    FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = v_teaching_group.id;

    v_max_capacity := CASE
        WHEN v_teaching_group.group_type = 'private' THEN 1
        WHEN v_teaching_group.group_type = 'semi_private' THEN 4
        ELSE 0
    END;

    IF NOT v_target_membership_exists AND v_target_member_count >= v_max_capacity THEN
        RAISE EXCEPTION 'Teaching group is at capacity'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT v_target_membership_exists THEN
        INSERT INTO public.teaching_group_students (
            teaching_group_id,
            student_id
        )
        VALUES (
            v_teaching_group.id,
            v_student.id
        );
    END IF;

    SELECT *
    INTO v_assignment
    FROM public.enrollment_teaching_group_assignments AS etga
    WHERE etga.enrollment_id = v_enrollment.id
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.enrollment_teaching_group_assignments
        SET teaching_group_id = v_teaching_group.id,
            assigned_at = now()
        WHERE id = v_assignment.id;
    ELSE
        INSERT INTO public.enrollment_teaching_group_assignments (
            enrollment_id,
            teaching_group_id
        )
        VALUES (
            v_enrollment.id,
            v_teaching_group.id
        );
    END IF;

    UPDATE public.enrollments
    SET status = 'active'
    WHERE id = v_enrollment.id
      AND status IN ('payment_approved', 'teacher_assignment')
    RETURNING * INTO v_enrollment;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment could not be activated from teacher assignment'
            USING ERRCODE = 'P0001';
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

REVOKE ALL ON FUNCTION public.admin_assign_next_level_enrollment_to_teaching_group(uuid, uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_assign_next_level_enrollment_to_teaching_group(uuid, uuid)
TO authenticated;


CREATE OR REPLACE FUNCTION public.get_my_teacher_teaching_groups()
RETURNS TABLE (
    teaching_group_id uuid,
    teaching_group_name text,
    level_name text,
    package_type text,
    student_id uuid,
    student_display_name text,
    enrollment_id uuid,
    enrollment_status text,
    roster_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT t.id
    INTO v_teacher_id
    FROM public.teachers AS t
    JOIN public.profiles AS p
      ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'active'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        tg.id,
        tg.name,
        l.name,
        tg.group_type,
        s.id,
        sp.full_name,
        COALESCE(active_enrollment.id, pending_enrollment.id),
        COALESCE(active_enrollment.status, pending_enrollment.status),
        CASE
            WHEN s.id IS NULL THEN NULL
            WHEN active_enrollment.id IS NOT NULL THEN 'active'
            WHEN pending_enrollment.id IS NOT NULL
                 AND pending_enrollment.level_id <> s.level_id
                THEN 'waiting_next_level'
            WHEN pending_enrollment.id IS NOT NULL
                 AND pending_enrollment.level_id = s.level_id
                THEN 'waiting_renewal'
            WHEN EXISTS (
                SELECT 1
                FROM public.student_level_results AS slr
                WHERE slr.student_id = s.id
                  AND slr.level_id = s.level_id
            ) THEN 'level_completed'
            ELSE 'waiting_assignment'
        END
    FROM public.teaching_groups AS tg
    JOIN public.levels AS l
      ON l.id = tg.level_id
    LEFT JOIN public.teaching_group_students AS tgs
      ON tgs.teaching_group_id = tg.id
    LEFT JOIN public.students AS s
      ON s.id = tgs.student_id
     AND s.is_active
    LEFT JOIN public.profiles AS sp
      ON sp.id = s.profile_id
     AND sp.role = 'student'::public.user_role
     AND sp.status = 'active'::public.user_status
    LEFT JOIN LATERAL (
        SELECT e.id, e.status
        FROM public.enrollments AS e
        JOIN public.enrollment_teaching_group_assignments AS etga
          ON etga.enrollment_id = e.id
         AND etga.teaching_group_id = tg.id
        WHERE s.id IS NOT NULL
          AND e.student_id = s.id
          AND e.status = 'active'
          AND e.level_id = tg.level_id
          AND e.package_type = tg.group_type
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 1
    ) AS active_enrollment
      ON TRUE
    LEFT JOIN LATERAL (
        SELECT e.id, e.status, e.level_id
        FROM public.enrollments AS e
        WHERE s.id IS NOT NULL
          AND e.student_id = s.id
          AND e.status IN (
              'pending',
              'payment_pending',
              'payment_submitted',
              'payment_rejected',
              'payment_approved',
              'teacher_assignment'
          )
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 1
    ) AS pending_enrollment
      ON TRUE
    WHERE tg.teacher_id = v_teacher_id
      AND tg.is_active
      AND EXISTS (
          SELECT 1
          FROM public.teacher_levels AS tl
          WHERE tl.teacher_id = v_teacher_id
            AND tl.level_id = tg.level_id
      )
    ORDER BY tg.name, tg.id, sp.full_name NULLS LAST, s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_teacher_teaching_groups()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_teacher_teaching_groups()
TO authenticated;
