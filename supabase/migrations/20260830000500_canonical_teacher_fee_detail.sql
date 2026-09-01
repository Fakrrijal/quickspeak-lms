-- Canonical teacher-fee detail read model. It keeps the established fee
-- qualifying set and rates, while exposing individual attendance rows.

DROP FUNCTION public.get_my_teacher_fee_report(integer, integer, text);
DROP FUNCTION public.get_teacher_fee_report(integer, integer, text, uuid[]);

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
    meeting_id uuid,
    session_date date,
    attendance_id uuid,
    attendance_recorded_at timestamptz,
    attendance_status text,
    teaching_group_id uuid,
    teaching_group_name text,
    level_id uuid,
    level_name text,
    package_type text,
    student_id uuid,
    student_name text,
    student_code text,
    fee_rate numeric,
    student_fee numeric,
    meeting_present_count bigint,
    meeting_fee numeric,
    is_fee_session_lead boolean,
    session_time timestamptz,
    session_number bigint,
    present_students bigint,
    fee numeric,
    status text,
    period_start date,
    earned_amount numeric,
    paid_amount numeric,
    outstanding_amount numeric,
    paid_at timestamptz,
    period_status text,
    period_earned numeric,
    period_paid numeric,
    period_outstanding numeric,
    detail_reconciles_period boolean
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
        WHERE t.profile_id = auth.uid() AND t.is_active
          AND p.role = 'teacher'::public.user_role AND p.status = 'active'::public.user_status
        FOR KEY SHARE OF t;
        IF NOT FOUND THEN RAISE EXCEPTION 'Active teacher or admin access is required' USING ERRCODE = '42501'; END IF;
        IF p_teacher_ids IS NOT NULL AND (cardinality(p_teacher_ids) <> 1 OR p_teacher_ids[1] <> v_teacher_id) THEN
            RAISE EXCEPTION 'Teachers may only request their own fee report' USING ERRCODE = '42501';
        END IF;
    END IF;

    v_period_start := pg_catalog.make_date(p_year, p_month, 1);
    v_period_end := (v_period_start + INTERVAL '1 month')::date;

    RETURN QUERY
    WITH selected_teachers AS (
        SELECT t.id, p.full_name, t.teacher_code
        FROM public.teachers AS t JOIN public.profiles AS p ON p.id = t.profile_id
        WHERE p.role = 'teacher'::public.user_role
          AND (v_is_admin OR t.id = v_teacher_id)
          AND (p_teacher_ids IS NULL OR t.id = ANY(p_teacher_ids))
    ), attendance_details AS (
        SELECT m.id AS meeting_id, m.teacher_id, m.student_id, m.level_id, m.enrollment_id,
               m.teaching_group_id, m.session_date, m.created_at AS meeting_created_at,
               a.id AS attendance_id, a.teacher_recorded_at, a.teacher_status,
               tg.name AS teaching_group_name, l.name AS level_name, e.package_type,
               s.student_code, student_profile.full_name AS student_name,
               CASE WHEN e.package_type = 'private' THEN 15000 ELSE 8000 END::numeric AS fee_rate,
               CASE WHEN e.package_type = 'private' THEN m.id::text ELSE tg.id::text || ':' || m.session_date::text END AS fee_session_key
        FROM public.meetings AS m
        JOIN public.attendance AS a ON a.meeting_id = m.id
        JOIN public.teaching_groups AS tg ON tg.id = m.teaching_group_id
        JOIN public.enrollments AS e ON e.id = m.enrollment_id
        JOIN public.enrollment_teaching_group_assignments AS etga ON etga.enrollment_id = m.enrollment_id AND etga.teaching_group_id = m.teaching_group_id
        JOIN public.students AS s ON s.id = m.student_id
        JOIN public.profiles AS student_profile ON student_profile.id = s.profile_id
        JOIN public.levels AS l ON l.id = m.level_id
        JOIN selected_teachers AS st ON st.id = m.teacher_id
        WHERE m.teacher_id = tg.teacher_id AND tg.is_active
          AND m.session_date >= v_period_start AND m.session_date < v_period_end
          AND e.package_type = tg.group_type
    ), logical_sessions_base AS (
        SELECT d.teacher_id, d.fee_session_key, d.session_date, d.teaching_group_id, d.teaching_group_name, d.package_type,
               min(d.teacher_recorded_at) AS session_time, min(d.meeting_created_at) AS first_created_at,
               count(*)::bigint AS present_students, sum(d.fee_rate)::numeric AS fee,
               (array_agg(d.attendance_id ORDER BY d.teacher_recorded_at, d.meeting_created_at, d.meeting_id))[1] AS lead_attendance_id
        FROM attendance_details AS d
        WHERE d.teacher_status = 'present'
        GROUP BY d.teacher_id, d.fee_session_key, d.session_date, d.teaching_group_id, d.teaching_group_name, d.package_type
    ), logical_sessions AS (
        SELECT lsb.*, row_number() OVER (PARTITION BY lsb.teacher_id, lsb.teaching_group_id ORDER BY lsb.session_date, lsb.first_created_at)::bigint AS session_number
        FROM logical_sessions_base AS lsb
    ), live_amounts AS (
        SELECT teacher_id, COALESCE(sum(fee), 0)::numeric AS earned_amount FROM logical_sessions GROUP BY teacher_id
    ), report_periods AS (
        SELECT st.id AS teacher_id, st.full_name AS teacher_name, st.teacher_code,
               COALESCE(tfp.status, 'unpaid') AS status,
               COALESCE(tfp.earned_amount, la.earned_amount, 0)::numeric AS earned_amount,
               COALESCE(tfp.paid_amount, 0)::numeric AS paid_amount, tfp.paid_at,
               COALESCE(la.earned_amount, 0)::numeric AS live_earned_amount
        FROM selected_teachers AS st
        LEFT JOIN live_amounts AS la ON la.teacher_id = st.id
        LEFT JOIN public.teacher_fee_periods AS tfp ON tfp.teacher_id = st.id AND tfp.period_start = v_period_start
    )
    SELECT rp.teacher_id, rp.teacher_name, rp.teacher_code,
           d.meeting_id, d.session_date, d.attendance_id, d.teacher_recorded_at, d.teacher_status,
           d.teaching_group_id, d.teaching_group_name, d.level_id, d.level_name, d.package_type,
           d.student_id, d.student_name, d.student_code, d.fee_rate,
           CASE WHEN d.teacher_status = 'present' THEN d.fee_rate ELSE 0 END::numeric AS student_fee,
           COALESCE(ls.present_students, 0), COALESCE(ls.fee, 0),
           COALESCE(d.attendance_id = ls.lead_attendance_id, false),
           ls.session_time, ls.session_number, COALESCE(ls.present_students, 0), COALESCE(ls.fee, 0),
           rp.status, v_period_start, rp.earned_amount, rp.paid_amount, rp.earned_amount - rp.paid_amount, rp.paid_at,
           rp.status, rp.earned_amount, rp.paid_amount, rp.earned_amount - rp.paid_amount,
           rp.live_earned_amount = rp.earned_amount
    FROM report_periods AS rp
    LEFT JOIN attendance_details AS d ON d.teacher_id = rp.teacher_id
    LEFT JOIN logical_sessions AS ls ON ls.teacher_id = d.teacher_id AND ls.fee_session_key = d.fee_session_key
    WHERE p_status = 'all' OR rp.status = p_status
    ORDER BY rp.teacher_name, rp.teacher_id, d.session_date DESC NULLS LAST, d.teacher_recorded_at DESC NULLS LAST, d.meeting_id DESC NULLS LAST;
END;
$$;

CREATE FUNCTION public.get_my_teacher_fee_report(p_month integer, p_year integer, p_status text DEFAULT 'all')
RETURNS TABLE (
    session_date date, session_time timestamptz, session_number bigint, teaching_group_name text,
    package_type text, present_students bigint, fee numeric, status text, period_start date,
    earned_amount numeric, paid_amount numeric, outstanding_amount numeric, paid_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $$
    SELECT session_date, session_time, session_number, teaching_group_name, package_type,
           present_students, fee, status, period_start, earned_amount, paid_amount,
           outstanding_amount, paid_at
    FROM public.get_teacher_fee_report(p_month, p_year, p_status, NULL)
    WHERE is_fee_session_lead;
$$;

REVOKE ALL ON FUNCTION public.get_teacher_fee_report(integer, integer, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_teacher_fee_report(integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_fee_report(integer, integer, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_fee_report(integer, integer, text) TO authenticated;
