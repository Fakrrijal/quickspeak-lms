-- Level completion, assessment, package renewal and next-level foundation.
--
-- IMPORTANT:
-- This migration is committed to the feature branch only.
-- It is intentionally NOT applied to the production Supabase project yet.
-- Attendance/session-consumption changes are handled separately so the
-- existing attendance flow remains untouched until the new rules are tested.

CREATE TABLE IF NOT EXISTS public.student_level_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL
        REFERENCES public.students(id)
        ON DELETE RESTRICT,
    level_id uuid NOT NULL
        REFERENCES public.levels(id)
        ON DELETE RESTRICT,
    teacher_id uuid NOT NULL
        REFERENCES public.teachers(id)
        ON DELETE RESTRICT,
    speaking integer NOT NULL CHECK (speaking BETWEEN 0 AND 100),
    listening integer NOT NULL CHECK (listening BETWEEN 0 AND 100),
    vocabulary integer NOT NULL CHECK (vocabulary BETWEEN 0 AND 100),
    grammar integer NOT NULL CHECK (grammar BETWEEN 0 AND 100),
    pronunciation integer NOT NULL CHECK (pronunciation BETWEEN 0 AND 100),
    final_score integer NOT NULL CHECK (final_score BETWEEN 0 AND 100),
    result text NOT NULL CHECK (
        result IN ('Excellent', 'Good', 'Satisfactory', 'Needs Improvement')
    ),
    feedback text,
    completed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT student_level_results_student_level_key
        UNIQUE (student_id, level_id)
);

CREATE INDEX IF NOT EXISTS idx_student_level_results_student_id
    ON public.student_level_results(student_id);

CREATE INDEX IF NOT EXISTS idx_student_level_results_level_id
    ON public.student_level_results(level_id);

CREATE INDEX IF NOT EXISTS idx_student_level_results_teacher_id
    ON public.student_level_results(teacher_id);

