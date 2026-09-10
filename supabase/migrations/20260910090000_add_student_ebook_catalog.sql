create or replace function public.get_my_published_ebooks()
returns table (
  ebook_id uuid,
  level_id uuid,
  level_name text,
  level_number integer,
  title text,
  heyzine_url text,
  is_unlocked boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_student_id uuid;
  v_current_level_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select s.id
    into v_student_id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid()
    and s.is_active
    and p.role = 'student'::public.user_role
    and p.status = 'active'::public.user_status
  limit 1;

  if not found then
    raise exception 'Student record not found' using errcode = '42501';
  end if;

  select l.level_number
    into v_current_level_number
  from public.enrollments e
  join public.levels l on l.id = e.level_id
  where e.student_id = v_student_id
    and e.status in ('pending','payment_pending','payment_submitted','payment_rejected','payment_approved','teacher_assignment','active','completed')
  order by e.created_at desc, e.id desc
  limit 1;

  return query
  select
    e.id,
    e.level_id,
    l.name,
    l.level_number,
    e.title,
    e.heyzine_url,
    coalesce(v_current_level_number >= l.level_number, false)
  from public.ebooks e
  join public.levels l on l.id = e.level_id
  where e.status = 'published'
  order by l.level_number asc, e.created_at asc, e.id asc;
end;
$$;

grant execute on function public.get_my_published_ebooks() to authenticated;
