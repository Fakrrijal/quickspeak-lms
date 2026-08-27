-- S2.6D3 Fix Admin Student Assignment RPCs

CREATE OR REPLACE FUNCTION public.admin_assign_student_to_teaching_group(
    p_teaching_group_id uuid,
    p_student_id uuid
)
RETURNS public.teaching_group_students
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_teaching_group public.teaching_groups%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_existing_membership public.teaching_group_students%ROWTYPE;
    v_current_count integer;
    v_max_capacity integer;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_teaching_group
    FROM public.teaching_groups
    WHERE id = p_teaching_group_id;

    IF v_teaching_group IS NULL THEN
        RAISE EXCEPTION 'Teaching group not found';
    END IF;

    IF NOT v_teaching_group.is_active THEN
        RAISE EXCEPTION 'Teaching group is inactive';
    END IF;

    SELECT * INTO v_student
    FROM public.students
    WHERE id = p_student_id;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    IF NOT v_student.is_active THEN
        RAISE EXCEPTION 'Student is not active';
    END IF;

    SELECT * INTO v_existing_membership
    FROM public.teaching_group_students
    WHERE teaching_group_id = p_teaching_group_id
      AND student_id = p_student_id;

    IF v_existing_membership IS NOT NULL THEN
        RAISE EXCEPTION 'Student is already assigned to this teaching group';
    END IF;

    SELECT * INTO v_teaching_group
    FROM public.teaching_groups
    WHERE id = p_teaching_group_id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_current_count
    FROM public.teaching_group_students
    WHERE teaching_group_id = p_teaching_group_id;

    IF v_teaching_group.group_type = 'private' THEN
        v_max_capacity := 1;
    ELSEIF v_teaching_group.group_type = 'semi_private' THEN
        v_max_capacity := 4;
    ELSE
        RAISE EXCEPTION 'Invalid teaching group type';
    END IF;

    IF v_current_count >= v_max_capacity THEN
        RAISE EXCEPTION 'Teaching group is at capacity';
    END IF;

    INSERT INTO public.teaching_group_students (
        teaching_group_id,
        student_id
    )
    VALUES (
        p_teaching_group_id,
        p_student_id
    )
    RETURNING * INTO v_existing_membership;

    RETURN v_existing_membership;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_student_from_teaching_group(
    p_teaching_group_id uuid,
    p_student_id uuid
)
RETURNS public.teaching_group_students
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_membership public.teaching_group_students%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_membership
    FROM public.teaching_group_students
    WHERE teaching_group_id = p_teaching_group_id
      AND student_id = p_student_id;

    IF v_membership IS NULL THEN
        RAISE EXCEPTION 'Student is not assigned to this teaching group';
    END IF;

    DELETE FROM public.teaching_group_students
    WHERE teaching_group_id = p_teaching_group_id
      AND student_id = p_student_id
    RETURNING * INTO v_membership;

    RETURN v_membership;
END;
$$;
