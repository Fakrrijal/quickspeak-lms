import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherAttendance, type TeacherAttendanceMeeting } from '../../services/teacher-attendance.service'
import { getMyTeacherFeeReport, type MyTeacherFeeReport } from '../../services/teacher-fee.service'

type DateRange = { from: string; to: string }

function getLocalIsoDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString('id-ID')}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function isInRange(value: string, range: DateRange) {
  return value >= range.from && value <= range.to
}

function getRangeMonths(range: DateRange) {
  const months: string[] = []
  const cursor = new Date(`${range.from.slice(0, 7)}-01T00:00:00`)
  const end = new Date(`${range.to.slice(0, 7)}-01T00:00:00`)
  while (cursor <= end) {
    months.push(monthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

function Icon({ name }: { name: 'group' | 'users' | 'wallet' | 'calendar' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'group') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5M8 17h3" /></svg>
  if (name === 'users') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  if (name === 'wallet') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7" /><path d="M16 13h.01" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18" /></svg>
}

function DatePicker({ value, onChange, min, max, ariaLabel }: { value: string; onChange: (value: string) => void; min?: string; max?: string; ariaLabel: string }) {
  return (
    <input
      aria-label={ariaLabel}
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      className="qs-date-input h-11 w-[180px] rounded-lg border border-slate-300 bg-white px-3 text-[15px] font-medium text-slate-700 shadow-none outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  )
}

export function TeacherDashboardV2() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const today = getLocalIsoDate()
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const start = new Date()
    start.setDate(1)
    return { from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`, to: today }
  })
  const [meetings, setMeetings] = useState<TeacherAttendanceMeeting[]>([])
  const [feeReports, setFeeReports] = useState<MyTeacherFeeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  useEffect(() => {
    if (!canLoad || dateRange.from > dateRange.to) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const months = getRangeMonths(dateRange)
    Promise.all([
      ...months.map((referenceDate) => getMyTeacherAttendance('month', referenceDate)),
      ...months.map((referenceDate) => {
        const [year, month] = referenceDate.slice(0, 7).split('-').map(Number)
        return getMyTeacherFeeReport(month, year)
      }),
    ])
      .then((results) => {
        if (cancelled) return
        setMeetings(results.slice(0, months.length).flat() as TeacherAttendanceMeeting[])
        setFeeReports(results.slice(months.length) as MyTeacherFeeReport[])
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [canLoad, dateRange.from, dateRange.to])

  const rangeMeetings = useMemo(() => meetings.filter((meeting) => isInRange(meeting.session_date, dateRange)), [dateRange, meetings])
  const completedMeetings = useMemo(() => rangeMeetings.filter((meeting) => meeting.teacher_status !== null && meeting.teacher_recorded_at !== null), [rangeMeetings])
  const classes = new Set(completedMeetings.map((meeting) => meeting.teaching_group_id)).size
  const activeStudents = new Set(completedMeetings.map((meeting) => meeting.student_id)).size
  const attendanceCount = completedMeetings.length
  const presentCount = completedMeetings.filter((meeting) => meeting.teacher_status === 'present').length
  const absentCount = completedMeetings.filter((meeting) => meeting.teacher_status === 'absent').length
  const earnedFee = useMemo(() => feeReports.reduce((total, report) => total + report.detail_entries.filter((entry) => isInRange(entry.session_date, dateRange)).reduce((subtotal, entry) => subtotal + entry.student_fee, 0), 0), [dateRange, feeReports])
  const rangeLabel = `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="teacher-dashboard-v2 mx-auto max-w-7xl space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <div>
          <p className="text-[18px] font-semibold leading-6 text-slate-500">Teacher Portal</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#102449] sm:text-[31px]">Welcome back, {profile.full_name || 'Teacher'}.</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600">Here is your current teaching operations overview.</p>
        </div>
        <div className="mt-5 flex justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker ariaLabel="From Date" value={dateRange.from} max={dateRange.to} onChange={(from) => setDateRange((current) => ({ ...current, from }))} />
            <DatePicker ariaLabel="To Date" value={dateRange.to} min={dateRange.from} max={today} onChange={(to) => setDateRange((current) => ({ ...current, to }))} />
          </div>
        </div>
        {dateRange.from > dateRange.to && <p className="mt-3 text-sm font-semibold text-rose-700">From Date cannot be later than To Date.</p>}
        {dateRange.from <= dateRange.to && <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Reporting period · {rangeLabel}</p>}
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" /></div>)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Classes', value: classes, icon: 'group' as const, color: 'text-blue-700' },
              { label: 'Active Students', value: activeStudents, icon: 'users' as const, color: 'text-emerald-700' },
              { label: 'Fee', value: formatRupiah(earnedFee), icon: 'wallet' as const, color: 'text-amber-800' },
              { label: 'Attendance', value: attendanceCount, icon: 'calendar' as const, color: 'text-violet-700' },
            ].map((card) => (
              <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-lg bg-slate-50"><span className={card.color}><Icon name={card.icon} /></span></div>
                <p className="mt-5 text-[15px] font-bold text-slate-600">{card.label}</p>
                <p className="mt-1 text-[27px] font-extrabold leading-tight tracking-[-0.025em] text-[#102449]">{card.value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">Period Overview</p>
                <h2 className="mt-1 text-[21px] font-bold text-[#102449]">Teaching activity</h2>
              </div>
              <p className="text-[15px] font-semibold text-slate-500">{rangeLabel}</p>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4"><dt className="text-[13px] font-semibold text-slate-500">Sessions</dt><dd className="mt-1 text-[22px] font-extrabold text-[#102449]">{attendanceCount}</dd></div>
              <div className="rounded-xl bg-emerald-50 p-4"><dt className="text-[13px] font-semibold text-emerald-700">Present</dt><dd className="mt-1 text-[22px] font-extrabold text-emerald-800">{presentCount}</dd></div>
              <div className="rounded-xl bg-rose-50 p-4"><dt className="text-[13px] font-semibold text-rose-700">Absent</dt><dd className="mt-1 text-[22px] font-extrabold text-rose-800">{absentCount}</dd></div>
              <div className="rounded-xl bg-amber-50 p-4"><dt className="text-[13px] font-semibold text-amber-800">Earned Fee</dt><dd className="mt-1 text-[22px] font-extrabold text-amber-900">{formatRupiah(earnedFee)}</dd></div>
            </dl>
            <p className="mt-5 border-t border-slate-200 pt-5 text-[15px] leading-6 text-slate-600">Metrics update from teaching activity inside the selected date range.</p>
          </section>
        </>
      )}
    </div>
  )
}
