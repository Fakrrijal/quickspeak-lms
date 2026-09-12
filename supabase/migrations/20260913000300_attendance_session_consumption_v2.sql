-- Attendance session consumption v2.
--
-- Business rule:
-- * Every recorded meeting consumes exactly one package session.
-- * Present and absent both consume one session.
-- * The eighth meeting completes the current package.
-- * A completed package cannot receive another meeting until a new
--   enrollment is activated (renewal or next level).
--
-- These are versioned functions so the existing production attendance
-- functions remain untouched until the feature is fully tested.

CREATE OR REPLACE FUNCTION public.record_my_teacher_group_attendance_v2(
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
    v_submission jsonb;
    v_session_date date := CURRENT_DATE;
    v_existing_session_count integer;
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

    -- Lock active enrollments for the group in a stable order so two
    -- concurrent attendance saves cannot consume the same session twice.
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
       AND sp.status = 'active'
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
               AND sp.status = 'active'
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
               AND sp.status = 'active'
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

    -- Every row consumes one meeting/session, regardless of present/absent.
    FOR v_submission IN
        SELECT to_jsonb(submitted)
        FROM jsonb_to_recordset(p_attendance) AS submitted(
            student_id uuid,
            enrollment_id uuid,
            teacher_status text
        )
        ORDER BY submitted.enrollment_id
    LOOP
        SELECT COUNT(*)::integer
        INTO v_existing_session_count
        FROM public.meetings AS m
        WHERE m.enrollment_id = (v_submission ->> 'enrollment_id')::uuid;

        IF v_existing_session_count >= (
            SELECT e.session_limit
            FROM public.enrollments AS e
            WHERE e.id = (v_submission ->> 'enrollment_id')::uuid
              AND e.status = 'active'
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
       AND m.session_date = v_session_date;

    -- The eighth meeting closes the package. Absent rows are intentionally
    -- included because the meeting itself is the consumed session.
    UPDATE public.enrollments AS e
    SET
        status = 'completed',
        completed_at = COALESCE(e.completed_at, now()),
        updated_at = now()
    WHERE e.id IN (
        SELECT submitted.enrollment_id
        FROM jsonb_to_recordset(p_attendance) AS submitted(
            student_id uuid,
            enrollment_id uuid,
            teacher_status text
        )
    )
      AND e.status = 'active'
      AND (
          SELECT COUNT(*)
          FROM public.meetings AS m
          WHERE m.enrollment_id = e.id
      ) >= e.session_limit;

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

CREATE OR REPLACE FUNCTION public.record_my_teacher_attendance_v2(
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
    v_enrollment public.enrollments%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_student_id uuid;
    v_enrollment_id uuid;
    v_teacher_status text;
    v_meeting public.meetings%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
    v_session_count integer;
    v_session_date date := CURRENT_DATE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_teaching_group_id IS NULL
       OR p_attendance IS NULL
       OR jsonb_typeof(p_attendance) <> 'array'
       OR jsonb_array_length(p_attendance) <> 1 THEN
        RAISE EXCEPTION 'Attendance for exactly one student is required'
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

    SELECT submitted.student_id, submitted.enrollment_id, submitted.teacher_status
    INTO v_student_id, v_enrollment_id, v_teacher_status
    FROM jsonb_to_recordset(p_attendance) AS submitted(
        student_id uuid,
        enrollment_id uuid,
        teacher_status text
    );

    IF v_student_id IS NULL
       OR v_enrollment_id IS NULL
       OR v_teacher_status NOT IN ('present', 'absent') THEN
        RAISE EXCEPTION 'Attendance must identify one student, enrollment, and present or absent status'
            USING ERRCODE = '22023';
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

    SELECT e.*
    INTO v_enrollment
    FROM public.enrollments AS e
    JOIN public.enrollment_teaching_group_assignments AS etga
        ON etga.enrollment_id = e.id
       AND etga.teaching_group_id = v_teaching_group.id
    WHERE e.id = v_enrollment_id
      AND e.student_id = v_student_id
      AND e.status = 'active'
      AND e.level_id = v_teaching_group.level_id
      AND e.package_type = v_teaching_group.group_type
    FOR UPDATE OF e;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment is not an active compatible assignment for this teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
       AND p.role = 'student'::public.user_role
       AND p.status = 'active'::public.user_status
    WHERE s.id = v_student_id
      AND s.is_active
    FOR KEY SHARE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment student is not active'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = v_teaching_group.id
      AND tgs.student_id = v_student.id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student is not assigned to the teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.meetings AS m
        WHERE m.teaching_group_id = v_teaching_group.id
          AND m.enrollment_id = v_enrollment.id
          AND m.session_date = v_session_date
    ) THEN
        RAISE EXCEPTION 'Attendance has already been recorded for this student today'
            USING ERRCODE = '23505';
    END IF;

    SELECT COUNT(*)::integer
    INTO v_session_count
    FROM public.meetings AS m
    WHERE m.enrollment_id = v_enrollment.id;

    IF v_session_count >= v_enrollment.session_limit THEN
        RAISE EXCEPTION 'Enrollment session limit has been reached'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.meetings (
        student_id,
        teacher_id,
        level_id,
        enrollment_id,
        teaching_group_id,
        session_date
    )
    VALUES (
        v_student.id,
        v_teacher.id,
        v_teaching_group.level_id,
        v_enrollment.id,
        v_teaching_group.id,
        v_session_date
    )
    RETURNING * INTO v_meeting;

    INSERT INTO public.attendance (meeting_id, teacher_status)
    VALUES (v_meeting.id, v_teacher_status)
    RETURNING * INTO v_attendance;

    IF (
        SELECT COUNT(*)
        FROM public.meetings AS m
        WHERE m.enrollment_id = v_enrollment.id
    ) >= v_enrollment.session_limit THEN
        UPDATE public.enrollments AS e
        SET
            status = 'completed',
            completed_at = COALESCE(e.completed_at, now()),
            updated_at = now()
        WHERE e.id = v_enrollment.id
          AND e.status = 'active';
    END IF;

    RETURN QUERY
    SELECT
        v_meeting.id,
        v_attendance.id,
        v_meeting.student_id,
        v_meeting.enrollment_id,
        v_attendance.teacher_status,
        v_meeting.session_date;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_teacher_group_attendance_v2(uuid, jsonb)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_my_teacher_attendance_v2(uuid, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_my_teacher_group_attendance_v2(uuid, jsonb)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_teacher_attendance_v2(uuid, jsonb)
TO authenticated;
