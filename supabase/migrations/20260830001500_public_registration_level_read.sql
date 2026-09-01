-- Phase B blocker fix: allow public registration to read canonical levels.
-- Anonymous access is restricted to the reference fields consumed by the
-- registration form; no write privileges are granted.

CREATE POLICY "Anonymous users can view registration levels"
    ON public.levels FOR SELECT
    TO anon
    USING (true);

GRANT SELECT (id, level_number, name) ON public.levels TO anon;
