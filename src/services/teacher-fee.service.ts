import { supabase } from '../lib/supabase'

export type TeacherFeeStatus = 'all' | 'paid' | 'unpaid'

export async function getMyTeacherCode() {
  const { data, error } = await supabase
    .from('teachers')
    .select('teacher_code')
    .maybeSingle()

  if (error) throw error

  return data?.teacher_code ?? null
}

export type TeacherFeeEntry = {
  session_date: string
  session_time: string
  session_number: number
  teaching_group_name: string
  package_type: 'private' | 'semi_private'
  present_students: number
  fee: number
  status: Exclude<TeacherFeeStatus, 'all'>
  period_start: string
  earned_amount: number
  paid_amount: number
  outstanding_amount: number
  paid_at: string | null
}

export type TeacherFeeDetailEntry = {
  teacher_id: string
  teacher_name: string
  teacher_code: string
  meeting_id: string
  session_date: string
  attendance_id: string
  attendance_recorded_at: string
  attendance_status: 'present' | 'absent'
  teaching_group_id: string
  teaching_group_name: string
  level_id: string
  level_name: string
  package_type: 'private' | 'semi_private'
  student_id: string
  student_name: string
  student_code: string
  fee_rate: number
  student_fee: number
  meeting_present_count: number
  meeting_fee: number
  period_status: Exclude<TeacherFeeStatus, 'all'>
  period_earned: number
  period_paid: number
  period_outstanding: number
  detail_reconciles_period: boolean
}

export type TeacherFeeStudentSummary = {
  student_id: string
  student_name: string
  student_code: string
  teaching_group_id: string
  teaching_group_name: string
  fee_rate: number
  present_attendance_count: number
  student_total: number
}

