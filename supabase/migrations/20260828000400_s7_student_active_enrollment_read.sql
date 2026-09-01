-- S7.1 Secure Student Active-Enrollment Read Path
-- Returns only the authenticated active student's active enrollment relationships.

CREATE OR REPLACE FUNCTION public.get_my_active_enrollments()
RETURNS TABLE (
    enrollment_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    package_type text,
    enrollment_status text,
    created_at timestamptz,
    teaching_group_id uuid,
    teaching_group_name text,
    teacher_id uuid,
    teacher_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.id
    INTO v_student_id
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND p.role = 'student'::public.user_role
      AND p.status = 'active'::public.user_status
      AND s.is_active;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student record not found'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.level_id,
        l.name,
        l.level_number,
        e.package_type,
        e.status,
        e.created_at,
        tg.id,
        tg.name,
        t.id,
        t.teacher_code
    FROM public.enrollments AS e
    JOIN public.levels AS l
        ON l.id = e.level_id
    JOIN public.teaching_group_students AS tgs
        ON tgs.student_id = e.student_id
    JOIN public.teaching_groups AS tg
        ON tg.id = tgs.teaching_group_id
       AND tg.level_id = e.level_id
       AND tg.group_type = e.package_type
       AND tg.is_active
    JOIN public.teachers AS t
        ON t.id = tg.teacher_id
       AND t.is_active
    WHERE e.student_id = v_student_id
      AND e.status = 'active'
    ORDER BY e.created_at DESC, e.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_enrollments() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_active_enrollments() TO authenticated;
