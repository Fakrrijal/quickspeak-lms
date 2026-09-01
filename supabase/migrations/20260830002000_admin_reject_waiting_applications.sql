-- Preserve rejected registration applications while removing them from waiting review.
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'rejected';

CREATE OR REPLACE FUNCTION public.admin_reject_waiting_student(p_profile_id uuid)
RETURNS TABLE (profile_id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_application_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile does not exist' USING ERRCODE = 'P0002';
    END IF;

    IF v_profile.role <> 'student'::public.user_role THEN
        RAISE EXCEPTION 'Target profile must have the student role' USING ERRCODE = '22023';
    END IF;

    IF v_profile.status <> 'waiting'::public.user_status THEN
        RAISE EXCEPTION 'Target profile must have waiting status' USING ERRCODE = '22023';
    END IF;

    SELECT id
    INTO v_application_id
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'student'::public.user_role
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiting student registration application does not exist' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.registration_applications
    SET reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = v_application_id;

    UPDATE public.profiles
    SET status = 'rejected'::public.user_status,
        updated_at = now()
    WHERE id = p_profile_id
      AND status = 'waiting'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile status changed before rejection completed' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_profile.id, v_profile.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_waiting_teacher(p_profile_id uuid)
RETURNS TABLE (profile_id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_application_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_profile
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

    SELECT id
    INTO v_application_id
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'teacher'::public.user_role
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiting teacher registration application does not exist' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.registration_applications
    SET reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = v_application_id;

    UPDATE public.profiles
    SET status = 'rejected'::public.user_status,
        updated_at = now()
    WHERE id = p_profile_id
      AND status = 'waiting'::public.user_status;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile status changed before rejection completed' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_profile.id, v_profile.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_waiting_student(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reject_waiting_teacher(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_waiting_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_waiting_teacher(uuid) TO authenticated;
