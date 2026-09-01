-- Safe, non-destructive admin removal for active operations.
-- Records and relationships are retained for historical reporting.

CREATE POLICY "Admins can view inactive student profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND role = 'student'::public.user_role
        AND status = 'inactive'::public.user_status
    );

CREATE POLICY "Admins can view inactive teacher profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND role = 'teacher'::public.user_role
        AND status = 'inactive'::public.user_status
    );

CREATE FUNCTION public.admin_deactivate_student(p_student_id uuid)
RETURNS public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_student
    FROM public.students
    WHERE id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.profiles
    SET status = 'inactive'::public.user_status,
        updated_at = now()
    WHERE id = v_student.profile_id
      AND role = 'student'::public.user_role
      AND status = 'active'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student profile is not active' USING ERRCODE = '22023';
    END IF;

    UPDATE public.students
    SET is_active = false,
        updated_at = now()
    WHERE id = v_student.id
      AND is_active = true
    RETURNING * INTO v_student;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student is not active' USING ERRCODE = '22023';
    END IF;

    RETURN v_student;
END;
$$;

CREATE FUNCTION public.admin_deactivate_teacher(p_teacher_id uuid)
RETURNS public.teachers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_teacher
    FROM public.teachers
    WHERE id = p_teacher_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher not found' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.teaching_groups
        WHERE teacher_id = v_teacher.id
          AND is_active
    ) THEN
        RAISE EXCEPTION 'Teacher cannot be deactivated while assigned to active teaching groups' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.profiles
    SET status = 'inactive'::public.user_status,
        updated_at = now()
    WHERE id = v_teacher.profile_id
      AND role = 'teacher'::public.user_role
      AND status = 'active'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher profile is not active' USING ERRCODE = '22023';
    END IF;

    UPDATE public.teachers
    SET is_active = false,
        updated_at = now()
    WHERE id = v_teacher.id
      AND is_active = true
    RETURNING * INTO v_teacher;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not active' USING ERRCODE = '22023';
    END IF;

    RETURN v_teacher;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_deactivate_student(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_deactivate_teacher(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_teacher(uuid) TO authenticated;
