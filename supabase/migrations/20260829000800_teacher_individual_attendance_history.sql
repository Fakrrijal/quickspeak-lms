-- Individual teacher attendance saves and teacher attendance history fields.
-- The existing per-teaching-group/enrollment/date unique index remains the
-- final duplicate protection and is intentionally not changed here.

CREATE OR REPLACE FUNCTION public.record_my_teacher_group_attendance(
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
    v_present_count integer;
    v_meeting public.meetings%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
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

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher.id
      AND tl.level_id = v_teaching_group.level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not eligible for the teaching group level'
            USING ERRCODE = 'P0001';
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

    IF v_teacher_status = 'present' THEN
        SELECT COUNT(*)::integer
        INTO v_present_count
        FROM public.attendance AS a
        JOIN public.meetings AS m
            ON m.id = a.meeting_id
        WHERE m.enrollment_id = v_enrollment.id
          AND a.teacher_status = 'present';

        IF v_present_count >= v_enrollment.session_limit THEN
            RAISE EXCEPTION 'Enrollment session limit has been reached'
                USING ERRCODE = 'P0001';
        END IF;
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

-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to change a function's
-- OUT columns. Recreate this same-signature read model to add display fields.
DROP FUNCTION public.get_my_teacher_attendance(text, date);

CREATE FUNCTION public.get_my_teacher_attendance(
    p_period text,
    p_reference_date date
)
RETURNS TABLE (
    meeting_id uuid,
    attendance_id uuid,
    enrollment_id uuid,
    session_number bigint,
    session_date date,
    student_display_name text,
    level_name text,
    teaching_group_name text,
    package_type text,
    teacher_status text,
    teacher_recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher_id uuid;
    v_start_date date;
    v_end_date date;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_period IS NULL OR p_period NOT IN ('day', 'month', 'year') THEN
        RAISE EXCEPTION 'Period must be day, month, or year'
            USING ERRCODE = '22023';
    END IF;

    IF p_reference_date IS NULL THEN
        RAISE EXCEPTION 'Reference date is required'
            USING ERRCODE = '22023';
    END IF;

    SELECT t.id
    INTO v_teacher_id
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

    IF p_period = 'day' THEN
        v_start_date := p_reference_date;
        v_end_date := p_reference_date + 1;
    ELSIF p_period = 'month' THEN
        v_start_date := pg_catalog.date_trunc('month', p_reference_date)::date;
        v_end_date := (v_start_date + INTERVAL '1 month')::date;
    ELSE
        v_start_date := pg_catalog.date_trunc('year', p_reference_date)::date;
        v_end_date := (v_start_date + INTERVAL '1 year')::date;
    END IF;

    RETURN QUERY
    WITH numbered_meetings AS (
        SELECT
            m.id AS meeting_id,
            a.id AS attendance_id,
            m.enrollment_id,
            ROW_NUMBER() OVER (
                PARTITION BY m.enrollment_id
                ORDER BY m.session_date, m.created_at, m.id
            ) AS session_number,
            m.session_date,
            sp.full_name AS student_display_name,
            l.name AS level_name,
            tg.name AS teaching_group_name,
            e.package_type,
            a.teacher_status,
            a.teacher_recorded_at
        FROM public.meetings AS m
        JOIN public.students AS s
            ON s.id = m.student_id
        JOIN public.profiles AS sp
            ON sp.id = s.profile_id
        JOIN public.levels AS l
            ON l.id = m.level_id
        JOIN public.teaching_groups AS tg
            ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e
            ON e.id = m.enrollment_id
        LEFT JOIN public.attendance AS a
            ON a.meeting_id = m.id
        WHERE m.teacher_id = v_teacher_id
    )
    SELECT
        nm.meeting_id,
        nm.attendance_id,
        nm.enrollment_id,
        nm.session_number,
        nm.session_date,
        nm.student_display_name,
        nm.level_name,
        nm.teaching_group_name,
        nm.package_type,
        nm.teacher_status,
        nm.teacher_recorded_at
    FROM numbered_meetings AS nm
    WHERE nm.session_date >= v_start_date
      AND nm.session_date < v_end_date
    ORDER BY nm.session_date DESC, nm.meeting_id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_teacher_group_attendance(uuid, jsonb)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_teacher_attendance(text, date)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_my_teacher_group_attendance(uuid, jsonb)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_attendance(text, date)
TO authenticated;
