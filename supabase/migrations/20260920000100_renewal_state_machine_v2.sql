-- Renewal state-machine read model and atomic approval handoff.
-- This migration is committed to the feature branch only.
-- It is intentionally NOT applied to the production Supabase project yet.

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

    IF v_active.id IS NOT NULL THEN
        v_next_action := 'learning';
    ELSIF v_result.id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.admin_review_payment(
    p_payment_id uuid,
    p_decision text,
    p_rejection_reason text DEFAULT NULL
)
RETURNS TABLE (
    payment_id uuid,
    payment_status text,
    invoice_id uuid,
    invoice_status text,
    enrollment_id uuid,
    enrollment_status text,
    verified_by uuid,
    verified_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_auth_uid uuid := auth.uid();
    v_payment public.payments%ROWTYPE;
    v_invoice public.invoices%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_verified_at timestamptz := now();
    v_membership_count integer := 0;
    v_membership public.teaching_group_students%ROWTYPE;
    v_group public.teaching_groups%ROWTYPE;
    v_teacher public.teachers%ROWTYPE;
    v_group_member_count integer := 0;
    v_max_capacity integer := 0;
    v_teacher_eligible boolean := false;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required' USING ERRCODE = '42501';
    END IF;

    IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Payment decision must be approve or reject' USING ERRCODE = '22023';
    END IF;

    IF p_decision = 'reject' AND NULLIF(btrim(p_rejection_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A rejection reason is required' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_payment
    FROM public.payments AS p
    WHERE p.id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_invoice
    FROM public.invoices AS i
    WHERE i.id = v_payment.invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment invoice not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.id = v_invoice.enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment enrollment not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_payment.status <> 'proof_submitted' THEN
        RAISE EXCEPTION 'Payment was already processed. Refreshing the list.' USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.status <> 'unpaid'
       OR v_enrollment.status <> 'payment_submitted' THEN
        RAISE EXCEPTION 'Payment review state is no longer eligible' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.payment_proofs AS pp
        WHERE pp.payment_id = v_payment.id
    ) THEN
        RAISE EXCEPTION 'Payment proof not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_decision = 'reject' THEN
        UPDATE public.payments
        SET status = 'rejected',
            verified_by = v_auth_uid,
            verified_at = v_verified_at,
            rejection_reason = btrim(p_rejection_reason)
        WHERE id = v_payment.id;

        UPDATE public.enrollments
        SET status = 'payment_rejected'
        WHERE id = v_enrollment.id;

        RETURN QUERY
        SELECT v_payment.id,
               'rejected'::text,
               v_invoice.id,
               'unpaid'::text,
               v_enrollment.id,
               'payment_rejected'::text,
               v_auth_uid,
               v_verified_at;
        RETURN;
    END IF;

    UPDATE public.payments
    SET status = 'approved',
        verified_by = v_auth_uid,
        verified_at = v_verified_at,
        rejection_reason = NULL
    WHERE id = v_payment.id;

    UPDATE public.invoices
    SET status = 'paid'
    WHERE id = v_invoice.id;

    UPDATE public.enrollments
    SET status = 'payment_approved'
    WHERE id = v_enrollment.id;

    -- Auto-adopt the existing Teacher/Teaching Group only when the old
    -- assignment is unambiguous and still valid. Otherwise leave the
    -- enrollment in payment_approved for explicit Admin assignment.
    SELECT count(*)::integer
    INTO v_membership_count
    FROM public.teaching_group_students AS tgs
    JOIN public.teaching_groups AS tg
      ON tg.id = tgs.teaching_group_id
    WHERE tgs.student_id = v_enrollment.student_id;

    IF v_membership_count = 1 THEN
        SELECT tgs.*
        INTO v_membership
        FROM public.teaching_group_students AS tgs
        WHERE tgs.student_id = v_enrollment.student_id
        LIMIT 1
        FOR UPDATE;

        SELECT *
        INTO v_group
        FROM public.teaching_groups AS tg
        WHERE tg.id = v_membership.teaching_group_id
        FOR UPDATE;

        SELECT *
        INTO v_teacher
        FROM public.teachers AS t
        WHERE t.id = v_group.teacher_id
        FOR KEY SHARE;

        SELECT count(*)::integer
        INTO v_group_member_count
        FROM public.teaching_group_students AS tgs
        WHERE tgs.teaching_group_id = v_group.id;

        v_max_capacity := CASE
            WHEN v_group.group_type = 'private' THEN 1
            WHEN v_group.group_type = 'semi_private' THEN 4
            ELSE 0
        END;

        SELECT EXISTS (
            SELECT 1
            FROM public.teacher_levels AS tl
            WHERE tl.teacher_id = v_teacher.id
              AND tl.level_id = v_enrollment.level_id
        )
        INTO v_teacher_eligible;

        IF v_group.is_active
           AND v_teacher.is_active
           AND v_group.level_id = v_enrollment.level_id
           AND v_group.group_type = v_enrollment.package_type
           AND v_max_capacity > 0
           AND v_group_member_count <= v_max_capacity
           AND v_teacher_eligible THEN
            PERFORM public.admin_adopt_existing_paid_enrollment_assignment(v_enrollment.id);
            SELECT *
            INTO v_enrollment
            FROM public.enrollments AS e
            WHERE e.id = v_enrollment.id;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_payment.id,
           'approved'::text,
           v_invoice.id,
           'paid'::text,
           v_enrollment.id,
           v_enrollment.status,
           v_auth_uid,
           v_verified_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_payment(uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid, text, text)
TO authenticated;
