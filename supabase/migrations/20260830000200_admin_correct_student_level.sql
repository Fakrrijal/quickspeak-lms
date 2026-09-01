-- Correct a student's base level from one unambiguous protected enrollment level.
-- Operational enrollment, group, meeting, attendance, payment, and fee records
-- are intentionally not changed by this function.

CREATE OR REPLACE FUNCTION public.admin_correct_student_level(
    p_student_id uuid,
    p_level_id uuid
)
RETURNS public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_updated_student public.students%ROWTYPE;
    v_operational_level_id uuid;
    v_distinct_operational_level_count integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_student_id IS NULL OR p_level_id IS NULL THEN
        RAISE EXCEPTION 'Student and level are required'
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_student
    FROM public.students AS s
    WHERE s.id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
    END IF;

    PERFORM 1 FROM public.levels AS l WHERE l.id = p_level_id FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Level does not exist' USING ERRCODE = 'P0002';
    END IF;

    SELECT COUNT(DISTINCT e.level_id)
    INTO v_distinct_operational_level_count
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.status IN ('pending', 'payment_pending', 'payment_submitted',
          'payment_rejected', 'payment_approved', 'teacher_assignment', 'active');

    IF v_distinct_operational_level_count = 0 THEN
        RAISE EXCEPTION 'Student has no protected enrollment to correct'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_distinct_operational_level_count > 1 THEN
        RAISE EXCEPTION 'Student level cannot be corrected automatically because multiple enrollments have different operational levels.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT e.level_id
    INTO v_operational_level_id
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.status IN ('pending', 'payment_pending', 'payment_submitted',
          'payment_rejected', 'payment_approved', 'teacher_assignment', 'active')
    LIMIT 1;

    IF p_level_id <> v_operational_level_id THEN
        RAISE EXCEPTION 'Level cannot be changed to another level while an enrollment is active. Use the existing enrollment level for correction.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.students
    SET level_id = p_level_id
    WHERE id = v_student.id
    RETURNING * INTO v_updated_student;

    RETURN v_updated_student;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_student_level(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_correct_student_level(uuid, uuid)
TO authenticated;
