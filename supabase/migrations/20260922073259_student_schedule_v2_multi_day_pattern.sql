-- Student Schedule v2
-- Allow a teaching group to have multiple weekly class days while keeping
-- one shared start/end time for the selected days. Schedule remains
-- informational only and is not a meeting/attendance record.

alter table public.class_schedules
  drop constraint if exists class_schedules_one_per_group;

alter table public.class_schedules
  add constraint class_schedules_one_per_group_day
  unique (teaching_group_id, day_of_week);

create or replace function public.replace_teaching_group_schedule(
  p_teaching_group_id uuid,
  p_days_of_week smallint[],
  p_start_time time,
  p_end_time time
)
returns setof public.class_schedules
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_class_schedule(p_teaching_group_id) then
    raise exception 'Not authorized to manage this teaching group schedule';
  end if;

  if p_days_of_week is null or coalesce(cardinality(p_days_of_week), 0) = 0 then
    raise exception 'At least one class day is required';
  end if;

  if p_start_time >= p_end_time then
    raise exception 'End time must be later than start time';
  end if;

  if exists (
    select 1
    from unnest(p_days_of_week) as day_value
    where day_value < 1 or day_value > 7
  ) then
    raise exception 'Class day must be between Monday (1) and Sunday (7)';
  end if;

  delete from public.class_schedules
  where teaching_group_id = p_teaching_group_id;

  insert into public.class_schedules (
    teaching_group_id,
    day_of_week,
    start_time,
    end_time,
    is_active,
    updated_at
  )
  select
    p_teaching_group_id,
    day_value,
    p_start_time,
    p_end_time,
    true,
    timezone('utc', now())
  from (
    select distinct unnest(p_days_of_week) as day_value
  ) as selected_days;

  return query
  select
    cs.id,
    cs.teaching_group_id,
    cs.day_of_week,
    cs.start_time,
    cs.end_time,
    cs.is_active,
    cs.created_at,
    cs.updated_at
  from public.class_schedules cs
  where cs.teaching_group_id = p_teaching_group_id
  order by cs.day_of_week;
end;
$$;

revoke all on function public.replace_teaching_group_schedule(uuid, smallint[], time, time)
from public, anon, authenticated;

grant execute on function public.replace_teaching_group_schedule(uuid, smallint[], time, time)
to authenticated;
