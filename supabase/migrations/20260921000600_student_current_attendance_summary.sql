-- Student current attendance read model.
--
-- Scope:
-- * Student portal read-only summary only.
-- * Uses the currently active enrollment for the student's current level.
-- * Counts every recorded meeting as one consumed session, including absent.
-- * Preserves the existing historical attendance RPC unchanged.
-- * Does not modify teacher attendance, renewal, or next-level state machines.

CREATE OR REPLACE FUNCTION public.get_my_current_student_attendance_summary()
RETURNS TABLE (
    student_id uuid,
    current_enrollment_id uuid,
    current_level_id uuid,
    current_level_name text,
    current_level_number integer,
    package_type text,
    session_limit integer,
    total_sessions integer,
    present_sessions integer,
    absent_sessions integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT
        s.id,
        e.id,
        l.id,
        l.name,
        l.level_number,
        e.package_type,
        COALESCE(e.session_limit, 8),
        COUNT(m.id)::integer,
        COUNT(*) FILTER (WHERE a.teacher_status = 'present')::integer,
        COUNT(*) FILTER (WHERE a.teacher_status = 'absent')::integer
    FROM public.students AS s
    JOIN public.profiles AS p
      ON p.id = s.profile_id
     AND p.role = 'student'::public.user_role
     AND p.status = 'active'::public.user_status
    JOIN public.enrollments AS e
      ON e.student_id = s.id
     AND e.level_id = s.level_id
     AND e.status = 'active'
    JOIN public.levels AS l
      ON l.id = e.level_id
    LEFT JOIN public.meetings AS m
      ON m.enrollment_id = e.id
    LEFT JOIN public.attendance AS a
      ON a.meeting_id = m.id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
    GROUP BY
        s.id,
        e.id,
        l.id,
        l.name,
        l.level_number,
        e.package_type,
        e.session_limit
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_current_student_attendance_summary()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_current_student_attendance_summary()
TO authenticated;
