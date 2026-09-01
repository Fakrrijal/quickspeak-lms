-- In-app notifications. Records are created only by trusted database triggers;
-- browser clients may only read their own records and mark them read.
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('finance', 'academic', 'operational', 'system', 'registration')),
    event_type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    target_path text NOT NULL CHECK (target_path LIKE '/%'),
    target_entity text NULL,
    target_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_created_at
    ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notifications_recipient_unread
    ON public.notifications (recipient_id, is_read)
    WHERE is_read = false;
CREATE UNIQUE INDEX notifications_event_entity_recipient_unique
    ON public.notifications (recipient_id, event_type, target_entity, target_id)
    WHERE target_entity IS NOT NULL AND target_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT TO authenticated
    USING (recipient_id = auth.uid());

CREATE POLICY "Users can mark own notifications read"
    ON public.notifications FOR UPDATE TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.create_notification_internal(
    p_recipient_id uuid,
    p_category text,
    p_event_type text,
    p_title text,
    p_message text,
    p_target_path text,
    p_target_entity text,
    p_target_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.notifications (
        recipient_id, category, event_type, title, message,
        target_path, target_entity, target_id
    ) VALUES (
        p_recipient_id, p_category, p_event_type, p_title, p_message,
        p_target_path, p_target_entity, p_target_id
    )
    ON CONFLICT (recipient_id, event_type, target_entity, target_id)
    WHERE target_entity IS NOT NULL AND target_id IS NOT NULL
    DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.create_notification_internal(uuid, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_registration_application_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE admin_id uuid;
BEGIN
    FOR admin_id IN
        SELECT id FROM public.profiles
        WHERE role = 'admin'::public.user_role AND status = 'active'::public.user_status
    LOOP
        PERFORM public.create_notification_internal(
            admin_id, 'registration',
            CASE WHEN NEW.role = 'student'::public.user_role THEN 'STUDENT_REGISTRATION' ELSE 'TEACHER_REGISTRATION' END,
            CASE WHEN NEW.role = 'student'::public.user_role THEN 'New Student Registration' ELSE 'New Teacher Registration' END,
            CASE WHEN NEW.role = 'student'::public.user_role THEN 'A student registration is ready for review.' ELSE 'A teacher registration is ready for review.' END,
            CASE WHEN NEW.role = 'student'::public.user_role THEN '/admin/waiting-students' ELSE '/admin/waiting-teachers' END,
            'registration_application', NEW.id
        );
    END LOOP;
    RETURN NEW;
END;
$$;
CREATE TRIGGER registration_application_notification
AFTER INSERT ON public.registration_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_registration_application_created();

CREATE OR REPLACE FUNCTION public.notify_payment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE student_profile_id uuid; admin_id uuid;
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
        FOR admin_id IN SELECT id FROM public.profiles WHERE role = 'admin'::public.user_role AND status = 'active'::public.user_status LOOP
            PERFORM public.create_notification_internal(admin_id, 'finance', 'PAYMENT_WAITING_VERIFICATION', 'Payment Waiting for Verification', 'A payment proof is ready for verification.', '/admin/payments', 'payment', NEW.id);
        END LOOP;
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
        FOR admin_id IN SELECT id FROM public.profiles WHERE role = 'admin'::public.user_role AND status = 'active'::public.user_status LOOP
            PERFORM public.create_notification_internal(admin_id, 'finance', 'PAYMENT_STATUS_UPDATE', 'Payment Status Update', 'A payment verification status was updated.', '/admin/payments', 'payment_status', NEW.id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER payment_status_notification
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_status_change();

CREATE OR REPLACE FUNCTION public.notify_profile_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.role NOT IN ('student'::public.user_role, 'teacher'::public.user_role) THEN
        RETURN NEW;
    END IF;
    IF OLD.status = 'waiting'::public.user_status AND NEW.status = 'active'::public.user_status THEN
        PERFORM public.create_notification_internal(NEW.id, 'system', 'ACCOUNT_APPROVED', 'Account Approved', 'Your QuickSpeak account has been approved.', CASE WHEN NEW.role = 'student'::public.user_role THEN '/student' ELSE '/teacher' END, 'profile', NEW.id);
    ELSE
        PERFORM public.create_notification_internal(NEW.id, 'system', 'ACCOUNT_STATUS_CHANGED', 'Account Status Changed', 'Your account status has been changed to ' || NEW.status::text || '.', CASE WHEN NEW.role = 'student'::public.user_role THEN '/student/profile' ELSE '/teacher/profile' END, 'profile_status', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER profile_status_notification
AFTER UPDATE OF status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_profile_status_change();

CREATE OR REPLACE FUNCTION public.notify_teacher_fee_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient uuid;
BEGIN
    SELECT profile_id INTO recipient FROM public.teachers WHERE id = NEW.teacher_id;
    IF recipient IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'INSERT' AND NEW.earned_amount > 0 THEN
        PERFORM public.create_notification_internal(recipient, 'finance', 'TEACHER_FEE_AVAILABLE', 'Teacher Fee Available', 'Your teacher fee is available to review.', '/teacher/fee', 'teacher_fee_period', NEW.id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
        PERFORM public.create_notification_internal(recipient, 'finance', 'TEACHER_FEE_PROCESSED', 'Teacher Fee Processed', 'Your teacher fee has been processed.', '/teacher/fee', 'teacher_fee_payment', NEW.id);
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER teacher_fee_notification
AFTER INSERT OR UPDATE OF status ON public.teacher_fee_periods
FOR EACH ROW EXECUTE FUNCTION public.notify_teacher_fee_change();
