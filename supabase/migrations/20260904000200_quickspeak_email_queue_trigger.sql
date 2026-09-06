-- QuickSpeak Email Queue Trigger for Waiting Registrations
-- Automatically queues a notification email when a new user registers
-- with status = 'waiting'. Uses SECURITY DEFINER so it bypasses RLS
-- on email_queue, and catches all errors so it never breaks registration.

CREATE OR REPLACE FUNCTION public.queue_waiting_registration_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IN ('student', 'teacher') THEN
        INSERT INTO public.email_queue (
            event_type,
            target_id,
            recipient_email,
            subject,
            payload
        )
        VALUES (
            CASE NEW.role
                WHEN 'student' THEN 'WAITING_STUDENTS'
                WHEN 'teacher' THEN 'WAITING_TEACHERS'
            END,
            NEW.id,
            'quickspeaklms@gmail.com',
            CASE NEW.role
                WHEN 'student' THEN '[QuickSpeak] Waiting Students'
                WHEN 'teacher' THEN '[QuickSpeak] Waiting Teachers'
            END,
            jsonb_build_object(
                'full_name', NEW.full_name,
                'email', NEW.email,
                'phone', NEW.phone,
                'role', NEW.role
            )
        )
        ON CONFLICT (event_type, target_id, recipient_email) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NEW;
END;
$$;

CREATE TRIGGER queue_waiting_registration_email_trigger
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    WHEN (NEW.status = 'waiting')
    EXECUTE FUNCTION public.queue_waiting_registration_email();
