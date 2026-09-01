import { supabase } from '../lib/supabase'

export type AdminAttendanceReportFilters = {
  month: number
  year: number
  studentId?: string
  teacherId?: string
  teachingGroupId?: string
  search?: string
}

export type AdminAttendanceRecord = {
  meeting_id: string
  session_date: string
  student_id: string
  student_name: string
  student_code: string
  teacher_id: string
  teacher_name: string
  teacher_code: string
  teaching_group_id: string
  teaching_group_name: string
  level_name: string
  package_type: 'private' | 'semi_private'
  teacher_status: 'present' | 'absent'
  teacher_recorded_at: string
}

export type AdminAttendanceMeeting = {
  meeting_id: string
  session_date: string
  teacher_recorded_at: string
  teacher_name: string
  teacher_code: string
  teaching_group_name: string
  level_name: string
  package_type: AdminAttendanceRecord['package_type']
  records: AdminAttendanceRecord[]
}

export type AdminAttendanceStudentSummary = {
  student_id: string
  student_name: string
  student_code: string
  teaching_group_id: string
  teaching_group_name: string
  total_sessions: number
  present: number
  absent: number
  attendance_rate: number | null
}

export type AdminAttendanceOverallSummary = {
  total_sessions: number
  total_records: number
  present: number
  absent: number
  attendance_rate: number | null
  total: number
  rate: number | null
}

export function groupAdminAttendanceMeetings(records: AdminAttendanceRecord[]): AdminAttendanceMeeting[] {
  const meetings = new Map<string, AdminAttendanceRecord[]>()
  records.forEach((record) => meetings.set(record.meeting_id, [...(meetings.get(record.meeting_id) ?? []), record]))
  return [...meetings.values()]
    .map((meetingRecords) => {
      const recordsByStudent = [...meetingRecords].sort((left, right) => left.student_name.localeCompare(right.student_name) || left.student_code.localeCompare(right.student_code))
      const record = recordsByStudent[0]
      return { ...record, records: recordsByStudent }
    })
    .sort((left, right) => left.session_date.localeCompare(right.session_date) || left.teacher_recorded_at.localeCompare(right.teacher_recorded_at) || left.meeting_id.localeCompare(right.meeting_id))
}

export function summarizeAdminAttendanceStudents(records: AdminAttendanceRecord[]): AdminAttendanceStudentSummary[] {
  const summaries = new Map<string, AdminAttendanceStudentSummary>()
  records.forEach((record) => {
    const key = `${record.student_id}:${record.teaching_group_id}`
    const summary = summaries.get(key) ?? {
      student_id: record.student_id,
      student_name: record.student_name,
      student_code: record.student_code,
      teaching_group_id: record.teaching_group_id,
      teaching_group_name: record.teaching_group_name,
      total_sessions: 0,
      present: 0,
      absent: 0,
      attendance_rate: null,
    }
    summary.total_sessions += 1
    if (record.teacher_status === 'present') summary.present += 1
    else summary.absent += 1
    summaries.set(key, summary)
  })
  return [...summaries.values()]
    .map((summary) => ({ ...summary, attendance_rate: summary.total_sessions ? (summary.present / summary.total_sessions) * 100 : null }))
    .sort((left, right) => left.student_name.localeCompare(right.student_name) || left.teaching_group_name.localeCompare(right.teaching_group_name))
}

export function summarizeAdminAttendanceOverall(records: AdminAttendanceRecord[]): AdminAttendanceOverallSummary {
  const present = records.filter((record) => record.teacher_status === 'present').length
  const totalRecords = records.length
  return {
    total_sessions: groupAdminAttendanceMeetings(records).length,
    total_records: totalRecords,
    present,
    absent: totalRecords - present,
    attendance_rate: totalRecords ? (present / totalRecords) * 100 : null,
    total: groupAdminAttendanceMeetings(records).length,
    rate: totalRecords ? (present / totalRecords) * 100 : null,
  }
}

export async function getAdminAttendanceReport(filters: AdminAttendanceReportFilters) {
  const { data, error } = await supabase.rpc('admin_get_attendance_report', {
    p_month: filters.month,
    p_year: filters.year,
    p_student_id: filters.studentId || null,
    p_teacher_id: filters.teacherId || null,
    p_teaching_group_id: filters.teachingGroupId || null,
    p_search: filters.search?.trim() || null,
  })

  if (error) throw error
  return (data ?? []) as AdminAttendanceRecord[]
}
