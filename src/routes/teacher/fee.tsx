import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTeacherFee } from '../../hooks/useTeacherFee'
import type { TeacherFeeStatus, TeacherFeeDetailEntry } from '../../services/teacher-fee.service'
import { getMyTeacherCode, summarizeTeacherFeeDetails } from '../../services/teacher-fee.service'
import { useAuthContext } from '../../providers/AuthProvider'
import { downloadTeacherFeePdf } from '../../utils/teacher-fee-pdf'

export const Route = createFileRoute('/teacher/fee')({ component: TeacherFeePage })

const PAGE_SIZE = 10

function formatAmount(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 'Select both dates'
  if (startDate > endDate) return 'Invalid date range'
  const format = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
  return `${format(startDate)} – ${format(endDate)}`
}

function Pagination({ page, totalItems, onPageChange }: { page: number; totalItems: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const showingStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingEnd = Math.min(page * PAGE_SIZE, totalItems)
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-500">Showing {showingStart}–{showingEnd} of {totalItems}</p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button key={pageNumber} type="button" aria-label={`Page ${pageNumber}`} aria-current={page === pageNumber ? 'page' : undefined} onClick={() => onPageChange(pageNumber)} className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium ${page === pageNumber ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}>{pageNumber}</button>
        ))}
        <button type="button" aria-label="Next page" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">›</button>
      </nav>
    </div>
  )
}

type FeeView = 'summary' | 'history' | 'detail'

