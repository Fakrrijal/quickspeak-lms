CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE student_profile_id uuid; admin_id uuid; student_email text;
BEGIN
    SELECT s.profile_id INTO student_profile_id
    FROM public.invoices i JOIN public.enrollments e ON e.id = i.enrollment_id
    JOIN public.students s ON s.id = e.student_id
    WHERE i.id = NEW.invoice_id;

    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status IN ('approved', 'rejected') AND student_profile_id IS NOT NULL THEN
        PERFORM public.create_notification_internal(
            student_profile_id, 'finance',
            CASE WHEN NEW.status = 'approved' THEN 'PAYMENT_APPROVED' ELSE 'PAYMENT_REJECTED' END,
            CASE WHEN NEW.status = 'approved' THEN 'Payment Approved' ELSE 'Payment Rejected' END,
            CASE WHEN NEW.status = 'approved' THEN 'Your payment has been approved.' ELSE 'Your payment was rejected. Please review the payment details.' END,
            '/student-payment', 'payment', NEW.id
        );
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'proof_submitted' THEN
        SELECT email INTO student_email FROM public.profiles WHERE id = student_profile_id;

        BEGIN
            INSERT INTO public.email_queue (
                event_type,
                target_id,
                recipient_email,
                subject,
                payload
            )
            VALUES (
                'PAYMENT_VERIFICATION',
                NEW.id,
                'quickspeaklms@gmail.com',
                '[QuickSpeak] Payment Verification',
                jsonb_build_object(
                    'payment_id', NEW.id,
                    'invoice_id', NEW.invoice_id,
                    'student_email', student_email,
                    'amount', NEW.amount,
                    'status', NEW.status
                )
            )
            ON CONFLICT (event_type, target_id, recipient_email) DO NOTHING;
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        FOR admin_id IN SELECT id FROM public.profiles WHERE role = 'admin'::public.user_role AND status = 'active'::public.user_status LOOP
            PERFORM public.create_notification_internal(admin_id, 'finance', 'PAYMENT_WAITING_VERIFICATION', 'Payment Waiting for Verification', 'A payment proof is ready for verification.', '/admin/payments', 'payment', NEW.id);
        END LOOP;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
        FOR admin_id IN SELECT id FROM public.profiles WHERE role = 'admin'::public.user_role AND status = 'active'::public.user_status LOOP
            PERFORM public.create_notification_internal(admin_id, 'finance', 'PAYMENT_STATUS_UPDATE', 'Payment Status Update', 'A payment verification status was updated.', '/admin/payments', 'payment_status', NEW.id);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_status_notification ON public.payments;
CREATE TRIGGER payment_status_notification
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_status_change();
