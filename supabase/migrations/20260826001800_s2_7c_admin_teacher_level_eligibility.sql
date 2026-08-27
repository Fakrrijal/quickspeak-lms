-- S2.7C Admin Teacher Level Eligibility RPCs

CREATE OR REPLACE FUNCTION public.admin_add_teacher_level(
    p_teacher_id uuid,
    p_level_id uuid
)
RETURNS public.teacher_levels
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_level public.levels%ROWTYPE;
    v_teacher_level public.teacher_levels%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_teacher
    FROM public.teachers
    WHERE id = p_teacher_id;

    IF v_teacher IS NULL THEN
        RAISE EXCEPTION 'Teacher not found';
    END IF;

    IF NOT v_teacher.is_active THEN
        RAISE EXCEPTION 'Teacher is not active';
    END IF;

    SELECT * INTO v_level
    FROM public.levels
    WHERE id = p_level_id;

    IF v_level IS NULL THEN
        RAISE EXCEPTION 'Level does not exist';
    END IF;

    SELECT * INTO v_teacher_level
    FROM public.teacher_levels
    WHERE teacher_id = p_teacher_id
      AND level_id = p_level_id;

    IF v_teacher_level IS NOT NULL THEN
        RAISE EXCEPTION 'Teacher is already eligible for this level';
    END IF;

    INSERT INTO public.teacher_levels (
        teacher_id,
        level_id
    )
    VALUES (
        p_teacher_id,
        p_level_id
    )
    RETURNING * INTO v_teacher_level;

    RETURN v_teacher_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_teacher_level(
    p_teacher_id uuid,
    p_level_id uuid
)
RETURNS public.teacher_levels
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_teacher_level public.teacher_levels%ROWTYPE;
    v_active_group_count integer;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_teacher
    FROM public.teachers
    WHERE id = p_teacher_id;

    IF v_teacher IS NULL THEN
        RAISE EXCEPTION 'Teacher not found';
    END IF;

    SELECT * INTO v_teacher_level
    FROM public.teacher_levels
    WHERE teacher_id = p_teacher_id
      AND level_id = p_level_id;

    IF v_teacher_level IS NULL THEN
        RAISE EXCEPTION 'Teacher is not eligible for this level';
    END IF;

    SELECT COUNT(*) INTO v_active_group_count
    FROM public.teaching_groups
    WHERE teacher_id = p_teacher_id
      AND level_id = p_level_id
      AND is_active = true;

    IF v_active_group_count > 0 THEN
        RAISE EXCEPTION 'Cannot remove level eligibility while teacher has active teaching groups at this level';
    END IF;

    DELETE FROM public.teacher_levels
    WHERE teacher_id = p_teacher_id
      AND level_id = p_level_id
    RETURNING * INTO v_teacher_level;

    RETURN v_teacher_level;
END;
$$;
