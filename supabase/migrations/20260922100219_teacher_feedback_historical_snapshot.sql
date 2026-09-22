
alter table public.teacher_feedback
  add column if not exists teaching_group_name text null;

update public.teacher_feedback tf
set teaching_group_name = tg.name
from public.teaching_groups tg
where tf.teaching_group_id = tg.id
  and nullif(btrim(tf.teaching_group_name), '') is null;

alter table public.teacher_feedback
  drop constraint if exists teacher_feedback_teaching_group_id_fkey;

alter table public.teacher_feedback
  add constraint teacher_feedback_teaching_group_id_fkey
  foreign key (teaching_group_id)
  references public.teaching_groups(id)
  on delete set null;

create index if not exists teacher_feedback_teacher_submitted_idx
  on public.teacher_feedback (teacher_id, submitted_at desc);

create or replace function public.submit_teacher_feedback(
  p_level_result_id uuid,
  p_rating smallint default null,
  p_comment text default null
)
returns public.teacher_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_level_result public.student_level_results%rowtype;
  v_comment text;
  v_enrollment_id uuid;
  v_teaching_group_id uuid;
  v_teaching_group_name text;
  v_feedback public.teacher_feedback%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select s.id
  into v_student_id
  from public.students s
  join public.profiles p
    on p.id = s.profile_id
  where s.profile_id = auth.uid()
    and s.is_active
    and p.role = 'student'::public.user_role
    and p.status = 'active'::public.user_status;

  if not found then
    raise exception 'Active student access is required'
      using errcode = '42501';
  end if;

  v_comment := nullif(btrim(coalesce(p_comment, '')), '');

  if p_rating is null and v_comment is null then
    raise exception 'Provide a rating or comment before submitting feedback'
      using errcode = '22023';
  end if;

  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'Rating must be between 1 and 5'
      using errcode = '22023';
  end if;

  select slr.*
  into v_level_result
  from public.student_level_results slr
  where slr.id = p_level_result_id
    and slr.student_id = v_student_id
    and slr.completed_at is not null;

  if not found then
    raise exception 'Completed level result not found for this student'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.teacher_feedback tf
    where tf.level_result_id = p_level_result_id
  ) then
    raise exception 'Feedback has already been submitted for this level result'
      using errcode = '23505';
  end if;

  select
    m.enrollment_id,
    m.teaching_group_id,
    tg.name
  into
    v_enrollment_id,
    v_teaching_group_id,
    v_teaching_group_name
  from public.meetings m
  left join public.teaching_groups tg
    on tg.id = m.teaching_group_id
  where m.student_id = v_level_result.student_id
    and m.teacher_id = v_level_result.teacher_id
    and m.level_id = v_level_result.level_id
    and m.created_at <= v_level_result.completed_at
  order by m.session_date desc, m.created_at desc
  limit 1;

  begin
    insert into public.teacher_feedback (
      level_result_id,
      student_id,
      teacher_id,
      level_id,
      enrollment_id,
      teaching_group_id,
      teaching_group_name,
      rating,
      comment
    )
    values (
      v_level_result.id,
      v_student_id,
      v_level_result.teacher_id,
      v_level_result.level_id,
      v_enrollment_id,
      v_teaching_group_id,
      v_teaching_group_name,
      p_rating,
      v_comment
    )
    returning * into v_feedback;
  exception
    when unique_violation then
      raise exception 'Feedback has already been submitted for this level result'
        using errcode = '23505';
  end;

  return v_feedback;
end;
$$;

create or replace function public.get_my_teaching_group_teacher_feedback(
  p_teaching_group_id uuid
)
returns table (
  level_result_id uuid,
  level_id uuid,
  level_name text,
  rating smallint,
  comment text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select t.id
  into v_teacher_id
  from public.teachers t
  join public.profiles p
    on p.id = t.profile_id
  where t.profile_id = auth.uid()
    and t.is_active
    and p.role = 'teacher'::public.user_role
    and p.status = 'active'::public.user_status;

  if not found then
    raise exception 'Active teacher access is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.teaching_groups tg
    where tg.id = p_teaching_group_id
      and tg.teacher_id = v_teacher_id
      and tg.is_active
  ) then
    raise exception 'Teacher is not authorized for this teaching group'
      using errcode = '42501';
  end if;

  return query
  select
    tf.level_result_id,
    tf.level_id,
    l.name,
    tf.rating,
    tf.comment,
    tf.submitted_at
  from public.teacher_feedback tf
  join public.levels l
    on l.id = tf.level_id
  where tf.teacher_id = v_teacher_id
    and tf.teaching_group_id = p_teaching_group_id
  order by tf.submitted_at desc, tf.id desc;
end;
$$;

create or replace function public.get_my_teacher_feedback_received()
returns table (
  level_result_id uuid,
  level_id uuid,
  level_name text,
  rating smallint,
  comment text,
  teaching_group_id uuid,
  teaching_group_name text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select t.id
  into v_teacher_id
  from public.teachers t
  join public.profiles p
    on p.id = t.profile_id
  where t.profile_id = auth.uid()
    and t.is_active
    and p.role = 'teacher'::public.user_role
    and p.status = 'active'::public.user_status;

  if not found then
    raise exception 'Active teacher access is required'
      using errcode = '42501';
  end if;

  return query
  select
    tf.level_result_id,
    tf.level_id,
    l.name,
    tf.rating,
    tf.comment,
    tf.teaching_group_id,
    tf.teaching_group_name,
    tf.submitted_at
  from public.teacher_feedback tf
  join public.levels l
    on l.id = tf.level_id
  where tf.teacher_id = v_teacher_id
  order by tf.submitted_at desc, tf.id desc;
end;
$$;

create or replace function public.get_admin_teacher_feedback(
  p_teacher_id uuid
)
returns table (
  feedback_id uuid,
  level_result_id uuid,
  student_id uuid,
  student_name text,
  student_code text,
  teacher_id uuid,
  teacher_name text,
  teacher_code text,
  level_id uuid,
  level_name text,
  level_number integer,
  teaching_group_id uuid,
  teaching_group_name text,
  rating smallint,
  comment text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access is required'
      using errcode = '42501';
  end if;

  return query
  select
    tf.id,
    tf.level_result_id,
    tf.student_id,
    sp.full_name,
    s.student_code,
    tf.teacher_id,
    tp.full_name,
    t.teacher_code,
    tf.level_id,
    l.name,
    l.level_number,
    tf.teaching_group_id,
    coalesce(tf.teaching_group_name, tg.name),
    tf.rating,
    tf.comment,
    tf.submitted_at
  from public.teacher_feedback tf
  join public.students s
    on s.id = tf.student_id
  join public.profiles sp
    on sp.id = s.profile_id
  join public.teachers t
    on t.id = tf.teacher_id
  join public.profiles tp
    on tp.id = t.profile_id
  join public.levels l
    on l.id = tf.level_id
  left join public.teaching_groups tg
    on tg.id = tf.teaching_group_id
  where tf.teacher_id = p_teacher_id
  order by tf.submitted_at desc, tf.id desc;
end;
$$;

revoke all on function public.get_my_teacher_feedback_received()
from public, anon, authenticated;

grant execute on function public.get_my_teacher_feedback_received()
to authenticated;
