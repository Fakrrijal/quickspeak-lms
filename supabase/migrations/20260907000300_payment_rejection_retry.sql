-- S4.1 Payment rejection retry
-- Keep rejected payment attempts immutable and create a new invoice/payment
-- attempt for the same enrollment when the student chooses Pay Again.

CREATE OR REPLACE FUNCTION public.retry_student_payment(
    p_enrollment_id uuid
)
RETURNS TABLE (
    enrollment_id uuid,
    invoice_id uuid,
    invoice_number text,
    invoice_amount integer,
    invoice_status text,
    payment_id uuid,
    payment_amount integer,
    payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_auth_uid uuid := auth.uid();
    v_enrollment public.enrollments%ROWTYPE;
    v_latest_payment public.payments%ROWTYPE;
    v_old_invoice public.invoices%ROWTYPE;
    v_invoice public.invoices%ROWTYPE;
    v_payment public.payments%ROWTYPE;
    v_attempt_number integer;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT e.*
    INTO v_enrollment
    FROM public.enrollments AS e
    JOIN public.students AS s
      ON s.id = e.student_id
    WHERE e.id = p_enrollment_id
      AND s.profile_id = v_auth_uid
    FOR UPDATE OF e;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment not found or not owned by the current student'
            USING ERRCODE = '42501';
    END IF;

    IF v_enrollment.status <> 'payment_rejected' THEN
        RAISE EXCEPTION 'Only a rejected payment can be retried'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT p.*
    INTO v_latest_payment
    FROM public.payments AS p
    JOIN public.invoices AS i
      ON i.id = p.invoice_id
    WHERE i.enrollment_id = v_enrollment.id
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1
    FOR UPDATE OF p;

    IF NOT FOUND OR v_latest_payment.status <> 'rejected' THEN
        RAISE EXCEPTION 'The latest payment attempt is not rejected'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT i.*
    INTO v_old_invoice
    FROM public.invoices AS i
    WHERE i.id = v_latest_payment.invoice_id
    FOR UPDATE;

    -- A rejected payment is a closed financial attempt. Preserve it in history.
    UPDATE public.invoices
    SET status = 'cancelled'
    WHERE id = v_old_invoice.id
      AND status <> 'paid';

    SELECT count(*) + 1
    INTO v_attempt_number
    FROM public.invoices
    WHERE enrollment_id = v_enrollment.id;

    INSERT INTO public.invoices (
        enrollment_id,
        invoice_number,
        amount,
        status
    )
    VALUES (
        v_enrollment.id,
        'INV-' || replace(v_enrollment.id::text, '-', '') || '-' || v_attempt_number::text,
        v_enrollment.price,
        'unpaid'
    )
    RETURNING * INTO v_invoice;

    INSERT INTO public.payments (
        invoice_id,
        amount,
        status,
        rejection_reason
    )
    VALUES (
        v_invoice.id,
        v_invoice.amount,
        'unpaid',
        NULL
    )
    RETURNING * INTO v_payment;

    UPDATE public.enrollments
    SET status = 'payment_pending'
    WHERE id = v_enrollment.id;

    RETURN QUERY
    SELECT
        v_enrollment.id,
        v_invoice.id,
        v_invoice.invoice_number,
        v_invoice.amount,
        v_invoice.status,
        v_payment.id,
        v_payment.amount,
        v_payment.status;
END;
$function$;

REVOKE ALL ON FUNCTION public.retry_student_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_student_payment(uuid) TO authenticated;

-- Close the invoice associated with a rejected payment even for legacy records
-- that were rejected before this retry flow was introduced.
CREATE OR REPLACE FUNCTION public.close_invoice_on_payment_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE public.invoices
        SET status = 'cancelled'
        WHERE id = NEW.invoice_id
          AND status <> 'paid';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS payments_close_invoice_on_rejection ON public.payments;

CREATE TRIGGER payments_close_invoice_on_rejection
AFTER UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.close_invoice_on_payment_rejection();

REVOKE ALL ON FUNCTION public.close_invoice_on_payment_rejection() FROM PUBLIC;
