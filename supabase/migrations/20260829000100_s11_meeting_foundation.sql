-- S11 Meeting Foundation
-- Records actual learning sessions only; it does not implement scheduling or attendance.

CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL
        REFERENCES public.students(id)
        ON DELETE RESTRICT,
    teacher_id UUID NOT NULL
        REFERENCES public.teachers(id)
        ON DELETE RESTRICT,
    level_id UUID NOT NULL
        REFERENCES public.levels(id)
        ON DELETE RESTRICT,
    enrollment_id UUID NOT NULL
        REFERENCES public.enrollments(id)
        ON DELETE RESTRICT,
    teaching_group_id UUID NOT NULL
        REFERENCES public.teaching_groups(id)
        ON DELETE RESTRICT,
    session_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meetings_student_session_date
    ON public.meetings(student_id, session_date DESC);

CREATE INDEX idx_meetings_teacher_session_date
    ON public.meetings(teacher_id, session_date DESC);

CREATE INDEX idx_meetings_teaching_group_session_date
    ON public.meetings(teaching_group_id, session_date DESC);

CREATE INDEX idx_meetings_enrollment_session_date
    ON public.meetings(enrollment_id, session_date DESC);

CREATE INDEX idx_meetings_session_date
    ON public.meetings(session_date DESC);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own meetings"
    ON public.meetings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.students AS s
            WHERE s.id = meetings.student_id
              AND s.profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can view own meetings"
    ON public.meetings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.teachers AS t
            WHERE t.id = meetings.teacher_id
              AND t.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view meetings"
    ON public.meetings
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_meeting(
    p_student_id uuid,
    p_enrollment_id uuid,
    p_teaching_group_id uuid,
    p_session_date date
)
RETURNS public.meetings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_meeting public.meetings%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_student_id IS NULL
       OR p_enrollment_id IS NULL
       OR p_teaching_group_id IS NULL
       OR p_session_date IS NULL THEN
        RAISE EXCEPTION 'Student, enrollment, teaching group, and session date are required'
            USING ERRCODE = '22023';
    END IF;

    IF p_session_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Meeting session date cannot be in the future'
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

    SELECT e.*
    INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.id = p_enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_enrollment.student_id <> p_student_id THEN
        RAISE EXCEPTION 'Enrollment does not belong to the supplied student'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.status <> 'active' THEN
        RAISE EXCEPTION 'Enrollment is not active'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    WHERE s.id = p_student_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_student.is_active THEN
        RAISE EXCEPTION 'Student is not active'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT tg.*
    INTO v_teaching_group
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_teaching_group.is_active THEN
        RAISE EXCEPTION 'Teaching group is not active'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.level_id <> v_enrollment.level_id THEN
        RAISE EXCEPTION 'Teaching group level does not match enrollment level'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.group_type <> v_enrollment.package_type THEN
        RAISE EXCEPTION 'Teaching group type does not match enrollment package'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_teaching_group.teacher_id <> v_teacher.id THEN
        RAISE EXCEPTION 'Teaching group is not assigned to the authenticated teacher'
            USING ERRCODE = '42501';
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

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher.id
      AND tl.level_id = v_enrollment.level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not eligible for the enrollment level'
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
        v_enrollment.level_id,
        v_enrollment.id,
        v_teaching_group.id,
        p_session_date
    )
    RETURNING * INTO v_meeting;

    RETURN v_meeting;
END;
$$;

REVOKE ALL ON TABLE public.meetings FROM PUBLIC;
GRANT SELECT ON TABLE public.meetings TO authenticated;

REVOKE ALL ON FUNCTION public.record_meeting(uuid, uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_meeting(uuid, uuid, uuid, date) TO authenticated;
