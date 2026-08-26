CREATE POLICY "Admins can view active teacher profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        AND role = 'teacher'::public.user_role
        AND status = 'active'::public.user_status
    );

CREATE POLICY "Admins can view teacher records"
    ON public.teachers
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
    );

CREATE POLICY "Admins can view teaching group memberships"
    ON public.teaching_group_students
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
    );
