-- The live function ACL included an EXECUTE grant for anon. Keep browser
-- access restricted to authenticated callers; the function also checks
-- auth.uid(). Existing service-role access is intentionally left unchanged.
REVOKE ALL ON FUNCTION public.create_registration_application(
    UUID, TEXT, TEXT, UUID[]
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_registration_application(
    UUID, TEXT, TEXT, UUID[]
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_registration_application(
    UUID, TEXT, TEXT, UUID[]
) TO authenticated;
