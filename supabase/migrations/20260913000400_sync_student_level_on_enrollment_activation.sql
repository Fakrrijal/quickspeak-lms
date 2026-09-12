-- Keep students.level_id aligned with the currently activated enrollment.
-- This is additive and works for both same-level renewals and next-level
-- purchases without changing the existing admin assignment functions.

CREATE OR REPLACE FUNCTION public.sync_student_level_on_enrollment_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF NEW.status = 'active'
       AND COALESCE(OLD.status, '') <> 'active'
       AND NEW.level_id IS NOT NULL THEN
        UPDATE public.students
        SET
            level_id = NEW.level_id,
            updated_at = now()
        WHERE id = NEW.student_id
          AND is_active;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_level_on_enrollment_activation
ON public.enrollments;

CREATE TRIGGER trg_sync_student_level_on_enrollment_activation
AFTER UPDATE OF status ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_level_on_enrollment_activation();

REVOKE ALL ON FUNCTION public.sync_student_level_on_enrollment_activation()
FROM PUBLIC, anon, authenticated;
