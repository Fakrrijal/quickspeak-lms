-- S2.6D1 Admin Update Teaching Group RPC
-- QuickSpeak LMS Database Schema
-- RPC for Admin to update Teaching Groups with full validation

CREATE OR REPLACE FUNCTION public.admin_update_teaching_group(
    p_teaching_group_id uuid,
    p_name text,
    p_teacher_id uuid,
    p_level_id uuid,
    p_group_type text
)
RETURNS public.teaching_groups
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_teacher_exists boolean;
    v_teacher_active boolean;
    v_level_exists boolean;
    v_eligibility_exists boolean;
    v_name_trimmed text;
BEGIN
    -- 1. Verify active Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    -- 2. Verify Teaching Group exists
    SELECT * INTO v_teaching_group
    FROM public.teaching_groups
    WHERE id = p_teaching_group_id;

    IF v_teaching_group IS NULL THEN
        RAISE EXCEPTION 'Teaching group not found';
    END IF;

    -- 3. Validate name
    v_name_trimmed := btrim(p_name);
    
    IF v_name_trimmed IS NULL OR v_name_trimmed = '' THEN
        RAISE EXCEPTION 'Teaching group name is required';
    END IF;

    -- 4. Validate Teacher
    SELECT EXISTS(
        SELECT 1 FROM public.teachers
        WHERE id = p_teacher_id AND is_active = true
    ) INTO v_teacher_active;

    IF NOT v_teacher_active THEN
        RAISE EXCEPTION 'Teacher is not active';
    END IF;

    -- 5. Validate Level
    SELECT EXISTS(
        SELECT 1 FROM public.levels
        WHERE id = p_level_id
    ) INTO v_level_exists;

    IF NOT v_level_exists THEN
        RAISE EXCEPTION 'Level does not exist';
    END IF;

    -- 6. Validate Teacher + Level eligibility
    SELECT EXISTS(
        SELECT 1 FROM public.teacher_levels
        WHERE teacher_id = p_teacher_id AND level_id = p_level_id
    ) INTO v_eligibility_exists;

    IF NOT v_eligibility_exists THEN
        RAISE EXCEPTION 'Teacher is not eligible for this level';
    END IF;

    -- 7. Validate group type
    IF p_group_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid teaching group type';
    END IF;

    -- 8. Update ONLY public.teaching_groups
    UPDATE public.teaching_groups
    SET 
        name = v_name_trimmed,
        teacher_id = p_teacher_id,
        level_id = p_level_id,
        group_type = p_group_type,
        updated_at = NOW()
    WHERE id = p_teaching_group_id;

    -- 9. Return the updated row
    SELECT * INTO v_teaching_group
    FROM public.teaching_groups
    WHERE id = p_teaching_group_id;

    RETURN v_teaching_group;
END;
$$;
