-- Student Schedule v1
-- Schedule is a read-only plan for students and a teacher-managed plan
-- attached to the current teaching group. It is intentionally separate
-- from meetings/attendance and never creates transactional records.

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  teaching_group_id uuid not null
    references public.teaching_groups(id)
    on delete cascade,
  day_of_week smallint not null
    check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedules_one_per_group unique (teaching_group_id),
  constraint class_schedules_valid_time check (start_time < end_time)
);

alter table public.class_schedules enable row level security;

revoke all on table public.class_schedules from anon, authenticated;
grant select, insert, update, delete on table public.class_schedules to authenticated;

create policy "Students can view schedule for active enrollment group"
on public.class_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollment_teaching_group_assignments eta
    join public.enrollments e on e.id = eta.enrollment_id
    join public.students s on s.id = e.student_id
    where eta.teaching_group_id = class_schedules.teaching_group_id
      and e.status = 'active'
      and s.profile_id = (select auth.uid())
  )
);

create policy "Teachers can view schedules for their active groups"
on public.class_schedules
for select
to authenticated
using (
  exists (
    select 1
    from public.teaching_groups tg
    join public.teachers t on t.id = tg.teacher_id
    where tg.id = class_schedules.teaching_group_id
      and tg.is_active
      and t.is_active
      and t.profile_id = (select auth.uid())
  )
);

create policy "Teachers can create schedules for their active groups"
on public.class_schedules
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teaching_groups tg
    join public.teachers t on t.id = tg.teacher_id
    where tg.id = class_schedules.teaching_group_id
      and tg.is_active
      and t.is_active
      and t.profile_id = (select auth.uid())
  )
);

create policy "Teachers can update schedules for their active groups"
on public.class_schedules
for update
to authenticated
using (
  exists (
    select 1
    from public.teaching_groups tg
    join public.teachers t on t.id = tg.teacher_id
    where tg.id = class_schedules.teaching_group_id
      and tg.is_active
      and t.is_active
      and t.profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.teaching_groups tg
    join public.teachers t on t.id = tg.teacher_id
    where tg.id = class_schedules.teaching_group_id
      and tg.is_active
      and t.is_active
      and t.profile_id = (select auth.uid())
  )
);

create policy "Teachers can delete schedules for their active groups"
on public.class_schedules
for delete
to authenticated
using (
  exists (
    select 1
    from public.teaching_groups tg
    join public.teachers t on t.id = tg.teacher_id
    where tg.id = class_schedules.teaching_group_id
      and tg.is_active
      and t.is_active
      and t.profile_id = (select auth.uid())
  )
);
