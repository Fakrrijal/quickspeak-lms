-- Atomic, admin-only operational teaching-group reassignment.

CREATE FUNCTION public.admin_move_student_between_teaching_groups(
    p_source_teaching_group_id uuid,
    p_target_teaching_group_id uuid,
    p_student_id uuid
)
RETURNS public.teaching_group_students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_source public.teaching_groups%ROWTYPE;
    v_target public.teaching_groups%ROWTYPE;
    v_membership public.teaching_group_students%ROWTYPE;
    v_target_count integer;
    v_target_capacity integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;
    IF p_source_teaching_group_id IS NULL OR p_target_teaching_group_id IS NULL
       OR p_student_id IS NULL OR p_source_teaching_group_id = p_target_teaching_group_id THEN
        RAISE EXCEPTION 'Different source group, target group, and student are required' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_student FROM public.students AS s WHERE s.id = p_student_id FOR UPDATE;
    IF NOT FOUND OR NOT v_student.is_active THEN
        RAISE EXCEPTION 'Student is not active or not found' USING ERRCODE = 'P0001';
    END IF;

    -- Lock in a stable order so competing moves cannot deadlock or overfill a group.
    PERFORM 1 FROM public.teaching_groups AS tg
    WHERE tg.id IN (p_source_teaching_group_id, p_target_teaching_group_id)
    ORDER BY tg.id FOR UPDATE;
    IF NOT FOUND OR (SELECT count(*) FROM public.teaching_groups WHERE id IN (p_source_teaching_group_id, p_target_teaching_group_id)) <> 2 THEN
        RAISE EXCEPTION 'Source or target teaching group not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_source FROM public.teaching_groups AS tg WHERE tg.id = p_source_teaching_group_id;
    SELECT * INTO v_target FROM public.teaching_groups AS tg WHERE tg.id = p_target_teaching_group_id;
    IF NOT v_target.is_active THEN
        RAISE EXCEPTION 'Target teaching group is inactive' USING ERRCODE = 'P0001';
    END IF;
    IF v_source.level_id <> v_target.level_id OR v_source.group_type <> v_target.group_type THEN
        RAISE EXCEPTION 'Target teaching group must match the source level and type' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_membership FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = p_source_teaching_group_id AND tgs.student_id = p_student_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student is not assigned to the source teaching group' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.teaching_group_students AS tgs WHERE tgs.teaching_group_id = p_target_teaching_group_id AND tgs.student_id = p_student_id) THEN
        RAISE EXCEPTION 'Student is already assigned to the target teaching group' USING ERRCODE = '23505';
    END IF;

    SELECT count(*)::integer INTO v_target_count FROM public.teaching_group_students AS tgs WHERE tgs.teaching_group_id = p_target_teaching_group_id;
    v_target_capacity := CASE v_target.group_type WHEN 'private' THEN 1 WHEN 'semi_private' THEN 4 ELSE 0 END;
    IF v_target_count >= v_target_capacity THEN
        RAISE EXCEPTION 'Target teaching group is at capacity' USING ERRCODE = 'P0001';
    END IF;

    -- Active enrollment assignments are current operational state; historical meetings are untouched.
    IF EXISTS (
        SELECT 1 FROM public.enrollment_teaching_group_assignments AS etga
        JOIN public.enrollments AS e ON e.id = etga.enrollment_id
        WHERE e.student_id = p_student_id AND e.status = 'active'
          AND etga.teaching_group_id = p_source_teaching_group_id
          AND (e.level_id <> v_target.level_id OR e.package_type <> v_target.group_type)
    ) THEN
        RAISE EXCEPTION 'Target teaching group does not match an active enrollment' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.enrollment_teaching_group_assignments AS etga
    SET teaching_group_id = p_target_teaching_group_id, assigned_at = now()
    FROM public.enrollments AS e
    WHERE e.id = etga.enrollment_id AND e.student_id = p_student_id
      AND e.status = 'active' AND etga.teaching_group_id = p_source_teaching_group_id;

    DELETE FROM public.teaching_group_students
    WHERE id = v_membership.id;
    INSERT INTO public.teaching_group_students (teaching_group_id, student_id)
    VALUES (p_target_teaching_group_id, p_student_id)
    RETURNING * INTO v_membership;
    RETURN v_membership;
END;
$$;

CREATE FUNCTION public.admin_replace_teaching_group_teacher(
    p_teaching_group_id uuid,
    p_teacher_id uuid
)
RETURNS public.teaching_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_group public.teaching_groups%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_group FROM public.teaching_groups AS tg WHERE tg.id = p_teaching_group_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Teaching group not found' USING ERRCODE = 'P0002'; END IF;
    PERFORM 1 FROM public.teachers AS t WHERE t.id = p_teacher_id AND t.is_active FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Teacher is not active or not found' USING ERRCODE = 'P0001'; END IF;
    PERFORM 1 FROM public.teacher_levels AS tl WHERE tl.teacher_id = p_teacher_id AND tl.level_id = v_group.level_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Teacher is not eligible for this teaching group level' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.teaching_groups AS tg SET teacher_id = p_teacher_id, updated_at = now()
    WHERE tg.id = v_group.id RETURNING * INTO v_group;
    RETURN v_group;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_move_student_between_teaching_groups(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_replace_teaching_group_teacher(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_move_student_between_teaching_groups(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_teaching_group_teacher(uuid, uuid) TO authenticated;
