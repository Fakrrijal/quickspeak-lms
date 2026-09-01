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

export async function getMyStudentAttendance(month: number, year: number): Promise<StudentAttendanceRecord[]> {
  const { data, error } = await supabase.rpc('get_my_student_attendance_report', { p_month: month, p_year: year })

  if (error) {
    throw error
  }

  return (data ?? []) as StudentAttendanceRecord[]
}
