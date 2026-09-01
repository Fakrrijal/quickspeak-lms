-- S13.1 Teacher Attendance Read Model

CREATE FUNCTION public.get_my_teacher_attendance(
    p_period text,
    p_reference_date date
)
RETURNS TABLE (
    meeting_id uuid,
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
    SELECT
        m.id,
        m.session_date,
        sp.full_name,
        l.name,
        tg.name,
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
      AND m.session_date >= v_start_date
      AND m.session_date < v_end_date
    ORDER BY m.session_date DESC, m.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_teacher_attendance(text, date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_attendance(text, date)
TO authenticated;
