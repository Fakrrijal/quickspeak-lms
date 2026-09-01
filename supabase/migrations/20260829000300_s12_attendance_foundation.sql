-- S12 Attendance Foundation
-- Attendance is tied to an existing meeting. Teacher attendance is immutable;
-- student confirmation is a one-time response and does not affect quota.

CREATE TABLE public.attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL
        REFERENCES public.meetings(id)
        ON DELETE RESTRICT
        UNIQUE,
    teacher_status text NOT NULL
        CHECK (teacher_status IN ('present', 'absent')),
    teacher_recorded_at timestamptz NOT NULL DEFAULT now(),
    student_confirmation text NULL
        CHECK (student_confirmation IN ('confirmed', 'disputed')),
    student_responded_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attendance_student_confirmation_response_check
        CHECK (
            (student_confirmation IS NULL AND student_responded_at IS NULL)
            OR
            (student_confirmation IS NOT NULL AND student_responded_at IS NOT NULL)
        )
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own attendance"
    ON public.attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.meetings AS m
            JOIN public.students AS s
                ON s.id = m.student_id
            WHERE m.id = attendance.meeting_id
              AND s.profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can view own attendance"
    ON public.attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.meetings AS m
            JOIN public.teachers AS t
                ON t.id = m.teacher_id
            WHERE m.id = attendance.meeting_id
              AND t.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view attendance"
    ON public.attendance
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_teacher_attendance(
    p_meeting_id uuid,
    p_teacher_status text
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_meeting public.meetings%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_present_count integer;
    v_attendance public.attendance%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_meeting_id IS NULL OR p_teacher_status IS NULL THEN
        RAISE EXCEPTION 'Meeting and teacher attendance status are required'
            USING ERRCODE = '22023';
    END IF;

    IF p_teacher_status NOT IN ('present', 'absent') THEN
        RAISE EXCEPTION 'Teacher attendance status must be present or absent'
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

    SELECT m.*
    INTO v_meeting
    FROM public.meetings AS m
    WHERE m.id = p_meeting_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meeting not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT e.*
    INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.id = v_meeting.enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meeting enrollment not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_meeting.teacher_id <> v_teacher.id THEN
        RAISE EXCEPTION 'Meeting is not owned by the authenticated teacher'
            USING ERRCODE = '42501';
    END IF;

    IF v_enrollment.status <> 'active' THEN
        RAISE EXCEPTION 'Meeting enrollment is not active'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_meeting.student_id <> v_enrollment.student_id
       OR v_meeting.level_id <> v_enrollment.level_id THEN
        RAISE EXCEPTION 'Meeting does not match its enrollment relationship'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    WHERE s.id = v_meeting.student_id
      AND s.is_active
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meeting student is not active'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT tg.*
    INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = v_meeting.teaching_group_id
      AND tg.is_active
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meeting teaching group is not active'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.teacher_id <> v_meeting.teacher_id
       OR v_teaching_group.level_id <> v_meeting.level_id
       OR v_teaching_group.group_type <> v_enrollment.package_type THEN
        RAISE EXCEPTION 'Meeting teaching group does not match its operational relationship'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = v_teaching_group.id
      AND tgs.student_id = v_student.id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Meeting student is not assigned to the teaching group'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher.id
      AND tl.level_id = v_meeting.level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not eligible for the meeting level'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.attendance AS a
    WHERE a.meeting_id = v_meeting.id
    FOR KEY SHARE;

    IF FOUND THEN
        RAISE EXCEPTION 'Attendance has already been recorded for this meeting'
            USING ERRCODE = '23505';
    END IF;

    IF p_teacher_status = 'present' THEN
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

    INSERT INTO public.attendance (meeting_id, teacher_status)
    VALUES (v_meeting.id, p_teacher_status)
    RETURNING * INTO v_attendance;

    RETURN v_attendance;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_student_attendance(
    p_attendance_id uuid,
    p_student_confirmation text
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_attendance public.attendance%ROWTYPE;
    v_meeting public.meetings%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_attendance_id IS NULL OR p_student_confirmation IS NULL THEN
        RAISE EXCEPTION 'Attendance and student confirmation are required'
            USING ERRCODE = '22023';
    END IF;

    IF p_student_confirmation NOT IN ('confirmed', 'disputed') THEN
        RAISE EXCEPTION 'Student confirmation must be confirmed or disputed'
            USING ERRCODE = '22023';
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
    FOR KEY SHARE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT a.*
    INTO v_attendance
    FROM public.attendance AS a
    WHERE a.id = p_attendance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT m.*
    INTO v_meeting
    FROM public.meetings AS m
    WHERE m.id = v_attendance.meeting_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attendance meeting not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_meeting.student_id <> v_student.id THEN
        RAISE EXCEPTION 'Attendance does not belong to the authenticated student'
            USING ERRCODE = '42501';
    END IF;

    IF v_attendance.student_confirmation IS NOT NULL THEN
        RAISE EXCEPTION 'Student attendance response has already been recorded'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.attendance AS a
    SET student_confirmation = p_student_confirmation,
        student_responded_at = now()
    WHERE a.id = v_attendance.id
    RETURNING * INTO v_attendance;

    RETURN v_attendance;
END;
$$;

REVOKE ALL ON TABLE public.attendance FROM PUBLIC;
REVOKE ALL ON TABLE public.attendance FROM anon, authenticated;
GRANT SELECT ON TABLE public.attendance TO authenticated;

REVOKE ALL ON FUNCTION public.record_teacher_attendance(uuid, text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_student_attendance(uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_teacher_attendance(uuid, text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_student_attendance(uuid, text)
TO authenticated;
