-- Teacher fee settlement is derived from immutable teacher attendance.
-- It deliberately does not alter meetings, attendance, enrollments, payments, or invoices.

CREATE TABLE public.teacher_fee_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
    period_start date NOT NULL,
    earned_amount numeric NOT NULL DEFAULT 0 CHECK (earned_amount >= 0),
    status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    paid_amount numeric NULL CHECK (paid_amount IS NULL OR paid_amount >= 0),
    paid_at timestamptz NULL,
    paid_by uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT teacher_fee_periods_teacher_period_key UNIQUE (teacher_id, period_start),
    CONSTRAINT teacher_fee_periods_payment_state_check CHECK (
        (status = 'unpaid' AND paid_amount IS NULL AND paid_at IS NULL AND paid_by IS NULL)
        OR
        (status = 'paid' AND paid_amount IS NOT NULL AND paid_at IS NOT NULL AND paid_by IS NOT NULL)
    ),
    CONSTRAINT teacher_fee_periods_period_start_check
        CHECK (period_start = pg_catalog.date_trunc('month', period_start)::date)
);

CREATE INDEX teacher_fee_periods_period_start_idx
    ON public.teacher_fee_periods (period_start DESC, teacher_id);

CREATE TRIGGER teacher_fee_periods_updated_at
    BEFORE UPDATE ON public.teacher_fee_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.teacher_fee_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own fee periods"
    ON public.teacher_fee_periods
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.teachers AS t
            WHERE t.id = teacher_fee_periods.teacher_id
              AND t.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view teacher fee periods"
    ON public.teacher_fee_periods
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE FUNCTION public.get_my_teacher_fee_report(
    p_month integer,
    p_year integer,
    p_status text DEFAULT 'all'
)
RETURNS TABLE (
    session_date date,
    session_time timestamptz,
    session_number bigint,
    teaching_group_name text,
    package_type text,
    present_students bigint,
    fee numeric,
    status text,
    period_start date,
    earned_amount numeric,
    paid_amount numeric,
    outstanding_amount numeric,
    paid_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_teacher_id uuid;
    v_period_start date;
    v_period_end date;
    v_settlement public.teacher_fee_periods%ROWTYPE;
    v_live_earned numeric := 0;
    v_earned numeric := 0;
    v_paid numeric := 0;
    v_status text := 'unpaid';
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
    END IF;

    IF p_month NOT BETWEEN 1 AND 12 OR p_year NOT BETWEEN 2000 AND 9999 THEN
        RAISE EXCEPTION 'A valid month and year are required' USING ERRCODE = '22023';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('all', 'paid', 'unpaid') THEN
        RAISE EXCEPTION 'Status must be all, paid, or unpaid' USING ERRCODE = '22023';
    END IF;

    SELECT t.id INTO v_teacher_id
    FROM public.teachers AS t
    JOIN public.profiles AS p ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.is_active
      AND p.role = 'teacher'::public.user_role
      AND p.status = 'active'::public.user_status
    FOR KEY SHARE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active teacher access is required' USING ERRCODE = '42501';
    END IF;

    v_period_start := pg_catalog.make_date(p_year, p_month, 1);
    v_period_end := (v_period_start + INTERVAL '1 month')::date;

    WITH valid_present_attendance AS (
        SELECT m.id, m.teacher_id, m.teaching_group_id, m.enrollment_id,
               m.session_date, m.created_at, a.teacher_recorded_at,
               tg.name AS teaching_group_name, e.package_type
        FROM public.meetings AS m
        JOIN public.attendance AS a ON a.meeting_id = m.id AND a.teacher_status = 'present'
        JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e ON e.id = m.enrollment_id
        JOIN public.enrollment_teaching_group_assignments AS etga
          ON etga.enrollment_id = m.enrollment_id AND etga.teaching_group_id = m.teaching_group_id
        WHERE m.teacher_id = v_teacher_id
          AND tg.teacher_id = v_teacher_id
          AND tg.is_active
          AND m.session_date >= v_period_start
          AND m.session_date < v_period_end
          AND e.package_type = tg.group_type
    ), logical_sessions AS (
        SELECT v.teacher_id, v.teaching_group_id, v.session_date, v.teaching_group_name,
               v.package_type, min(v.teacher_recorded_at) AS session_time,
               count(*)::bigint AS present_students,
               CASE WHEN v.package_type = 'private' THEN count(*) * 15000 ELSE count(*) * 8000 END::numeric AS fee
        FROM valid_present_attendance AS v
        GROUP BY v.teacher_id, v.teaching_group_id, v.session_date, v.teaching_group_name, v.package_type,
                 CASE WHEN v.package_type = 'private' THEN v.id::text ELSE v.teaching_group_id::text END
    )
    SELECT COALESCE(sum(ls.fee), 0) INTO v_live_earned FROM logical_sessions AS ls;

    SELECT tfp.* INTO v_settlement
    FROM public.teacher_fee_periods AS tfp
    WHERE tfp.teacher_id = v_teacher_id AND tfp.period_start = v_period_start;

    IF FOUND THEN
        v_status := v_settlement.status;
        v_earned := v_settlement.earned_amount;
        v_paid := COALESCE(v_settlement.paid_amount, 0);
    ELSE
        v_earned := v_live_earned;
    END IF;

    IF p_status <> 'all' AND p_status <> v_status THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH valid_present_attendance AS (
        SELECT m.id, m.teacher_id, m.teaching_group_id, m.enrollment_id,
               m.session_date, m.created_at, a.teacher_recorded_at,
               tg.name AS teaching_group_name, e.package_type
        FROM public.meetings AS m
        JOIN public.attendance AS a ON a.meeting_id = m.id AND a.teacher_status = 'present'
        JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e ON e.id = m.enrollment_id
        JOIN public.enrollment_teaching_group_assignments AS etga
          ON etga.enrollment_id = m.enrollment_id AND etga.teaching_group_id = m.teaching_group_id
        WHERE m.teacher_id = v_teacher_id
          AND tg.teacher_id = v_teacher_id
          AND tg.is_active
          AND m.session_date >= v_period_start
          AND m.session_date < v_period_end
          AND e.package_type = tg.group_type
    ), logical_sessions AS (
        SELECT v.teacher_id, v.teaching_group_id, v.session_date, v.teaching_group_name,
               v.package_type, min(v.teacher_recorded_at) AS session_time,
               min(v.created_at) AS first_created_at, count(*)::bigint AS present_students,
               CASE WHEN v.package_type = 'private' THEN count(*) * 15000 ELSE count(*) * 8000 END::numeric AS fee
        FROM valid_present_attendance AS v
        GROUP BY v.teacher_id, v.teaching_group_id, v.session_date, v.teaching_group_name, v.package_type,
                 CASE WHEN v.package_type = 'private' THEN v.id::text ELSE v.teaching_group_id::text END
    )
    SELECT ls.session_date, ls.session_time,
           row_number() OVER (PARTITION BY ls.teaching_group_id ORDER BY ls.session_date, ls.first_created_at)::bigint,
           ls.teaching_group_name, ls.package_type, ls.present_students, ls.fee,
           v_status, v_period_start, v_earned, v_paid, v_earned - v_paid,
           v_settlement.paid_at
    FROM logical_sessions AS ls
    ORDER BY ls.session_date DESC, ls.session_time DESC, ls.teaching_group_name;
END;
$$;

CREATE FUNCTION public.admin_mark_teacher_fee_period_paid(
    p_teacher_id uuid,
    p_period_start date
)
RETURNS public.teacher_fee_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_period_end date;
    v_earned numeric := 0;
    v_period public.teacher_fee_periods%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active admin access is required' USING ERRCODE = '42501';
    END IF;

    IF p_teacher_id IS NULL OR p_period_start IS NULL
       OR p_period_start <> pg_catalog.date_trunc('month', p_period_start)::date THEN
        RAISE EXCEPTION 'Teacher and first day of the fee month are required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.teachers AS t WHERE t.id = p_teacher_id FOR KEY SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teacher not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.teacher_fee_periods (teacher_id, period_start, earned_amount)
    VALUES (p_teacher_id, p_period_start, 0)
    ON CONFLICT (teacher_id, period_start) DO NOTHING;

    SELECT tfp.* INTO v_period
    FROM public.teacher_fee_periods AS tfp
    WHERE tfp.teacher_id = p_teacher_id AND tfp.period_start = p_period_start
    FOR UPDATE;

    IF v_period.status = 'paid' THEN
        RAISE EXCEPTION 'Teacher fee period has already been paid' USING ERRCODE = 'P0001';
    END IF;

    v_period_end := (p_period_start + INTERVAL '1 month')::date;

    WITH valid_present_attendance AS (
        SELECT m.id, m.teaching_group_id, m.session_date, e.package_type
        FROM public.meetings AS m
        JOIN public.attendance AS a ON a.meeting_id = m.id AND a.teacher_status = 'present'
        JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e ON e.id = m.enrollment_id
        JOIN public.enrollment_teaching_group_assignments AS etga
          ON etga.enrollment_id = m.enrollment_id AND etga.teaching_group_id = m.teaching_group_id
        WHERE m.teacher_id = p_teacher_id
          AND tg.teacher_id = p_teacher_id
          AND tg.is_active
          AND m.session_date >= p_period_start
          AND m.session_date < v_period_end
          AND e.package_type = tg.group_type
    ), logical_sessions AS (
        SELECT v.teaching_group_id, v.session_date, v.package_type,
               CASE WHEN v.package_type = 'private' THEN count(*) * 15000 ELSE count(*) * 8000 END::numeric AS fee
        FROM valid_present_attendance AS v
        GROUP BY v.teaching_group_id, v.session_date, v.package_type,
                 CASE WHEN v.package_type = 'private' THEN v.id::text ELSE v.teaching_group_id::text END
    )
    SELECT COALESCE(sum(ls.fee), 0) INTO v_earned FROM logical_sessions AS ls;

    UPDATE public.teacher_fee_periods AS tfp
    SET earned_amount = v_earned,
        status = 'paid',
        paid_amount = v_earned,
        paid_at = now(),
        paid_by = auth.uid()
    WHERE tfp.id = v_period.id
    RETURNING * INTO v_period;

    RETURN v_period;
END;
$$;

CREATE FUNCTION public.admin_get_teacher_fee_periods(p_month integer, p_year integer)
RETURNS TABLE (
    teacher_id uuid,
    teacher_name text,
    period_start date,
    earned_amount numeric,
    due_date date,
    status text,
    paid_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_period_start date;
    v_period_end date;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active admin access is required' USING ERRCODE = '42501';
    END IF;

    IF p_month NOT BETWEEN 1 AND 12 OR p_year NOT BETWEEN 2000 AND 9999 THEN
        RAISE EXCEPTION 'A valid month and year are required' USING ERRCODE = '22023';
    END IF;

    v_period_start := pg_catalog.make_date(p_year, p_month, 1);
    v_period_end := (v_period_start + INTERVAL '1 month')::date;

    RETURN QUERY
    WITH valid_present_attendance AS (
        SELECT m.id, m.teacher_id, m.teaching_group_id, m.session_date, e.package_type
        FROM public.meetings AS m
        JOIN public.attendance AS a ON a.meeting_id = m.id AND a.teacher_status = 'present'
        JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e ON e.id = m.enrollment_id
        JOIN public.enrollment_teaching_group_assignments AS etga
          ON etga.enrollment_id = m.enrollment_id AND etga.teaching_group_id = m.teaching_group_id
        WHERE m.teacher_id = tg.teacher_id
          AND tg.is_active
          AND m.session_date >= v_period_start
          AND m.session_date < v_period_end
          AND e.package_type = tg.group_type
    ), logical_sessions AS (
        SELECT v.teacher_id, v.teaching_group_id, v.session_date, v.package_type,
               CASE WHEN v.package_type = 'private' THEN count(*) * 15000 ELSE count(*) * 8000 END::numeric AS fee
        FROM valid_present_attendance AS v
        GROUP BY v.teacher_id, v.teaching_group_id, v.session_date, v.package_type,
                 CASE WHEN v.package_type = 'private' THEN v.id::text ELSE v.teaching_group_id::text END
    ), live_amounts AS (
        SELECT ls.teacher_id, sum(ls.fee)::numeric AS earned_amount
        FROM logical_sessions AS ls
        GROUP BY ls.teacher_id
    )
    SELECT t.id, p.full_name, v_period_start,
           COALESCE(tfp.earned_amount, la.earned_amount, 0),
           ((v_period_start + INTERVAL '1 month')::date + 9),
           COALESCE(tfp.status, 'unpaid'), tfp.paid_at
    FROM public.teachers AS t
    JOIN public.profiles AS p ON p.id = t.profile_id
    LEFT JOIN live_amounts AS la ON la.teacher_id = t.id
    LEFT JOIN public.teacher_fee_periods AS tfp
      ON tfp.teacher_id = t.id AND tfp.period_start = v_period_start
    WHERE p.role = 'teacher'::public.user_role
    ORDER BY p.full_name, t.id;
END;
$$;

REVOKE ALL ON TABLE public.teacher_fee_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.teacher_fee_periods TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_teacher_fee_report(integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_mark_teacher_fee_period_paid(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_teacher_fee_periods(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_fee_report(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_teacher_fee_period_paid(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_teacher_fee_periods(integer, integer) TO authenticated;
