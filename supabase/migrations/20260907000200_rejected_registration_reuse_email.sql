-- Rejected registrations are archived, then the Auth identity and its
-- pre-approval records are removed so the applicant can register again
-- with the same email address.
--
-- This intentionally preserves an audit/history snapshot without keeping a
-- live auth.users/profile row that would block Supabase signup with the same
-- email.

CREATE TABLE IF NOT EXISTS public.registration_rejection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_profile_id UUID NOT NULL,
    original_application_id UUID NOT NULL,
    role public.user_role NOT NULL CHECK (role IN ('student', 'teacher')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    application_snapshot JSONB NOT NULL,
    rejected_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_rejection_history_email
    ON public.registration_rejection_history(lower(email));
CREATE INDEX IF NOT EXISTS idx_registration_rejection_history_rejected_at
    ON public.registration_rejection_history(rejected_at DESC);

ALTER TABLE public.registration_rejection_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view registration rejection history"
    ON public.registration_rejection_history;
CREATE POLICY "Admins can view registration rejection history"
    ON public.registration_rejection_history
    FOR SELECT TO authenticated
    USING (public.is_admin());

REVOKE ALL ON public.registration_rejection_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.registration_rejection_history TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_waiting_student(p_profile_id uuid)
RETURNS TABLE (profile_id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_application public.registration_applications%ROWTYPE;
    v_supported_levels JSONB;
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
    IF v_profile.role <> 'student'::public.user_role THEN
        RAISE EXCEPTION 'Target profile must have the student role' USING ERRCODE = '22023';
    END IF;
    IF v_profile.status <> 'waiting'::public.user_status THEN
        RAISE EXCEPTION 'Target profile must have waiting status' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_application
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'student'::public.user_role
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiting student registration application does not exist' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.registration_rejection_history (
        original_profile_id,
        original_application_id,
        role,
        full_name,
        email,
        phone,
        application_snapshot,
        rejected_by
    )
    VALUES (
        v_profile.id,
        v_application.id,
        v_profile.role,
        v_profile.full_name,
        v_profile.email,
        v_profile.phone,
        jsonb_build_object(
            'student_starting_level_id', v_application.student_starting_level_id,
            'student_class_type', v_application.student_class_type,
            'submitted_at', v_application.submitted_at,
            'created_at', v_application.created_at,
            'updated_at', v_application.updated_at
        ),
        auth.uid()
    );

    -- Delete audit rows first because their FK intentionally uses RESTRICT.
    DELETE FROM public.registration_application_audits
    WHERE application_id = v_application.id;

    -- Supported levels cascade from the application.
    DELETE FROM public.registration_applications
    WHERE id = v_application.id;

    -- The profile FK to auth.users is ON DELETE CASCADE. Removing the Auth
    -- identity therefore removes the pre-approval profile as well.
    DELETE FROM auth.users
    WHERE id = v_profile.id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auth user could not be removed' USING ERRCODE = 'P0001';
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
    v_application public.registration_applications%ROWTYPE;
    v_supported_levels JSONB;
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

    SELECT * INTO v_application
    FROM public.registration_applications
    WHERE profile_id = p_profile_id
      AND role = 'teacher'::public.user_role
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiting teacher registration application does not exist' USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'level_id', ral.level_id,
        'level_number', l.level_number,
        'name', l.name
    ) ORDER BY l.level_number), '[]'::jsonb)
    INTO v_supported_levels
    FROM public.registration_application_supported_levels ral
    JOIN public.levels l ON l.id = ral.level_id
    WHERE ral.application_id = v_application.id;

    INSERT INTO public.registration_rejection_history (
        original_profile_id,
        original_application_id,
        role,
        full_name,
        email,
        phone,
        application_snapshot,
        rejected_by
    )
    VALUES (
        v_profile.id,
        v_application.id,
        v_profile.role,
        v_profile.full_name,
        v_profile.email,
        v_profile.phone,
        jsonb_build_object(
            'teacher_class_type', v_application.teacher_class_type,
            'supported_levels', v_supported_levels,
            'submitted_at', v_application.submitted_at,
            'created_at', v_application.created_at,
            'updated_at', v_application.updated_at
        ),
        auth.uid()
    );

    DELETE FROM public.registration_application_audits
    WHERE application_id = v_application.id;

    DELETE FROM public.registration_applications
    WHERE id = v_application.id;

    DELETE FROM auth.users
    WHERE id = v_profile.id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auth user could not be removed' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_profile.id, v_profile.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_waiting_student(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reject_waiting_teacher(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_waiting_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_waiting_teacher(uuid) TO authenticated;
