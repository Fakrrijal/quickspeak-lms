import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import { useTeacherGroupAttendance } from '../hooks/useTeacherGroupAttendance'
import { useTeacherAttendance } from '../hooks/useTeacherAttendance'
import { type TeacherAttendanceMeeting, type TeacherAttendancePeriod } from '../services/teacher-attendance.service'
import { downloadAdminAttendancePdf } from '../utils/admin-attendance-pdf'
import { summarizeAdminAttendanceOverall, summarizeAdminAttendanceStudents, type AdminAttendanceRecord } from '../services/admin-attendance.service'

export const Route = createFileRoute('/teacher')({
  beforeLoad: ({ location }) => {
    if (location.pathname === '/teacher') {
      throw redirect({ to: '/teacher/overview', replace: true })
    }
  },
  component: TeacherRouteComponent,
})

function formatPackageType(packageType: string) {
  return packageType === 'semi_private' ? 'Semi-Private' : 'Private'
}

function getTodayIsoDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatSessionDate(sessionDate: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${sessionDate}T00:00:00`))
}

function formatAttendanceTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function formatPeriod(referenceDate: string, _period: TeacherAttendancePeriod) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${referenceDate.slice(0, 7)}-01T00:00:00`))
}

function formatRecordedDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

/*
function Icon({ name }: { name: 'users' | 'calendar' | 'wallet' | 'check' | 'arrow' | 'group' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'users') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  if (name === 'wallet') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7" /><path d="M16 13h.01" /></svg>
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  if (name === 'group') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5M8 17h3" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}
*/

