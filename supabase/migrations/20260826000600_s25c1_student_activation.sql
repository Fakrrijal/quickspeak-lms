-- S2.5C1 Transactional Student Activation RPC
-- Activate a waiting student and assign them to an active teaching group atomically.

-- One counter row per activation year provides concurrency-safe student-code numbers.
CREATE TABLE public.student_code_year_counters (
    activation_year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 9999)
);

-- Preserve the next code number if valid student codes already exist.
INSERT INTO public.student_code_year_counters AS counter (
    activation_year,
    last_number
)
SELECT
    substring(s.student_code FROM '^QS-([0-9]{4})-[0-9]{4}$')::INTEGER,
    MAX(substring(s.student_code FROM '^QS-[0-9]{4}-([0-9]{4})$')::INTEGER)
FROM public.students AS s
WHERE s.student_code ~ '^QS-[0-9]{4}-[0-9]{4}$'
GROUP BY 1
ON CONFLICT (activation_year) DO UPDATE
SET last_number = GREATEST(counter.last_number, EXCLUDED.last_number);

CREATE OR REPLACE FUNCTION public.admin_activate_student(
    p_profile_id UUID,
    p_teaching_group_id UUID
)
RETURNS TABLE (
    student_id UUID,
    student_code TEXT,
    teaching_group_id UUID,
    level_id UUID,
    profile_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_role public.user_role;
    v_profile_status public.user_status;
    v_teacher_id UUID;
    v_level_id UUID;
    v_group_type TEXT;
    v_teacher_is_active BOOLEAN;
    v_existing_student_id UUID;
    v_membership_count INTEGER;
    v_activation_year INTEGER;
    v_yearly_number INTEGER;
    v_student_code TEXT;
    v_student_id UUID;
    v_updated_profile_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active administrators can activate students';
    END IF;

    -- Serializes attempts to activate the same profile.
    SELECT p.role, p.status
    INTO v_profile_role, v_profile_status
    FROM public.profiles AS p
    WHERE p.id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile does not exist';
    END IF;

    IF v_profile_role <> 'student'::public.user_role THEN
        RAISE EXCEPTION 'Target profile must have the student role';
    END IF;

    IF v_profile_status <> 'waiting'::public.user_status THEN
        RAISE EXCEPTION 'Target profile must have waiting status';
    END IF;

    -- Serializes membership and capacity checks for the selected group.
    SELECT tg.teacher_id, tg.level_id, tg.group_type
    INTO v_teacher_id, v_level_id, v_group_type
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
      AND tg.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected teaching group does not exist or is inactive';
    END IF;

    SELECT t.is_active
    INTO v_teacher_is_active
    FROM public.teachers AS t
    WHERE t.id = v_teacher_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected teaching group teacher does not exist';
    END IF;

    IF NOT v_teacher_is_active THEN
        RAISE EXCEPTION 'Selected teaching group teacher is inactive';
    END IF;

    PERFORM 1
    FROM public.teacher_levels AS tl
    WHERE tl.teacher_id = v_teacher_id
      AND tl.level_id = v_level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected teaching group teacher is not eligible for the group level';
    END IF;

    SELECT s.id
    INTO v_existing_student_id
    FROM public.students AS s
    WHERE s.profile_id = p_profile_id
    FOR KEY SHARE;

    IF FOUND THEN
        RAISE EXCEPTION 'Target profile already has a student record';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.students AS s
        JOIN public.teaching_group_students AS tgs
            ON tgs.student_id = s.id
        JOIN public.teaching_groups AS tg
            ON tg.id = tgs.teaching_group_id
        WHERE s.profile_id = p_profile_id
          AND tg.is_active = true
    ) THEN
        RAISE EXCEPTION 'Student already belongs to an active teaching group';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO v_membership_count
    FROM public.teaching_group_students AS tgs
    WHERE tgs.teaching_group_id = p_teaching_group_id;

    IF v_group_type = 'private' AND v_membership_count <> 0 THEN
        RAISE EXCEPTION 'Private teaching group is at capacity';
    END IF;

    IF v_group_type = 'semi_private' AND v_membership_count >= 4 THEN
        RAISE EXCEPTION 'Semi-private teaching group is at capacity';
    END IF;

    v_activation_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

    INSERT INTO public.student_code_year_counters AS counter (
        activation_year,
        last_number
    )
    VALUES (v_activation_year, 1)
    ON CONFLICT (activation_year) DO UPDATE
    SET last_number = counter.last_number + 1
    WHERE counter.last_number < 9999
    RETURNING last_number INTO v_yearly_number;

    IF v_yearly_number IS NULL THEN
        RAISE EXCEPTION 'Student code sequence is exhausted for activation year %', v_activation_year;
    END IF;

    v_student_code := format(
        'QS-%s-%s',
        v_activation_year,
        lpad(v_yearly_number::TEXT, 4, '0')
    );

    INSERT INTO public.students (
        profile_id,
        level_id,
        student_code,
        is_active
    )
    VALUES (
        p_profile_id,
        v_level_id,
        v_student_code,
        true
    )
    RETURNING id INTO v_student_id;

    INSERT INTO public.teaching_group_students (
        teaching_group_id,
        student_id
    )
    VALUES (
        p_teaching_group_id,
        v_student_id
    );

    UPDATE public.profiles
    SET status = 'active'::public.user_status,
        updated_at = NOW()
    WHERE id = p_profile_id
      AND status = 'waiting'::public.user_status
    RETURNING id INTO v_updated_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile status changed before activation could complete';
    END IF;

    RETURN QUERY
    SELECT
        v_student_id,
        v_student_code,
        p_teaching_group_id,
        v_level_id,
        p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_student(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activate_student(UUID, UUID) TO authenticated;
