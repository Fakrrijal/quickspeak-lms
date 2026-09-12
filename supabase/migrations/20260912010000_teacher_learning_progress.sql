create table if not exists public.learning_chapters (
  id uuid primary key default gen_random_uuid(),
  ebook_id uuid not null references public.ebooks(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title text not null check (btrim(title) <> ''),
  created_at timestamptz not null default now(),
  unique (ebook_id, chapter_number)
);

create table if not exists public.student_chapter_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  chapter_id uuid not null references public.learning_chapters(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid not null references public.profiles(id),
  primary key (student_id, chapter_id)
);

create index if not exists idx_learning_chapters_ebook_order
  on public.learning_chapters (ebook_id, chapter_number);

create index if not exists idx_student_chapter_progress_student_completed
  on public.student_chapter_progress (student_id, completed_at desc);

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
  join public.profiles p on p.id = s.profile_id
  join public.levels current_level on current_level.id = s.level_id
  join public.teaching_group_students tgs on tgs.student_id = s.id
  join public.teaching_groups tg on tg.id = tgs.teaching_group_id and tg.is_active
  join public.teachers t on t.id = tg.teacher_id and t.is_active
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
    and (
      p_search is null
      or btrim(p_search) = ''
      or p.full_name ilike '%' || btrim(p_search) || '%'
    )
  order by p.full_name asc, viewed_level.level_number asc, lc.chapter_number asc nulls last;
$$;

grant execute on function public.get_my_teacher_learning_progress(text) to authenticated;

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

  return query
  insert into public.student_chapter_progress (student_id, chapter_id, completed_at, completed_by)
  values (p_student_id, p_chapter_id, now(), auth.uid())
  on conflict (student_id, chapter_id)
  do update set completed_at = excluded.completed_at, completed_by = excluded.completed_by
  returning student_id, chapter_id, completed_at;
end;
$$;

grant execute on function public.mark_teacher_chapter_completed(uuid, uuid) to authenticated;

create or replace function public.unmark_teacher_chapter_completed(
  p_student_id uuid,
  p_chapter_id uuid
)
returns boolean
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

  delete from public.student_chapter_progress
  where student_id = p_student_id
    and chapter_id = p_chapter_id;

  return found;
end;
$$;

grant execute on function public.unmark_teacher_chapter_completed(uuid, uuid) to authenticated;

alter table public.learning_chapters enable row level security;
alter table public.student_chapter_progress enable row level security;
