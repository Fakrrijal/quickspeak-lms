import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getAdminAttendanceReport, summarizeAdminAttendanceOverall, summarizeAdminAttendanceStudents, type AdminAttendanceRecord, type AdminAttendanceStudentSummary } from '../../services/admin-attendance.service'
import { getAdminStudents, getTeachingGroups, getTeachers, type AdminStudentDirectoryItem, type AdminTeacher, type TeachingGroup } from '../../services/admin.service'
import { downloadAdminAttendancePdf } from '../../utils/admin-attendance-pdf'

export const Route = createFileRoute('/admin/attendance-reports')({ component: AdminAttendanceReportsPage })

type ReportFilters = { search: string, studentId: string, teacherId: string, teachingGroupId: string, month: number, year: number }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function formatRecordedTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatPeriod(year: number, month: number) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1))
}

function formatPackageType(packageType: AdminAttendanceRecord['package_type']) {
  return packageType === 'semi_private' ? 'Semi-private' : 'Private'
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'report'
}

function AttendanceDetailModal({ student, records, month, year, onClose }: { student: AdminAttendanceStudentSummary, records: AdminAttendanceRecord[], month: number, year: number, onClose: () => void }) {
  const summary = useMemo(() => {
    const present = records.filter((record) => record.teacher_status === 'present').length
    return { total: records.length, present, absent: records.length - present, rate: records.length ? (present / records.length) * 100 : null }
  }, [records])

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="attendance-detail-title" className="mx-auto my-6 w-full max-w-5xl rounded-2xl bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white px-6 py-5">
        <div>
          <h3 id="attendance-detail-title" className="text-xl font-bold text-slate-900">Attendance Detail</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
            <div><dt className="inline font-medium text-slate-700">Student: </dt><dd className="inline">{student.student_name}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Student Code: </dt><dd className="inline">{student.student_code}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Period: </dt><dd className="inline">{formatPeriod(year, month)}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Teaching Group: </dt><dd className="inline">{student.teaching_group_name}</dd></div>
          </dl>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Close</button>
      </header>

      <div className="space-y-6 p-6">
        <section>
          <h4 className="text-lg font-bold text-slate-900">Meeting &amp; Attendance Detail</h4>
          <div className="mt-3 space-y-4">{records.map((record, index) => <article key={`${record.meeting_id}:${record.student_id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-900">Meeting {index + 1}</p>
            <p className="mt-1 text-sm text-slate-600">{formatDate(record.session_date)} · {formatRecordedTime(record.teacher_recorded_at)}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Teacher</dt><dd className="font-medium text-slate-900">{record.teacher_name}</dd></div>
              <div><dt className="text-slate-500">Teacher Code</dt><dd className="font-medium text-slate-900">{record.teacher_code}</dd></div>
              <div><dt className="text-slate-500">Teaching Group</dt><dd className="font-medium text-slate-900">{record.teaching_group_name}</dd></div>
              <div><dt className="text-slate-500">Level</dt><dd className="font-medium text-slate-900">{record.level_name}</dd></div>
              <div><dt className="text-slate-500">Package / Type</dt><dd className="font-medium text-slate-900">{formatPackageType(record.package_type)}</dd></div>
              <div><dt className="text-slate-500">Attendance Status</dt><dd className={record.teacher_status === 'present' ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{record.teacher_status === 'present' ? 'Present' : 'Absent'}</dd></div>
              <div><dt className="text-slate-500">Recorded Time</dt><dd className="font-medium text-slate-900">{formatRecordedTime(record.teacher_recorded_at)}</dd></div>
            </dl>
          </article>)}</div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-lg font-bold text-slate-900">Attendance Summary</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Total Sessions</dt><dd className="mt-1 font-bold text-slate-900">{summary.total}</dd></div><div><dt className="text-slate-500">Present</dt><dd className="mt-1 font-bold text-slate-900">{summary.present}</dd></div><div><dt className="text-slate-500">Absent</dt><dd className="mt-1 font-bold text-slate-900">{summary.absent}</dd></div><div><dt className="text-slate-500">Attendance Rate</dt><dd className="mt-1 font-bold text-slate-900">{summary.rate === null ? '-' : `${summary.rate.toFixed(1)}%`}</dd></div></dl>
        </section>
      </div>
    </div>
  </div>
}

function AdminAttendanceReportsPage() {
  const { isAuthenticated, loading, profile, profileLoading, profileError, role, status } = useAuthContext()
  const navigate = useNavigate()
  const today = new Date()
  const [filters, setFilters] = useState<ReportFilters>({ search: '', studentId: '', teacherId: '', teachingGroupId: '', month: today.getMonth() + 1, year: today.getFullYear() })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([])
  const [students, setStudents] = useState<AdminStudentDirectoryItem[]>([])
  const [teachers, setTeachers] = useState<AdminTeacher[]>([])
  const [groups, setGroups] = useState<TeachingGroup[]>([])
  const [detailStudent, setDetailStudent] = useState<AdminAttendanceStudentSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canLoad = isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status !== 'active') navigate({ to: '/waiting', replace: true })
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true)
    try { const [nextStudents, nextTeachers, nextGroups] = await Promise.all([getAdminStudents(), getTeachers(), getTeachingGroups()]); setStudents(nextStudents); setTeachers(nextTeachers); setGroups(nextGroups) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load attendance filter options.') } finally { setIsLoadingOptions(false) }
  }, [])
  const loadReport = useCallback(async (nextFilters: ReportFilters) => {
    setIsLoading(true); setError(null)
    try { setRecords(await getAdminAttendanceReport(nextFilters)) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load attendance records.') } finally { setIsLoading(false) }
  }, [])
  useEffect(() => { if (canLoad) void Promise.all([loadOptions(), loadReport(appliedFilters)]) }, [appliedFilters, canLoad, loadOptions, loadReport])

  const studentSummary = useMemo(() => summarizeAdminAttendanceStudents(records), [records])
  const summary = useMemo(() => summarizeAdminAttendanceOverall(records), [records])
  const detailRecords = useMemo(() => detailStudent ? records.filter((record) => record.student_id === detailStudent.student_id && record.teaching_group_id === detailStudent.teaching_group_id).sort((left, right) => left.session_date.localeCompare(right.session_date) || left.teacher_recorded_at.localeCompare(right.teacher_recorded_at) || left.meeting_id.localeCompare(right.meeting_id)) : [], [detailStudent, records])

  const downloadPdf = () => {
    if (records.length === 0) return
    const selectedStudent = students.find((student) => student.id === appliedFilters.studentId)
    const selectedTeacher = teachers.find((teacher) => teacher.id === appliedFilters.teacherId)
    const selectedGroup = groups.find((group) => group.id === appliedFilters.teachingGroupId)
    const filename = selectedStudent ? `attendance-${sanitizeFilename(selectedStudent.profile?.full_name ?? selectedStudent.student_code)}-${appliedFilters.year}-${String(appliedFilters.month).padStart(2, '0')}.pdf` : selectedTeacher ? `attendance-${sanitizeFilename(selectedTeacher.teacher_code)}-${appliedFilters.year}-${String(appliedFilters.month).padStart(2, '0')}.pdf` : `attendance-report-${appliedFilters.year}-${String(appliedFilters.month).padStart(2, '0')}.pdf`
    downloadAdminAttendancePdf({ records, generatedBy: profile?.full_name ?? 'Administrator', generatedAt: new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), filters: { student: selectedStudent ? `${selectedStudent.profile?.full_name ?? 'Name unavailable'} (${selectedStudent.student_code})` : 'All Students', teacher: selectedTeacher ? `${selectedTeacher.profiles?.full_name ?? 'Name unavailable'} (${selectedTeacher.teacher_code})` : 'All Teachers', teachingGroup: selectedGroup?.name ?? 'All Groups', period: formatPeriod(appliedFilters.year, appliedFilters.month) }, filename })
  }

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status !== 'active') return null
  if (role !== 'admin') return <p>Access denied.</p>

  return <section>
    <h2 className="text-3xl font-bold text-slate-900">Attendance Reports</h2><p className="mt-2 text-slate-600">Read-only attendance history for the selected reporting period.</p>
    <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filters }); setDetailStudent(null) }}>
      <label className="text-sm font-medium text-slate-700">Search<input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Student / teacher / group / code..." className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
      <label className="text-sm font-medium text-slate-700">Student<select value={filters.studentId} onChange={(event) => setFilters((current) => ({ ...current, studentId: event.target.value }))} disabled={isLoadingOptions} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All Students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.profile?.full_name ?? 'Name unavailable'} · {student.student_code}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Teacher<select value={filters.teacherId} onChange={(event) => setFilters((current) => ({ ...current, teacherId: event.target.value }))} disabled={isLoadingOptions} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All Teachers</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.profiles?.full_name ?? 'Name unavailable'} · {teacher.teacher_code}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Teaching Group<select value={filters.teachingGroupId} onChange={(event) => setFilters((current) => ({ ...current, teachingGroupId: event.target.value }))} disabled={isLoadingOptions} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All Groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Month<select value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: Number(event.target.value) }))} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index))}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Year<input type="number" min="2000" max="9999" value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: Number(event.target.value) }))} className="ml-2 w-24 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
      <button type="submit" disabled={isLoading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isLoading ? 'Applying...' : 'Apply Filters'}</button><button type="button" onClick={downloadPdf} disabled={isLoading || records.length === 0} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Download PDF</button>
    </form>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="mt-8"><h3 className="text-xl font-bold text-slate-900">Student Attendance Summary</h3><div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Student Code</th><th className="px-3 py-3">Teaching Group</th><th className="px-3 py-3 text-right">Total Sessions</th><th className="px-3 py-3 text-right">Present</th><th className="px-3 py-3 text-right">Absent</th><th className="px-3 py-3 text-right">Attendance Rate</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{isLoading ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">Loading attendance records...</td></tr> : studentSummary.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">No attendance records match the selected filters.</td></tr> : studentSummary.map((student) => <tr key={`${student.student_id}:${student.teaching_group_id}`}><td className="px-3 py-3 font-medium text-slate-900"><button type="button" onClick={() => setDetailStudent(student)} className="text-left hover:text-slate-600 hover:underline">{student.student_name}</button></td><td className="px-3 py-3">{student.student_code}</td><td className="px-3 py-3">{student.teaching_group_name}</td><td className="px-3 py-3 text-right">{student.total_sessions}</td><td className="px-3 py-3 text-right">{student.present}</td><td className="px-3 py-3 text-right">{student.absent}</td><td className="px-3 py-3 text-right">{student.attendance_rate === null ? '-' : `${student.attendance_rate.toFixed(1)}%`}</td><td className="px-3 py-3"><button type="button" onClick={() => setDetailStudent(student)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700">View Detail</button></td></tr>)}</tbody></table></div></section>
    <p className="mt-6 text-sm text-slate-600">Overall summary: {summary.total_sessions} sessions, {summary.total_records} attendance records, {summary.present} present, {summary.absent} absent ({summary.attendance_rate === null ? '-' : `${summary.attendance_rate.toFixed(1)}%`}).</p>
    {detailStudent && <AttendanceDetailModal student={detailStudent} records={detailRecords} month={appliedFilters.month} year={appliedFilters.year} onClose={() => setDetailStudent(null)} />}
  </section>
}
