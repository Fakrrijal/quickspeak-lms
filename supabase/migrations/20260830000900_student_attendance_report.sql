CREATE FUNCTION public.get_my_student_attendance_report(p_month integer, p_year integer)
RETURNS TABLE (
  meeting_id uuid, enrollment_id uuid, session_date date, student_name text,
  student_code text, teacher_name text, teacher_code text, teaching_group_id uuid,
  teaching_group_name text, level_name text, package_type text,
  teacher_status text, teacher_recorded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT m.id, m.enrollment_id, m.session_date, sp.full_name, s.student_code,
    tp.full_name, t.teacher_code, tg.id, tg.name, l.name, e.package_type,
    a.teacher_status, a.teacher_recorded_at
  FROM public.meetings m
  JOIN public.attendance a ON a.meeting_id = m.id
  JOIN public.students s ON s.id = m.student_id
  JOIN public.profiles sp ON sp.id = s.profile_id
  JOIN public.teachers t ON t.id = m.teacher_id
  JOIN public.profiles tp ON tp.id = t.profile_id
  JOIN public.teaching_groups tg ON tg.id = m.teaching_group_id
  JOIN public.levels l ON l.id = m.level_id
  JOIN public.enrollments e ON e.id = m.enrollment_id
  WHERE s.profile_id = auth.uid()
    AND m.session_date >= make_date(p_year, p_month, 1)
    AND m.session_date < (make_date(p_year, p_month, 1) + interval '1 month')::date
  ORDER BY m.session_date, a.teacher_recorded_at, m.id;
$$;
REVOKE ALL ON FUNCTION public.get_my_student_attendance_report(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_student_attendance_report(integer, integer) TO authenticated;
