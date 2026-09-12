drop function if exists public.get_my_teacher_learning_progress(text);

create function public.get_my_teacher_learning_progress(p_search text default null)
returns table(
  student_id uuid,
  student_name text,
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
  material_id uuid,
  material_number integer,
  material_title text,
  completed_at timestamp with time zone,
  teaching_group_id uuid,
  teaching_group_name text,
  teacher_id uuid,
  teacher_name text,
  teacher_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.full_name,
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
    lc.id,
    lc.chapter_number,
    lc.title,
    scp.completed_at,
    tg.id,
    tg.name,
    t.id,
    tp.full_name,
    t.teacher_code
  from public.students s
  join public.profiles p on p.id = s.profile_id
  join public.levels current_level on current_level.id = s.level_id
  join public.teaching_group_students tgs on tgs.student_id = s.id
  join public.teaching_groups tg on tg.id = tgs.teaching_group_id and tg.is_active
  join public.teachers t on t.id = tg.teacher_id and t.is_active
  join public.profiles tp on tp.id = t.profile_id
  join public.levels viewed_level on viewed_level.level_number <= current_level.level_number
  left join lateral (
    select e.*
    from public.ebooks e
    where e.level_id = viewed_level.id
    order by (e.status = 'published') desc, e.updated_at desc, e.created_at desc, e.id desc
    limit 1
  ) eb on true
  left join public.learning_chapters lc on lc.ebook_id = eb.id
  left join public.student_chapter_progress scp
    on scp.student_id = s.id
   and scp.chapter_id = lc.id
  where s.is_active
    and t.profile_id = auth.uid()
    and exists (
      select 1
      from public.teachers teacher_profile
      join public.profiles tp2 on tp2.id = teacher_profile.profile_id
      where teacher_profile.profile_id = auth.uid()
        and teacher_profile.is_active
        and tp2.role = 'teacher'::public.user_role
        and tp2.status = 'active'::public.user_status
    )
    and (
      p_search is null
      or btrim(p_search) = ''
      or p.full_name ilike '%' || btrim(p_search) || '%'
    )
  order by p.full_name asc, viewed_level.level_number asc, lc.chapter_number asc nulls last;
$$;

revoke execute on function public.get_my_teacher_learning_progress(text) from public;
revoke execute on function public.get_my_teacher_learning_progress(text) from anon;
grant execute on function public.get_my_teacher_learning_progress(text) to authenticated;
