-- Admin access to system_error_events
-- Enable RLS on system_error_events table
ALTER TABLE public.system_error_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admin can read system_error_events" ON public.system_error_events;
DROP POLICY IF EXISTS "Admin can update system_error_events" ON public.system_error_events;

-- Create SELECT policy for admin only
CREATE POLICY "Admin can read system_error_events"
ON public.system_error_events
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Create UPDATE policy for admin only
CREATE POLICY "Admin can update system_error_events"
ON public.system_error_events
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Note: INSERT and DELETE remain restricted to service_role only
-- These operations are only performed by the backend Edge Function
