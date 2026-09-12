create or replace function public.get_my_teacher_learning_progress(p_search text default null)
returns table (
  student_id uuid,
  student_name text,
  level_id uuid,
  level_name text,
  ebook_id uuid,
  ebook_title text,
  chapter_id uuid,
  chapter_number integer,
  chapter_title text,
  material_id uuid,
  material_number integer,
  material_title text,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    s.id,
    p.full_name,
    s.level_id,
    l.name,
    eb.id,
    eb.title,
    lc.id,
    lc.chapter_number,
    lc.title,
    lm.id,
    lm.material_number,
    lm.title,
    smp.completed_at
  from public.students s
  join public.profiles p on p.id = s.profile_id
  join public.levels l on l.id = s.level_id
  left join lateral (
    select e.*
    from public.ebooks e
    where e.level_id = s.level_id
    order by (e.status = 'published') desc, e.updated_at desc, e.created_at desc, e.id desc
    limit 1
  ) eb on true
  left join public.learning_chapters lc on lc.ebook_id = eb.id
  left join public.learning_materials lm on lm.chapter_id = lc.id
  left join public.student_material_progress smp
    on smp.student_id = s.id
   and smp.material_id = lm.id
  where s.is_active
    and exists (
      select 1
      from public.teaching_group_students tgs
      join public.teaching_groups tg on tg.id = tgs.teaching_group_id and tg.is_active
      join public.teachers t on t.id = tg.teacher_id and t.is_active
      where tgs.student_id = s.id
        and t.profile_id = auth.uid()
    )
    and exists (
      select 1
      from public.teachers t
      join public.profiles tp on tp.id = t.profile_id
      where t.profile_id = auth.uid()
        and t.is_active
        and tp.role = 'teacher'::public.user_role
        and tp.status = 'active'::public.user_status
    )
    and (p_search is null or btrim(p_search) = '' or p.full_name ilike '%' || btrim(p_search) || '%')
  order by p.full_name asc, lc.chapter_number asc nulls last, lm.material_number asc nulls last;
$$;

grant execute on function public.get_my_teacher_learning_progress(text) to authenticated;
