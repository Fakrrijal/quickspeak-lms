-- Resolve the RETURNS TABLE output variable/table column ambiguity in the
-- invoice lookup while preserving the existing payment initialization flow.
CREATE OR REPLACE FUNCTION public.initialize_enrollment_payment(
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
    v_invoice public.invoices%ROWTYPE;
    v_payment public.payments%ROWTYPE;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_enrollment
    FROM public.enrollments
    WHERE id = p_enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.students
        WHERE id = v_enrollment.student_id
          AND profile_id = v_auth_uid
    ) THEN
        RAISE EXCEPTION 'Not authorized to initialize this enrollment payment'
            USING ERRCODE = '42501';
    END IF;

    IF v_enrollment.status <> 'payment_pending' THEN
        RAISE EXCEPTION 'Enrollment is not eligible for payment initialization'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices AS i
    WHERE i.enrollment_id = v_enrollment.id
    ORDER BY created_at, id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.invoices (
            enrollment_id,
            invoice_number,
            amount,
            status
        )
        VALUES (
            v_enrollment.id,
            'INV-' || replace(v_enrollment.id::text, '-', ''),
            v_enrollment.price,
            'unpaid'
        )
        RETURNING * INTO v_invoice;
    END IF;

    SELECT *
    INTO v_payment
    FROM public.payments AS p
    WHERE p.invoice_id = v_invoice.id
    ORDER BY created_at, id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.payments (
            invoice_id,
            amount,
            status
        )
        VALUES (
            v_invoice.id,
            v_invoice.amount,
            'unpaid'
        )
        RETURNING * INTO v_payment;
    END IF;

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

REVOKE ALL ON FUNCTION public.initialize_enrollment_payment(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.initialize_enrollment_payment(uuid)
TO authenticated;