function TeacherFeePage() {
  const { isAuthenticated, loading: authLoading, profileLoading, profileError, role, status, profile } = useAuthContext()
  const navigate = useNavigate()
  const today = new Date()
  const [startDate, setStartDate] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
  const [endDate, setEndDate] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
  const [isAllTime, setIsAllTime] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TeacherFeeStatus>('all')
  const [feeView, setFeeView] = useState<FeeView>('summary')
  const canLoad = !authLoading && !profileLoading && isAuthenticated && !profileError && role === 'teacher' && status === 'active'
  const validDateRange = Boolean(startDate && endDate && startDate <= endDate)
  const reportReady = isAllTime || validDateRange
  const { entries, detailEntries, monthlySummaries, detailReconcilesPeriod, loading, error, reload } = useTeacherFee(startDate, endDate, canLoad && reportReady, isAllTime)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [summaryPage, setSummaryPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [detailPage, setDetailPage] = useState(1)

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profileError, profileLoading, status])

  const dateRangeLabel = isAllTime ? 'All Time' : formatDateRange(startDate, endDate)
  const handleAllTime = () => setIsAllTime(true)
  const handleDateRange = () => setIsAllTime(false)
  const handleFeeStartDateChange = (value: string) => {
    setIsAllTime(false)
    setStartDate(value)
  }
  const handleFeeEndDateChange = (value: string) => {
    setIsAllTime(false)
    setEndDate(value)
    if (!startDate && value === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`) {
      setStartDate(`${value.slice(0, 7)}-01`)
    }
  }
  const rangeEntries = reportReady ? entries : []
  const rangeDetailEntries = reportReady ? detailEntries : []
  const rangeMonthlySummaries = reportReady ? monthlySummaries : []
  const rangeEarned = useMemo(() => rangeDetailEntries.reduce((total, entry) => total + entry.student_fee, 0), [rangeDetailEntries])
  const rangePresentAttendances = useMemo(() => rangeDetailEntries.filter((entry) => entry.attendance_status === 'present').length, [rangeDetailEntries])
  const settlementMonths = useMemo(() => ({
    paid: rangeMonthlySummaries.filter((summary) => summary.status === 'paid').length,
    unpaid: rangeMonthlySummaries.filter((summary) => summary.status !== 'paid').length,
    total: rangeMonthlySummaries.length,
  }), [rangeMonthlySummaries])
  const visibleEntries = useMemo(() => statusFilter === 'all' ? rangeEntries : rangeEntries.filter((entry) => entry.status === statusFilter), [rangeEntries, statusFilter])
  const visibleDetailEntries = useMemo(() => statusFilter === 'all' ? rangeDetailEntries : rangeDetailEntries.filter((entry) => entry.period_status === statusFilter), [rangeDetailEntries, statusFilter])
  const studentSummaries = useMemo(() => summarizeTeacherFeeDetails(visibleDetailEntries), [visibleDetailEntries])
  const paginatedStudentSummaries = useMemo(() => studentSummaries.slice((summaryPage - 1) * PAGE_SIZE, summaryPage * PAGE_SIZE), [studentSummaries, summaryPage])
  const paginatedEntries = useMemo(() => visibleEntries.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE), [visibleEntries, historyPage])
  const paginatedDetailEntries = useMemo(() => visibleDetailEntries.slice((detailPage - 1) * PAGE_SIZE, detailPage * PAGE_SIZE), [visibleDetailEntries, detailPage])

  useEffect(() => {
    setSummaryPage(1); setHistoryPage(1); setDetailPage(1)
  }, [statusFilter, startDate, endDate, feeView])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(studentSummaries.length / PAGE_SIZE)); if (summaryPage > totalPages) setSummaryPage(totalPages)
  }, [studentSummaries.length, summaryPage])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE)); if (historyPage > totalPages) setHistoryPage(totalPages)
  }, [visibleEntries.length, historyPage])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleDetailEntries.length / PAGE_SIZE)); if (detailPage > totalPages) setDetailPage(totalPages)
  }, [visibleDetailEntries.length, detailPage])

  const handleDownloadPdf = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const teacherCode = await getMyTeacherCode()
      const exportStudentSummaries = summarizeTeacherFeeDetails(visibleDetailEntries)
      downloadTeacherFeePdf({
        teacherName: profile?.full_name ?? 'Teacher',
        teacherCode: teacherCode ?? 'teacher',
        period: dateRangeLabel,
        status: statusFilter === 'all' ? 'All Status' : statusFilter,
        earned: rangeEarned,
        paid: null,
        outstanding: null,
        detailEntries: visibleDetailEntries,
        studentSummaries: exportStudentSummaries,
        totalStudentAttendances: exportStudentSummaries.reduce((total, student) => total + student.present_attendance_count, 0),
        detailReconcilesPeriod: true,
        settlementNote: 'Settlement status is monthly. Each fee record below shows the settlement status for its month.',
      }, new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()))
    } catch (downloadError) { setExportError(downloadError instanceof Error ? downloadError.message : 'Unable to generate the PDF report.') } finally { setIsExporting(false) }
  }

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  const viewMeta = { summary: { eyebrow: 'Student Fee Summary', title: 'Fee Summary', description: 'Fee totals grouped by student and teaching group.' }, history: { eyebrow: 'Earnings Activity', title: 'Fee History', description: 'Fee earnings by teaching session.' }, detail: { eyebrow: 'Attendance Records', title: 'Fee Detail', description: `Attendance-based fee detail for ${dateRangeLabel}.` } }[feeView]

  return (
    <div className="qs-fee-report-frame mx-auto w-full space-y-6">
      <header className="border-b border-slate-200 pb-5"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p><div className="mt-2"><h1 className="text-3xl font-extrabold tracking-[-0.03em] text-[#102449]">Teacher Fee</h1><p className="mt-1.5 text-sm leading-6 text-slate-600">Review your current fee statement and attendance-based earnings.</p></div></header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Report Period</p>
              {isAllTime ? (
                <>
                  <p className="mt-1 text-lg font-bold text-[#102449]">All Time</p>
                  <p className="mt-1 text-xs text-slate-500">Showing all available fee records.</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-lg font-bold text-[#102449]">{dateRangeLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">Use From and To to change the reporting period.</p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {!isAllTime && (
                <>
                  <label className="text-sm font-semibold text-slate-700">From<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => handleFeeStartDateChange(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium" /></label>
                  <label className="text-sm font-semibold text-slate-700">To<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => handleFeeEndDateChange(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium" /></label>
                </>
              )}
              <button type="button" onClick={isAllTime ? handleDateRange : handleAllTime} className={isAllTime ? 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50' : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50'}>{isAllTime ? 'Date Range' : 'All Time'}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Payment Status</span>
            {(['all', 'paid', 'unpaid'] as const).map((filter) => <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={statusFilter === filter ? 'rounded-lg bg-[#102449] px-3 py-2 text-sm font-bold text-white' : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50'}>{filter === 'all' ? 'All Status' : filter === 'paid' ? 'Paid' : 'Unpaid'}</button>)}
            <button type="button" onClick={() => void handleDownloadPdf()} disabled={isExporting || loading || !reportReady || visibleDetailEntries.length === 0} className="rounded-lg bg-[#102449] px-3 py-2 text-sm font-bold text-white hover:bg-[#17325f] disabled:opacity-50">{isExporting ? 'Preparing PDF...' : 'Download PDF'}</button>
          </div>
          <p className="text-xs text-slate-500">Paid / Unpaid follows the monthly settlement status attached to each fee record. The selected dates or All Time mode controls which records are shown and exported.</p>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><p className="text-sm font-semibold text-slate-600">{isAllTime ? 'Total Earned' : 'Earned in Range'}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{formatAmount(rangeEarned)}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><p className="text-sm font-semibold text-slate-600">{isAllTime ? 'Total Attendances' : 'Present Attendances'}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{rangePresentAttendances}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><p className="text-sm font-semibold text-slate-600">Settlement Months</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{settlementMonths.total}</p><p className="mt-1 text-xs text-slate-500">{settlementMonths.paid} paid · {settlementMonths.unpaid} unpaid</p></article>
      </section>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error} <button type="button" className="ml-2 font-bold underline" onClick={() => void reload()}>Retry</button></div>}
      {exportError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{exportError}</div>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5 sm:px-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{viewMeta.eyebrow}</p><h2 className="mt-1 text-xl font-bold text-[#102449]">{viewMeta.title}</h2><p className="mt-1 text-sm text-slate-500">{viewMeta.description}</p></div><div className="inline-flex w-fit rounded-xl border border-slate-200 bg-slate-50 p-1">{[['summary', 'Summary'], ['history', 'History'], ['detail', 'Detail']].map(([value, label]) => <button key={value} type="button" onClick={() => setFeeView(value as FeeView)} className={feeView === value ? 'rounded-lg bg-[#102449] px-3 py-2 text-sm font-bold text-white shadow-sm' : 'rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-[#102449]'}>{label}</button>)}</div></div></div>
        {feeView === 'summary' && <div className="overflow-x-auto px-5 sm:px-6"><table className="min-w-[900px] w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-sm"><tr className="h-10"><th className="px-3">Student</th><th className="px-3">Code</th><th className="px-3">Teaching Group</th><th className="w-[90px] whitespace-nowrap px-3 text-right">Present</th><th className="px-3 text-right">Fee / Attendance</th><th className="px-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr className="h-10"><td colSpan={6} className="px-3 text-slate-600">Loading student fee summary...</td></tr> : studentSummaries.length === 0 ? <tr className="h-10"><td colSpan={6} className="px-3 text-slate-600">No student fee summary for this selection.</td></tr> : paginatedStudentSummaries.map((student) => <tr key={`${student.student_id}:${student.teaching_group_id}:${student.fee_rate}`} className="h-10 hover:bg-slate-50"><td className="px-3 font-medium">{student.student_name}</td><td className="px-3">{student.student_code}</td><td className="px-3">{student.teaching_group_name}</td><td className="w-[90px] whitespace-nowrap px-3 text-right">{student.present_attendance_count}</td><td className="px-3 text-right">{formatAmount(student.fee_rate)}</td><td className="px-3 text-right font-semibold">{formatAmount(student.student_total)}</td></tr>)}</tbody></table><Pagination page={summaryPage} totalItems={studentSummaries.length} onPageChange={setSummaryPage} /></div>}
        {feeView === 'history' && <div className="overflow-x-auto px-5 sm:px-6"><table className="w-full table-fixed text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-sm"><tr><th className="w-[14%] px-4 py-3">Date</th><th className="w-[9%] px-4 py-3">Time</th><th className="w-[8%] px-4 py-3">Session</th><th className="w-[18%] px-4 py-3">Teaching Group</th><th className="w-[13%] px-4 py-3">Package</th><th className="w-[14%] px-4 py-3">Present Students</th><th className="w-[12%] px-4 py-3">Fee</th><th className="w-[12%] px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="px-4 py-8 text-slate-600">Loading fee history...</td></tr> : visibleEntries.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-slate-600">No fee history for this selection.</td></tr> : paginatedEntries.map((entry, index) => <tr key={`${entry.teaching_group_name}-${entry.session_date}-${index}`} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3">{formatDate(entry.session_date)}</td><td className="whitespace-nowrap px-4 py-3">{formatTime(entry.session_time)}</td><td className="px-4 py-3">{entry.session_number}</td><td className="px-4 py-3 break-words">{entry.teaching_group_name}</td><td className="px-4 py-3">{entry.package_type === 'semi_private' ? 'Semi-Private' : 'Private'}</td><td className="px-4 py-3">{entry.present_students}</td><td className="px-4 py-3 font-semibold">{formatAmount(entry.fee)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ${entry.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{entry.status}</span></td></tr>)}</tbody></table><Pagination page={historyPage} totalItems={visibleEntries.length} onPageChange={setHistoryPage} /></div>}
        {feeView === 'detail' && <div className="overflow-x-auto px-5 sm:px-6"><table className="w-full table-fixed text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-sm"><tr><th className="w-[13%] px-3 py-2.5">Date</th><th className="w-[20%] px-3 py-2.5">Teaching Group</th><th className="w-[10%] px-3 py-2.5">Level</th><th className="w-[17%] px-3 py-2.5">Student</th><th className="w-[16%] px-3 py-2.5">Code</th><th className="w-[14%] px-3 py-2.5">Attendance</th><th className="w-[10%] px-3 py-2.5 text-right">Fee</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="px-3 py-8 text-slate-600">Loading fee detail...</td></tr> : visibleDetailEntries.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-slate-600">No attendance detail for this selection.</td></tr> : paginatedDetailEntries.map((entry) => <tr key={entry.attendance_id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-3 py-2">{formatDate(entry.session_date)}</td><td className="px-3 py-2 break-words">{entry.teaching_group_name}</td><td className="px-3 py-2">{entry.level_name}</td><td className="px-3 py-2 font-medium break-words">{entry.student_name}</td><td className="px-3 py-2 break-words">{entry.student_code}</td><td className="px-3 py-2 capitalize">{entry.attendance_status}</td><td className="px-3 py-2 text-right">{formatAmount(entry.student_fee)}</td></tr>)}</tbody></table><Pagination page={detailPage} totalItems={visibleDetailEntries.length} onPageChange={setDetailPage} /></div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Student Attendances</p><p className="mt-1 text-lg font-extrabold text-[#102449]">{studentSummaries.reduce((total, s) => total + s.present_attendance_count, 0)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Teacher Fee</p><p className="mt-1 text-lg font-extrabold text-[#102449]">{formatAmount(rangeEarned)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reconciliation</p><p className={`mt-1 text-sm font-bold ${detailReconcilesPeriod ? 'text-emerald-700' : 'text-amber-700'}`}>{detailReconcilesPeriod ? '✓ Reconciled' : '⚠ Review required'}</p></div></div></section>
    </div>
  )
}
