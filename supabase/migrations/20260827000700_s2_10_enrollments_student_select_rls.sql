-- S2.10 Student Enrollment Read Authorization

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS classes
        JOIN pg_catalog.pg_namespace AS namespaces
            ON namespaces.oid = classes.relnamespace
        WHERE namespaces.nspname = 'public'
          AND classes.relname = 'enrollments'
          AND classes.relrowsecurity
    ) THEN
        ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'enrollments'
          AND policyname = 'Students can view own enrollments'
    ) THEN
        CREATE POLICY "Students can view own enrollments"
            ON public.enrollments FOR SELECT
            TO authenticated
            USING (
                enrollments.student_id = (
                    SELECT students.id
                    FROM public.students
                    WHERE students.profile_id = auth.uid()
                )
            );
    END IF;
END;
$$;
