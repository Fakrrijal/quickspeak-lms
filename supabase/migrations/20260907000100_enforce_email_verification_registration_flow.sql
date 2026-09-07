-- Enforce email verification as a hard prerequisite for registration approval.
-- The registration application may be created at signup, but unverified users
-- must not appear in admin waiting queues or be approved.

CREATE OR REPLACE FUNCTION public.get_waiting_students()
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    phone text,
    status text,
    registration_date timestamptz,
    starting_level_id uuid,
    starting_level_number integer,
    starting_level_name text,
    class_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.email,
        p.phone,
        p.status::text,
        ra.submitted_at,
        l.id,
        l.level_number,
        l.name,
        ra.student_class_type::text
    FROM public.registration_applications AS ra
    JOIN public.profiles AS p
      ON p.id = ra.profile_id
    JOIN public.levels AS l
      ON l.id = ra.student_starting_level_id
    JOIN auth.users AS u
      ON u.id = p.id
    WHERE ra.role = 'student'::public.user_role
      AND p.role = 'student'::public.user_role
      AND p.status = 'waiting'::public.user_status
      AND u.email_confirmed_at IS NOT NULL
    ORDER BY ra.submitted_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_waiting_teachers()
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    phone text,
    status text,
    registration_date timestamptz,
    class_type text,
    supported_levels jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.email,
        p.phone,
        p.status::text,
        ra.submitted_at,
        ra.teacher_class_type::text,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', l.id,
                    'level_number', l.level_number,
                    'name', l.name
                )
                ORDER BY l.level_number
            ) FILTER (WHERE l.id IS NOT NULL),
            '[]'::jsonb
        )
    FROM public.registration_applications AS ra
    JOIN public.profiles AS p
      ON p.id = ra.profile_id
    JOIN auth.users AS u
      ON u.id = p.id
    LEFT JOIN public.registration_application_supported_levels AS rasl
      ON rasl.application_id = ra.id
    LEFT JOIN public.levels AS l
      ON l.id = rasl.level_id
    WHERE ra.role = 'teacher'::public.user_role
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'waiting'::public.user_status
      AND u.email_confirmed_at IS NOT NULL
    GROUP BY
        p.id,
        p.full_name,
        p.email,
        p.phone,
        p.status,
        ra.submitted_at,
        ra.teacher_class_type
    ORDER BY ra.submitted_at ASC;
END;
$$;

-- Approval itself must enforce the same rule. This protects the database even
-- if an admin client bypasses the waiting-list UI.
CREATE OR REPLACE FUNCTION public.admin_approve_student(
    p_profile_id uuid,
    p_level_id uuid
)
RETURNS public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_level public.levels%ROWTYPE;
    v_existing_student public.students%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_application_level_id uuid;
    v_email_confirmed_at timestamptz;
    v_activation_year integer;
    v_yearly_number integer;
    v_student_code text;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile does not exist';
    END IF;

    IF v_profile.role <> 'student'::public.user_role THEN
        RAISE EXCEPTION 'Target profile must have the student role';
    END IF;

    IF v_profile.status <> 'waiting'::public.user_status THEN
        RAISE EXCEPTION 'Target profile must have waiting status';
    END IF;

    SELECT email_confirmed_at
    INTO v_email_confirmed_at
    FROM auth.users
    WHERE id = p_profile_id;

    IF v_email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Student email must be verified before approval'
            USING ERRCODE = '42501';
    END IF;

    SELECT student_starting_level_id
    INTO v_application_level_id
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'student'::public.user_role
    FOR KEY SHARE;

    IF NOT FOUND OR v_application_level_id IS NULL THEN
        RAISE EXCEPTION 'Waiting student registration application does not have a starting level';
    END IF;

    IF p_level_id IS DISTINCT FROM v_application_level_id THEN
        RAISE EXCEPTION 'Selected level must match the registration starting level';
    END IF;

    SELECT * INTO v_level
    FROM public.levels
    WHERE id = v_application_level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected level does not exist';
    END IF;

    SELECT * INTO v_existing_student
    FROM public.students
    WHERE profile_id = p_profile_id
    FOR KEY SHARE;

    IF FOUND THEN
        RAISE EXCEPTION 'Target profile already has a student record';
    END IF;

    v_activation_year := extract(year from current_date)::integer;

    INSERT INTO public.student_code_year_counters AS counter (activation_year, last_number)
    VALUES (v_activation_year, 1)
    ON CONFLICT (activation_year) DO UPDATE
    SET last_number = counter.last_number + 1
    WHERE counter.last_number < 9999
    RETURNING last_number INTO v_yearly_number;

    IF v_yearly_number IS NULL THEN
        RAISE EXCEPTION 'Student code sequence is exhausted for activation year %', v_activation_year;
    END IF;

    v_student_code := format('QS-%s-%s', v_activation_year, lpad(v_yearly_number::text, 4, '0'));

    INSERT INTO public.students (profile_id, level_id, student_code, is_active)
    VALUES (p_profile_id, v_application_level_id, v_student_code, true)
    RETURNING * INTO v_student;

    UPDATE public.profiles
    SET status = 'active'::public.user_status,
        updated_at = now()
    WHERE id = p_profile_id
      AND status = 'waiting'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile status changed before approval completed';
    END IF;

    RETURN v_student;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_approve_teacher(p_profile_id uuid)
