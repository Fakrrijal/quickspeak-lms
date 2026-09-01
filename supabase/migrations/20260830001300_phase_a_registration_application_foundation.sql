-- Phase A: Pre-Approval Registration Data Foundation
-- QuickSpeak LMS Database Schema
-- Creates registration application tables for pre-approval review workflow

-- Create registration_applications table
CREATE TABLE IF NOT EXISTS public.registration_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    profile_id UUID NOT NULL UNIQUE
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,
    
    role public.user_role NOT NULL
        CHECK (role IN ('student', 'teacher')),
    
    student_starting_level_id UUID NULL
        REFERENCES public.levels(id)
        ON DELETE RESTRICT,
    
    student_class_type TEXT NULL
        CHECK (student_class_type IN ('private', 'semi_private')),
    
    teacher_class_type TEXT NULL
        CHECK (teacher_class_type IN ('private', 'semi_private')),
    
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    reviewed_by UUID NULL
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,
    
    reviewed_at TIMESTAMPTZ NULL,
    
    approved_at TIMESTAMPTZ NULL,
    
    -- Role-specific field consistency constraints
    CONSTRAINT registration_applications_student_fields_check
        CHECK (
            -- Student applications must have student-specific fields
            (role = 'student' AND student_starting_level_id IS NOT NULL AND student_class_type IS NOT NULL)
            OR
            -- Teacher applications must not have student-specific fields
            (role = 'teacher' AND student_starting_level_id IS NULL AND student_class_type IS NULL)
        ),
    
    CONSTRAINT registration_applications_teacher_fields_check
        CHECK (
            -- Teacher applications must have teacher-specific field
            (role = 'teacher' AND teacher_class_type IS NOT NULL)
            OR
            -- Student applications must not have teacher-specific field
            (role = 'student' AND teacher_class_type IS NULL)
        )
);

-- Create indexes for registration_applications
CREATE INDEX IF NOT EXISTS idx_registration_applications_profile_id
    ON public.registration_applications(profile_id);

CREATE INDEX IF NOT EXISTS idx_registration_applications_role
    ON public.registration_applications(role);

CREATE INDEX IF NOT EXISTS idx_registration_applications_student_starting_level_id
    ON public.registration_applications(student_starting_level_id)
    WHERE student_starting_level_id IS NOT NULL;

-- Create updated_at trigger for registration_applications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'registration_applications_updated_at'
          AND tgrelid = 'public.registration_applications'::regclass
    ) THEN
        CREATE TRIGGER registration_applications_updated_at
            BEFORE UPDATE ON public.registration_applications
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

-- Enable RLS on registration_applications
ALTER TABLE public.registration_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for registration_applications
-- Admins can read all registration applications
CREATE POLICY "Admins can view all registration applications"
    ON public.registration_applications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Applicants can read only their own application
CREATE POLICY "Applicants can view own registration application"
    ON public.registration_applications FOR SELECT
    TO authenticated
    USING (profile_id = auth.uid());

-- Note: No INSERT/UPDATE/DELETE policies for this phase
-- Application creation and modification will be handled by controlled RPCs in later phases

-- Create registration_application_supported_levels table
CREATE TABLE IF NOT EXISTS public.registration_application_supported_levels (
    application_id UUID NOT NULL
        REFERENCES public.registration_applications(id)
        ON DELETE CASCADE,
    
    level_id UUID NOT NULL
        REFERENCES public.levels(id)
        ON DELETE RESTRICT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (application_id, level_id)
);

-- Create indexes for registration_application_supported_levels
CREATE INDEX IF NOT EXISTS idx_registration_application_supported_levels_application_id
    ON public.registration_application_supported_levels(application_id);

CREATE INDEX IF NOT EXISTS idx_registration_application_supported_levels_level_id
    ON public.registration_application_supported_levels(level_id);

-- Enable RLS on registration_application_supported_levels
ALTER TABLE public.registration_application_supported_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for registration_application_supported_levels
-- Admins can read all supported levels
CREATE POLICY "Admins can view all registration application supported levels"
    ON public.registration_application_supported_levels FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Applicants can read supported levels for their own application
CREATE POLICY "Applicants can view own registration application supported levels"
    ON public.registration_application_supported_levels FOR SELECT
    TO authenticated
    USING (
        application_id IN (
            SELECT id
            FROM public.registration_applications
            WHERE profile_id = auth.uid()
        )
    );

-- Note: No INSERT/UPDATE/DELETE policies for this phase
-- Supported level management will be handled by controlled RPCs in later phases

-- Create registration_application_audits table
CREATE TABLE IF NOT EXISTS public.registration_application_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    application_id UUID NOT NULL
        REFERENCES public.registration_applications(id)
        ON DELETE RESTRICT,
    
    changed_by UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,
    
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    previous_values JSONB NOT NULL,
    
    new_values JSONB NOT NULL,
    
    reason TEXT NULL
);

-- Create indexes for registration_application_audits
CREATE INDEX IF NOT EXISTS idx_registration_application_audits_application_id
    ON public.registration_application_audits(application_id);

CREATE INDEX IF NOT EXISTS idx_registration_application_audits_changed_by
    ON public.registration_application_audits(changed_by);

CREATE INDEX IF NOT EXISTS idx_registration_application_audits_changed_at
    ON public.registration_application_audits(changed_at);

-- Enable RLS on registration_application_audits
ALTER TABLE public.registration_application_audits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for registration_application_audits
-- Admins can read all audit records
CREATE POLICY "Admins can view all registration application audits"
    ON public.registration_application_audits FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Applicants can read audit records for their own application
CREATE POLICY "Applicants can view own registration application audits"
    ON public.registration_application_audits FOR SELECT
    TO authenticated
    USING (
        application_id IN (
            SELECT id
            FROM public.registration_applications
            WHERE profile_id = auth.uid()
        )
    );

-- Note: No INSERT/UPDATE/DELETE policies for this phase
-- Audit records will be written by controlled Admin review RPCs or security-definer functions in later phases

-- Grant necessary permissions
GRANT SELECT ON public.registration_applications TO authenticated;
GRANT SELECT ON public.registration_application_supported_levels TO authenticated;
GRANT SELECT ON public.registration_application_audits TO authenticated;
