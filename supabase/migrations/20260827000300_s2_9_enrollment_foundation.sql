ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES public.students(id)
        ON DELETE RESTRICT,

    level_id UUID NOT NULL
        REFERENCES public.levels(id)
        ON DELETE RESTRICT,

    package_type TEXT NOT NULL,

    price INTEGER NOT NULL,

    session_limit INTEGER NOT NULL DEFAULT 8,

    status TEXT NOT NULL DEFAULT 'pending',

    started_at TIMESTAMPTZ NULL,

    completed_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT enrollments_package_type_check
        CHECK (
            package_type IN ('private', 'semi_private')
        ),

    CONSTRAINT enrollments_price_check
        CHECK (
            (package_type = 'private' AND price = 180000)
            OR
            (package_type = 'semi_private' AND price = 150000)
        ),

    CONSTRAINT enrollments_session_limit_check
        CHECK (session_limit = 8),

    CONSTRAINT enrollments_status_check
        CHECK (
            status IN (
                'pending',
                'payment_pending',
                'payment_submitted',
                'payment_rejected',
                'payment_approved',
                'teacher_assignment',
                'active',
                'completed',
                'cancelled'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id
    ON public.enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_level_id
    ON public.enrollments(level_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_status
    ON public.enrollments(status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'enrollments_updated_at'
          AND tgrelid = 'public.enrollments'::regclass
    ) THEN
        CREATE TRIGGER enrollments_updated_at
            BEFORE UPDATE ON public.enrollments
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;