export type MyTeacherFeeReport = {
  entries: TeacherFeeEntry[]
  detail_entries: TeacherFeeDetailEntry[]
  detail_reconciles_period: boolean
  period_summary: {
    earned_amount: number
    paid_amount: number
    outstanding_amount: number
    status: Exclude<TeacherFeeStatus, 'all'>
    paid_at: string | null
  }
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function toTeacherFeeEntry(entry: Record<string, unknown>): TeacherFeeEntry {
  return {
    session_date: String(entry.session_date),
    session_time: String(entry.session_time),
    session_number: toNumber(entry.session_number),
    teaching_group_name: String(entry.teaching_group_name),
    package_type: entry.package_type as 'private' | 'semi_private',
    present_students: toNumber(entry.present_students),
    fee: toNumber(entry.fee),
    status: entry.status as Exclude<TeacherFeeStatus, 'all'>,
    period_start: String(entry.period_start),
    earned_amount: toNumber(entry.earned_amount),
    paid_amount: toNumber(entry.paid_amount),
    outstanding_amount: toNumber(entry.outstanding_amount),
    paid_at: entry.paid_at === null ? null : String(entry.paid_at),
  }
}

function toTeacherFeeDetailEntry(entry: Record<string, unknown>): TeacherFeeDetailEntry {
  return {
    teacher_id: String(entry.teacher_id), teacher_name: String(entry.teacher_name), teacher_code: String(entry.teacher_code),
    meeting_id: String(entry.meeting_id), session_date: String(entry.session_date), attendance_id: String(entry.attendance_id),
    attendance_recorded_at: String(entry.attendance_recorded_at), attendance_status: entry.attendance_status as 'present' | 'absent',
    teaching_group_id: String(entry.teaching_group_id), teaching_group_name: String(entry.teaching_group_name),
    level_id: String(entry.level_id), level_name: String(entry.level_name), package_type: entry.package_type as 'private' | 'semi_private',
    student_id: String(entry.student_id), student_name: String(entry.student_name), student_code: String(entry.student_code),
    fee_rate: toNumber(entry.fee_rate), student_fee: toNumber(entry.student_fee),
    meeting_present_count: toNumber(entry.meeting_present_count), meeting_fee: toNumber(entry.meeting_fee),
    period_status: entry.period_status as Exclude<TeacherFeeStatus, 'all'>,
    period_earned: toNumber(entry.period_earned), period_paid: toNumber(entry.period_paid),
    period_outstanding: toNumber(entry.period_outstanding),
    detail_reconciles_period: entry.detail_reconciles_period === true,
  }
}

/**
 * Aggregates only canonical detail values. The historical group and returned
 * fee rate are deliberately part of the key so a student can have separate
 * summaries when either changed during the selected period.
 */
export function summarizeTeacherFeeDetails(entries: TeacherFeeDetailEntry[]): TeacherFeeStudentSummary[] {
  const summaries = new Map<string, TeacherFeeStudentSummary>()

  for (const entry of entries) {
    const key = [entry.student_id, entry.teaching_group_id, entry.fee_rate].join(':')
    const summary = summaries.get(key) ?? {
      student_id: entry.student_id,
      student_name: entry.student_name,
      student_code: entry.student_code,
      teaching_group_id: entry.teaching_group_id,
      teaching_group_name: entry.teaching_group_name,
      fee_rate: entry.fee_rate,
      present_attendance_count: 0,
      student_total: 0,
    }

    if (entry.attendance_status === 'present') summary.present_attendance_count += 1
    summary.student_total += entry.student_fee
    summaries.set(key, summary)
  }

  return [...summaries.values()]
}

function assertLiveDetailReconciliation(entries: TeacherFeeDetailEntry[]) {
  if (entries.length === 0) return

  const total = entries.reduce((sum, entry) => sum + entry.student_fee, 0)
  const periodEarned = entries[0].period_earned
  const periodStatus = entries[0].period_status

  if (periodStatus === 'unpaid' && total !== periodEarned) {
    throw new Error(`Teacher fee detail does not reconcile: detail Rp${total} versus earned Rp${periodEarned}.`)
  }
}

function addMonthsToFirstDay(referenceDate: string, offset: number) {
  const [year, month] = referenceDate.slice(0, 7).split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function listMonthStarts(startDate: string, endDate: string) {
  const start = `${startDate.slice(0, 7)}-01`
  const end = `${endDate.slice(0, 7)}-01`
  const months: string[] = []
  let cursor = start
  while (cursor <= end) {
    months.push(cursor)
    const next = addMonthsToFirstDay(cursor, 1)
    if (next === cursor) break
    cursor = next
  }
  return months
}

export async function getMyTeacherFeeReportRange(startDate: string, endDate: string) {
  if (startDate > endDate) {
    return { entries: [], detail_entries: [], monthly_summaries: [] as MyTeacherFeeReport['period_summary'][], detail_reconciles_period: true }
  }

  const reports = await Promise.all(
    listMonthStarts(startDate, endDate).map((monthStart) => {
      const year = Number(monthStart.slice(0, 4))
      const month = Number(monthStart.slice(5, 7))
      return getMyTeacherFeeReport(month, year)
    }),
  )

  const entries = reports.flatMap((report) => report.entries)
    .filter((entry) => entry.session_date >= startDate && entry.session_date <= endDate)
    .sort((left, right) => right.session_date.localeCompare(left.session_date) || right.session_time.localeCompare(left.session_time))
  const detailEntries = reports.flatMap((report) => report.detail_entries)
    .filter((entry) => entry.session_date >= startDate && entry.session_date <= endDate)
    .sort((left, right) => right.session_date.localeCompare(left.session_date) || right.attendance_recorded_at.localeCompare(left.attendance_recorded_at))

  return {
    entries,
    detail_entries: detailEntries,
    monthly_summaries: reports.map((report) => report.period_summary),
    detail_reconciles_period: true,
  }
}

export async function getMyTeacherFeeReport(month: number, year: number) {
  const { data, error } = await supabase.rpc('get_teacher_fee_report', {
    p_month: month,
    p_year: year,
    p_status: 'all',
    p_teacher_ids: null,
  })

  if (error) throw error

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const firstRow = rows[0]
  return {
    entries: rows.filter((entry) => entry.is_fee_session_lead === true).map(toTeacherFeeEntry),
    detail_entries: rows.filter((entry) => entry.session_date !== null).map(toTeacherFeeDetailEntry),
    detail_reconciles_period: firstRow?.detail_reconciles_period === true,
    period_summary: {
      earned_amount: toNumber(firstRow?.earned_amount),
      paid_amount: toNumber(firstRow?.paid_amount),
      outstanding_amount: toNumber(firstRow?.outstanding_amount),
      status: firstRow?.status as Exclude<TeacherFeeStatus, 'all'> ?? 'unpaid',
      paid_at: firstRow?.paid_at === null ? null : String(firstRow.paid_at),
    },
  } satisfies MyTeacherFeeReport
}

export type AdminTeacherFeePeriod = {
  teacher_id: string
  teacher_name: string
  period_start: string
  earned_amount: number
  due_date: string
  status: Exclude<TeacherFeeStatus, 'all'>
  paid_at: string | null
}

export type AdminTeacherFeeReport = {
  teacher_id: string
  teacher_name: string
  teacher_code: string
  period_start: string
  earned_amount: number
  paid_amount: number
  outstanding_amount: number
  status: Exclude<TeacherFeeStatus, 'all'>
  paid_at: string | null
  /** False means the current live detail no longer matches a frozen settlement. */
  detail_reconciles_period: boolean
  entries: TeacherFeeEntry[]
  detail_entries: TeacherFeeDetailEntry[]
}

export async function getAdminTeacherFeePeriods(month: number, year: number) {
  const { data, error } = await supabase.rpc('admin_get_teacher_fee_periods', {
    p_month: month,
    p_year: year,
  })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((entry) => ({ ...entry, earned_amount: toNumber(entry.earned_amount) })) as AdminTeacherFeePeriod[]
}

export async function getAdminTeacherFeeReports(
  month: number,
  year: number,
  status: TeacherFeeStatus,
  teacherIds?: string[],
): Promise<AdminTeacherFeeReport[]> {
  const { data, error } = await supabase.rpc('get_teacher_fee_report', {
    p_month: month,
    p_year: year,
    p_status: status,
    p_teacher_ids: teacherIds?.length ? teacherIds : null,
  })

  if (error) throw error

  const reports = new Map<string, AdminTeacherFeeReport>()
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const teacherId = String(row.teacher_id)
    const report = reports.get(teacherId) ?? {
      teacher_id: teacherId,
      teacher_name: String(row.teacher_name ?? 'Teacher'),
      teacher_code: String(row.teacher_code ?? ''),
      period_start: String(row.period_start),
      earned_amount: toNumber(row.earned_amount),
      paid_amount: toNumber(row.paid_amount),
      outstanding_amount: toNumber(row.outstanding_amount),
      status: row.status as Exclude<TeacherFeeStatus, 'all'>,
      paid_at: row.paid_at === null ? null : String(row.paid_at),
      detail_reconciles_period: row.detail_reconciles_period === true,
      entries: [],
      detail_entries: [],
    }

    if (row.session_date !== null) {
      report.detail_entries.push(toTeacherFeeDetailEntry(row))
      if (row.is_fee_session_lead === true) report.entries.push(toTeacherFeeEntry(row))
    }
    reports.set(teacherId, report)
  }

  const result = [...reports.values()]
  result.forEach((report) => assertLiveDetailReconciliation(report.detail_entries))
  return result
}

export async function markTeacherFeePeriodPaid(teacherId: string, periodStart: string) {
  const { data, error } = await supabase.rpc('admin_mark_teacher_fee_period_paid', {
    p_teacher_id: teacherId,
    p_period_start: periodStart,
  })
  if (error) throw error
  return data
}
