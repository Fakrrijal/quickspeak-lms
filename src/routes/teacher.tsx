import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import { useTeacherGroupAttendance } from '../hooks/useTeacherGroupAttendance'
import { useTeacherAttendance } from '../hooks/useTeacherAttendance'
import { type TeacherAttendanceGroup, type TeacherAttendanceMeeting, type TeacherAttendancePeriod, getMyTeacherAttendance, getMyTeacherAttendanceGroups } from '../services/teacher-attendance.service'
import { downloadAdminAttendancePdf } from '../utils/admin-attendance-pdf'
import { summarizeAdminAttendanceOverall, summarizeAdminAttendanceStudents, type AdminAttendanceRecord } from '../services/admin-attendance.service'
import { getMyTeacherFeeReport, type MyTeacherFeeReport } from '../services/teacher-fee.service'

export const Route = createFileRoute('/teacher')({
  component: TeacherRouteComponent,
})

function formatPackageType(packageType: string) {
  return packageType === 'semi_private' ? 'Semi-Private' : 'Private'
}

function getTodayIsoDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatSessionDate(sessionDate: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${sessionDate}T00:00:00`))
}

function formatAttendanceTime(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(value))
}

function formatPeriod(referenceDate: string, _period: TeacherAttendancePeriod) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${referenceDate.slice(0, 7)}-01T00:00:00`))
}

function TeacherAttendanceDetailModal({ student, records, period, referenceDate, onClose }: { student: ReturnType<typeof summarizeAdminAttendanceStudents>[number], records: AdminAttendanceRecord[], period: TeacherAttendancePeriod, referenceDate: string, onClose: () => void }) {
  const overall = summarizeAdminAttendanceOverall(records)
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="teacher-attendance-detail-title" className="mx-auto my-6 w-full max-w-5xl rounded-2xl bg-slate-50 shadow-xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white px-6 py-5"><div><h3 id="teacher-attendance-detail-title" className="text-xl font-bold text-slate-900">Attendance Detail</h3><dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2"><div><dt className="inline font-medium text-slate-700">Student: </dt><dd className="inline">{student.student_name}</dd></div><div><dt className="inline font-medium text-slate-700">Student Code: </dt><dd className="inline">{student.student_code}</dd></div><div><dt className="inline font-medium text-slate-700">Teaching Group: </dt><dd className="inline">{student.teaching_group_name}</dd></div><div><dt className="inline font-medium text-slate-700">Period: </dt><dd className="inline">{formatPeriod(referenceDate, period)}</dd></div></dl></div><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Close</button></header><div className="space-y-6 p-6"><section><h4 className="text-lg font-bold text-slate-900">Meeting &amp; Attendance Detail</h4><div className="mt-3 space-y-4">{records.map((record, index) => <article key={record.meeting_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="font-semibold text-slate-900">Meeting {index + 1}</p><p className="mt-1 text-sm text-slate-600">{formatSessionDate(record.session_date)} · {formatRecordedDateTime(record.teacher_recorded_at)}</p><dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Teacher</dt><dd className="font-medium text-slate-900">{record.teacher_name}</dd></div><div><dt className="text-slate-500">Teacher Code</dt><dd className="font-medium text-slate-900">{record.teacher_code}</dd></div><div><dt className="text-slate-500">Teaching Group</dt><dd className="font-medium text-slate-900">{record.teaching_group_name}</dd></div><div><dt className="text-slate-500">Level</dt><dd className="font-medium text-slate-900">{record.level_name}</dd></div><div><dt className="text-slate-500">Package / Type</dt><dd className="font-medium text-slate-900">{record.package_type === 'semi_private' ? 'Semi-private' : 'Private'}</dd></div><div><dt className="text-slate-500">Attendance Status</dt><dd className={record.teacher_status === 'present' ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{record.teacher_status === 'present' ? 'Present' : 'Absent'}</dd></div><div><dt className="text-slate-500">Recorded Time</dt><dd className="font-medium text-slate-900">{formatRecordedDateTime(record.teacher_recorded_at)}</dd></div></dl></article>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-4"><h4 className="text-lg font-bold text-slate-900">Attendance Summary</h4><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Total Sessions</dt><dd className="mt-1 font-bold text-slate-900">{overall.total_records}</dd></div><div><dt className="text-slate-500">Present</dt><dd className="mt-1 font-bold text-slate-900">{overall.present}</dd></div><div><dt className="text-slate-500">Absent</dt><dd className="mt-1 font-bold text-slate-900">{overall.absent}</dd></div><div><dt className="text-slate-500">Attendance Rate</dt><dd className="mt-1 font-bold text-slate-900">{overall.attendance_rate === null ? '-' : `${overall.attendance_rate.toFixed(1)}%`}</dd></div></dl></section></div></div></div>
}

