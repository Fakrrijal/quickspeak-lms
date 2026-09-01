-- Canonical read model for teacher-fee reporting. It preserves the existing
-- meeting/attendance calculation and settlement snapshot semantics while
-- authorizing either the active teacher (self only) or an active admin.

CREATE FUNCTION public.get_teacher_fee_report(
    p_month integer,
    p_year integer,
    p_status text DEFAULT 'all',
    p_teacher_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    teacher_id uuid,
    teacher_name text,
    teacher_code text,
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
    v_is_admin boolean := public.is_admin();
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

    IF NOT v_is_admin THEN
        SELECT t.id INTO v_teacher_id
        FROM public.teachers AS t
        JOIN public.profiles AS p ON p.id = t.profile_id
        WHERE t.profile_id = auth.uid()
          AND t.is_active
          AND p.role = 'teacher'::public.user_role
          AND p.status = 'active'::public.user_status
        FOR KEY SHARE OF t;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active teacher or admin access is required' USING ERRCODE = '42501';
        END IF;

        IF p_teacher_ids IS NOT NULL
           AND (cardinality(p_teacher_ids) <> 1 OR p_teacher_ids[1] <> v_teacher_id) THEN
            RAISE EXCEPTION 'Teachers may only request their own fee report' USING ERRCODE = '42501';
        END IF;
    END IF;

    v_period_start := pg_catalog.make_date(p_year, p_month, 1);
    v_period_end := (v_period_start + INTERVAL '1 month')::date;

    RETURN QUERY
    WITH selected_teachers AS (
        SELECT t.id, p.full_name, t.teacher_code
        FROM public.teachers AS t
        JOIN public.profiles AS p ON p.id = t.profile_id
        WHERE p.role = 'teacher'::public.user_role
          AND (v_is_admin OR t.id = v_teacher_id)
          AND (p_teacher_ids IS NULL OR t.id = ANY(p_teacher_ids))
    ), valid_present_attendance AS (
        SELECT m.id, m.teacher_id, m.teaching_group_id, m.enrollment_id,
               m.session_date, m.created_at, a.teacher_recorded_at,
               tg.name AS teaching_group_name, e.package_type
        FROM public.meetings AS m
        JOIN public.attendance AS a ON a.meeting_id = m.id AND a.teacher_status = 'present'
        JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e ON e.id = m.enrollment_id
        JOIN public.enrollment_teaching_group_assignments AS etga
          ON etga.enrollment_id = m.enrollment_id AND etga.teaching_group_id = m.teaching_group_id
        JOIN selected_teachers AS st ON st.id = m.teacher_id
        WHERE m.teacher_id = tg.teacher_id
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
    ), live_amounts AS (
        SELECT ls.teacher_id, COALESCE(sum(ls.fee), 0)::numeric AS earned_amount
        FROM logical_sessions AS ls
        GROUP BY ls.teacher_id
    ), report_periods AS (
        SELECT st.id AS teacher_id, st.full_name AS teacher_name, st.teacher_code,
               COALESCE(tfp.status, 'unpaid') AS status,
               COALESCE(tfp.earned_amount, la.earned_amount, 0)::numeric AS earned_amount,
               COALESCE(tfp.paid_amount, 0)::numeric AS paid_amount,
               tfp.paid_at
        FROM selected_teachers AS st
        LEFT JOIN live_amounts AS la ON la.teacher_id = st.id
        LEFT JOIN public.teacher_fee_periods AS tfp
          ON tfp.teacher_id = st.id AND tfp.period_start = v_period_start
    )
    SELECT rp.teacher_id, rp.teacher_name, rp.teacher_code,
           ls.session_date, ls.session_time,
           row_number() OVER (PARTITION BY ls.teacher_id, ls.teaching_group_id ORDER BY ls.session_date, ls.first_created_at)::bigint,
           ls.teaching_group_name, ls.package_type, ls.present_students, ls.fee,
           rp.status, v_period_start, rp.earned_amount, rp.paid_amount,
           rp.earned_amount - rp.paid_amount, rp.paid_at
    FROM report_periods AS rp
    LEFT JOIN logical_sessions AS ls ON ls.teacher_id = rp.teacher_id
    WHERE p_status = 'all' OR rp.status = p_status
    ORDER BY rp.teacher_name, rp.teacher_id, ls.session_date DESC NULLS LAST, ls.session_time DESC NULLS LAST, ls.teaching_group_name;
END;
$$;

-- Preserve the established teacher-only RPC as a compatibility wrapper while
-- making it consume the canonical report source.
CREATE OR REPLACE FUNCTION public.get_my_teacher_fee_report(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT session_date, session_time, session_number, teaching_group_name,
           package_type, present_students, fee, status, period_start,
           earned_amount, paid_amount, outstanding_amount, paid_at
    FROM public.get_teacher_fee_report(p_month, p_year, p_status, NULL);
$$;

REVOKE ALL ON FUNCTION public.get_teacher_fee_report(integer, integer, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_fee_report(integer, integer, text, uuid[]) TO authenticated;
