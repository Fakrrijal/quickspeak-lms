-- Consolidate the two read policies into one OR policy.
-- This keeps student/teacher access separate from write permissions
-- while avoiding multiple permissive SELECT policies on the same table.

drop policy if exists "Students can view schedule for active enrollment group" on public.class_schedules;
drop policy if exists "Teachers can view schedules for their active groups" on public.class_schedules;

create policy "Students and teachers can view allowed schedules"
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
  or
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
