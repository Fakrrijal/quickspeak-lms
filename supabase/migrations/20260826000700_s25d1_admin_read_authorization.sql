CREATE POLICY "Admins can view waiting student profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND role = 'student'::public.user_role
        AND status = 'waiting'::public.user_status
    );

CREATE POLICY "Admins can view active teaching groups"
    ON public.teaching_groups
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND is_active = true
    );
