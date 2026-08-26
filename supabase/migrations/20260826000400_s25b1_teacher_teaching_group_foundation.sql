-- S2.5B1 Teacher Eligibility + Teaching Group Foundation Migration
-- QuickSpeak LMS Database Schema

-- Confirm the obsolete teacher branch relationship exists before removing it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teachers'
          AND column_name = 'branch_id'
    ) THEN
        RAISE EXCEPTION 'public.teachers.branch_id does not exist';
    END IF;
END;
$$;

-- QuickSpeak has no branches.
ALTER TABLE public.teachers
    DROP COLUMN branch_id;

-- Record the levels each teacher is eligible to teach.
CREATE TABLE public.teacher_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT teacher_levels_teacher_id_level_id_key UNIQUE (teacher_id, level_id)
);

CREATE INDEX idx_teacher_levels_teacher_id ON public.teacher_levels(teacher_id);
CREATE INDEX idx_teacher_levels_level_id ON public.teacher_levels(level_id);

ALTER TABLE public.teacher_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own level eligibility"
    ON public.teacher_levels FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.teachers
            WHERE teachers.id = teacher_levels.teacher_id
              AND teachers.profile_id = auth.uid()
        )
    );

-- Each teaching group has one teacher, one level, and one supported type.
CREATE TABLE public.teaching_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    level_id UUID NOT NULL REFERENCES public.levels(id),
    group_type TEXT NOT NULL CHECK (group_type IN ('private', 'semi_private')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teaching_groups_teacher_id ON public.teaching_groups(teacher_id);
CREATE INDEX idx_teaching_groups_level_id ON public.teaching_groups(level_id);
CREATE INDEX idx_teaching_groups_is_active ON public.teaching_groups(is_active);

CREATE TRIGGER teaching_groups_updated_at
    BEFORE UPDATE ON public.teaching_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.teaching_groups ENABLE ROW LEVEL SECURITY;

-- Associate students with teaching groups. Capacity and active-group exclusivity
-- are intentionally deferred to future controlled service/RPC logic.
CREATE TABLE public.teaching_group_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teaching_group_id UUID NOT NULL REFERENCES public.teaching_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT teaching_group_students_teaching_group_id_student_id_key
        UNIQUE (teaching_group_id, student_id)
);

CREATE INDEX idx_teaching_group_students_teaching_group_id
    ON public.teaching_group_students(teaching_group_id);
CREATE INDEX idx_teaching_group_students_student_id
    ON public.teaching_group_students(student_id);

ALTER TABLE public.teaching_group_students ENABLE ROW LEVEL SECURITY;

-- Table privileges are granted for future authenticated read policies.
-- RLS permits only the explicit teacher-level eligibility policy above.
GRANT SELECT ON public.teacher_levels TO authenticated;
GRANT SELECT ON public.teaching_groups TO authenticated;
GRANT SELECT ON public.teaching_group_students TO authenticated;