ALTER TABLE public.student_level_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_level_results FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_student_level(
    p_student_id uuid,
    p_level_id uuid,
    p_speaking integer,
    p_listening integer,
    p_vocabulary integer,
    p_grammar integer,
    p_pronunciation integer,
    p_feedback text DEFAULT NULL
)
RETURNS TABLE (
    result_id uuid,
    student_id uuid,
    level_id uuid,
    teacher_id uuid,
    speaking integer,
    listening integer,
    vocabulary integer,
    grammar integer,
    pronunciation integer,
    final_score integer,
    result text,
    feedback text,
    completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
    v_student public.students%ROWTYPE;
    v_result public.student_level_results%ROWTYPE;
    v_final_score integer;
    v_result_label text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_speaking IS NULL OR p_listening IS NULL OR p_vocabulary IS NULL
       OR p_grammar IS NULL OR p_pronunciation IS NULL
       OR p_speaking NOT BETWEEN 0 AND 100
       OR p_listening NOT BETWEEN 0 AND 100
       OR p_vocabulary NOT BETWEEN 0 AND 100
       OR p_grammar NOT BETWEEN 0 AND 100
       OR p_pronunciation NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'All scores must be between 0 and 100'
            USING ERRCODE = '22023';
    END IF;

    SELECT t.*
    INTO v_teacher
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'
      AND p.status = 'active'
    FOR UPDATE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.id = p_student_id
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active'
    FOR UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student was not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_student.level_id <> p_level_id THEN
        RAISE EXCEPTION 'The selected level is not the student current level'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        JOIN public.teaching_groups AS tg
            ON tg.id = tgs.teaching_group_id
        WHERE tgs.student_id = v_student.id
          AND tg.teacher_id = v_teacher.id
          AND tg.level_id = p_level_id
          AND tg.is_active
    ) THEN
        RAISE EXCEPTION 'Teacher is not assigned to this student for the selected level'
            USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.student_level_results AS slr
        WHERE slr.student_id = v_student.id
          AND slr.level_id = p_level_id
    ) THEN
        RAISE EXCEPTION 'This level has already been completed'
            USING ERRCODE = '23505';
    END IF;

    v_final_score := round(
        (
            p_speaking::numeric
            + p_listening::numeric
            + p_vocabulary::numeric
            + p_grammar::numeric
            + p_pronunciation::numeric
        ) / 5
    )::integer;

    v_result_label := CASE
        WHEN v_final_score >= 90 THEN 'Excellent'
        WHEN v_final_score >= 80 THEN 'Good'
        WHEN v_final_score >= 70 THEN 'Satisfactory'
        ELSE 'Needs Improvement'
    END;

    INSERT INTO public.student_level_results (
        student_id,
        level_id,
        teacher_id,
        speaking,
        listening,
        vocabulary,
        grammar,
        pronunciation,
        final_score,
        result,
        feedback,
        completed_at,
        updated_at
    )
    VALUES (
        v_student.id,
        p_level_id,
        v_teacher.id,
        p_speaking,
        p_listening,
        p_vocabulary,
        p_grammar,
        p_pronunciation,
        v_final_score,
        v_result_label,
        NULLIF(trim(p_feedback), ''),
        now(),
        now()
    )
    RETURNING * INTO v_result;

    -- Completing a level closes any still-active package for that same level.
    -- This supports completion before the package reaches its eighth meeting.
    UPDATE public.enrollments AS e
    SET
        status = 'completed',
        completed_at = COALESCE(e.completed_at, now()),
        updated_at = now()
    WHERE e.student_id = v_student.id
      AND e.level_id = p_level_id
      AND e.status = 'active';

    RETURN QUERY
    SELECT
        v_result.id,
        v_result.student_id,
        v_result.level_id,
        v_result.teacher_id,
        v_result.speaking,
        v_result.listening,
        v_result.vocabulary,
        v_result.grammar,
        v_result.pronunciation,
        v_result.final_score,
        v_result.result,
        v_result.feedback,
        v_result.completed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_teacher_level_result(
    p_student_id uuid,
    p_level_id uuid
)
RETURNS TABLE (
    result_id uuid,
    student_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    teacher_id uuid,
    teacher_code text,
    speaking integer,
    listening integer,
    vocabulary integer,
    grammar integer,
    pronunciation integer,
    final_score integer,
    result text,
    feedback text,
    completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher public.teachers%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT t.*
    INTO v_teacher
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'
      AND p.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        JOIN public.teaching_groups AS tg
            ON tg.id = tgs.teaching_group_id
        WHERE tgs.student_id = p_student_id
          AND tg.teacher_id = v_teacher.id
          AND tg.level_id = p_level_id
    ) THEN
        RAISE EXCEPTION 'Teacher is not authorized for this student and level'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        slr.id,
        slr.student_id,
        slr.level_id,
        l.name,
        l.level_number,
        slr.teacher_id,
        t.teacher_code,
        slr.speaking,
        slr.listening,
        slr.vocabulary,
        slr.grammar,
        slr.pronunciation,
        slr.final_score,
        slr.result,
        slr.feedback,
        slr.completed_at
    FROM public.student_level_results AS slr
    JOIN public.levels AS l
        ON l.id = slr.level_id
    JOIN public.teachers AS t
        ON t.id = slr.teacher_id
    WHERE slr.student_id = p_student_id
      AND slr.level_id = p_level_id
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_student_level_results(
    p_level_id uuid DEFAULT NULL
)
RETURNS TABLE (
    result_id uuid,
    student_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    teacher_id uuid,
    teacher_code text,
    speaking integer,
    listening integer,
    vocabulary integer,
    grammar integer,
    pronunciation integer,
    final_score integer,
    result text,
    feedback text,
    completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.id
    INTO v_student_id
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        slr.id,
        slr.student_id,
        slr.level_id,
        l.name,
        l.level_number,
        slr.teacher_id,
        t.teacher_code,
        slr.speaking,
        slr.listening,
        slr.vocabulary,
        slr.grammar,
        slr.pronunciation,
        slr.final_score,
        slr.result,
        slr.feedback,
        slr.completed_at
    FROM public.student_level_results AS slr
    JOIN public.levels AS l
        ON l.id = slr.level_id
    JOIN public.teachers AS t
        ON t.id = slr.teacher_id
    WHERE slr.student_id = v_student_id
      AND (p_level_id IS NULL OR slr.level_id = p_level_id)
    ORDER BY l.level_number DESC, slr.completed_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_student_level_package_status()
RETURNS TABLE (
    student_id uuid,
    current_level_id uuid,
    current_level_name text,
    current_level_number integer,
    level_completed boolean,
    current_enrollment_id uuid,
    current_package_type text,
    current_package_price integer,
    current_package_status text,
    current_package_session_count integer,
    session_limit integer,
    cumulative_level_session_count integer,
    renewal_available boolean,
    next_level_id uuid,
    next_level_name text,
    next_level_number integer,
    next_level_available boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_level public.levels%ROWTYPE;
    v_result public.student_level_results%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_current_package_sessions integer := 0;
    v_cumulative_sessions integer := 0;
    v_renewal_available boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_level
    FROM public.levels AS l
    WHERE l.id = v_student.level_id;

    SELECT *
    INTO v_result
    FROM public.student_level_results AS slr
    WHERE slr.student_id = v_student.id
      AND slr.level_id = v_student.level_id
    LIMIT 1;

    SELECT *
    INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_student.level_id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1;

    IF FOUND THEN
        SELECT count(*)::integer
        INTO v_current_package_sessions
        FROM public.meetings AS m
        WHERE m.enrollment_id = v_enrollment.id;
    END IF;

    SELECT count(*)::integer
    INTO v_cumulative_sessions
    FROM public.meetings AS m
    WHERE m.student_id = v_student.id
      AND m.level_id = v_student.level_id;

    v_renewal_available := v_result.id IS NULL
        AND v_enrollment.id IS NOT NULL
        AND v_current_package_sessions >= COALESCE(v_enrollment.session_limit, 8)
        AND v_enrollment.status IN ('active', 'completed');

    RETURN QUERY
    SELECT
        v_student.id,
        v_level.id,
        v_level.name,
        v_level.level_number,
        v_result.id IS NOT NULL,
        v_enrollment.id,
        v_enrollment.package_type,
        v_enrollment.price,
        v_enrollment.status,
        v_current_package_sessions,
        COALESCE(v_enrollment.session_limit, 8),
        v_cumulative_sessions,
        v_renewal_available,
        next_level.id,
        next_level.name,
        next_level.level_number,
        v_result.id IS NOT NULL AND next_level.id IS NOT NULL
    FROM public.levels AS next_level
    WHERE next_level.level_number = v_level.level_number + 1;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            v_student.id,
            v_level.id,
            v_level.name,
            v_level.level_number,
            v_result.id IS NOT NULL,
            v_enrollment.id,
            v_enrollment.package_type,
            v_enrollment.price,
            v_enrollment.status,
            v_current_package_sessions,
            COALESCE(v_enrollment.session_limit, 8),
            v_cumulative_sessions,
            v_renewal_available,
            NULL::uuid,
            NULL::text,
            NULL::integer,
            false;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_current_level_package_renewal()
RETURNS TABLE (
    enrollment_id uuid,
    level_id uuid,
    package_type text,
    price integer,
    session_limit integer,
    enrollment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_level_result public.student_level_results%ROWTYPE;
    v_latest_enrollment public.enrollments%ROWTYPE;
    v_new_enrollment public.enrollments%ROWTYPE;
    v_meeting_count integer;
    v_price integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active'
    FOR UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_level_result
    FROM public.student_level_results AS slr
    WHERE slr.student_id = v_student.id
      AND slr.level_id = v_student.level_id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Level is already completed; renew is not available'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_latest_enrollment
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_student.level_id
      AND e.status IN ('active', 'completed')
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No completed package is available for renewal'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT count(*)::integer
    INTO v_meeting_count
    FROM public.meetings AS m
    WHERE m.enrollment_id = v_latest_enrollment.id;

    IF v_meeting_count <> v_latest_enrollment.session_limit THEN
        RAISE EXCEPTION 'The current package must complete all sessions before renewal'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_latest_enrollment.status = 'active' THEN
        UPDATE public.enrollments
        SET
            status = 'completed',
            completed_at = COALESCE(completed_at, now()),
            updated_at = now()
        WHERE id = v_latest_enrollment.id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.enrollments AS e
        WHERE e.student_id = v_student.id
          AND e.level_id = v_student.level_id
          AND e.status IN (
              'pending',
              'payment_pending',
              'payment_submitted',
              'payment_approved',
              'teacher_assignment',
              'active'
          )
    ) THEN
        RAISE EXCEPTION 'A renewal enrollment is already in progress'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT CASE v_latest_enrollment.package_type
        WHEN 'private' THEN ps.private_registration_fee
        WHEN 'semi_private' THEN ps.semi_private_registration_fee
        ELSE NULL
    END::integer
    INTO v_price
    FROM public.payment_settings AS ps
    WHERE ps.is_active
    ORDER BY ps.updated_at DESC
    LIMIT 1;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Active payment settings are not configured for this package type'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.enrollments (
        student_id,
        level_id,
        package_type,
        price,
        session_limit,
        status
    )
    VALUES (
        v_student.id,
        v_student.level_id,
        v_latest_enrollment.package_type,
        v_price,
        8,
        'payment_pending'
    )
    RETURNING * INTO v_new_enrollment;

    RETURN QUERY
    SELECT
        v_new_enrollment.id,
        v_new_enrollment.level_id,
        v_new_enrollment.package_type,
        v_new_enrollment.price,
        v_new_enrollment.session_limit,
        v_new_enrollment.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_next_level_enrollment(
    p_package_type text
)
RETURNS TABLE (
    enrollment_id uuid,
    level_id uuid,
    package_type text,
    price integer,
    session_limit integer,
    enrollment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_next_level public.levels%ROWTYPE;
    v_existing public.enrollments%ROWTYPE;
    v_new_enrollment public.enrollments%ROWTYPE;
    v_has_result boolean := false;
    v_price integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_package_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid package type'
            USING ERRCODE = '22023';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p
        ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active'
    FOR UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.student_level_results AS slr
        WHERE slr.student_id = v_student.id
          AND slr.level_id = v_student.level_id
    )
    INTO v_has_result;

    IF NOT v_has_result THEN
        RAISE EXCEPTION 'Current level must be completed by a teacher first'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_next_level
    FROM public.levels AS l
    JOIN public.levels AS current_level
      ON current_level.id = v_student.level_id
    WHERE l.level_number = current_level.level_number + 1
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The current level has no next level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_existing
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_next_level.id
      AND e.status IN (
          'pending',
          'payment_pending',
          'payment_submitted',
          'payment_approved',
          'teacher_assignment',
          'active'
      )
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status = 'payment_rejected' THEN
            RETURN QUERY
            SELECT
                v_existing.id,
                v_existing.level_id,
                v_existing.package_type,
                v_existing.price,
                v_existing.session_limit,
                v_existing.status;
            RETURN;
        END IF;

        RAISE EXCEPTION 'Student already has an enrollment in progress for the next level'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT CASE p_package_type
        WHEN 'private' THEN ps.private_registration_fee
        WHEN 'semi_private' THEN ps.semi_private_registration_fee
    END::integer
    INTO v_price
    FROM public.payment_settings AS ps
    WHERE ps.is_active
    ORDER BY ps.updated_at DESC
    LIMIT 1;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Active payment settings are not configured for this package type'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.enrollments (
        student_id,
        level_id,
        package_type,
        price,
        session_limit,
        status
    )
    VALUES (
        v_student.id,
        v_next_level.id,
        p_package_type,
        v_price,
        8,
        'payment_pending'
    )
    RETURNING * INTO v_new_enrollment;

    RETURN QUERY
    SELECT
        v_new_enrollment.id,
        v_new_enrollment.level_id,
        v_new_enrollment.package_type,
        v_new_enrollment.price,
        v_new_enrollment.session_limit,
        v_new_enrollment.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_student_level(
    uuid, uuid, integer, integer, integer, integer, integer, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_teacher_level_result(uuid, uuid)
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_student_level_results(uuid)
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_student_level_package_status()
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_current_level_package_renewal()
    TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_next_level_enrollment(text)
    TO authenticated;
