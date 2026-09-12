create table if not exists public.learning_chapters (
  id uuid primary key default gen_random_uuid(),
  ebook_id uuid not null references public.ebooks(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title text not null check (btrim(title) <> ''),
  created_at timestamptz not null default now(),
  unique (ebook_id, chapter_number)
);

create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.learning_chapters(id) on delete cascade,
  material_number integer not null check (material_number > 0),
  title text not null check (btrim(title) <> ''),
  created_at timestamptz not null default now(),
  unique (chapter_id, material_number)
);

create table if not exists public.student_material_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  material_id uuid not null references public.learning_materials(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid not null references public.profiles(id),
  primary key (student_id, material_id)
);

create index if not exists idx_learning_chapters_ebook_order
  on public.learning_chapters (ebook_id, chapter_number);

create index if not exists idx_learning_materials_chapter_order
  on public.learning_materials (chapter_id, material_number);

create index if not exists idx_student_material_progress_student_completed
  on public.student_material_progress (student_id, completed_at desc);

create or replace function public.teacher_has_student_access(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.teachers t
    join public.profiles tp on tp.id = t.profile_id
    join public.teaching_groups tg on tg.teacher_id = t.id and tg.is_active
    join public.teaching_group_students tgs on tgs.teaching_group_id = tg.id and tgs.student_id = p_student_id
    join public.students s on s.id = tgs.student_id and s.is_active
    where t.profile_id = auth.uid()
      and t.is_active
      and tp.role = 'teacher'::public.user_role
      and tp.status = 'active'::public.user_status
  );
$$;

grant execute on function public.teacher_has_student_access(uuid) to authenticated;

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
  join public.teaching_group_students tgs on tgs.student_id = s.id
  join public.teaching_groups tg on tg.id = tgs.teaching_group_id and tg.is_active
  join public.teachers t on t.id = tg.teacher_id and t.is_active
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
  where t.profile_id = auth.uid()
    and (p_search is null or btrim(p_search) = '' or p.full_name ilike '%' || btrim(p_search) || '%')
  order by p.full_name asc, lc.chapter_number asc nulls last, lm.material_number asc nulls last;
$$;

grant execute on function public.get_my_teacher_learning_progress(text) to authenticated;

create or replace function public.mark_teacher_material_completed(
  p_student_id uuid,
  p_material_id uuid
)
returns table (
  student_id uuid,
  material_id uuid,
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
    from public.learning_materials lm
    join public.learning_chapters lc on lc.id = lm.chapter_id
    join public.ebooks eb on eb.id = lc.ebook_id
    join public.students s on s.id = p_student_id
    where lm.id = p_material_id
      and eb.level_id = s.level_id
  ) then
    raise exception 'Material does not match the student level' using errcode = '42501';
  end if;

  return query
  insert into public.student_material_progress (student_id, material_id, completed_at, completed_by)
  values (p_student_id, p_material_id, now(), auth.uid())
  on conflict (student_id, material_id)
  do update set completed_at = excluded.completed_at, completed_by = excluded.completed_by
  returning student_id, material_id, completed_at;
end;
$$;

grant execute on function public.mark_teacher_material_completed(uuid, uuid) to authenticated;

-- Keep learning-content tables private. Teacher access is exposed only through
-- the scoped security-definer RPCs above, which prevents arbitrary direct reads.
alter table public.learning_chapters enable row level security;
alter table public.learning_materials enable row level security;
alter table public.student_material_progress enable row level security;