RETURNS TABLE (
    teacher_id uuid,
    teacher_code text,
    full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_teacher public.teachers%ROWTYPE;
    v_application_id uuid;
    v_email_confirmed_at timestamptz;
    v_teacher_number integer;
    v_teacher_code text;
    v_supported_level_count integer;
    v_inserted_level_count integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile does not exist' USING ERRCODE = 'P0002';
    END IF;

    IF v_profile.role <> 'teacher'::public.user_role THEN
        RAISE EXCEPTION 'Target profile must have the teacher role' USING ERRCODE = '22023';
    END IF;

    IF v_profile.status <> 'waiting'::public.user_status THEN
        RAISE EXCEPTION 'Target profile must have waiting status' USING ERRCODE = '22023';
    END IF;

    SELECT email_confirmed_at
    INTO v_email_confirmed_at
    FROM auth.users
    WHERE id = p_profile_id;

    IF v_email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Teacher email must be verified before approval'
            USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_application_id
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'teacher'::public.user_role
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiting teacher registration application does not exist' USING ERRCODE = 'P0002';
    END IF;

    SELECT count(*) INTO v_supported_level_count
    FROM public.registration_application_supported_levels
    WHERE application_id = v_application_id;

    IF v_supported_level_count = 0 THEN
        RAISE EXCEPTION 'Waiting teacher registration application has no supported levels' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.teachers WHERE profile_id = p_profile_id FOR KEY SHARE;
    IF FOUND THEN
        RAISE EXCEPTION 'Target profile already has a teacher record' USING ERRCODE = '23505';
    END IF;

    UPDATE public.teacher_code_counter
    SET last_number = last_number + 1
    WHERE singleton = true
    RETURNING last_number INTO v_teacher_number;

    IF v_teacher_number IS NULL THEN
        RAISE EXCEPTION 'Teacher code counter is unavailable' USING ERRCODE = 'P0001';
    END IF;

    v_teacher_code := format('TCH-%s', lpad(v_teacher_number::text, 4, '0'));

    INSERT INTO public.teachers (profile_id, teacher_code, is_active)
    VALUES (p_profile_id, v_teacher_code, true)
    RETURNING * INTO v_teacher;

    INSERT INTO public.teacher_levels (teacher_id, level_id)
    SELECT v_teacher.id, application_level.level_id
    FROM public.registration_application_supported_levels AS application_level
    WHERE application_level.application_id = v_application_id
    ON CONFLICT (teacher_id, level_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted_level_count = ROW_COUNT;

    IF v_inserted_level_count <> v_supported_level_count THEN
        RAISE EXCEPTION 'Teacher supported levels could not be persisted' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.profiles
    SET status = 'active'::public.user_status,
        updated_at = now()
    WHERE id = p_profile_id
      AND status = 'waiting'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile status changed before approval completed' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_teacher.id, v_teacher.teacher_code, v_profile.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_waiting_students() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_waiting_teachers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_waiting_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waiting_teachers() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_approve_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_student(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_approve_teacher(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_teacher(uuid) TO authenticated;
