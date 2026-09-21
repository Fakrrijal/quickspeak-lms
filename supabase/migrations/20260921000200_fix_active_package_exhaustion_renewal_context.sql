-- Treat an active current-level package with all sessions consumed as Renewal-ready.
-- This preserves the current Teacher/Teaching Group until the student explicitly
-- starts the renewal, at which point request_current_level_package_renewal()
-- transitions the exhausted active enrollment to completed and creates the new one.

CREATE OR REPLACE FUNCTION public.get_my_student_renewal_context()
RETURNS TABLE (
    student_id uuid,
    current_level_id uuid,
    current_level_name text,
    current_level_number integer,
    active_enrollment_id uuid,
    active_package_type text,
    active_enrollment_status text,
    active_session_count integer,
    active_session_limit integer,
    previous_enrollment_id uuid,
    previous_package_type text,
    previous_enrollment_status text,
    previous_session_count integer,
    previous_session_limit integer,
    teaching_group_id uuid,
    teaching_group_name text,
    teacher_id uuid,
    teacher_name text,
    teacher_code text,
    renewal_enrollment_id uuid,
    renewal_package_type text,
    renewal_price integer,
    renewal_status text,
    renewal_invoice_id uuid,
    renewal_invoice_number text,
    renewal_invoice_status text,
    renewal_payment_id uuid,
    renewal_payment_status text,
    renewal_available boolean,
    next_action text
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
    v_active public.enrollments%ROWTYPE;
    v_previous public.enrollments%ROWTYPE;
    v_renewal public.enrollments%ROWTYPE;
    v_membership public.teaching_group_students%ROWTYPE;
    v_group public.teaching_groups%ROWTYPE;
    v_teacher public.teachers%ROWTYPE;
    v_group_count integer := 0;
    v_active_sessions integer := 0;
    v_previous_sessions integer := 0;
    v_invoice public.invoices%ROWTYPE;
    v_payment public.payments%ROWTYPE;
    v_next_action text := 'package_selection';
    v_renewal_available boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
    END IF;

    SELECT s.*
    INTO v_student
    FROM public.students AS s
    JOIN public.profiles AS p ON p.id = s.profile_id
    WHERE s.profile_id = auth.uid()
      AND s.is_active
      AND p.role = 'student'
      AND p.status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active student access is required' USING ERRCODE = '42501';
    END IF;

    SELECT l.*
    INTO v_level
    FROM public.levels AS l
    WHERE l.id = v_student.level_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Current student level was not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_result
    FROM public.student_level_results AS slr
    WHERE slr.student_id = v_student.id
      AND slr.level_id = v_student.level_id
    LIMIT 1;

    SELECT e.*
    INTO v_active
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_student.level_id
      AND e.status = 'active'
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1;

    IF FOUND THEN
        SELECT count(*)::integer
        INTO v_active_sessions
        FROM public.meetings AS m
        WHERE m.enrollment_id = v_active.id;
    END IF;

    SELECT e.*
    INTO v_previous
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_student.level_id
      AND e.status = 'completed'
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1;

    IF FOUND THEN
        SELECT count(*)::integer
        INTO v_previous_sessions
        FROM public.meetings AS m
        WHERE m.enrollment_id = v_previous.id;
    END IF;

    SELECT e.*
    INTO v_renewal
    FROM public.enrollments AS e
    WHERE e.student_id = v_student.id
      AND e.level_id = v_student.level_id
      AND e.status IN (
          'pending',
          'payment_pending',
          'payment_submitted',
          'payment_rejected',
          'payment_approved',
          'teacher_assignment'
      )
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1;

    SELECT count(*)::integer
    INTO v_group_count
    FROM public.teaching_group_students AS tgs
    JOIN public.teaching_groups AS tg
      ON tg.id = tgs.teaching_group_id
    WHERE tgs.student_id = v_student.id
      AND tg.is_active;

    IF v_group_count = 1 THEN
        SELECT tgs.*
        INTO v_membership
        FROM public.teaching_group_students AS tgs
        JOIN public.teaching_groups AS tg
          ON tg.id = tgs.teaching_group_id
        WHERE tgs.student_id = v_student.id
          AND tg.is_active
        LIMIT 1;

        SELECT *
        INTO v_group
        FROM public.teaching_groups AS tg
        WHERE tg.id = v_membership.teaching_group_id
          AND tg.is_active;

        IF FOUND THEN
            SELECT *
            INTO v_teacher
            FROM public.teachers AS t
            WHERE t.id = v_group.teacher_id
              AND t.is_active;
        END IF;
    END IF;

    IF v_renewal.id IS NOT NULL THEN
        SELECT i.*
        INTO v_invoice
        FROM public.invoices AS i
        WHERE i.enrollment_id = v_renewal.id
        ORDER BY i.created_at DESC, i.id DESC
        LIMIT 1;

        IF v_invoice.id IS NOT NULL THEN
            SELECT p.*
            INTO v_payment
            FROM public.payments AS p
            WHERE p.invoice_id = v_invoice.id
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT 1;
        END IF;
    END IF;

    IF v_result.id IS NOT NULL THEN
        v_next_action := 'level_completed';
    ELSIF v_renewal.id IS NOT NULL THEN
        v_next_action := CASE v_renewal.status
            WHEN 'pending' THEN 'renewal_payment'
            WHEN 'payment_pending' THEN 'renewal_payment'
            WHEN 'payment_rejected' THEN 'renewal_payment'
            WHEN 'payment_submitted' THEN 'waiting_approval'
            WHEN 'payment_approved' THEN 'activation_pending'
            WHEN 'teacher_assignment' THEN 'activation_pending'
            ELSE 'renewal'
        END;
    ELSIF v_active.id IS NOT NULL THEN
        IF v_active_sessions >= COALESCE(v_active.session_limit, 8) THEN
            v_renewal_available := true;
            v_next_action := 'renewal';
        ELSE
            v_next_action := 'learning';
        END IF;
    ELSIF v_previous.id IS NOT NULL
          AND v_previous_sessions >= COALESCE(v_previous.session_limit, 8) THEN
        v_renewal_available := true;
        v_next_action := 'renewal';
    END IF;

    RETURN QUERY
    SELECT
        v_student.id,
        v_level.id,
        v_level.name,
        v_level.level_number,
        v_active.id,
        v_active.package_type,
        v_active.status,
        v_active_sessions,
        COALESCE(v_active.session_limit, 8),
        v_previous.id,
        v_previous.package_type,
        v_previous.status,
        v_previous_sessions,
        COALESCE(v_previous.session_limit, 8),
        CASE WHEN v_group_count = 1 THEN v_group.id ELSE NULL END,
        CASE WHEN v_group_count = 1 THEN v_group.name ELSE NULL END,
        CASE WHEN v_group_count = 1 THEN v_teacher.id ELSE NULL END,
        CASE WHEN v_group_count = 1 THEN tp.full_name ELSE NULL END,
        CASE WHEN v_group_count = 1 THEN v_teacher.teacher_code ELSE NULL END,
        v_renewal.id,
        v_renewal.package_type,
        v_renewal.price,
        v_renewal.status,
        v_invoice.id,
        v_invoice.invoice_number,
        v_invoice.status,
        v_payment.id,
        v_payment.status,
        v_renewal_available,
        v_next_action
    FROM (SELECT 1) AS one
    LEFT JOIN public.profiles AS tp
      ON tp.id = v_teacher.profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_student_renewal_context()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_student_renewal_context()
TO authenticated;
