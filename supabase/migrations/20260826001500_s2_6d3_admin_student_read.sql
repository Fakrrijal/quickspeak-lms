-- S2.6D3 Admin Student Read Authorization

CREATE POLICY "Admins can view students"
    ON public.students
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
    );