function formatRecordedDateTime(value: string) { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

function TeacherRouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return pathname === '/teacher' ? <TeacherDashboard /> : <Outlet />
}

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
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
    } else if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
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

    Promise.all([
      getMyTeacherAttendanceGroups(),
      getMyTeacherAttendance('month', referenceDate),
      getMyTeacherFeeReport(month, year),
    ])
      .then(([groupsData, meetingsData, feeReportData]) => {
        if (!cancelled) {
          setGroups(groupsData)
          setMeetings(meetingsData)
          setFeeReport(feeReportData)
          setSummaryLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummaryError(err instanceof Error ? err.message : 'Unable to load dashboard summary')
          setSummaryLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [canLoad, retryCount])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  const classCount = groups.length
  const activeStudentCount = new Set(groups.flatMap((group) => group.students.map((student) => student.student_id))).size
  const feeAmount = feeReport?.period_summary.earned_amount ?? 0
  const attendanceCount = meetings.filter((meeting) => meeting.teacher_status !== null && meeting.teacher_recorded_at !== null).length

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Teacher Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Welcome back, {profile.full_name || 'Teacher'}.</p>
      </header>

      <section className="mb-8 rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Teaching Workspace</h2>
          <p className="mt-1 text-sm text-slate-600">Manage your assigned teaching groups and attendance.</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Dashboard Summary</h2>
        {summaryLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : summaryError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            <p>{summaryError}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-3 font-medium underline">Retry</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                    <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h-1m2-4v4m0 0V8" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Classes</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#102449]">{classCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1a6 6 0 0112 0v-1M12 15a3 3 0 100-6M15 12a3 3 0 11-6 0m3 0a3 3 0 100-6" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Active Students</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#102449]">{activeStudentCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                    <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Fee (This Month)</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#102449]">Rp{feeAmount.toLocaleString('id-ID')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012 2h2a2 2 0 012-2m-6 6l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Attendance (This Month)</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#102449]">{attendanceCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

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
  const canLoadGroups = !authLoading && !profileLoading && isAuthenticated && Boolean(profile)
    && !profileError && role === 'teacher' && status === 'active'
  const { groups, loading, error, mutationError, saving, saveAttendance, reload } = useTeacherGroupAttendance(canLoadGroups)
  const {
    meetings,
    loading: historyLoading,
    error: historyError,
    isUpdating: historyUpdating,
    reload: reloadHistory,
  } = useTeacherAttendance(period, referenceDate, canLoadGroups)
  const selectedGroup = useMemo(
    () => groups.find((group) => group.teaching_group_id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )
  const selectedStudent = useMemo(
    () => selectedGroup?.students.find((student) => student.enrollment_id === selectedEnrollmentId) ?? null,
    [selectedEnrollmentId, selectedGroup],
  )
  const reportRecords = useMemo(() => {
    const query = reportSearch.trim().toLocaleLowerCase()
    return meetings.filter((meeting): meeting is TeacherAttendanceMeeting & { teacher_status: 'present' | 'absent', teacher_recorded_at: string } => meeting.teacher_status !== null && meeting.teacher_recorded_at !== null)
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
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
    } else if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  if (authLoading || profileLoading) {
    return <div className="mx-auto max-w-3xl p-8"><p>Loading...</p></div>
  }
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') {
    return <div className="mx-auto max-w-3xl p-8"><p>Access denied.</p></div>
  }

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId)
    setSelectedEnrollmentId('')
    setTeacherStatus(null)
    setSuccessMessage(null)
  }

  const selectStudent = (enrollmentId: string) => {
    setSelectedEnrollmentId(enrollmentId)
    setTeacherStatus(null)
    setSuccessMessage(null)
  }

  const handlePeriodChange = (nextPeriod: TeacherAttendancePeriod) => {
    setPeriod(nextPeriod)
  }

  const handleReferenceDateChange = (value: string) => {
    if (period === 'month') {
      setReferenceDate(`${value}-01`)
    } else if (period === 'year') {
      setReferenceDate(`${value}-01-01`)
    } else {
      setReferenceDate(value)
    }
  }

  const referenceInputValue = period === 'month'
    ? referenceDate.slice(0, 7)
    : period === 'year'
      ? referenceDate.slice(0, 4)
      : referenceDate

  const save = async () => {
    if (!selectedGroup || !selectedStudent || !teacherStatus) return

    const saved = await saveAttendance({
      teachingGroupId: selectedGroup.teaching_group_id,
      attendance: [{
        studentId: selectedStudent.student_id,
        enrollmentId: selectedStudent.enrollment_id,
        teacherStatus,
      }],
    })

    if (saved) {
      setSuccessMessage('Attendance saved for today.')
      void reloadHistory()
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900">Attendance</h1>
        <p className="mt-2 text-slate-600">Welcome, {profile.full_name || 'Teacher'}. Record today’s attendance for a teaching group.</p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="teaching-group" className="block text-sm font-medium text-slate-700">Teaching Group</label>
          <select
            id="teaching-group"
            value={selectedGroupId}
            onChange={(event) => selectGroup(event.target.value)}
            disabled={loading || saving}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select Teaching Group</option>
            {groups.map((group) => (
              <option key={group.teaching_group_id} value={group.teaching_group_id}>
                {group.teaching_group_name} · {group.level_name} · {formatPackageType(group.package_type)}
              </option>
            ))}
          </select>
        </section>

        {mutationError && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{mutationError}</div>}
        {successMessage && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</div>}

        {loading ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">Loading teaching groups…</p></section>
        ) : error ? (
          <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p>{error}</p><button type="button" onClick={() => void reload()} className="mt-3 font-medium underline">Retry</button>
          </section>
        ) : groups.length === 0 ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">No active teaching groups are assigned to you.</p></section>
        ) : selectedGroup ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <label htmlFor="attendance-student" className="block text-sm font-medium text-slate-700">Student</label>
            <select id="attendance-student" value={selectedEnrollmentId} onChange={(event) => selectStudent(event.target.value)} disabled={saving} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
              <option value="">Select Student</option>
              {selectedGroup.students.map((student) => <option key={student.enrollment_id} value={student.enrollment_id}>{student.student_display_name}</option>)}
            </select>

            {selectedStudent && (
              <div className="mt-5">
                <p className="text-sm font-medium text-slate-700">Status</p>
                <div className="mt-2 flex gap-2" role="radiogroup" aria-label={`Attendance for ${selectedStudent.student_display_name}`}>
                  {(['present', 'absent'] as const).map((statusOption) => {
                    const selected = teacherStatus === statusOption
                    const isPresent = statusOption === 'present'
                    return (
                      <button key={statusOption} type="button" role="radio" aria-checked={selected} disabled={saving} onClick={() => { setTeacherStatus(statusOption); setSuccessMessage(null) }} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${selected ? (isPresent ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                        {isPresent ? 'Present' : 'Absent'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!selectedStudent || !teacherStatus || saving}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Attendance'}
            </button>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-900">Student Attendance Summary</h2><p className="mt-1 text-sm text-slate-600">Authorized attendance for your teaching groups · {formatPeriod(referenceDate, period)}</p></div><button type="button" onClick={downloadReport} disabled={historyLoading || reportRecords.length === 0} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Download PDF</button></div>
          <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-slate-700">Search<input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Student / code / group" className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Teaching Group<select value={reportGroup} onChange={(event) => setReportGroup(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All Authorized Groups</option>{groups.map((group) => <option key={group.teaching_group_id} value={group.teaching_group_id}>{group.teaching_group_name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Month<input type="month" value={referenceDate.slice(0, 7)} onChange={(event) => handleReferenceDateChange(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Year<input type="number" value={referenceDate.slice(0, 4)} onChange={(event) => setReferenceDate(`${event.target.value}-${referenceDate.slice(5, 7)}-01`)} min="2000" max="9999" className="ml-2 w-24 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label></div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Student Code</th><th className="px-3 py-3">Teaching Group</th><th className="px-3 py-3 text-right">Total Sessions</th><th className="px-3 py-3 text-right">Present</th><th className="px-3 py-3 text-right">Absent</th><th className="px-3 py-3 text-right">Attendance Rate</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{historyLoading ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">Loading attendance report...</td></tr> : studentSummary.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">No attendance records for this period.</td></tr> : studentSummary.map((student) => <tr key={`${student.student_id}:${student.teaching_group_id}`}><td className="px-3 py-3 font-medium text-slate-900"><button type="button" onClick={() => setDetailStudentKey(`${student.student_id}:${student.teaching_group_id}`)} className="hover:underline">{student.student_name}</button></td><td className="px-3 py-3">{student.student_code}</td><td className="px-3 py-3">{student.teaching_group_name}</td><td className="px-3 py-3 text-right">{student.total_sessions}</td><td className="px-3 py-3 text-right">{student.present}</td><td className="px-3 py-3 text-right">{student.absent}</td><td className="px-3 py-3 text-right">{student.attendance_rate === null ? '-' : `${student.attendance_rate.toFixed(1)}%`}</td><td className="px-3 py-3"><button type="button" onClick={() => setDetailStudentKey(`${student.student_id}:${student.teaching_group_id}`)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700">View Detail</button></td></tr>)}</tbody></table></div>
        </section>

        <section className="hidden mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Attendance History</h2>
              {historyUpdating && <p className="mt-1 text-sm text-slate-500">Updating history…</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label htmlFor="history-period" className="block text-sm font-medium text-slate-700">Filter</label>
                <select id="history-period" value={period} onChange={(event) => handlePeriodChange(event.target.value as TeacherAttendancePeriod)} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                  <option value="day">Daily</option><option value="month">Monthly</option><option value="year">Yearly</option>
                </select>
              </div>
              <div>
                <label htmlFor="history-reference" className="block text-sm font-medium text-slate-700">{period === 'day' ? 'Date' : period === 'month' ? 'Month' : 'Year'}</label>
                <input id="history-reference" type={period === 'day' ? 'date' : period === 'month' ? 'month' : 'number'} value={referenceInputValue} min={period === 'year' ? '2000' : undefined} max={period === 'year' ? '9999' : undefined} onChange={(event) => handleReferenceDateChange(event.target.value)} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
              </div>
            </div>
          </div>
          {historyLoading ? <p className="mt-4 text-sm text-slate-600">Loading history…</p> : historyError ? (
            <div className="mt-4 text-sm text-amber-800"><p>{historyError}</p><button type="button" onClick={() => void reloadHistory()} className="mt-2 font-medium underline">Retry</button></div>
          ) : meetings.length === 0 ? <p className="mt-4 text-sm text-slate-600">No attendance history for this period.</p> : (
            <div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 font-medium">Pertemuan</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Student</th><th className="px-3 py-2 font-medium">Teaching Group</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{meetings.map((meeting) => <tr key={meeting.meeting_id}><td className="px-3 py-3 text-slate-900">{meeting.session_number}</td><td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatSessionDate(meeting.session_date)}</td><td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatAttendanceTime(meeting.teacher_recorded_at)}</td><td className="px-3 py-3 text-slate-900">{meeting.student_display_name}</td><td className="px-3 py-3 text-slate-700">{meeting.teaching_group_name}</td><td className="px-3 py-3"><span className={meeting.teacher_status === 'present' ? 'rounded-full bg-emerald-100 px-2 py-1 text-emerald-800' : meeting.teacher_status === 'absent' ? 'rounded-full bg-rose-100 px-2 py-1 text-rose-800' : 'rounded-full bg-amber-100 px-2 py-1 text-amber-800'}>{meeting.teacher_status === 'present' ? 'Present' : meeting.teacher_status === 'absent' ? 'Absent' : 'Pending'}</span></td></tr>)}</tbody></table></div>
          )}
        </section>
        {detailStudent && <TeacherAttendanceDetailModal student={detailStudent} records={detailRecords} period={period} referenceDate={referenceDate} onClose={() => setDetailStudentKey(null)} />}
      </div>
    </div>
  )
}
