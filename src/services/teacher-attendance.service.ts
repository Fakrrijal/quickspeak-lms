import { supabase } from '../lib/supabase'

export type TeacherAttendancePeriod = 'day' | 'month' | 'year'

export type TeacherAttendanceMeeting = {
  meeting_id: string
  attendance_id: string | null
  enrollment_id: string
  student_id: string
  session_number: number
  session_date: string
  student_display_name: string
  student_code: string
  teacher_name: string
  teacher_code: string
  teaching_group_id: string
  level_name: string
  teaching_group_name: string
  package_type: string
  teacher_status: 'present' | 'absent' | null
  teacher_recorded_at: string | null
}

export type TeacherAttendanceReportRecord = TeacherAttendanceMeeting & {
  teacher_status: 'present' | 'absent'
  teacher_recorded_at: string
}

export type RecordTeacherAttendanceInput = {
  meetingId: string
  teacherStatus: 'present' | 'absent'
}

export type TeacherAttendanceGroupStudent = {
  student_id: string
  student_display_name: string
  enrollment_id: string
}

export type TeacherAttendanceGroup = {
  teaching_group_id: string
  teaching_group_name: string
  level_name: string
  package_type: 'private' | 'semi_private'
  students: TeacherAttendanceGroupStudent[]
}

export type RecordTeacherGroupAttendanceInput = {
  teachingGroupId: string
  attendance: Array<{
    studentId: string
    enrollmentId: string
    teacherStatus: 'present' | 'absent'
  }>
}

export async function getMyTeacherAttendance(
  period: TeacherAttendancePeriod,
  referenceDate: string,
): Promise<TeacherAttendanceMeeting[]> {
  const { data, error } = await supabase.rpc('get_my_teacher_attendance', {
    p_period: period,
    p_reference_date: referenceDate,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as TeacherAttendanceMeeting[]
}

export async function recordTeacherAttendance({
  meetingId,
  teacherStatus,
}: RecordTeacherAttendanceInput) {
  const { data, error } = await supabase.rpc('record_teacher_attendance', {
    p_meeting_id: meetingId,
    p_teacher_status: teacherStatus,
  })

  if (error) {
    throw error
  }

  return data
}

export async function getMyTeacherAttendanceGroups(): Promise<TeacherAttendanceGroup[]> {
  const { data, error } = await supabase.rpc('get_my_teacher_attendance_groups')

  if (error) {
    throw error
  }

  const groups = new Map<string, TeacherAttendanceGroup>()

  for (const row of (data ?? []) as Array<{
    teaching_group_id: string
    teaching_group_name: string
    level_name: string
    package_type: 'private' | 'semi_private'
    student_id: string
    student_display_name: string
    enrollment_id: string
  }>) {
    const group = groups.get(row.teaching_group_id) ?? {
      teaching_group_id: row.teaching_group_id,
      teaching_group_name: row.teaching_group_name,
      level_name: row.level_name,
      package_type: row.package_type,
      students: [],
    }

    group.students.push({
      student_id: row.student_id,
      student_display_name: row.student_display_name,
      enrollment_id: row.enrollment_id,
    })
    groups.set(group.teaching_group_id, group)
  }

  return [...groups.values()]
}

export async function recordTeacherGroupAttendance({
  teachingGroupId,
  attendance,
}: RecordTeacherGroupAttendanceInput) {
  const { data, error } = await supabase.rpc('record_my_teacher_group_attendance_v2', {
    p_teaching_group_id: teachingGroupId,
    p_attendance: attendance.map((entry) => ({
      student_id: entry.studentId,
      enrollment_id: entry.enrollmentId,
      teacher_status: entry.teacherStatus,
    })),
  })

  if (error) {
    throw error
  }

  return data
}
