-- Require all published learning chapters for the current level
-- to be completed before a teacher can finalize the level assessment.
--
-- This is a database-only guard. No Cloudflare Worker deployment is required
-- because the frontend continues calling the same RPC.

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
        FROM public.learning_chapters AS lc
        JOIN public.ebooks AS e
            ON e.id = lc.ebook_id
        WHERE e.level_id = p_level_id
          AND e.status = 'published'
          AND NOT EXISTS (
              SELECT 1
              FROM public.student_chapter_progress AS scp
              WHERE scp.student_id = v_student.id
                AND scp.chapter_id = lc.id
          )
    ) THEN
        RAISE EXCEPTION 'All published chapters for this level must be completed before the level can be finalized'
            USING ERRCODE = 'P0001';
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

REVOKE ALL ON FUNCTION public.complete_student_level(uuid, uuid, integer, integer, integer, integer, integer, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_student_level(uuid, uuid, integer, integer, integer, integer, integer, text)
TO authenticated;
