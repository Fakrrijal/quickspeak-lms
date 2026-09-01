-- Controlled waiting-teacher read and approval workflow.
-- Teacher codes are generated only by the approval RPC.

CREATE TABLE public.teacher_code_counter (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

-- Establish the counter baseline without changing existing teachers or codes.
INSERT INTO public.teacher_code_counter (singleton, last_number)
SELECT
    true,
    COALESCE(MAX((substring(teacher_code FROM '^TCH-([0-9]+)$'))::integer), 0)
FROM public.teachers
WHERE teacher_code ~ '^TCH-[0-9]+$'
ON CONFLICT (singleton) DO NOTHING;

REVOKE ALL ON TABLE public.teacher_code_counter
FROM PUBLIC, anon, authenticated;

CREATE POLICY "Admins can view waiting teacher profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND role = 'teacher'::public.user_role
        AND status = 'waiting'::public.user_status
    );

CREATE FUNCTION public.admin_approve_teacher(p_profile_id uuid)
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
    v_teacher_number integer;
    v_teacher_code text;
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
$$;

REVOKE ALL ON FUNCTION public.admin_approve_teacher(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_teacher(uuid)
TO authenticated;
