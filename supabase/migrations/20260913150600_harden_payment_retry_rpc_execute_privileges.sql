-- Harden payment retry RPC privileges.
-- Supabase default function privileges in production grant EXECUTE to anon;
-- remove that access explicitly and keep retry available only to authenticated users.

REVOKE EXECUTE ON FUNCTION public.retry_student_payment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_student_payment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.retry_student_payment(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.close_invoice_on_payment_rejection() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_invoice_on_payment_rejection() FROM anon;

REVOKE EXECUTE ON FUNCTION public.reject_proof_for_closed_payment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_proof_for_closed_payment() FROM anon;
