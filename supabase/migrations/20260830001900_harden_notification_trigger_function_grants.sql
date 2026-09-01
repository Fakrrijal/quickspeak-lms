-- Trigger helpers are internal implementation details and must not be callable
-- by browser roles. The notification creator was already revoked in the
-- foundation migration; revoke PostgreSQL's default PUBLIC execute privilege
-- from the remaining trigger functions as well.
REVOKE ALL ON FUNCTION public.notify_registration_application_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_payment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_profile_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_teacher_fee_change() FROM PUBLIC, anon, authenticated;
