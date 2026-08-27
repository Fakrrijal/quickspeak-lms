-- S2.7B Admin Teacher Status RPC

CREATE OR REPLACE FUNCTION public.admin_set_teacher_status(
    p_teacher_id uuid,
    p_is_active boolean
)
RETURNS public.teachers
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
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

    IF NOT p_is_active THEN
        SELECT COUNT(*) INTO v_active_group_count
        FROM public.teaching_groups
        WHERE teacher_id = p_teacher_id
          AND is_active = true;

        IF v_active_group_count > 0 THEN
            RAISE EXCEPTION 'Teacher cannot be deactivated while assigned to active teaching groups';
        END IF;
    END IF;

    UPDATE public.teachers
    SET
        is_active = p_is_active,
        updated_at = now()
    WHERE id = p_teacher_id
    RETURNING * INTO v_teacher;

    RETURN v_teacher;
END;
$$;
