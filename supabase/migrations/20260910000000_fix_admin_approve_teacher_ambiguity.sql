CREATE OR REPLACE FUNCTION public.admin_approve_teacher(p_profile_id uuid)
RETURNS TABLE(teacher_id uuid, teacher_code text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
        RAISE EXCEPTION 'Teacher email must be verified before approval' USING ERRCODE = '42501';
    END IF;

    SELECT id
    INTO v_application_id
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'teacher'::public.user_role
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiting teacher registration application does not exist' USING ERRCODE = 'P0002';
    END IF;

    SELECT count(*)
    INTO v_supported_level_count
    FROM public.registration_application_supported_levels
    WHERE application_id = v_application_id;

    IF v_supported_level_count = 0 THEN
        RAISE EXCEPTION 'Waiting teacher registration application has no supported levels' USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.teachers
    WHERE profile_id = p_profile_id
    FOR KEY SHARE;

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
    ON CONFLICT ON CONSTRAINT teacher_levels_teacher_id_level_id_key DO NOTHING;

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

    RETURN QUERY
    SELECT v_teacher.id, v_teacher.teacher_code, v_profile.full_name;
END;
$function$;
