create or replace function public.get_my_student_learning_progress()
returns table(
  current_level_id uuid,
  current_level_name text,
  current_level_number integer,
  level_id uuid,
  level_name text,
  level_number integer,
  ebook_id uuid,
  ebook_title text,
  chapter_id uuid,
  chapter_number integer,
  chapter_title text,
  completed_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    current_level.id,
    current_level.name,
    current_level.level_number,
    viewed_level.id,
    viewed_level.name,
    viewed_level.level_number,
    eb.id,
    eb.title,
    lc.id,
    lc.chapter_number,
    lc.title,
    scp.completed_at
  from public.students s
  join public.profiles p
    on p.id = s.profile_id
  join public.levels current_level
    on current_level.id = s.level_id
  join public.levels viewed_level
    on viewed_level.level_number <= current_level.level_number
  left join lateral (
    select e.*
    from public.ebooks e
    where e.level_id = viewed_level.id
    order by (e.status = 'published') desc, e.updated_at desc, e.created_at desc, e.id desc
    limit 1
  ) eb on true
  left join public.learning_chapters lc
    on lc.ebook_id = eb.id
  left join public.student_chapter_progress scp
    on scp.student_id = s.id
   and scp.chapter_id = lc.id
  where s.profile_id = auth.uid()
    and s.is_active
    and p.role = 'student'::public.user_role
    and p.status = 'active'::public.user_status
  order by viewed_level.level_number asc, lc.chapter_number asc nulls last;
$$;

revoke execute on function public.get_my_student_learning_progress() from public;
revoke execute on function public.get_my_student_learning_progress() from anon;
grant execute on function public.get_my_student_learning_progress() to authenticated;
