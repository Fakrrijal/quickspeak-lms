-- S2.5A Level Foundation Migration
-- QuickSpeak LMS Database Schema

-- Create levels table
CREATE TABLE public.levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger for levels
CREATE TRIGGER levels_updated_at
    BEFORE UPDATE ON public.levels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on levels
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for levels
-- Authenticated users can read the level records
CREATE POLICY "Authenticated users can view levels"
    ON public.levels FOR SELECT
    TO authenticated
    USING (true);

-- Seed QuickSpeak's four learning levels
INSERT INTO public.levels (level_number, name)
VALUES
    (1, 'Level 1'),
    (2, 'Level 2'),
    (3, 'Level 3'),
    (4, 'Level 4')
ON CONFLICT (level_number) DO NOTHING;

-- Remove obsolete branch relationship from students
ALTER TABLE public.students
    DROP COLUMN branch_id;

-- Link students to their learning level
ALTER TABLE public.students
    ADD CONSTRAINT students_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id);

-- Create index for student level lookups
CREATE INDEX idx_students_level_id ON public.students(level_id);

-- Grant authenticated users read access to levels
GRANT SELECT ON public.levels TO authenticated;
