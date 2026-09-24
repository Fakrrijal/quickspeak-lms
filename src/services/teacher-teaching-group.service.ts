import { supabase } from '../lib/supabase'

export type TeacherRosterStatus =
  | 'active'
  | 'waiting_renewal'
  | 'waiting_next_level'
  | 'level_completed'
  | 'waiting_assignment'

export type TeacherTeachingGroupStudent = {
  student_id: string
  student_display_name: string
  enrollment_id: string | null
  enrollment_status: string | null
  roster_status: TeacherRosterStatus
}

export type TeacherTeachingGroup = {
  teaching_group_id: string
  teaching_group_name: string
  level_name: string
  package_type: 'private' | 'semi_private'
  students: TeacherTeachingGroupStudent[]
}

export async function getMyTeacherTeachingGroups(): Promise<TeacherTeachingGroup[]> {
  const { data, error } = await supabase.rpc('get_my_teacher_teaching_groups')

  if (error) {
    throw error
  }

  const groups = new Map<string, TeacherTeachingGroup>()

  for (const row of (data ?? []) as Array<{
    teaching_group_id: string
    teaching_group_name: string
    level_name: string
    package_type: 'private' | 'semi_private'
    student_id: string | null
    student_display_name: string | null
    enrollment_id: string | null
    enrollment_status: string | null
    roster_status: TeacherRosterStatus | null
  }>) {
    const group = groups.get(row.teaching_group_id) ?? {
      teaching_group_id: row.teaching_group_id,
      teaching_group_name: row.teaching_group_name,
      level_name: row.level_name,
      package_type: row.package_type,
      students: [],
    }

    if (row.student_id && row.student_display_name && row.roster_status) {
      group.students.push({
        student_id: row.student_id,
        student_display_name: row.student_display_name,
        enrollment_id: row.enrollment_id,
        enrollment_status: row.enrollment_status,
        roster_status: row.roster_status,
      })
    }

    groups.set(group.teaching_group_id, group)
  }

  return [...groups.values()]
}
