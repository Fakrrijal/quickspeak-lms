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

export async function getScheduleForTeachingGroup(teachingGroupId: string): Promise<ClassSchedule | null> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(SCHEDULE_SELECT)
    .eq('teaching_group_id', teachingGroupId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data as ClassSchedule | null
}

export type SaveTeachingGroupScheduleInput = {
  teachingGroupId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export async function saveTeachingGroupSchedule({
  teachingGroupId,
  dayOfWeek,
  startTime,
  endTime,
}: SaveTeachingGroupScheduleInput): Promise<ClassSchedule> {
  const { data, error } = await supabase
    .from('class_schedules')
    .upsert({
      teaching_group_id: teachingGroupId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'teaching_group_id' })
    .select(SCHEDULE_SELECT)
    .single()

  if (error) throw error
  return data as ClassSchedule
}

export async function deleteTeachingGroupSchedule(teachingGroupId: string) {
  const { error } = await supabase
    .from('class_schedules')
    .delete()
    .eq('teaching_group_id', teachingGroupId)

  if (error) throw error
}
