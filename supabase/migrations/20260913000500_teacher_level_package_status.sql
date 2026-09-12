-- Teacher-side read model for level/package completion.
-- Feature branch only; not applied to production yet.

CREATE OR REPLACE FUNCTION public.get_my_teacher_student_level_package_status(
    p_student_id uuid,
    p_level_id uuid
)
RETURNS TABLE (
    student_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    level_completed boolean,
    current_enrollment_id uuid,
    current_package_type text,
    current_package_price integer,
    current_package_status text,
    current_package_session_count integer,
    session_limit integer,
    cumulative_level_session_count integer,
    renewal_available boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_level public.levels%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_result public.student_level_results%ROWTYPE;
    v_package_sessions integer := 0;
    v_cumulative_sessions integer := 0;
    v_renewal_available boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT t.*
    INTO v_teacher
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'
      AND p.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.id = p_student_id
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student was not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT l.*
    INTO v_level
    FROM public.levels AS l
    WHERE l.id = p_level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Level was not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        JOIN public.teaching_groups AS tg
            ON tg.id = tgs.teaching_group_id
        WHERE tgs.student_id = p_student_id
          AND tg.teacher_id = v_teacher.id
          AND tg.level_id = p_level_id
          AND tg.is_active
    ) THEN
        RAISE EXCEPTION 'Teacher is not authorized for this student and level'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_result
    FROM public.student_level_results AS slr
    WHERE slr.student_id = p_student_id
      AND slr.level_id = p_level_id
    LIMIT 1;

    SELECT e.*
    INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.student_id = p_student_id
      AND e.level_id = p_level_id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1;

    IF FOUND THEN
        SELECT count(*)::integer
        INTO v_package_sessions
        FROM public.meetings AS m
        WHERE m.enrollment_id = v_enrollment.id;
    END IF;

    SELECT count(*)::integer
    INTO v_cumulative_sessions
    FROM public.meetings AS m
    WHERE m.student_id = p_student_id
      AND m.level_id = p_level_id;

    v_renewal_available := v_result.id IS NULL
        AND v_enrollment.id IS NOT NULL
        AND v_package_sessions >= COALESCE(v_enrollment.session_limit, 8)
        AND v_enrollment.status IN ('active', 'completed');

    RETURN QUERY
    SELECT
        p_student_id,
        p_level_id,
        v_level.name,
        v_level.level_number,
        v_result.id IS NOT NULL,
        v_enrollment.id,
        v_enrollment.package_type,
        v_enrollment.price,
        v_enrollment.status,
        v_package_sessions,
        COALESCE(v_enrollment.session_limit, 8),
        v_cumulative_sessions,
        v_renewal_available;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_teacher_student_level_package_status(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_teacher_student_level_package_status(uuid, uuid)
TO authenticated;
