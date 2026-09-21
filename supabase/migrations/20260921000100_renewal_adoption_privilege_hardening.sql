-- Harden the Renewal admin handoff RPC so anonymous callers cannot invoke it.
-- Authorization inside the function still requires an active administrator.

REVOKE EXECUTE
ON FUNCTION public.admin_adopt_existing_paid_enrollment_assignment(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.admin_adopt_existing_paid_enrollment_assignment(uuid)
TO authenticated;
