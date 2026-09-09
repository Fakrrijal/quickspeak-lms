create or replace function public.get_my_learning_state()
returns table (
  enrollment_id uuid,
  level_id uuid,
  level_name text,
  level_number integer,
  package_type text,
  enrollment_status text,
  session_limit integer,
  completed_sessions bigint,
  started_at timestamptz,
  completed_at timestamptz,
  teaching_group_id uuid,
  teaching_group_name text,
  teacher_id uuid,
  teacher_code text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select s.id
    into v_student_id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid()
    and p.role = 'student'::public.user_role
    and s.is_active
  limit 1;

  if not found then
    raise exception 'Student record not found' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.level_id,
    l.name,
    l.level_number,
    e.package_type,
    e.status,
    e.session_limit,
    coalesce(count(m.id) filter (where m.session_date <= current_date), 0),
    e.started_at,
    e.completed_at,
    tg.id,
    tg.name,
    t.id,
    t.teacher_code
  from public.enrollments e
  join public.levels l on l.id = e.level_id
  left join public.teaching_group_students tgs on tgs.student_id = e.student_id
  left join public.teaching_groups tg
    on tg.id = tgs.teaching_group_id
   and tg.level_id = e.level_id
   and tg.group_type = e.package_type
   and tg.is_active
  left join public.teachers t on t.id = tg.teacher_id and t.is_active
  left join public.meetings m on m.enrollment_id = e.id
  where e.student_id = v_student_id
    and e.status in ('pending','payment_pending','payment_submitted','payment_rejected','payment_approved','teacher_assignment','active','completed')
  group by e.id, e.level_id, l.name, l.level_number, e.package_type, e.status, e.session_limit, e.started_at, e.completed_at, tg.id, tg.name, t.id, t.teacher_code
  order by e.created_at desc, e.id desc
  limit 1;
end;
$$;
