-- Phase B: Registration Application Creation RPC
-- QuickSpeak LMS Database Schema
-- Creates RPC for registration application creation after Auth signup

CREATE OR REPLACE FUNCTION public.create_registration_application(
    p_student_starting_level_id UUID DEFAULT NULL,
    p_student_class_type TEXT DEFAULT NULL,
    p_teacher_class_type TEXT DEFAULT NULL,
    p_supported_level_ids UUID[] DEFAULT NULL
)
RETURNS public.registration_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_application public.registration_applications%ROWTYPE;
    v_level RECORD;
BEGIN
    -- 1. User must be authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Load and validate profile
    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = auth.uid()
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- 3. Validate profile status (should be waiting for new registrations)
    IF v_profile.status <> 'waiting'::public.user_status THEN
        RAISE EXCEPTION 'Registration applications can only be created for waiting accounts';
    END IF;

    -- 4. Validate role consistency between profile and parameters
    IF v_profile.role = 'student'::public.user_role THEN
        -- Student application must have student-specific fields
        IF p_student_starting_level_id IS NULL THEN
            RAISE EXCEPTION 'Starting level is required for student registration';
        END IF;

        IF p_student_class_type IS NULL THEN
            RAISE EXCEPTION 'Class type is required for student registration';
        END IF;

        -- Student application must not have teacher-specific fields
        IF p_teacher_class_type IS NOT NULL THEN
            RAISE EXCEPTION 'Teacher class type cannot be set for student registration';
        END IF;

        IF p_supported_level_ids IS NOT NULL AND array_length(p_supported_level_ids, 1) > 0 THEN
            RAISE EXCEPTION 'Supported levels cannot be set for student registration';
        END IF;

        -- Validate starting level exists
        IF NOT EXISTS (
            SELECT 1
            FROM public.levels
            WHERE id = p_student_starting_level_id
        ) THEN
            RAISE EXCEPTION 'Invalid starting level';
        END IF;

        -- Validate class type
        IF p_student_class_type NOT IN ('private', 'semi_private') THEN
            RAISE EXCEPTION 'Invalid class type for student registration';
        END IF;

    ELSIF v_profile.role = 'teacher'::public.user_role THEN
        -- Teacher application must have teacher-specific field
        IF p_teacher_class_type IS NULL THEN
            RAISE EXCEPTION 'Class type is required for teacher registration';
        END IF;

        -- Teacher application must not have student-specific fields
        IF p_student_starting_level_id IS NOT NULL THEN
            RAISE EXCEPTION 'Starting level cannot be set for teacher registration';
        END IF;

        IF p_student_class_type IS NOT NULL THEN
            RAISE EXCEPTION 'Student class type cannot be set for teacher registration';
        END IF;

        -- Teacher must have at least one supported level
        IF p_supported_level_ids IS NULL OR array_length(p_supported_level_ids, 1) IS NULL OR array_length(p_supported_level_ids, 1) = 0 THEN
            RAISE EXCEPTION 'At least one supported level is required for teacher registration';
        END IF;

        -- Validate class type
        IF p_teacher_class_type NOT IN ('private', 'semi_private') THEN
            RAISE EXCEPTION 'Invalid class type for teacher registration';
        END IF;

        -- Validate all supported levels exist
        FOR v_level IN SELECT unnest(p_supported_level_ids) AS level_id
        LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM public.levels
                WHERE id = v_level.level_id
            ) THEN
                RAISE EXCEPTION 'Invalid supported level';
            END IF;
        END LOOP;

    ELSE
        RAISE EXCEPTION 'Invalid role for registration application';
    END IF;

    -- 5. Check for duplicate application
    IF EXISTS (
        SELECT 1
        FROM public.registration_applications
        WHERE profile_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Registration application already exists for this profile';
    END IF;

    -- 6. Create registration application
    INSERT INTO public.registration_applications (
        profile_id,
        role,
        student_starting_level_id,
        student_class_type,
        teacher_class_type
    )
    VALUES (
        auth.uid(),
        v_profile.role,
        p_student_starting_level_id,
        p_student_class_type,
        p_teacher_class_type
    )
    RETURNING * INTO v_application;

    -- 7. Create supported levels for teacher applications
    IF v_profile.role = 'teacher'::public.user_role AND p_supported_level_ids IS NOT NULL THEN
        INSERT INTO public.registration_application_supported_levels (
            application_id,
            level_id
        )
        SELECT v_application.id, unnest(p_supported_level_ids);
    END IF;

    RETURN v_application;
END;
$$;

REVOKE ALL ON FUNCTION public.create_registration_application(
    UUID, TEXT, TEXT, UUID[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_registration_application(
    UUID, TEXT, TEXT, UUID[]
) TO authenticated;
