import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  getAdminTeacherFeeReports,
  markTeacherFeePeriodPaid,
  summarizeTeacherFeeDetails,
  type AdminTeacherFeeReport,
  type TeacherFeeDetailEntry,
  type TeacherFeeStatus,
} from '../../services/teacher-fee.service'
import { downloadAdminTeacherFeePdf } from '../../utils/teacher-fee-pdf'
import { reportSystemError } from '../../lib/systemErrorReporter'

export const Route = createFileRoute('/admin/teacher-fees')({ component: AdminTeacherFeesPage })

function formatAmount(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1))
}

function formatPackageType(packageType: TeacherFeeDetailEntry['package_type']) {
  return packageType === 'semi_private' ? 'Semi-private' : 'Private'
}

function TeacherFeeDetailModal({ report, month, year, onClose }: { report: AdminTeacherFeeReport, month: number, year: number, onClose: () => void }) {
  const meetings = useMemo(() => {
    const byMeeting = new Map<string, TeacherFeeDetailEntry[]>()
    report.detail_entries.forEach((entry) => byMeeting.set(entry.meeting_id, [...(byMeeting.get(entry.meeting_id) ?? []), entry]))

    return [...byMeeting.values()]
      .map((entries) => entries.sort((left, right) => left.attendance_recorded_at.localeCompare(right.attendance_recorded_at)))
      .sort((left, right) => left[0].session_date.localeCompare(right[0].session_date) || left[0].attendance_recorded_at.localeCompare(right[0].attendance_recorded_at))
  }, [report.detail_entries])
  const studentSummaries = useMemo(() => summarizeTeacherFeeDetails(report.detail_entries), [report.detail_entries])
  const totalPresentAttendances = studentSummaries.reduce((total, summary) => total + summary.present_attendance_count, 0)
  const reconciliationMessage = report.detail_reconciles_period
    ? 'Detail reconciles with Teacher Fee total.'
    : report.status === 'paid'
      ? 'Historical detail does not currently reconcile with the frozen settlement amount.'
      : 'Detail does not currently reconcile with the Teacher Fee total.'

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="teacher-fee-detail-title" className="mx-auto my-6 w-full max-w-5xl rounded-2xl bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white px-6 py-5">
        <div>
          <h3 id="teacher-fee-detail-title" className="text-xl font-bold text-slate-900">Teacher Fee Detail</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
            <div><dt className="inline font-medium text-slate-700">Teacher: </dt><dd className="inline">{report.teacher_name}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Teacher Code: </dt><dd className="inline">{report.teacher_code}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Period: </dt><dd className="inline">{formatMonth(year, month)}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Status: </dt><dd className="inline uppercase">{report.status}</dd></div>
          </dl>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Close</button>
      </header>

      <div className="space-y-6 p-6">
        {report.detail_entries.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No fee detail available for this teacher and period.</p> : <>
          <section>
            <h4 className="text-lg font-bold text-slate-900">Meeting &amp; Attendance Detail</h4>
            <div className="mt-3 space-y-4">{meetings.map((entries) => {
              const meeting = entries[0]
              return <article key={meeting.meeting_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{formatDate(meeting.session_date)} · {formatTime(meeting.attendance_recorded_at)}</p>
                  <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-3">
                    <span><strong>Teaching Group:</strong> {meeting.teaching_group_name}</span>
                    <span><strong>Package:</strong> {formatPackageType(meeting.package_type)}</span>
                    <span><strong>Level:</strong> {meeting.level_name}</span>
                  </div>
                </div>
                <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.attendance_id}><td className="px-4 py-3 font-medium text-slate-900">{entry.student_name}</td><td className="px-4 py-3 text-slate-600">{entry.student_code}</td><td className="px-4 py-3 capitalize">{entry.attendance_status}</td><td className="px-4 py-3 text-right">{formatAmount(entry.student_fee)}</td></tr>)}</tbody></table></div>
                <p className="border-t border-slate-100 px-4 py-3 text-right text-sm font-bold text-slate-900">Meeting Fee: {formatAmount(meeting.meeting_fee)}</p>
              </article>
            })}</div>
          </section>

          <section>
            <h4 className="text-lg font-bold text-slate-900">Student Fee Summary</h4>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student Code</th><th className="px-4 py-3">Teaching Group</th><th className="px-4 py-3 text-right">Present Attendances</th><th className="px-4 py-3 text-right">Fee / Attendance</th><th className="px-4 py-3 text-right">Total Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{studentSummaries.map((summary) => <tr key={`${summary.student_id}:${summary.teaching_group_id}:${summary.fee_rate}`}><td className="px-4 py-3 font-medium text-slate-900">{summary.student_name}</td><td className="px-4 py-3 text-slate-600">{summary.student_code}</td><td className="px-4 py-3">{summary.teaching_group_name}</td><td className="px-4 py-3 text-right">{summary.present_attendance_count}×</td><td className="px-4 py-3 text-right">{formatAmount(summary.fee_rate)}</td><td className="px-4 py-3 text-right font-medium">{formatAmount(summary.student_total)}</td></tr>)}</tbody></table></div>
          </section>
        </>}

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-lg font-bold text-slate-900">Teacher Fee Summary</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Earned</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(report.earned_amount)}</dd></div><div><dt className="text-slate-500">Paid</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(report.paid_amount)}</dd></div><div><dt className="text-slate-500">Outstanding</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(report.outstanding_amount)}</dd></div><div><dt className="text-slate-500">Total Student Attendances</dt><dd className="mt-1 font-bold text-slate-900">{totalPresentAttendances}</dd></div></dl>
          <p className={`mt-4 text-sm ${report.detail_reconciles_period ? 'text-emerald-700' : 'text-amber-700'}`}>{report.detail_reconciles_period ? '✓ ' : '⚠ '}{reconciliationMessage}</p>
        </section>
      </div>
    </div>
  </div>
}

function AdminTeacherFeesPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  const navigate = useNavigate()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [statusFilter, setStatusFilter] = useState<TeacherFeeStatus>('all')
  const [search, setSearch] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
  const [reports, setReports] = useState<AdminTeacherFeeReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [payingTeacherId, setPayingTeacherId] = useState<string | null>(null)
  const [detailReport, setDetailReport] = useState<AdminTeacherFeeReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try { setReports(await getAdminTeacherFeeReports(month, year, statusFilter)) } catch (loadError) { await reportSystemError({ feature: 'TEACHER_FEE', action: 'LOAD_TEACHER_FEES', error: loadError }); setError(loadError instanceof Error ? loadError.message : 'Unable to load teacher fee reports.') } finally { setIsLoading(false) }
  }, [month, statusFilter, year])

  useEffect(() => { if (isAuthenticated && role === 'admin' && status === 'active') void load() }, [isAuthenticated, load, role, status])

  const matchingReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return reports.filter((report) => (!teacherFilter || report.teacher_id === teacherFilter) && (!query || report.teacher_name.toLocaleLowerCase().includes(query) || report.teacher_code.toLocaleLowerCase().includes(query)))
  }, [reports, search, teacherFilter])
  const selectedReports = useMemo(() => selectedTeacherIds.length === 0 ? matchingReports : matchingReports.filter((report) => selectedTeacherIds.includes(report.teacher_id)), [matchingReports, selectedTeacherIds])
  const toggleTeacher = (teacherId: string) => setSelectedTeacherIds((current) => current.includes(teacherId) ? current.filter((id) => id !== teacherId) : [...current, teacherId])

  const markPaid = async (report: AdminTeacherFeeReport) => {
    if (!window.confirm(`Mark ${report.teacher_name}'s ${formatAmount(report.earned_amount)} fee as paid?`)) return
    setPayingTeacherId(report.teacher_id); setError(null)
    try { await markTeacherFeePeriodPaid(report.teacher_id, report.period_start); await load() } catch (paymentError) { setError(paymentError instanceof Error ? paymentError.message : 'Unable to mark the fee period paid.'); await load() } finally { setPayingTeacherId(null) }
  }

  const downloadPdf = () => {
    if (selectedReports.length === 0) { setError('No teacher fee records match the selected filters.'); return }
    setIsExporting(true); setError(null)
    try {
      const safeCode = selectedReports[0]?.teacher_code.replace(/[^a-zA-Z0-9_-]/g, '') || 'teacher'
      downloadAdminTeacherFeePdf({ reports: selectedReports.map((report) => {
        const studentSummaries = summarizeTeacherFeeDetails(report.detail_entries)
        return {
          teacherName: report.teacher_name,
          teacherCode: report.teacher_code,
          period: formatMonth(year, month),
          status: report.status,
          earned: report.earned_amount,
          paid: report.paid_amount,
          outstanding: report.outstanding_amount,
          detailEntries: report.detail_entries,
          studentSummaries,
          totalStudentAttendances: studentSummaries.reduce((total, summary) => total + summary.present_attendance_count, 0),
          detailReconcilesPeriod: report.detail_reconciles_period,
        }
      }), generatedAt: new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), filename: selectedReports.length === 1 ? `teacher-fee-${safeCode}-${year}-${String(month).padStart(2, '0')}.pdf` : `teacher-fee-report-${year}-${String(month).padStart(2, '0')}.pdf` })
    } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : 'Unable to generate the PDF report.') } finally { setIsExporting(false) }
  }

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status === 'waiting') return null
  if (role !== 'admin' || status !== 'active') return <p>Access denied.</p>

  return <section>
    <h2 className="text-3xl font-bold text-slate-900">Teacher Fee Settlement</h2>
    <div className="mt-6 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-slate-700">Search teacher / code<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or TCH code" className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
      <label className="text-sm font-medium text-slate-700">Teacher<select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All Teachers</option>{reports.map((report) => <option key={report.teacher_id} value={report.teacher_id}>{report.teacher_name} · {report.teacher_code}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Month<select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index))}</option>)}</select></label>
      <label className="text-sm font-medium text-slate-700">Year<input type="number" min="2000" max="9999" value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-2 w-24 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
      <label className="text-sm font-medium text-slate-700">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TeacherFeeStatus)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="all">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label>
      <button type="button" onClick={() => setSelectedTeacherIds(matchingReports.map((report) => report.teacher_id))} disabled={matchingReports.length === 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Select All Matching</button>
      <button type="button" onClick={downloadPdf} disabled={isExporting || isLoading || matchingReports.length === 0} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{isExporting ? 'Preparing PDF...' : 'Download PDF'}</button>
    </div>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3">Teacher</th><th className="px-3 py-3">Teacher Code</th><th className="px-3 py-3">Earned</th><th className="px-3 py-3">Paid</th><th className="px-3 py-3">Outstanding</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{isLoading ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">Loading fee periods...</td></tr> : matchingReports.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">No teacher fee records match the selected filters.</td></tr> : matchingReports.map((report) => <tr key={report.teacher_id}><td className="px-3 py-3"><input type="checkbox" checked={selectedTeacherIds.includes(report.teacher_id)} onChange={() => toggleTeacher(report.teacher_id)} aria-label={`Select ${report.teacher_name}`} /></td><td className="px-3 py-3 font-medium text-slate-900">{report.teacher_name}</td><td className="px-3 py-3">{report.teacher_code}</td><td className="px-3 py-3">{formatAmount(report.earned_amount)}</td><td className="px-3 py-3">{formatAmount(report.paid_amount)}</td><td className="px-3 py-3">{formatAmount(report.outstanding_amount)}</td><td className="px-3 py-3"><span className="font-medium uppercase">{report.status}</span></td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setDetailReport(report)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700">View Detail</button>{report.status === 'paid' ? null : <button type="button" onClick={() => void markPaid(report)} disabled={payingTeacherId !== null} className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-50">{payingTeacherId === report.teacher_id ? 'Processing...' : 'Mark Paid'}</button>}</div></td></tr>)}</tbody></table></div>
    {detailReport && <TeacherFeeDetailModal report={detailReport} month={month} year={year} onClose={() => setDetailReport(null)} />}
  </section>
}
