-- Tighten RPC execution permissions for the level-completion feature.
-- The functions are SECURITY DEFINER and perform their own role checks;
-- keep them unavailable to anon/Public and callable by authenticated users only.

REVOKE ALL ON FUNCTION public.complete_student_level(uuid, uuid, integer, integer, integer, integer, integer, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_level(uuid, uuid, integer, integer, integer, integer, integer, text)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_teacher_level_result(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_level_result(uuid, uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_student_level_results(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_student_level_results(uuid)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_student_level_package_status()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_student_level_package_status()
TO authenticated;

REVOKE ALL ON FUNCTION public.request_current_level_package_renewal()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_current_level_package_renewal()
TO authenticated;

REVOKE ALL ON FUNCTION public.request_next_level_enrollment(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_next_level_enrollment(text)
TO authenticated;

REVOKE ALL ON FUNCTION public.record_my_teacher_group_attendance_v2(uuid, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_teacher_group_attendance_v2(uuid, jsonb)
TO authenticated;

REVOKE ALL ON FUNCTION public.record_my_teacher_attendance_v2(uuid, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_my_teacher_attendance_v2(uuid, jsonb)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_teacher_student_level_package_status(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_student_level_package_status(uuid, uuid)
TO authenticated;
