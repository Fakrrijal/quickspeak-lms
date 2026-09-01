-- Create the pre-approval registration application in the same transaction
-- that creates its Auth user and profile. Email-confirmed signups have no
-- browser session at this point, so this must not depend on auth.uid() from a
-- subsequent client RPC.
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
    v_student_starting_level_id UUID;
    v_student_class_type TEXT;
    v_teacher_class_type TEXT;
    v_supported_level_ids UUID[];
    v_application public.registration_applications%ROWTYPE;
BEGIN
    v_full_name := NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), '');
    IF v_full_name IS NULL THEN
        v_email_local := split_part(NEW.email, '@', 1);
        v_full_name := COALESCE(v_email_local, 'User');
    END IF;

    v_phone := NULLIF(btrim(NEW.raw_user_meta_data ->> 'phone'), '');
    v_role := CASE
        WHEN NEW.raw_user_meta_data ->> 'role' = 'teacher' THEN 'teacher'::public.user_role
        ELSE 'student'::public.user_role
    END;

    INSERT INTO public.profiles (id, full_name, email, phone, role, status)
    VALUES (NEW.id, v_full_name, NEW.email, v_phone, v_role, 'waiting'::public.user_status)
    ON CONFLICT (id) DO NOTHING;

    IF v_role = 'student'::public.user_role THEN
        v_student_starting_level_id := NULLIF(
            NEW.raw_user_meta_data ->> 'student_starting_level_id', ''
        )::UUID;
        v_student_class_type := NEW.raw_user_meta_data ->> 'student_class_type';

        IF v_student_starting_level_id IS NULL THEN
            RAISE EXCEPTION 'Starting level is required for student registration';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.levels WHERE id = v_student_starting_level_id) THEN
            RAISE EXCEPTION 'Invalid starting level';
        END IF;
        IF v_student_class_type NOT IN ('private', 'semi_private') THEN
            RAISE EXCEPTION 'Invalid class type for student registration';
        END IF;

        INSERT INTO public.registration_applications (
            profile_id, role, student_starting_level_id, student_class_type
        )
        VALUES (NEW.id, v_role, v_student_starting_level_id, v_student_class_type)
        RETURNING * INTO v_application;
    ELSE
        v_teacher_class_type := NEW.raw_user_meta_data ->> 'teacher_class_type';
        SELECT COALESCE(array_agg(value::UUID), ARRAY[]::UUID[])
        INTO v_supported_level_ids
        FROM jsonb_array_elements_text(
            COALESCE(NEW.raw_user_meta_data -> 'supported_level_ids', '[]'::JSONB)
        ) AS supported_level(value);

        IF v_teacher_class_type NOT IN ('private', 'semi_private') THEN
            RAISE EXCEPTION 'Invalid class type for teacher registration';
        END IF;
        IF cardinality(v_supported_level_ids) = 0 THEN
            RAISE EXCEPTION 'At least one supported level is required for teacher registration';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM unnest(v_supported_level_ids) AS requested_level(id)
            WHERE NOT EXISTS (SELECT 1 FROM public.levels WHERE id = requested_level.id)
        ) THEN
            RAISE EXCEPTION 'Invalid supported level';
        END IF;

        INSERT INTO public.registration_applications (
            profile_id, role, teacher_class_type
        )
        VALUES (NEW.id, v_role, v_teacher_class_type)
        RETURNING * INTO v_application;

        INSERT INTO public.registration_application_supported_levels (application_id, level_id)
        SELECT v_application.id, requested_level.id
        FROM unnest(v_supported_level_ids) AS requested_level(id);
    END IF;

    RETURN NEW;
END;
$$;
