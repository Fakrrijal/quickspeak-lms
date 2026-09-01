-- S4 Admin Payment Verification
-- Admin decisions are made only through the controlled RPC below.

CREATE POLICY "Admins can view enrollments"
    ON public.enrollments FOR SELECT
    TO authenticated
    USING (public.is_admin());

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
AS $function$
DECLARE
    v_auth_uid uuid := auth.uid();
    v_payment public.payments%ROWTYPE;
    v_invoice public.invoices%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_rejection_reason text;
    v_verified_at timestamptz := now();
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Payment decision must be approve or reject'
            USING ERRCODE = '22023';
    END IF;

    IF p_decision = 'reject' THEN
        v_rejection_reason := btrim(p_rejection_reason);

        IF v_rejection_reason IS NULL OR v_rejection_reason = '' THEN
            RAISE EXCEPTION 'A rejection reason is required'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    SELECT *
    INTO v_payment
    FROM public.payments AS p
    WHERE p.id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices AS i
    WHERE i.id = v_payment.invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment invoice not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_enrollment
    FROM public.enrollments AS e
    WHERE e.id = v_invoice.enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment enrollment not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_payment.status <> 'proof_submitted' THEN
        RAISE EXCEPTION 'Payment was already processed. Refreshing the list.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_invoice.status <> 'unpaid'
       OR v_enrollment.status <> 'payment_submitted' THEN
        RAISE EXCEPTION 'Payment review state is no longer eligible'
            USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.payment_proofs AS pp
    WHERE pp.payment_id = v_payment.id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment proof not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF p_decision = 'approve' THEN
        UPDATE public.payments
        SET
            status = 'approved',
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

        RETURN QUERY
        SELECT
            v_payment.id,
            'approved'::text,
            v_invoice.id,
            'paid'::text,
            v_enrollment.id,
            'payment_approved'::text,
            v_auth_uid,
            v_verified_at;
        RETURN;
    END IF;

    UPDATE public.payments
    SET
        status = 'rejected',
        verified_by = v_auth_uid,
        verified_at = v_verified_at,
        rejection_reason = v_rejection_reason
    WHERE id = v_payment.id;

    UPDATE public.enrollments
    SET status = 'payment_rejected'
    WHERE id = v_enrollment.id;

    RETURN QUERY
    SELECT
        v_payment.id,
        'rejected'::text,
        v_invoice.id,
        'unpaid'::text,
        v_enrollment.id,
        'payment_rejected'::text,
        v_auth_uid,
        v_verified_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_review_payment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid, text, text)
TO authenticated;
