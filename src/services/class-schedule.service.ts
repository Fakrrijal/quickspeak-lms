import { supabase } from '../lib/supabase'

export type ClassSchedule = {
  id: string
  teaching_group_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const SCHEDULE_SELECT = 'id, teaching_group_id, day_of_week, start_time, end_time, is_active, created_at, updated_at'

export async function getScheduleForTeachingGroup(teachingGroupId: string): Promise<ClassSchedule[]> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(SCHEDULE_SELECT)
    .eq('teaching_group_id', teachingGroupId)
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })

  if (error) throw error
  return (data ?? []) as ClassSchedule[]
}

export type SaveTeachingGroupScheduleInput = {
  teachingGroupId: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
}

export async function saveTeachingGroupSchedule({
  teachingGroupId,
  daysOfWeek,
  startTime,
  endTime,
}: SaveTeachingGroupScheduleInput): Promise<ClassSchedule[]> {
  const { data, error } = await supabase.rpc('replace_teaching_group_schedule', {
    p_teaching_group_id: teachingGroupId,
    p_days_of_week: daysOfWeek,
    p_start_time: startTime,
    p_end_time: endTime,
  })

  if (error) throw error
  return (data ?? []) as ClassSchedule[]
}

export async function deleteTeachingGroupSchedule(teachingGroupId: string) {
  const { error } = await supabase
    .from('class_schedules')
    .delete()
    .eq('teaching_group_id', teachingGroupId)

  if (error) throw error
}
