import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTeacherFee } from '../../hooks/useTeacherFee'
import type { TeacherFeeStatus, TeacherFeeDetailEntry, TeacherFeeStudentSummary } from '../../services/teacher-fee.service'
import { getMyTeacherCode, summarizeTeacherFeeDetails } from '../../services/teacher-fee.service'
import { useAuthContext } from '../../providers/AuthProvider'
import { downloadTeacherFeePdf } from '../../utils/teacher-fee-pdf'

export const Route = createFileRoute('/teacher/fee')({ component: TeacherFeePage })

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

function TeacherFeeDetailModal({ detailEntries, studentSummaries, month, year, detailReconcilesPeriod, onClose }: { detailEntries: TeacherFeeDetailEntry[], studentSummaries: TeacherFeeStudentSummary[], month: number, year: number, detailReconcilesPeriod: boolean, onClose: () => void }) {
  const meetings = useMemo(() => {
    const byMeeting = new Map<string, TeacherFeeDetailEntry[]>()
    detailEntries.forEach((entry) => byMeeting.set(entry.meeting_id, [...(byMeeting.get(entry.meeting_id) ?? []), entry]))

    return [...byMeeting.values()]
      .map((entries) => entries.sort((left, right) => left.attendance_recorded_at.localeCompare(right.attendance_recorded_at)))
      .sort((left, right) => left[0].session_date.localeCompare(right[0].session_date) || left[0].attendance_recorded_at.localeCompare(right[0].attendance_recorded_at))
  }, [detailEntries])
  const totalPresentAttendances = studentSummaries.reduce((total, summary) => total + summary.present_attendance_count, 0)
  const totalDetailFee = detailEntries.reduce((total, entry) => total + entry.student_fee, 0)
  const reconciliationMessage = detailReconcilesPeriod
    ? 'Detail reconciles with Teacher Fee total.'
    : 'Detail does not currently reconcile with the Teacher Fee total.'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="teacher-fee-detail-title" className="mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Teacher Fee</p>
            <h3 id="teacher-fee-detail-title" className="mt-1 text-xl font-extrabold text-[#102449]">Fee Detail</h3>
            <p className="mt-1 text-sm text-slate-600">{formatMonth(year, month)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Close</button>
        </header>

        <div className="space-y-6 p-6">
          {detailEntries.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No fee detail available for this period.</p>
          ) : (
            <>
              <section>
                <h4 className="text-lg font-bold text-[#102449]">Meeting &amp; Attendance Detail</h4>
                <div className="mt-3 space-y-4">
                  {meetings.map((entries) => {
                    const meeting = entries[0]
                    return (
                      <article key={meeting.meeting_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">{formatDate(meeting.session_date)} · {formatTime(meeting.attendance_recorded_at)}</p>
                          <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                            <span><strong className="text-slate-800">Teaching Group:</strong> {meeting.teaching_group_name}</span>
                            <span><strong className="text-slate-800">Package:</strong> {formatPackageType(meeting.package_type)}</span>
                            <span><strong className="text-slate-800">Level:</strong> {meeting.level_name}</span>
                          </div>
                        </div>
                        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-white text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.attendance_id}><td className="px-4 py-3 font-semibold text-slate-900">{entry.student_name}</td><td className="px-4 py-3 text-slate-600">{entry.student_code}</td><td className="px-4 py-3 capitalize text-slate-700">{entry.attendance_status}</td><td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(entry.student_fee)}</td></tr>)}</tbody></table></div>
                        <p className="border-t border-slate-100 px-4 py-3 text-right text-sm font-bold text-slate-900">Meeting Fee: {formatAmount(meeting.meeting_fee)}</p>
                      </article>
                    )
                  })}
                </div>
              </section>

              <section>
                <h4 className="text-lg font-bold text-[#102449]">Student Fee Summary</h4>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student Code</th><th className="px-4 py-3">Teaching Group</th><th className="px-4 py-3 text-right">Present Attendances</th><th className="px-4 py-3 text-right">Fee / Attendance</th><th className="px-4 py-3 text-right">Total Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{studentSummaries.map((summary) => <tr key={`${summary.student_id}:${summary.teaching_group_id}:${summary.fee_rate}`}><td className="px-4 py-3 font-semibold text-slate-900">{summary.student_name}</td><td className="px-4 py-3 text-slate-600">{summary.student_code}</td><td className="px-4 py-3">{summary.teaching_group_name}</td><td className="px-4 py-3 text-right">{summary.present_attendance_count}×</td><td className="px-4 py-3 text-right">{formatAmount(summary.fee_rate)}</td><td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.student_total)}</td></tr>)}</tbody></table></div>
              </section>
            </>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-lg font-bold text-[#102449]">Teacher Fee Summary</h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Total Detail Fee</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(totalDetailFee)}</dd></div><div><dt className="text-slate-500">Total Student Attendances</dt><dd className="mt-1 font-bold text-slate-900">{totalPresentAttendances}</dd></div></dl>
            <p className={`mt-4 text-sm font-medium ${detailReconcilesPeriod ? 'text-emerald-700' : 'text-amber-700'}`}>{detailReconcilesPeriod ? '✓ ' : '⚠ '}{reconciliationMessage}</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function TeacherFeePage() {
  const { isAuthenticated, loading: authLoading, profileLoading, profileError, role, status, profile } = useAuthContext()
  const navigate = useNavigate()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [statusFilter, setStatusFilter] = useState<TeacherFeeStatus>('all')
  const canLoad = !authLoading && !profileLoading && isAuthenticated && !profileError && role === 'teacher' && status === 'active'
  const { entries, detailEntries, detailReconcilesPeriod, periodSummary, loading, error, reload } = useTeacherFee(month, year, canLoad)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profileError, profileLoading, status])

  const summary = useMemo(() => {
    if (!periodSummary) return { earned: 0, paid: 0, outstanding: 0, status: 'unpaid' as const }
    return { earned: periodSummary.earned_amount, paid: periodSummary.paid_amount, outstanding: periodSummary.outstanding_amount, status: periodSummary.status }
  }, [periodSummary])
  const visibleEntries = useMemo(() => statusFilter === 'all' || summary.status === statusFilter ? entries : [], [entries, statusFilter, summary.status])
  const visibleDetailEntries = useMemo(() => statusFilter === 'all' || summary.status === statusFilter ? detailEntries : [], [detailEntries, statusFilter, summary.status])
  const studentSummaries = useMemo(() => summarizeTeacherFeeDetails(visibleDetailEntries), [visibleDetailEntries])

  const handleDownloadPdf = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const teacherCode = await getMyTeacherCode()
      const studentSummaries = summarizeTeacherFeeDetails(visibleDetailEntries)
      downloadTeacherFeePdf({
        teacherName: profile?.full_name ?? 'Teacher',
        teacherCode: teacherCode ?? 'teacher',
        period: formatMonth(year, month),
        status: summary.status,
        earned: summary.earned,
        paid: summary.paid,
        outstanding: summary.outstanding,
        detailEntries: visibleDetailEntries,
        studentSummaries,
        totalStudentAttendances: studentSummaries.reduce((total, student) => total + student.present_attendance_count, 0),
        detailReconcilesPeriod,
      }, new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()))
    } catch (downloadError) {
      setExportError(downloadError instanceof Error ? downloadError.message : 'Unable to generate the PDF report.')
    } finally {
      setIsExporting(false)
    }
  }

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  const statusTone = summary.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-[#102449]">Teacher Fee</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">Review your current fee statement and attendance-based earnings.</p>
          </div>
          <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${statusTone}`}>{summary.status}</span>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Statement Period</p>
            <p className="mt-1 text-lg font-bold text-[#102449]">{formatMonth(year, month)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-semibold text-slate-700">Month<select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index))}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Year<input type="number" min="2000" max="9999" value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-2 w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium" /></label>
            <div className="flex items-end gap-2">{(['all', 'paid', 'unpaid'] as const).map((filter) => <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={statusFilter === filter ? 'rounded-lg bg-[#102449] px-3 py-2 text-sm font-bold text-white' : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50'}>{filter === 'all' ? 'All' : filter === 'paid' ? 'Paid' : 'Unpaid'}</button>)}</div>
            <button type="button" onClick={() => setShowDetailModal(true)} disabled={loading || visibleDetailEntries.length === 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">View Detail</button>
            <button type="button" onClick={() => void handleDownloadPdf()} disabled={isExporting || loading} className="rounded-lg bg-[#102449] px-3 py-2 text-sm font-bold text-white hover:bg-[#17325f] disabled:opacity-50">{isExporting ? 'Preparing PDF...' : 'Download PDF'}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Earned', summary.earned, 'bg-blue-50 text-blue-700'],
          ['Paid', summary.paid, 'bg-emerald-50 text-emerald-700'],
          ['Outstanding', summary.outstanding, 'bg-amber-50 text-amber-800'],
        ].map(([label, amount, tone]) => (
          <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-600">{label}</p><span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}>This Period</span></div>
            <p className="mt-3 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{formatAmount(Number(amount))}</p>
          </article>
        ))}
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error} <button type="button" className="ml-2 font-bold underline" onClick={() => void reload()}>Retry</button></div>}
      {exportError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{exportError}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Earnings Activity</p>
          <h2 className="mt-1 text-xl font-bold text-[#102449]">Fee History</h2>
        </div>
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Teaching Group</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Present Students</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="px-4 py-8 text-slate-600">Loading fee history...</td></tr> : visibleEntries.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-slate-600">No fee history for this selection.</td></tr> : visibleEntries.map((entry, index) => <tr key={`${entry.teaching_group_name}-${entry.session_date}-${index}`} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3">{formatDate(entry.session_date)}</td><td className="whitespace-nowrap px-4 py-3">{formatTime(entry.session_time)}</td><td className="px-4 py-3">{entry.session_number}</td><td className="px-4 py-3">{entry.teaching_group_name}</td><td className="px-4 py-3">{entry.package_type === 'semi_private' ? 'Semi-Private' : 'Private'}</td><td className="px-4 py-3">{entry.present_students}</td><td className="px-4 py-3 font-semibold">{formatAmount(entry.fee)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ${entry.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{entry.status}</span></td></tr>)}</tbody></table></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Reconciliation</p>
          <h2 className="mt-1 text-xl font-bold text-[#102449]">Fee Detail &amp; Summary</h2>
        </div>
        <div className="p-6 sm:p-7">
          {visibleDetailEntries.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No attendance detail for this selection.</p> : <>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Teaching Group</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2 text-right">Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleDetailEntries.map((entry) => <tr key={entry.attendance_id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-2">{formatDate(entry.session_date)}</td><td className="px-3 py-2">{entry.teaching_group_name}</td><td className="px-3 py-2">{entry.level_name}</td><td className="px-3 py-2 font-medium">{entry.student_name}</td><td className="px-3 py-2">{entry.student_code}</td><td className="px-3 py-2 capitalize">{entry.attendance_status}</td><td className="px-3 py-2 text-right">{formatAmount(entry.student_fee)}</td></tr>)}</tbody></table></div>
            <div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Teaching Group</th><th className="px-3 py-2 text-right">Present</th><th className="px-3 py-2 text-right">Fee / Attendance</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{studentSummaries.map((student) => <tr key={`${student.student_id}:${student.teaching_group_id}:${student.fee_rate}`}><td className="px-3 py-2 font-medium">{student.student_name}</td><td className="px-3 py-2">{student.student_code}</td><td className="px-3 py-2">{student.teaching_group_name}</td><td className="px-3 py-2 text-right">{student.present_attendance_count}</td><td className="px-3 py-2 text-right">{formatAmount(student.fee_rate)}</td><td className="px-3 py-2 text-right">{formatAmount(student.student_total)}</td></tr>)}</tbody></table></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Student Attendances</p><p className="mt-1 text-lg font-extrabold text-[#102449]">{studentSummaries.reduce((total, s) => total + s.present_attendance_count, 0)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Teacher Fee</p><p className="mt-1 text-lg font-extrabold text-[#102449]">{formatAmount(summary.earned)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reconciliation</p><p className={`mt-1 text-sm font-bold ${detailReconcilesPeriod ? 'text-emerald-700' : 'text-amber-700'}`}>{detailReconcilesPeriod ? '✓ Reconciled' : '⚠ Review required'}</p></div></div>
          </>}
        </div>
      </section>

      {showDetailModal && <TeacherFeeDetailModal detailEntries={visibleDetailEntries} studentSummaries={studentSummaries} month={month} year={year} detailReconcilesPeriod={detailReconcilesPeriod} onClose={() => setShowDetailModal(false)} />}
    </div>
  )
}