function TeacherAttendanceDetailModal({ student, records, period, referenceDate, onClose }: { student: ReturnType<typeof summarizeAdminAttendanceStudents>[number], records: AdminAttendanceRecord[], period: TeacherAttendancePeriod, referenceDate: string, onClose: () => void }) {
  const overall = summarizeAdminAttendanceOverall(records)
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="teacher-attendance-detail-title" className="mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Attendance</p><h3 id="teacher-attendance-detail-title" className="mt-1 text-xl font-extrabold text-[#102449]">Student Detail</h3><p className="mt-1 text-sm text-slate-600">{student.student_name} · {formatPeriod(referenceDate, period)}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Close</button>
        </header>
        <div className="space-y-6 p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h4 className="text-lg font-bold text-[#102449]">Meeting &amp; Attendance Detail</h4><div className="mt-4 space-y-3">{records.map((record, index) => <article key={record.meeting_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">Meeting {index + 1}</p><p className="mt-1 text-sm text-slate-600">{formatSessionDate(record.session_date)} · {formatRecordedDateTime(record.teacher_recorded_at)}</p></div><span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${record.teacher_status === 'present' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{record.teacher_status === 'present' ? 'Present' : 'Absent'}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-slate-500">Teacher</dt><dd className="mt-0.5 font-semibold">{record.teacher_name}</dd></div><div><dt className="text-slate-500">Teacher Code</dt><dd className="mt-0.5 font-semibold">{record.teacher_code}</dd></div><div><dt className="text-slate-500">Teaching Group</dt><dd className="mt-0.5 font-semibold">{record.teaching_group_name}</dd></div><div><dt className="text-slate-500">Level</dt><dd className="mt-0.5 font-semibold">{record.level_name}</dd></div><div><dt className="text-slate-500">Package</dt><dd className="mt-0.5 font-semibold">{record.package_type === 'semi_private' ? 'Semi-private' : 'Private'}</dd></div><div><dt className="text-slate-500">Recorded Time</dt><dd className="mt-0.5 font-semibold">{formatRecordedDateTime(record.teacher_recorded_at)}</dd></div></dl></article>)}</div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h4 className="text-lg font-bold text-[#102449]">Attendance Summary</h4><dl className="mt-4 grid gap-4 sm:grid-cols-4"><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sessions</dt><dd className="mt-1 text-xl font-extrabold text-[#102449]">{overall.total_records}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Present</dt><dd className="mt-1 text-xl font-extrabold text-emerald-700">{overall.present}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Absent</dt><dd className="mt-1 text-xl font-extrabold text-rose-700">{overall.absent}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Rate</dt><dd className="mt-1 text-xl font-extrabold text-[#102449]">{overall.attendance_rate === null ? '-' : `${overall.attendance_rate.toFixed(1)}%`}</dd></div></dl></section>
        </div>
      </div>
    </div>
  )
}

function TeacherRouteComponent() {
  return <Outlet />
}

/* Legacy TeacherDashboard removed from routing in favor of /teacher/overview.
function TeacherDashboard() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'
  const [groups, setGroups] = useState<TeacherAttendanceGroup[]>([])
  const [meetings, setMeetings] = useState<TeacherAttendanceMeeting[]>([])
  const [feeReport, setFeeReport] = useState<MyTeacherFeeReport | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setSummaryLoading(true)
    setSummaryError(null)
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const referenceDate = `${year}-${String(month).padStart(2, '0')}-01`
    Promise.all([getMyTeacherAttendanceGroups(), getMyTeacherAttendance('month', referenceDate), getMyTeacherFeeReport(month, year)])
      .then(([groupsData, meetingsData, feeReportData]) => {
        if (cancelled) return
        setGroups(groupsData)
        setMeetings(meetingsData)
        setFeeReport(feeReportData)
        setSummaryLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setSummaryError(err instanceof Error ? err.message : 'Unable to load dashboard summary')
        setSummaryLoading(false)
      })
    return () => { cancelled = true }
  }, [canLoad, retryCount])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  const classCount = groups.length
  const activeStudentCount = new Set(groups.flatMap((group) => group.students.map((student) => student.student_id))).size
  const feeAmount = feeReport?.period_summary.earned_amount ?? 0
  const completedMeetings = meetings.filter((meeting) => meeting.teacher_status !== null && meeting.teacher_recorded_at !== null)
  const presentCount = completedMeetings.filter((meeting) => meeting.teacher_status === 'present').length
  const absentCount = completedMeetings.filter((meeting) => meeting.teacher_status === 'absent').length
  const attendanceCount = completedMeetings.length
  const recentAttendance = [...completedMeetings].sort((left, right) => right.session_date.localeCompare(left.session_date) || String(right.teacher_recorded_at).localeCompare(String(left.teacher_recorded_at))).slice(0, 5)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#102449] sm:text-4xl">Welcome back, {profile.full_name || 'Teacher'}.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Here is your current teaching operations overview.</p>
      </header>

      {summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" /></div>)}</div>
      ) : summaryError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p>{summaryError}</p><button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-3 font-bold underline">Retry</button></div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Classes', value: classCount, icon: 'group' as const, tone: 'bg-blue-50 text-blue-700' },
            { label: 'Active Students', value: activeStudentCount, icon: 'users' as const, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Fee (This Month)', value: `Rp${feeAmount.toLocaleString('id-ID')}`, icon: 'wallet' as const, tone: 'bg-amber-50 text-amber-800' },
            { label: 'Attendance (This Month)', value: attendanceCount, icon: 'calendar' as const, tone: 'bg-violet-50 text-violet-700' },
          ].map((card) => (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><div className={`flex size-10 items-center justify-center rounded-lg ${card.tone}`}><Icon name={card.icon} /></div><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">This month</span></div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{card.value}</p>
            </article>
          ))}
        </section>
      )}

      {!summaryLoading && !summaryError && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-7"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teaching Workspace</p><h2 className="mt-1 text-xl font-bold text-[#102449]">Assigned teaching groups</h2><p className="mt-1 text-sm text-slate-600">Your current teaching groups and student coverage.</p></div>
            <div className="divide-y divide-slate-100">
              {groups.length === 0 ? <div className="p-6"><p className="text-sm text-slate-600">No active teaching groups are assigned to you.</p></div> : groups.map((group) => <article key={group.teaching_group_id} className="p-6 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-bold text-[#102449]">{group.teaching_group_name}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">{group.level_name}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{formatPackageType(group.package_type)}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{group.students.length} student{group.students.length === 1 ? '' : 's'}</span></div></div><a href="/teacher/attendance" className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#102449] px-3.5 py-2.5 text-sm font-bold text-white hover:bg-[#17325f]">View Attendance <Icon name="arrow" /></a></div></article>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Monthly Overview</p>
            <h2 className="mt-1 text-xl font-bold text-[#102449]">Teaching activity</h2>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold text-slate-500">Sessions</dt><dd className="mt-1 text-xl font-extrabold text-[#102449]">{attendanceCount}</dd></div><div className="rounded-xl bg-emerald-50 p-4"><dt className="text-xs font-semibold text-emerald-700">Present</dt><dd className="mt-1 text-xl font-extrabold text-emerald-800">{presentCount}</dd></div><div className="rounded-xl bg-rose-50 p-4"><dt className="text-xs font-semibold text-rose-700">Absent</dt><dd className="mt-1 text-xl font-extrabold text-rose-800">{absentCount}</dd></div><div className="rounded-xl bg-amber-50 p-4"><dt className="text-xs font-semibold text-amber-800">Earned Fee</dt><dd className="mt-1 text-xl font-extrabold text-amber-900">Rp{feeAmount.toLocaleString('id-ID')}</dd></div></dl>
            <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-sm leading-6 text-slate-600">Attendance records and fee totals update from your current teaching activity.</p></div>
          </section>
        </div>
      )}

      {!summaryLoading && !summaryError && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Recent Activity</p><h2 className="mt-1 text-xl font-bold text-[#102449]">Recent attendance</h2></div><a href="/teacher/attendance" className="text-sm font-bold text-blue-700 hover:text-blue-800">View all attendance</a></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 font-semibold">Student</th><th className="px-5 py-3 font-semibold">Teaching Group</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Recorded</th></tr></thead><tbody className="divide-y divide-slate-100">{recentAttendance.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-slate-600">No attendance activity recorded this month.</td></tr> : recentAttendance.map((meeting) => <tr key={meeting.meeting_id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-3 text-slate-700">{formatSessionDate(meeting.session_date)}</td><td className="px-5 py-3 font-semibold text-slate-900">{meeting.student_display_name}</td><td className="px-5 py-3 text-slate-700">{meeting.teaching_group_name}</td><td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meeting.teacher_status === 'present' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{meeting.teacher_status === 'present' ? 'Present' : 'Absent'}</span></td><td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatAttendanceTime(meeting.teacher_recorded_at)}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </div>
  )
}
*/

export function TeacherAttendancePage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('')
  const [teacherStatus, setTeacherStatus] = useState<'present' | 'absent' | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [detailStudentKey, setDetailStudentKey] = useState<string | null>(null)
  const [period, setPeriod] = useState<TeacherAttendancePeriod>('month')
  const [referenceDate, setReferenceDate] = useState(() => `${getTodayIsoDate().slice(0, 7)}-01`)
  const [reportSearch, setReportSearch] = useState('')
  const [reportGroup, setReportGroup] = useState('')
  const canLoadGroups = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'
  const { groups, loading, error, mutationError, saving, saveAttendance, reload } = useTeacherGroupAttendance(canLoadGroups)
  const { meetings, loading: historyLoading, error: historyError, isUpdating: historyUpdating, reload: reloadHistory } = useTeacherAttendance(period, referenceDate, canLoadGroups)
  const selectedGroup = useMemo(() => groups.find((group) => group.teaching_group_id === selectedGroupId) ?? null, [groups, selectedGroupId])
  const selectedStudent = useMemo(() => selectedGroup?.students.find((student) => student.enrollment_id === selectedEnrollmentId) ?? null, [selectedEnrollmentId, selectedGroup])
  const reportRecords = useMemo(() => {
    const query = reportSearch.trim().toLocaleLowerCase()
    return meetings
      .filter((meeting): meeting is TeacherAttendanceMeeting & { teacher_status: 'present' | 'absent', teacher_recorded_at: string } => meeting.teacher_status !== null && meeting.teacher_recorded_at !== null)
      .filter((meeting) => !reportGroup || meeting.teaching_group_id === reportGroup)
      .filter((meeting) => !query || [meeting.student_display_name, meeting.student_code, meeting.teaching_group_name].some((value) => (value ?? '').toLocaleLowerCase().includes(query)))
      .map((meeting) => ({ meeting_id: meeting.meeting_id, session_date: meeting.session_date, student_id: meeting.student_id, student_name: meeting.student_display_name, student_code: meeting.student_code, teacher_id: '', teacher_name: meeting.teacher_name, teacher_code: meeting.teacher_code, teaching_group_id: meeting.teaching_group_id, teaching_group_name: meeting.teaching_group_name, level_name: meeting.level_name, package_type: meeting.package_type as 'private' | 'semi_private', teacher_status: meeting.teacher_status, teacher_recorded_at: meeting.teacher_recorded_at } satisfies AdminAttendanceRecord))
  }, [meetings, reportGroup, reportSearch])
  const studentSummary = useMemo(() => summarizeAdminAttendanceStudents(reportRecords), [reportRecords])
  const detailStudent = studentSummary.find((student) => `${student.student_id}:${student.teaching_group_id}` === detailStudentKey) ?? null
  const detailRecords = detailStudent ? reportRecords.filter((record) => record.student_id === detailStudent.student_id && record.teaching_group_id === detailStudent.teaching_group_id).sort((left, right) => left.session_date.localeCompare(right.session_date) || left.teacher_recorded_at.localeCompare(right.teacher_recorded_at)) : []

  const downloadReport = () => {
    if (reportRecords.length === 0) return
    downloadAdminAttendancePdf({ records: reportRecords, generatedBy: profile?.full_name || 'Teacher', generatedAt: formatRecordedDateTime(new Date().toISOString()), filters: { student: 'All Students', teacher: profile?.full_name || 'Teacher', teachingGroup: 'Authorized Teaching Groups', period: formatPeriod(referenceDate, period) }, filename: `teacher-attendance-${referenceDate.slice(0, 7)}.pdf` })
  }

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  if (authLoading || profileLoading) return <div className="mx-auto max-w-6xl"><p>Loading...</p></div>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>

  const selectGroup = (groupId: string) => { setSelectedGroupId(groupId); setSelectedEnrollmentId(''); setTeacherStatus(null); setSuccessMessage(null) }
  const selectStudent = (enrollmentId: string) => { setSelectedEnrollmentId(enrollmentId); setTeacherStatus(null); setSuccessMessage(null) }
  const handlePeriodChange = (nextPeriod: TeacherAttendancePeriod) => setPeriod(nextPeriod)
  const handleReferenceDateChange = (value: string) => {
    if (period === 'month') setReferenceDate(`${value}-01`)
    else if (period === 'year') setReferenceDate(`${value}-01-01`)
    else setReferenceDate(value)
  }
  const referenceInputValue = period === 'month' ? referenceDate.slice(0, 7) : period === 'year' ? referenceDate.slice(0, 4) : referenceDate
  const save = async () => {
    if (!selectedGroup || !selectedStudent || !teacherStatus) return
    const saved = await saveAttendance({ teachingGroupId: selectedGroup.teaching_group_id, attendance: [{ studentId: selectedStudent.student_id, enrollmentId: selectedStudent.enrollment_id, teacherStatus }] })
    if (saved) { setSuccessMessage('Attendance saved for today.'); void reloadHistory() }
  }

  const totalRecords = reportRecords.length
  const presentRecords = reportRecords.filter((record) => record.teacher_status === 'present').length
  const absentRecords = reportRecords.filter((record) => record.teacher_status === 'absent').length
  const attendanceRate = totalRecords ? (presentRecords / totalRecords) * 100 : null

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449]">Attendance</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Record teaching attendance and review your authorized attendance history.</p></header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Daily Recording</p><h2 className="mt-1 text-xl font-bold text-[#102449]">Record attendance</h2></div><p className="text-sm text-slate-500">Select a teaching group and student, then record today’s status.</p></div><div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]"><div><label htmlFor="teaching-group" className="block text-sm font-semibold text-slate-700">Teaching Group</label><select id="teaching-group" value={selectedGroupId} onChange={(event) => selectGroup(event.target.value)} disabled={loading || saving} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-50"><option value="">Select Teaching Group</option>{groups.map((group) => <option key={group.teaching_group_id} value={group.teaching_group_id}>{group.teaching_group_name} · {group.level_name} · {formatPackageType(group.package_type)}</option>)}</select></div><div><label htmlFor="attendance-student" className="block text-sm font-semibold text-slate-700">Student</label><select id="attendance-student" value={selectedEnrollmentId} onChange={(event) => selectStudent(event.target.value)} disabled={!selectedGroup || saving} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-50"><option value="">Select Student</option>{selectedGroup?.students.map((student) => <option key={student.enrollment_id} value={student.enrollment_id}>{student.student_display_name}</option>)}</select></div><div className="lg:min-w-[250px]"><p className="block text-sm font-semibold text-slate-700">Status</p><div className="mt-1.5 flex gap-2">{(['present', 'absent'] as const).map((statusOption) => { const selected = teacherStatus === statusOption; const isPresent = statusOption === 'present'; return <button key={statusOption} type="button" disabled={!selectedStudent || saving} onClick={() => { setTeacherStatus(statusOption); setSuccessMessage(null) }} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${selected ? (isPresent ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-50`}>{isPresent ? 'Present' : 'Absent'}</button> })}</div><button type="button" onClick={() => void save()} disabled={!selectedStudent || !teacherStatus || saving} className="mt-2.5 w-full rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save Attendance'}</button></div></div></section>

      {mutationError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{mutationError}</div>}
      {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}<button type="button" onClick={() => void reload()} className="ml-2 font-bold underline">Retry</button></div>}

      <section className="grid gap-4 sm:grid-cols-4"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Sessions</p><p className="mt-2 text-2xl font-extrabold text-[#102449]">{historyLoading ? '…' : totalRecords}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Present</p><p className="mt-2 text-2xl font-extrabold text-emerald-700">{historyLoading ? '…' : presentRecords}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Absent</p><p className="mt-2 text-2xl font-extrabold text-rose-700">{historyLoading ? '…' : absentRecords}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Attendance Rate</p><p className="mt-2 text-2xl font-extrabold text-[#102449]">{historyLoading ? '…' : attendanceRate === null ? '—' : `${attendanceRate.toFixed(0)}%`}</p></article></section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Authorized Records</p><h2 className="mt-1 text-xl font-bold text-[#102449]">Student Attendance Summary</h2><p className="mt-1 text-sm text-slate-600">{formatPeriod(referenceDate, period)}</p></div><button type="button" onClick={downloadReport} disabled={historyLoading || reportRecords.length === 0} className="rounded-lg bg-[#102449] px-3.5 py-2.5 text-sm font-bold text-white hover:bg-[#17325f] disabled:opacity-50">Download PDF</button></div><div className="flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4"><label className="text-sm font-semibold text-slate-700">Search<input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Student / code / group" className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Teaching Group<select value={reportGroup} onChange={(event) => setReportGroup(event.target.value)} className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">All Authorized Groups</option>{groups.map((group) => <option key={group.teaching_group_id} value={group.teaching_group_id}>{group.teaching_group_name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Month<input type="month" value={referenceDate.slice(0, 7)} onChange={(event) => handleReferenceDateChange(event.target.value)} className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Year<input type="number" value={referenceDate.slice(0, 4)} onChange={(event) => setReferenceDate(`${event.target.value}-${referenceDate.slice(5, 7)}-01`)} min="2000" max="9999" className="mt-1.5 block w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-white text-slate-600"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Teaching Group</th><th className="px-5 py-3 text-right">Sessions</th><th className="px-5 py-3 text-right">Present</th><th className="px-5 py-3 text-right">Absent</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{historyLoading ? <tr><td colSpan={8} className="px-5 py-8 text-slate-600">Loading attendance report...</td></tr> : studentSummary.length === 0 ? <tr><td colSpan={8} className="px-5 py-8 text-slate-600">No attendance records for this period.</td></tr> : studentSummary.map((student) => <tr key={`${student.student_id}:${student.teaching_group_id}`} className="hover:bg-slate-50"><td className="px-5 py-3 font-semibold text-slate-900"><button type="button" onClick={() => setDetailStudentKey(`${student.student_id}:${student.teaching_group_id}`)} className="hover:text-blue-700 hover:underline">{student.student_name}</button></td><td className="px-5 py-3 text-slate-600">{student.student_code}</td><td className="px-5 py-3 text-slate-700">{student.teaching_group_name}</td><td className="px-5 py-3 text-right">{student.total_sessions}</td><td className="px-5 py-3 text-right text-emerald-700">{student.present}</td><td className="px-5 py-3 text-right text-rose-700">{student.absent}</td><td className="px-5 py-3 text-right font-semibold">{student.attendance_rate === null ? '-' : `${student.attendance_rate.toFixed(1)}%`}</td><td className="px-5 py-3"><button type="button" onClick={() => setDetailStudentKey(`${student.student_id}:${student.teaching_group_id}`)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">View Detail</button></td></tr>)}</tbody></table></div></section>

      <section className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold text-slate-900">Attendance History</h2>{historyUpdating && <p className="mt-1 text-sm text-slate-500">Updating history…</p>}</div><div className="flex flex-wrap gap-3"><div><label htmlFor="history-period" className="block text-sm font-medium text-slate-700">Filter</label><select id="history-period" value={period} onChange={(event) => handlePeriodChange(event.target.value as TeacherAttendancePeriod)} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="day">Daily</option><option value="month">Monthly</option><option value="year">Yearly</option></select></div><div><label htmlFor="history-reference" className="block text-sm font-medium text-slate-700">{period === 'day' ? 'Date' : period === 'month' ? 'Month' : 'Year'}</label><input id="history-reference" type={period === 'day' ? 'date' : period === 'month' ? 'month' : 'number'} value={referenceInputValue} min={period === 'year' ? '2000' : undefined} max={period === 'year' ? '9999' : undefined} onChange={(event) => handleReferenceDateChange(event.target.value)} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></div></div></div>{historyLoading ? <p className="mt-4 text-sm text-slate-600">Loading history…</p> : historyError ? <div className="mt-4 text-sm text-amber-800"><p>{historyError}</p><button type="button" onClick={() => void reloadHistory()} className="mt-2 font-medium underline">Retry</button></div> : meetings.length === 0 ? <p className="mt-4 text-sm text-slate-600">No attendance history for this period.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 font-medium">Session</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Student</th><th className="px-3 py-2 font-medium">Teaching Group</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{meetings.map((meeting) => <tr key={meeting.meeting_id}><td className="px-3 py-3">{meeting.session_number}</td><td className="px-3 py-3">{formatSessionDate(meeting.session_date)}</td><td className="px-3 py-3">{formatAttendanceTime(meeting.teacher_recorded_at)}</td><td className="px-3 py-3">{meeting.student_display_name}</td><td className="px-3 py-3">{meeting.teaching_group_name}</td><td className="px-3 py-3"><span className={meeting.teacher_status === 'present' ? 'rounded-full bg-emerald-100 px-2 py-1 text-emerald-800' : meeting.teacher_status === 'absent' ? 'rounded-full bg-rose-100 px-2 py-1 text-rose-800' : 'rounded-full bg-amber-100 px-2 py-1 text-amber-800'}>{meeting.teacher_status === 'present' ? 'Present' : meeting.teacher_status === 'absent' ? 'Absent' : 'Pending'}</span></td></tr>)}</tbody></table></div>}
      </section>

      {detailStudent && <TeacherAttendanceDetailModal student={detailStudent} records={detailRecords} period={period} referenceDate={referenceDate} onClose={() => setDetailStudentKey(null)} />}
    </div>
  )
}
