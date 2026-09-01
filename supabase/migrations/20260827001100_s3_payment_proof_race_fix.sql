-- S3 Payment Proof Submission Race Fix
-- Lock the accepted Storage metadata row until the payment proof reference is
-- committed. A concurrent Storage API DELETE must wait for this transaction.

CREATE OR REPLACE FUNCTION public.submit_payment_proof(
    p_payment_id uuid,
    p_storage_path text,
    p_original_filename text,
    p_mime_type text,
    p_file_size integer
)
RETURNS TABLE (
    payment_proof_id uuid,
    payment_status text,
    enrollment_status text,
    uploaded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_auth_uid uuid := auth.uid();
    v_student public.students%ROWTYPE;
    v_payment public.payments%ROWTYPE;
    v_invoice public.invoices%ROWTYPE;
    v_enrollment public.enrollments%ROWTYPE;
    v_existing_proof public.payment_proofs%ROWTYPE;
    v_proof public.payment_proofs%ROWTYPE;
    v_filename text;
    v_extension text;
    v_filename_uuid text;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_student
    FROM public.students
    WHERE profile_id = v_auth_uid
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student record not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_invoice
    FROM public.invoices
    WHERE id = v_payment.invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment invoice not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_enrollment
    FROM public.enrollments
    WHERE id = v_invoice.enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment enrollment not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_enrollment.student_id <> v_student.id THEN
        RAISE EXCEPTION 'Not authorized to submit proof for this payment'
            USING ERRCODE = '42501';
    END IF;

    IF v_payment.status = 'proof_submitted' THEN
        SELECT *
        INTO v_existing_proof
        FROM public.payment_proofs
        WHERE payment_id = v_payment.id
          AND storage_path = p_storage_path
        ORDER BY uploaded_at DESC, id DESC
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY
            SELECT
                v_existing_proof.id,
                v_payment.status,
                v_enrollment.status,
                v_existing_proof.uploaded_at;
            RETURN;
        END IF;

        RAISE EXCEPTION 'Payment proof has already been submitted'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_payment.status = 'approved' THEN
        RAISE EXCEPTION 'Payment has already been approved'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_payment.status NOT IN ('unpaid', 'rejected') THEN
        RAISE EXCEPTION 'Payment is not eligible for proof submission'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_enrollment.status NOT IN ('payment_pending', 'payment_rejected') THEN
        RAISE EXCEPTION 'Enrollment is not eligible for proof submission'
            USING ERRCODE = 'P0001';
    END IF;

    v_filename := SPLIT_PART(p_storage_path, '/', 3);

    IF p_storage_path <> format('%s/%s/%s', v_student.id, v_payment.id, v_filename)
       OR v_filename = ''
       OR SPLIT_PART(p_storage_path, '/', 4) <> '' THEN
        RAISE EXCEPTION 'Invalid payment proof storage path'
            USING ERRCODE = '22023';
    END IF;

    v_extension := lower(substring(v_filename FROM '\.([^.]+)$'));
    v_filename_uuid := regexp_replace(v_filename, '\.[^.]+$', '');

    IF v_filename_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Payment proof filename must use a UUID'
            USING ERRCODE = '22023';
    END IF;

    IF (v_extension = 'pdf' AND p_mime_type <> 'application/pdf')
       OR (v_extension IN ('jpg', 'jpeg') AND p_mime_type <> 'image/jpeg')
       OR (v_extension = 'png' AND p_mime_type <> 'image/png')
       OR v_extension NOT IN ('pdf', 'jpg', 'jpeg', 'png') THEN
        RAISE EXCEPTION 'Payment proof file type is not allowed'
            USING ERRCODE = '22023';
    END IF;

    IF p_file_size IS NULL OR p_file_size <= 0 OR p_file_size > 5242880 THEN
        RAISE EXCEPTION 'Payment proof file size must be between 1 byte and 5 MiB'
            USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM storage.objects
    WHERE bucket_id = 'payment_proofs'
      AND name = p_storage_path
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment proof storage object was not found'
            USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.payment_proofs (
        payment_id,
        storage_path,
        original_filename,
        mime_type,
        file_size
    )
    VALUES (
        v_payment.id,
        p_storage_path,
        p_original_filename,
        p_mime_type,
        p_file_size
    )
    RETURNING * INTO v_proof;

    UPDATE public.payments
    SET status = 'proof_submitted'
    WHERE id = v_payment.id;

    UPDATE public.enrollments
    SET status = 'payment_submitted'
    WHERE id = v_enrollment.id;

    RETURN QUERY
    SELECT
        v_proof.id,
        'proof_submitted'::text,
        'payment_submitted'::text,
        v_proof.uploaded_at;
END;
$function$;
