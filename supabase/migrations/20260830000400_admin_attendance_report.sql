-- Read-only admin attendance report. Historical identity is resolved from the
-- meeting relationships, never from a student's current group assignment.

CREATE FUNCTION public.admin_get_attendance_report(
    p_month integer,
    p_year integer,
    p_student_id uuid DEFAULT NULL,
    p_teacher_id uuid DEFAULT NULL,
    p_teaching_group_id uuid DEFAULT NULL,
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    meeting_id uuid,
    session_date date,
    student_id uuid,
    student_name text,
    student_code text,
    teacher_id uuid,
    teacher_name text,
    teacher_code text,
    teaching_group_id uuid,
    teaching_group_name text,
    level_name text,
    package_type text,
    teacher_status text,
    teacher_recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_period_start date;
    v_period_end date;
    v_search text := NULLIF(pg_catalog.btrim(p_search), '');
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active admin access is required' USING ERRCODE = '42501';
    END IF;

    IF p_month NOT BETWEEN 1 AND 12 OR p_year NOT BETWEEN 2000 AND 9999 THEN
        RAISE EXCEPTION 'A valid month and year are required' USING ERRCODE = '22023';
    END IF;

    v_period_start := pg_catalog.make_date(p_year, p_month, 1);
    v_period_end := (v_period_start + INTERVAL '1 month')::date;

    RETURN QUERY
    SELECT
        m.id,
        m.session_date,
        s.id,
        student_profile.full_name,
        s.student_code,
        t.id,
        teacher_profile.full_name,
        t.teacher_code,
        tg.id,
        tg.name,
        l.name,
        e.package_type,
        a.teacher_status,
        a.teacher_recorded_at
    FROM public.meetings AS m
    JOIN public.attendance AS a ON a.meeting_id = m.id
    JOIN public.students AS s ON s.id = m.student_id
    JOIN public.profiles AS student_profile ON student_profile.id = s.profile_id
    JOIN public.teachers AS t ON t.id = m.teacher_id
    JOIN public.profiles AS teacher_profile ON teacher_profile.id = t.profile_id
    JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
    JOIN public.levels AS l ON l.id = m.level_id
    JOIN public.enrollments AS e ON e.id = m.enrollment_id
    WHERE m.session_date >= v_period_start
      AND m.session_date < v_period_end
      AND (p_student_id IS NULL OR m.student_id = p_student_id)
      AND (p_teacher_id IS NULL OR m.teacher_id = p_teacher_id)
      AND (p_teaching_group_id IS NULL OR m.teaching_group_id = p_teaching_group_id)
      AND (
        v_search IS NULL
        OR student_profile.full_name ILIKE '%' || v_search || '%'
        OR s.student_code ILIKE '%' || v_search || '%'
        OR teacher_profile.full_name ILIKE '%' || v_search || '%'
        OR t.teacher_code ILIKE '%' || v_search || '%'
        OR tg.name ILIKE '%' || v_search || '%'
      )
    ORDER BY m.session_date DESC, a.teacher_recorded_at DESC, m.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_attendance_report(integer, integer, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_attendance_report(integer, integer, uuid, uuid, uuid, text) TO authenticated;
