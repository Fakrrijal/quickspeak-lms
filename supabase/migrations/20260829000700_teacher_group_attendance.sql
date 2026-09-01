-- Simple teacher group attendance.
-- This preserves the meeting-based attendance model while keeping meeting
-- creation and validation inside an atomic, teacher-authorized operation.

-- Preflight the existing data before enforcing the one-meeting-per-enrollment
-- rule. The current environment was verified empty, but a clear failure keeps
-- this migration safe for any other environment.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.meetings AS m
        GROUP BY m.teaching_group_id, m.enrollment_id, m.session_date
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot add unique meeting protection: duplicate teaching group, enrollment, and session date rows exist';
    END IF;
END;
$$;

CREATE UNIQUE INDEX meetings_teaching_group_enrollment_session_date_key
    ON public.meetings (teaching_group_id, enrollment_id, session_date);

CREATE FUNCTION public.get_my_teacher_attendance_groups()
RETURNS TABLE (
    teaching_group_id uuid,
    teaching_group_name text,
    level_name text,
    package_type text,
    student_id uuid,
    student_display_name text,
    enrollment_id uuid
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
        e.id
    FROM public.teaching_groups AS tg
    JOIN public.levels AS l
        ON l.id = tg.level_id
    JOIN public.enrollment_teaching_group_assignments AS etga
        ON etga.teaching_group_id = tg.id
    JOIN public.enrollments AS e
        ON e.id = etga.enrollment_id
       AND e.status = 'active'
       AND e.level_id = tg.level_id
       AND e.package_type = tg.group_type
    JOIN public.students AS s
        ON s.id = e.student_id
       AND s.is_active
    JOIN public.profiles AS sp
        ON sp.id = s.profile_id
       AND sp.role = 'student'::public.user_role
       AND sp.status = 'active'::public.user_status
    JOIN public.teaching_group_students AS tgs
        ON tgs.teaching_group_id = tg.id
       AND tgs.student_id = s.id
    WHERE tg.teacher_id = v_teacher_id
      AND tg.is_active
      AND EXISTS (
          SELECT 1
          FROM public.teacher_levels AS tl
          WHERE tl.teacher_id = v_teacher_id
            AND tl.level_id = tg.level_id
      )
    ORDER BY tg.name, tg.id, sp.full_name, s.id, e.id;
END;
$$;

CREATE FUNCTION public.record_my_teacher_group_attendance(
    p_teaching_group_id uuid,
    p_attendance jsonb
)
RETURNS TABLE (
    meeting_id uuid,
    attendance_id uuid,
    student_id uuid,
    enrollment_id uuid,
    teacher_status text,
    session_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_expected_count integer;
    v_submitted_count integer;
    v_present_count integer;
    v_submission jsonb;
    v_session_date date := CURRENT_DATE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_teaching_group_id IS NULL
       OR p_attendance IS NULL
       OR jsonb_typeof(p_attendance) <> 'array'
       OR jsonb_array_length(p_attendance) = 0 THEN
        RAISE EXCEPTION 'Teaching group and attendance for every active student are required'
            USING ERRCODE = '22023';
    END IF;

    SELECT t.*
    INTO v_teacher
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'active'::public.user_status
    FOR KEY SHARE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT tg.*
    INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
      AND tg.teacher_id = v_teacher.id
      AND tg.is_active
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group is not available to the authenticated teacher'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher.id
      AND tl.level_id = v_teaching_group.level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not eligible for the teaching group level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*)::integer
    INTO v_submitted_count
    FROM jsonb_to_recordset(p_attendance) AS submitted(
        student_id uuid,
        enrollment_id uuid,
        teacher_status text
    );

    IF v_submitted_count <> jsonb_array_length(p_attendance)
       OR EXISTS (
           SELECT 1
           FROM jsonb_to_recordset(p_attendance) AS submitted(
               student_id uuid,
               enrollment_id uuid,
               teacher_status text
           )
           WHERE submitted.student_id IS NULL
              OR submitted.enrollment_id IS NULL
              OR submitted.teacher_status NOT IN ('present', 'absent')
       )
       OR EXISTS (
           SELECT 1
           FROM jsonb_to_recordset(p_attendance) AS submitted(
               student_id uuid,
               enrollment_id uuid,
               teacher_status text
           )
           GROUP BY submitted.student_id, submitted.enrollment_id
           HAVING COUNT(*) > 1
       ) THEN
        RAISE EXCEPTION 'Each attendance status must identify one student, enrollment, and present or absent status'
            USING ERRCODE = '22023';
    END IF;

    -- Lock the active enrollment rows in a stable order before checking their
    -- session limits, so concurrent saves cannot over-count present sessions.
    PERFORM 1
    FROM public.enrollments AS e
    JOIN public.enrollment_teaching_group_assignments AS etga
        ON etga.enrollment_id = e.id
       AND etga.teaching_group_id = v_teaching_group.id
    JOIN public.students AS s
        ON s.id = e.student_id
       AND s.is_active
    JOIN public.profiles AS sp
        ON sp.id = s.profile_id
       AND sp.role = 'student'::public.user_role
       AND sp.status = 'active'::public.user_status
    JOIN public.teaching_group_students AS tgs
        ON tgs.teaching_group_id = v_teaching_group.id
       AND tgs.student_id = s.id
    WHERE e.status = 'active'
      AND e.level_id = v_teaching_group.level_id
      AND e.package_type = v_teaching_group.group_type
    ORDER BY e.id
    FOR UPDATE OF e;

    SELECT COUNT(*)::integer
    INTO v_expected_count
    FROM public.enrollments AS e
    JOIN public.enrollment_teaching_group_assignments AS etga
        ON etga.enrollment_id = e.id
       AND etga.teaching_group_id = v_teaching_group.id
    JOIN public.students AS s
        ON s.id = e.student_id
       AND s.is_active
    JOIN public.profiles AS sp
        ON sp.id = s.profile_id
       AND sp.role = 'student'::public.user_role
       AND sp.status = 'active'::public.user_status
    JOIN public.teaching_group_students AS tgs
        ON tgs.teaching_group_id = v_teaching_group.id
       AND tgs.student_id = s.id
    WHERE e.status = 'active'
      AND e.level_id = v_teaching_group.level_id
      AND e.package_type = v_teaching_group.group_type;

    IF v_expected_count = 0 OR v_submitted_count <> v_expected_count OR EXISTS (
        (
            SELECT e.student_id, e.id AS enrollment_id
            FROM public.enrollments AS e
            JOIN public.enrollment_teaching_group_assignments AS etga
                ON etga.enrollment_id = e.id
               AND etga.teaching_group_id = v_teaching_group.id
            JOIN public.students AS s
                ON s.id = e.student_id
               AND s.is_active
            JOIN public.profiles AS sp
                ON sp.id = s.profile_id
               AND sp.role = 'student'::public.user_role
               AND sp.status = 'active'::public.user_status
            JOIN public.teaching_group_students AS tgs
                ON tgs.teaching_group_id = v_teaching_group.id
               AND tgs.student_id = s.id
            WHERE e.status = 'active'
              AND e.level_id = v_teaching_group.level_id
              AND e.package_type = v_teaching_group.group_type
            EXCEPT
            SELECT submitted.student_id, submitted.enrollment_id
            FROM jsonb_to_recordset(p_attendance) AS submitted(
                student_id uuid,
                enrollment_id uuid,
                teacher_status text
            )
        )
        UNION ALL
        (
            SELECT submitted.student_id, submitted.enrollment_id
            FROM jsonb_to_recordset(p_attendance) AS submitted(
                student_id uuid,
                enrollment_id uuid,
                teacher_status text
            )
            EXCEPT
            SELECT e.student_id, e.id
            FROM public.enrollments AS e
            JOIN public.enrollment_teaching_group_assignments AS etga
                ON etga.enrollment_id = e.id
               AND etga.teaching_group_id = v_teaching_group.id
            JOIN public.students AS s
                ON s.id = e.student_id
               AND s.is_active
            JOIN public.profiles AS sp
                ON sp.id = s.profile_id
               AND sp.role = 'student'::public.user_role
               AND sp.status = 'active'::public.user_status
            JOIN public.teaching_group_students AS tgs
                ON tgs.teaching_group_id = v_teaching_group.id
               AND tgs.student_id = s.id
            WHERE e.status = 'active'
              AND e.level_id = v_teaching_group.level_id
              AND e.package_type = v_teaching_group.group_type
        )
    ) THEN
        RAISE EXCEPTION 'Attendance must include every current active student in the teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.meetings AS m
        WHERE m.teaching_group_id = v_teaching_group.id
          AND m.session_date = v_session_date
          AND m.enrollment_id IN (
              SELECT submitted.enrollment_id
              FROM jsonb_to_recordset(p_attendance) AS submitted(
                  student_id uuid,
                  enrollment_id uuid,
                  teacher_status text
              )
          )
    ) THEN
        RAISE EXCEPTION 'Attendance has already been recorded for this teaching group today'
            USING ERRCODE = '23505';
    END IF;

    FOR v_submission IN
        SELECT to_jsonb(submitted)
        FROM jsonb_to_recordset(p_attendance) AS submitted(
            student_id uuid,
            enrollment_id uuid,
            teacher_status text
        )
        WHERE submitted.teacher_status = 'present'
        ORDER BY submitted.enrollment_id
    LOOP
        SELECT COUNT(*)::integer
        INTO v_present_count
        FROM public.attendance AS a
        JOIN public.meetings AS m
            ON m.id = a.meeting_id
        WHERE m.enrollment_id = (v_submission ->> 'enrollment_id')::uuid
          AND a.teacher_status = 'present';

        IF v_present_count >= (
            SELECT e.session_limit
            FROM public.enrollments AS e
            WHERE e.id = (v_submission ->> 'enrollment_id')::uuid
        ) THEN
            RAISE EXCEPTION 'Enrollment session limit has been reached'
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    INSERT INTO public.meetings (
        student_id,
        teacher_id,
        level_id,
        enrollment_id,
        teaching_group_id,
        session_date
    )
    SELECT
        submitted.student_id,
        v_teacher.id,
        v_teaching_group.level_id,
        submitted.enrollment_id,
        v_teaching_group.id,
        v_session_date
    FROM jsonb_to_recordset(p_attendance) AS submitted(
        student_id uuid,
        enrollment_id uuid,
        teacher_status text
    );

    INSERT INTO public.attendance (meeting_id, teacher_status)
    SELECT
        m.id,
        submitted.teacher_status
    FROM jsonb_to_recordset(p_attendance) AS submitted(
        student_id uuid,
        enrollment_id uuid,
        teacher_status text
    )
    JOIN public.meetings AS m
        ON m.teaching_group_id = v_teaching_group.id
       AND m.enrollment_id = submitted.enrollment_id
       AND m.student_id = submitted.student_id
       AND m.session_date = v_session_date
    ;

    RETURN QUERY
    SELECT
        m.id,
        a.id,
        m.student_id,
        m.enrollment_id,
        a.teacher_status,
        m.session_date
    FROM public.attendance AS a
    JOIN public.meetings AS m
        ON m.id = a.meeting_id
    WHERE m.teaching_group_id = v_teaching_group.id
      AND m.session_date = v_session_date
      AND m.enrollment_id IN (
          SELECT submitted.enrollment_id
          FROM jsonb_to_recordset(p_attendance) AS submitted(
              student_id uuid,
              enrollment_id uuid,
              teacher_status text
          )
      )
    ORDER BY m.enrollment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_teacher_attendance_groups()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_my_teacher_group_attendance(uuid, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_teacher_attendance_groups()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_teacher_group_attendance(uuid, jsonb)
TO authenticated;
