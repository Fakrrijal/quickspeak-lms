import { supabase } from '../lib/supabase'

export type StudentAttendanceRecord = {
  meeting_id: string
  enrollment_id: string
  session_date: string
  teacher_status: 'present' | 'absent'
  student_name: string
  student_code: string
  teacher_name: string
  teacher_code: string
  teaching_group_id: string
  teaching_group_name: string
  level_name: string
  package_type: 'private' | 'semi_private'
  teacher_recorded_at: string
}

export type StudentCurrentAttendanceSummary = {
  student_id: string
  current_enrollment_id: string
  current_level_id: string
  current_level_name: string
  current_level_number: number
  package_type: 'private' | 'semi_private'
  session_limit: number
  total_sessions: number
  present_sessions: number
  absent_sessions: number
}

export async function getMyStudentAttendance(month: number, year: number): Promise<StudentAttendanceRecord[]> {
  const { data, error } = await supabase.rpc('get_my_student_attendance_report', { p_month: month, p_year: year })

  if (error) {
    throw error
  }

  return (data ?? []) as StudentAttendanceRecord[]
}

export async function getMyCurrentStudentAttendanceSummary(): Promise<StudentCurrentAttendanceSummary | null> {
  const { data, error } = await supabase.rpc('get_my_current_student_attendance_summary')

  if (error) {
    throw error
  }

  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as StudentCurrentAttendanceSummary | null
}
