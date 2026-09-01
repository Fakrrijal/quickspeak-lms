-- S11.1 Meeting Grant Hardening
-- Restricts direct table access and RPC execution to the approved roles.

REVOKE ALL ON TABLE public.meetings FROM anon, authenticated;
GRANT SELECT ON TABLE public.meetings TO authenticated;

REVOKE ALL ON FUNCTION public.record_meeting(uuid, uuid, uuid, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_meeting(uuid, uuid, uuid, date) TO authenticated;
