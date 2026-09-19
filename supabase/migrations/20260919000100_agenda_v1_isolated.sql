-- QuickSpeak Agenda V1
-- Informational schedule only.
-- It does NOT create meetings, attendance, teacher fee, payment, enrollment,
-- level completion, or other academic/business state.

CREATE TABLE public.teacher_agenda_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL
        REFERENCES public.teachers(id)
        ON DELETE CASCADE,
    teaching_group_id UUID NOT NULL
        REFERENCES public.teaching_groups(id)
        ON DELETE CASCADE,
    start_date DATE NOT NULL,
    meeting_count INTEGER NOT NULL DEFAULT 8
        CHECK (meeting_count = 8),
    schedule_definition JSONB NOT NULL,
    title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.teacher_agenda_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL
        REFERENCES public.teacher_agenda_series(id)
        ON DELETE CASCADE,
    teacher_id UUID NOT NULL
        REFERENCES public.teachers(id)
        ON DELETE CASCADE,
    teaching_group_id UUID NOT NULL
        REFERENCES public.teaching_groups(id)
        ON DELETE CASCADE,
    occurrence_number INTEGER NOT NULL
        CHECK (occurrence_number BETWEEN 1 AND 8),
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT teacher_agenda_occurrence_time_check
        CHECK (end_time > start_time),
    CONSTRAINT teacher_agenda_occurrence_number_unique
        UNIQUE (series_id, occurrence_number)
);

CREATE INDEX idx_teacher_agenda_series_teacher
    ON public.teacher_agenda_series(teacher_id, created_at DESC);

CREATE INDEX idx_teacher_agenda_series_group
    ON public.teacher_agenda_series(teaching_group_id, created_at DESC);

CREATE INDEX idx_teacher_agenda_occurrences_series
    ON public.teacher_agenda_occurrences(series_id, scheduled_date, start_time);

CREATE INDEX idx_teacher_agenda_occurrences_teacher
    ON public.teacher_agenda_occurrences(teacher_id, scheduled_date, start_time);

CREATE INDEX idx_teacher_agenda_occurrences_group
    ON public.teacher_agenda_occurrences(teaching_group_id, scheduled_date, start_time);

ALTER TABLE public.teacher_agenda_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_agenda_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own agenda series"
    ON public.teacher_agenda_series
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.teachers AS t
            JOIN public.profiles AS p
                ON p.id = t.profile_id
            JOIN public.teaching_groups AS tg
                ON tg.id = teacher_agenda_series.teaching_group_id
            WHERE t.id = teacher_agenda_series.teacher_id
              AND t.profile_id = auth.uid()
              AND t.is_active
              AND p.role = 'teacher'::public.user_role
              AND p.status = 'active'::public.user_status
              AND tg.teacher_id = t.id
              AND tg.is_active
        )
    );

CREATE POLICY "Students can view agenda series for own group"
    ON public.teacher_agenda_series
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.students AS s
            JOIN public.profiles AS p
                ON p.id = s.profile_id
            JOIN public.teaching_group_students AS tgs
                ON tgs.student_id = s.id
            JOIN public.teaching_groups AS tg
                ON tg.id = tgs.teaching_group_id
            WHERE s.profile_id = auth.uid()
              AND s.is_active
              AND p.role = 'student'::public.user_role
              AND p.status = 'active'::public.user_status
              AND tgs.teaching_group_id = teacher_agenda_series.teaching_group_id
              AND tg.is_active
        )
    );

CREATE POLICY "Teachers can view own agenda occurrences"
    ON public.teacher_agenda_occurrences
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.teachers AS t
            JOIN public.profiles AS p
                ON p.id = t.profile_id
            JOIN public.teaching_groups AS tg
                ON tg.id = teacher_agenda_occurrences.teaching_group_id
            WHERE t.id = teacher_agenda_occurrences.teacher_id
              AND t.profile_id = auth.uid()
              AND t.is_active
              AND p.role = 'teacher'::public.user_role
              AND p.status = 'active'::public.user_status
              AND tg.teacher_id = t.id
              AND tg.is_active
        )
    );

CREATE POLICY "Students can view agenda occurrences for own group"
    ON public.teacher_agenda_occurrences
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.students AS s
            JOIN public.profiles AS p
                ON p.id = s.profile_id
            JOIN public.teaching_group_students AS tgs
                ON tgs.student_id = s.id
            JOIN public.teaching_groups AS tg
                ON tg.id = tgs.teaching_group_id
            WHERE s.profile_id = auth.uid()
              AND s.is_active
              AND p.role = 'student'::public.user_role
              AND p.status = 'active'::public.user_status
              AND tgs.teaching_group_id = teacher_agenda_occurrences.teaching_group_id
              AND tg.is_active
        )
    );

