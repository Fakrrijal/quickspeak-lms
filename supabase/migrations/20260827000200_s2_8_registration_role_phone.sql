CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_full_name TEXT;
    v_email_local TEXT;
    v_phone TEXT;
    v_role public.user_role;
BEGIN
    -- Full name from signup metadata, with safe fallback.
    v_full_name := NULLIF(
        btrim(NEW.raw_user_meta_data ->> 'full_name'),
        ''
    );

    IF v_full_name IS NULL THEN
        v_email_local := split_part(NEW.email, '@', 1);
        v_full_name := COALESCE(v_email_local, 'User');
    END IF;

    -- Phone from signup metadata.
    v_phone := NULLIF(
        btrim(NEW.raw_user_meta_data ->> 'phone'),
        ''
    );

    -- Public registration is allowed only for Student or Teacher.
    -- Admin must never be created through public registration.
    v_role := CASE
        WHEN NEW.raw_user_meta_data ->> 'role' = 'teacher'
            THEN 'teacher'::public.user_role
        ELSE 'student'::public.user_role
    END;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        role,
        status
    )
    VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        v_phone,
        v_role,
        'waiting'::public.user_status
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;