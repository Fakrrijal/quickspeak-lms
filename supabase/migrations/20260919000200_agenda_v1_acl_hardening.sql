-- QuickSpeak Agenda V1 ACL hardening
-- Supabase default function privileges may leave EXECUTE on new functions
-- for anon. Agenda mutations are authenticated-teacher RPCs only.

REVOKE EXECUTE ON FUNCTION public.create_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_agenda_series(UUID, DATE, JSONB, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_teacher_agenda_series(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_teacher_agenda_series(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_teacher_agenda_series(UUID) TO authenticated;
