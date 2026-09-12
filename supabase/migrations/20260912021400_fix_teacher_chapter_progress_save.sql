-- Fix Teacher Learning Progress chapter save.
-- The previous function used unqualified RETURNING column names that
-- conflicted with the PL/pgSQL output variables.

create or replace function public.mark_teacher_chapter_completed(
  p_student_id uuid,
  p_chapter_id uuid
)
returns table (
  student_id uuid,
  chapter_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not public.teacher_has_student_access(p_student_id) then
    raise exception 'Student access is not allowed' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.learning_chapters lc
    join public.ebooks eb on eb.id = lc.ebook_id
    join public.students s on s.id = p_student_id
    join public.levels chapter_level on chapter_level.id = eb.level_id
    join public.levels current_level on current_level.id = s.level_id
    where lc.id = p_chapter_id
      and chapter_level.level_number <= current_level.level_number
  ) then
    raise exception 'Chapter does not match the student learning scope' using errcode = '42501';
  end if;

  insert into public.student_chapter_progress (
    student_id,
    chapter_id,
    completed_at,
    completed_by
  )
  values (
    p_student_id,
    p_chapter_id,
    now(),
    auth.uid()
  )
  on conflict (student_id, chapter_id)
  do update set
    completed_at = excluded.completed_at,
    completed_by = excluded.completed_by;

  return query
  select
    scp.student_id,
    scp.chapter_id,
    scp.completed_at
  from public.student_chapter_progress scp
  where scp.student_id = p_student_id
    and scp.chapter_id = p_chapter_id;
end;
$$;

grant execute on function public.mark_teacher_chapter_completed(uuid, uuid) to authenticated;
