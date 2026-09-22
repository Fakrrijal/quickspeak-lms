-- Harden Schedule RLS with private SECURITY DEFINER helpers.
-- The helpers perform cross-table authorization checks outside the
-- underlying tables' RLS, while accepting only the authenticated caller.

create schema if not exists private;

create or replace function private.can_access_class_schedule(p_teaching_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.enrollment_teaching_group_assignments eta
      join public.enrollments e on e.id = eta.enrollment_id
      join public.students s on s.id = e.student_id
      where eta.teaching_group_id = p_teaching_group_id
        and e.status = 'active'
        and s.profile_id = (select auth.uid())
        and s.is_active
    )
    or
    exists (
      select 1
      from public.teaching_groups tg
      join public.teachers t on t.id = tg.teacher_id
      where tg.id = p_teaching_group_id
        and tg.is_active
        and t.is_active
        and t.profile_id = (select auth.uid())
    );
$$;

create or replace function private.can_manage_class_schedule(p_teaching_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teaching_groups tg
    join public.teachers t on t.id = tg.teacher_id
    join public.profiles p on p.id = t.profile_id
    where tg.id = p_teaching_group_id
      and tg.is_active
      and t.is_active
      and t.profile_id = (select auth.uid())
      and p.role = 'teacher'
      and p.status = 'active'
  );
$$;

revoke all on function private.can_access_class_schedule(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_class_schedule(uuid) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.can_access_class_schedule(uuid) to authenticated;
grant execute on function private.can_manage_class_schedule(uuid) to authenticated;

drop policy if exists "Students and teachers can view allowed schedules" on public.class_schedules;
drop policy if exists "Teachers can create schedules for their active groups" on public.class_schedules;
drop policy if exists "Teachers can update schedules for their active groups" on public.class_schedules;
drop policy if exists "Teachers can delete schedules for their active groups" on public.class_schedules;

create policy "Students and teachers can view allowed schedules"
on public.class_schedules
for select
to authenticated
using (private.can_access_class_schedule(teaching_group_id));

create policy "Teachers can create schedules for their active groups"
on public.class_schedules
for insert
to authenticated
with check (private.can_manage_class_schedule(teaching_group_id));

create policy "Teachers can update schedules for their active groups"
on public.class_schedules
for update
to authenticated
using (private.can_manage_class_schedule(teaching_group_id))
with check (private.can_manage_class_schedule(teaching_group_id));

create policy "Teachers can delete schedules for their active groups"
on public.class_schedules
for delete
to authenticated
using (private.can_manage_class_schedule(teaching_group_id));
