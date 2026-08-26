-- S2.6C Admin Create Teaching Group Foundation

CREATE OR REPLACE FUNCTION public.admin_create_teaching_group(
    p_name TEXT,
    p_teacher_id UUID,
    p_level_id UUID,
    p_group_type TEXT
)
RETURNS public.teaching_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teaching_group public.teaching_groups;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    IF NULLIF(btrim(p_name), '') IS NULL THEN
        RAISE EXCEPTION 'Teaching group name is required';
    END IF;

    IF p_group_type IS NULL
       OR p_group_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid teaching group type';
    END IF;

    PERFORM 1
    FROM public.teachers AS t
    WHERE t.id = p_teacher_id
      AND t.is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not active';
    END IF;

    PERFORM 1
    FROM public.levels AS l
    WHERE l.id = p_level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Level does not exist';
    END IF;

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = p_teacher_id
      AND tl.level_id = p_level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher is not eligible for this level';
    END IF;

    INSERT INTO public.teaching_groups (
        name,
        teacher_id,
        level_id,
        group_type,
        is_active
    )
    VALUES (
        btrim(p_name),
        p_teacher_id,
        p_level_id,
        p_group_type,
        true
    )
    RETURNING * INTO v_teaching_group;

    RETURN v_teaching_group;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_teaching_group(TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_teaching_group(TEXT, UUID, UUID, TEXT) TO authenticated;
