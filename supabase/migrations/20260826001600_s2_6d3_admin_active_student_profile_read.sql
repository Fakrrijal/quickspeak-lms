-- S2.6D3 Admin Active Student Profile Read Authorization

CREATE POLICY "Admins can view active student profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND role = 'student'::public.user_role
        AND status = 'active'::public.user_status
    );