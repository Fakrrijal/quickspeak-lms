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

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="teacher-fee-detail-title" className="mx-auto my-6 w-full max-w-5xl rounded-2xl bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white px-6 py-5">
        <div>
          <h3 id="teacher-fee-detail-title" className="text-xl font-bold text-slate-900">Teacher Fee Detail</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
            <div><dt className="inline font-medium text-slate-700">Period: </dt><dd className="inline">{formatMonth(year, month)}</dd></div>
          </dl>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Close</button>
      </header>

      <div className="space-y-6 p-6">
        {detailEntries.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No fee detail available for this period.</p> : <>
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
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Total Detail Fee</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(totalDetailFee)}</dd></div><div><dt className="text-slate-500">Total Student Attendances</dt><dd className="mt-1 font-bold text-slate-900">{totalPresentAttendances}</dd></div></dl>
          <p className={`mt-4 text-sm ${detailReconcilesPeriod ? 'text-emerald-700' : 'text-amber-700'}`}>{detailReconcilesPeriod ? '✓ ' : '⚠ '}{reconciliationMessage}</p>
        </section>
      </div>
    </div>
  </div>
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
    if (!periodSummary) {
      return { earned: 0, paid: 0, outstanding: 0, status: 'unpaid' as const }
    }
    return {
      earned: periodSummary.earned_amount,
      paid: periodSummary.paid_amount,
      outstanding: periodSummary.outstanding_amount,
      status: periodSummary.status,
    }
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

  return (
    <div className="p-8">
      <section>
        <h2 className="text-3xl font-bold text-slate-900">Teacher Fee</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <label className="text-sm font-medium text-slate-700">Month<select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index))}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Year<input type="number" min="2000" max="9999" value={year} onChange={(event) => setYear(Number(event.target.value))} className="ml-2 w-24 rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
          <div className="flex items-end gap-2">{(['all', 'paid', 'unpaid'] as const).map((filter) => <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={statusFilter === filter ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white' : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700'}>{filter === 'all' ? 'All' : filter === 'paid' ? 'Paid' : 'Unpaid'}</button>)}</div>
          <button type="button" onClick={() => setShowDetailModal(true)} disabled={loading || visibleDetailEntries.length === 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">View Detail</button>
          <button type="button" onClick={() => void handleDownloadPdf()} disabled={isExporting || loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">{isExporting ? 'Preparing PDF...' : 'Download PDF'}</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">{[['Earned', summary.earned], ['Paid', summary.paid], ['Outstanding', summary.outstanding]].map(([label, amount]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatAmount(Number(amount))}</p></article>)}</div>
        <p className="mt-3 text-sm text-slate-600">Status: <span className="font-semibold uppercase">{summary.status}</span></p>
        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="font-medium underline" onClick={() => void reload()}>Retry</button></div>}
        {exportError && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{exportError}</div>}
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">Pertemuan</th><th className="px-3 py-3">Teaching Group</th><th className="px-3 py-3">Package</th><th className="px-3 py-3">Present Students</th><th className="px-3 py-3">Fee</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">Loading fee history...</td></tr> : visibleEntries.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-slate-600">No fee history for this selection.</td></tr> : visibleEntries.map((entry, index) => <tr key={`${entry.teaching_group_name}-${entry.session_date}-${index}`}><td className="whitespace-nowrap px-3 py-3">{formatDate(entry.session_date)}</td><td className="whitespace-nowrap px-3 py-3">{formatTime(entry.session_time)}</td><td className="px-3 py-3">{entry.session_number}</td><td className="px-3 py-3">{entry.teaching_group_name}</td><td className="px-3 py-3">{entry.package_type === 'semi_private' ? 'Semi-Private' : 'Private'}</td><td className="px-3 py-3">{entry.present_students}</td><td className="px-3 py-3">{formatAmount(entry.fee)}</td><td className="px-3 py-3"><span className="font-medium uppercase">{entry.status}</span></td></tr>)}</tbody></table></div>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Fee Detail</h3>
          {visibleDetailEntries.length === 0 ? <p className="mt-3 text-sm text-slate-600">No attendance detail for this selection.</p> : <>
            <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Teaching Group</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2 text-right">Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleDetailEntries.map((entry) => <tr key={entry.attendance_id}><td className="whitespace-nowrap px-3 py-2">{formatDate(entry.session_date)}</td><td className="px-3 py-2">{entry.teaching_group_name}</td><td className="px-3 py-2">{entry.level_name}</td><td className="px-3 py-2 font-medium">{entry.student_name}</td><td className="px-3 py-2">{entry.student_code}</td><td className="px-3 py-2 capitalize">{entry.attendance_status}</td><td className="px-3 py-2 text-right">{formatAmount(entry.student_fee)}</td></tr>)}</tbody></table></div>
            <h4 className="mt-5 font-semibold text-slate-900">Student Fee Summary</h4>
            <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Teaching Group</th><th className="px-3 py-2 text-right">Present</th><th className="px-3 py-2 text-right">Fee / Attendance</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{studentSummaries.map((student) => <tr key={`${student.student_id}:${student.teaching_group_id}:${student.fee_rate}`}><td className="px-3 py-2 font-medium">{student.student_name}</td><td className="px-3 py-2">{student.student_code}</td><td className="px-3 py-2">{student.teaching_group_name}</td><td className="px-3 py-2 text-right">{student.present_attendance_count}</td><td className="px-3 py-2 text-right">{formatAmount(student.fee_rate)}</td><td className="px-3 py-2 text-right">{formatAmount(student.student_total)}</td></tr>)}</tbody></table></div>
            <h4 className="mt-5 font-semibold text-slate-900">Teacher Fee Summary</h4>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Total Student Attendances</dt><dd className="mt-1 font-bold text-slate-900">{studentSummaries.reduce((total, s) => total + s.present_attendance_count, 0)}</dd></div><div><dt className="text-slate-500">Earned</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(summary.earned)}</dd></div><div><dt className="text-slate-500">Paid</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(summary.paid)}</dd></div><div><dt className="text-slate-500">Outstanding</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(summary.outstanding)}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-bold text-slate-900 uppercase">{summary.status}</dd></div><div><dt className="text-slate-500">Total Teacher Fee</dt><dd className="mt-1 font-bold text-slate-900">{formatAmount(summary.earned)}</dd></div></dl>
            <h4 className="mt-5 font-semibold text-slate-900">Reconciliation</h4>
            <p className={`mt-2 text-sm ${detailReconcilesPeriod ? 'text-emerald-700' : 'text-amber-700'}`}>{detailReconcilesPeriod ? '✓ Detail reconciles with Teacher Fee total.' : '⚠ Detail does not currently reconcile with the Teacher Fee total.'}</p>
          </>}
        </section>
        {showDetailModal && <TeacherFeeDetailModal detailEntries={visibleDetailEntries} studentSummaries={studentSummaries} month={month} year={year} detailReconcilesPeriod={detailReconcilesPeriod} onClose={() => setShowDetailModal(false)} />}
      </section>
    </div>
  )
}