CREATE OR REPLACE FUNCTION public.create_teacher_agenda_series(
    p_teaching_group_id UUID,
    p_start_date DATE,
    p_schedule JSONB,
    p_title TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_teacher_id UUID;
    v_series_id UUID;
    v_cursor DATE;
    v_weekday INTEGER;
    v_start_time TIME;
    v_end_time TIME;
    v_count INTEGER := 0;
    v_item JSONB;
    v_seen_weekdays INTEGER[] := ARRAY[]::INTEGER[];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_teaching_group_id IS NULL
       OR p_start_date IS NULL
       OR p_schedule IS NULL THEN
        RAISE EXCEPTION 'Teaching group, start date, and weekly schedule are required'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_schedule) <> 'array'
       OR jsonb_array_length(p_schedule) < 1
       OR jsonb_array_length(p_schedule) > 7 THEN
        RAISE EXCEPTION 'Weekly schedule must contain 1 to 7 selected days'
            USING ERRCODE = '22023';
    END IF;

    SELECT t.id
    INTO v_teacher_id
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'active'::public.user_status
    FOR KEY SHARE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.teaching_groups AS tg
    WHERE tg.id = p_teaching_group_id
      AND tg.teacher_id = v_teacher_id
      AND tg.is_active
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group is not assigned to the authenticated teacher'
            USING ERRCODE = '42501';
    END IF;

    IF length(COALESCE(btrim(p_title), '')) > 160 THEN
        RAISE EXCEPTION 'Agenda title is too long'
            USING ERRCODE = '22023';
    END IF;

    IF length(COALESCE(btrim(p_notes), '')) > 1000 THEN
        RAISE EXCEPTION 'Agenda notes are too long'
            USING ERRCODE = '22023';
    END IF;

    -- Validate the weekly pattern before creating anything.
    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_schedule)
    LOOP
        IF NOT (v_item ? 'weekday')
           OR NOT (v_item ? 'start_time')
           OR NOT (v_item ? 'end_time') THEN
            RAISE EXCEPTION 'Each schedule item requires weekday, start_time, and end_time'
                USING ERRCODE = '22023';
        END IF;

        BEGIN
            v_weekday := (v_item ->> 'weekday')::INTEGER;
            v_start_time := (v_item ->> 'start_time')::TIME;
            v_end_time := (v_item ->> 'end_time')::TIME;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid schedule time or weekday value'
                    USING ERRCODE = '22023';
        END;

        IF v_weekday < 1 OR v_weekday > 7 THEN
            RAISE EXCEPTION 'Weekday must be between 1 (Monday) and 7 (Sunday)'
                USING ERRCODE = '22023';
        END IF;

        IF v_end_time <= v_start_time THEN
            RAISE EXCEPTION 'End time must be later than start time'
                USING ERRCODE = '22023';
        END IF;

        IF v_weekday = ANY(v_seen_weekdays) THEN
            RAISE EXCEPTION 'Each weekday can only be selected once'
                USING ERRCODE = '22023';
        END IF;

        v_seen_weekdays := array_append(v_seen_weekdays, v_weekday);
    END LOOP;

    INSERT INTO public.teacher_agenda_series (
        teacher_id,
        teaching_group_id,
        start_date,
        meeting_count,
        schedule_definition,
        title,
        notes
    )
    VALUES (
        v_teacher_id,
        p_teaching_group_id,
        p_start_date,
        8,
        p_schedule,
        NULLIF(btrim(p_title), ''),
        NULLIF(btrim(p_notes), '')
    )
    RETURNING id INTO v_series_id;

    v_cursor := p_start_date;

    WHILE v_count < 8 LOOP
        v_weekday := EXTRACT(ISODOW FROM v_cursor)::INTEGER;

        SELECT
            (item ->> 'start_time')::TIME,
            (item ->> 'end_time')::TIME
        INTO
            v_start_time,
            v_end_time
        FROM jsonb_array_elements(p_schedule) AS item
        WHERE (item ->> 'weekday')::INTEGER = v_weekday
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO public.teacher_agenda_occurrences (
                series_id,
                teacher_id,
                teaching_group_id,
                occurrence_number,
                scheduled_date,
                start_time,
                end_time
            )
            VALUES (
                v_series_id,
                v_teacher_id,
                p_teaching_group_id,
                v_count + 1,
                v_cursor,
                v_start_time,
                v_end_time
            );

            v_count := v_count + 1;
        END IF;

        v_cursor := v_cursor + 1;

        IF v_cursor > p_start_date + 365 THEN
            RAISE EXCEPTION 'Unable to generate the required 8 agenda occurrences'
                USING ERRCODE = '22023';
        END IF;
    END LOOP;

    RETURN v_series_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_teacher_agenda_series(
    p_series_id UUID,
    p_start_date DATE,
    p_schedule JSONB,
    p_title TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_teacher_id UUID;
    v_series public.teacher_agenda_series%ROWTYPE;
    v_cursor DATE;
    v_weekday INTEGER;
    v_start_time TIME;
    v_end_time TIME;
    v_count INTEGER := 0;
    v_item JSONB;
    v_seen_weekdays INTEGER[] := ARRAY[]::INTEGER[];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_series_id IS NULL
       OR p_start_date IS NULL
       OR p_schedule IS NULL THEN
        RAISE EXCEPTION 'Agenda series, start date, and weekly schedule are required'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_schedule) <> 'array'
       OR jsonb_array_length(p_schedule) < 1
       OR jsonb_array_length(p_schedule) > 7 THEN
        RAISE EXCEPTION 'Weekly schedule must contain 1 to 7 selected days'
            USING ERRCODE = '22023';
    END IF;

    SELECT t.id
    INTO v_teacher_id
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'active'::public.user_status
    FOR KEY SHARE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_series
    FROM public.teacher_agenda_series AS s
    WHERE s.id = p_series_id
      AND s.teacher_id = v_teacher_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agenda series not found or not owned by teacher'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.teaching_groups AS tg
    WHERE tg.id = v_series.teaching_group_id
      AND tg.teacher_id = v_teacher_id
      AND tg.is_active
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching group is not assigned to the authenticated teacher'
            USING ERRCODE = '42501';
    END IF;

    IF length(COALESCE(btrim(p_title), '')) > 160 THEN
        RAISE EXCEPTION 'Agenda title is too long'
            USING ERRCODE = '22023';
    END IF;

    IF length(COALESCE(btrim(p_notes), '')) > 1000 THEN
        RAISE EXCEPTION 'Agenda notes are too long'
            USING ERRCODE = '22023';
    END IF;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_schedule)
    LOOP
        IF NOT (v_item ? 'weekday')
           OR NOT (v_item ? 'start_time')
           OR NOT (v_item ? 'end_time') THEN
            RAISE EXCEPTION 'Each schedule item requires weekday, start_time, and end_time'
                USING ERRCODE = '22023';
        END IF;

        BEGIN
            v_weekday := (v_item ->> 'weekday')::INTEGER;
            v_start_time := (v_item ->> 'start_time')::TIME;
            v_end_time := (v_item ->> 'end_time')::TIME;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid schedule time or weekday value'
                    USING ERRCODE = '22023';
        END;

        IF v_weekday < 1 OR v_weekday > 7 THEN
            RAISE EXCEPTION 'Weekday must be between 1 (Monday) and 7 (Sunday)'
                USING ERRCODE = '22023';
        END IF;

        IF v_end_time <= v_start_time THEN
            RAISE EXCEPTION 'End time must be later than start time'
                USING ERRCODE = '22023';
        END IF;

        IF v_weekday = ANY(v_seen_weekdays) THEN
            RAISE EXCEPTION 'Each weekday can only be selected once'
                USING ERRCODE = '22023';
        END IF;

        v_seen_weekdays := array_append(v_seen_weekdays, v_weekday);
    END LOOP;

    UPDATE public.teacher_agenda_series
    SET start_date = p_start_date,
        schedule_definition = p_schedule,
        title = NULLIF(btrim(p_title), ''),
        notes = NULLIF(btrim(p_notes), ''),
        updated_at = NOW()
    WHERE id = p_series_id;

    DELETE FROM public.teacher_agenda_occurrences
    WHERE series_id = p_series_id;

    v_cursor := p_start_date;

    WHILE v_count < 8 LOOP
        v_weekday := EXTRACT(ISODOW FROM v_cursor)::INTEGER;

        SELECT
            (item ->> 'start_time')::TIME,
            (item ->> 'end_time')::TIME
        INTO
            v_start_time,
            v_end_time
        FROM jsonb_array_elements(p_schedule) AS item
        WHERE (item ->> 'weekday')::INTEGER = v_weekday
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO public.teacher_agenda_occurrences (
                series_id,
                teacher_id,
                teaching_group_id,
                occurrence_number,
                scheduled_date,
                start_time,
                end_time
            )
            VALUES (
                p_series_id,
                v_teacher_id,
                v_series.teaching_group_id,
                v_count + 1,
                v_cursor,
                v_start_time,
                v_end_time
            );

            v_count := v_count + 1;
        END IF;

        v_cursor := v_cursor + 1;

        IF v_cursor > p_start_date + 365 THEN
            RAISE EXCEPTION 'Unable to generate the required 8 agenda occurrences'
                USING ERRCODE = '22023';
        END IF;
    END LOOP;

    RETURN p_series_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_teacher_agenda_series(
    p_series_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_teacher_id UUID;
    v_deleted INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT t.id
    INTO v_teacher_id
    FROM public.teachers AS t
    JOIN public.profiles AS p
        ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'active'
    FOR KEY SHARE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required'
            USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.teacher_agenda_series
    WHERE id = p_series_id
      AND teacher_id = v_teacher_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted = 1;
END;
$function$;

REVOKE ALL ON TABLE public.teacher_agenda_series FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.teacher_agenda_occurrences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.teacher_agenda_series TO authenticated;
GRANT SELECT ON TABLE public.teacher_agenda_occurrences TO authenticated;

REVOKE ALL ON FUNCTION public.create_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_teacher_agenda_series(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_teacher_agenda_series(UUID) TO authenticated;
