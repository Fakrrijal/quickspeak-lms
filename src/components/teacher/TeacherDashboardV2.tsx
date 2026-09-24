import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherAttendance, type TeacherAttendanceMeeting } from '../../services/teacher-attendance.service'
import { getMyTeacherUnpaidFee } from '../../services/teacher-fee.service'
import { getMyTeacherScheduleOverview, type TeacherScheduleOverview } from '../../services/class-schedule.service'
import { formatScheduleDate, formatScheduleTime, getNextScheduleOccurrences } from '../../lib/schedule'

type DateRange = { from: string; to: string }

function getLocalIsoDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
  if (!value) return 'Select dates'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Select dates'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function getScheduleDayStatus(date: Date) {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayOffset = Math.round((targetStart.getTime() - todayStart.getTime()) / 86400000)

  if (dayOffset === 0) return 'TODAY'
  if (dayOffset === 1) return 'TOMORROW'
  return date.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
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
  const common = 'size-5 fill-none stroke-current stroke-[1.8]'
  if (name === 'group') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8M8 13h5M8 17h3" /></svg>
  if (name === 'users') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  if (name === 'wallet') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7" /><path d="M16 13h.01" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
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
      className="qs-date-input h-10 w-[176px] rounded-lg border border-slate-300 bg-white px-3 text-[14px] font-medium text-slate-700 shadow-none outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
  const validDateRange = Boolean(dateRange.from && dateRange.to && dateRange.from <= dateRange.to)
  const [meetings, setMeetings] = useState<TeacherAttendanceMeeting[]>([])
  const [unpaidFee, setUnpaidFee] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scheduleOverview, setScheduleOverview] = useState<TeacherScheduleOverview[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState(false)
  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setScheduleLoading(true)
    setScheduleError(false)

    getMyTeacherScheduleOverview()
      .then((data) => {
        if (!cancelled) setScheduleOverview(data)
      })
      .catch(() => {
        if (!cancelled) setScheduleError(true)
      })
      .finally(() => {
        if (!cancelled) setScheduleLoading(false)
      })

    return () => { cancelled = true }
  }, [canLoad])

  useEffect(() => {
    if (!canLoad || !validDateRange) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const months = getRangeMonths(dateRange)
    Promise.all(months.map((referenceDate) => getMyTeacherAttendance('month', referenceDate)))
      .then((results) => {
        if (cancelled) return
        setMeetings(results.flat())
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [canLoad, dateRange.from, dateRange.to, validDateRange])

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    getMyTeacherUnpaidFee()
      .then((amount) => {
        if (!cancelled) setUnpaidFee(amount)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load teacher fee data')
      })
    return () => { cancelled = true }
  }, [canLoad])

  const rangeMeetings = useMemo(() => meetings.filter((meeting) => isInRange(meeting.session_date, dateRange)), [dateRange, meetings])
  const completedMeetings = useMemo(() => rangeMeetings.filter((meeting) => meeting.teacher_status !== null && meeting.teacher_recorded_at !== null), [rangeMeetings])
  const classes = new Set(completedMeetings.map((meeting) => meeting.teaching_group_id)).size
  const activeStudents = new Set(completedMeetings.map((meeting) => meeting.student_id)).size
  const attendanceCount = completedMeetings.length
  const presentCount = completedMeetings.filter((meeting) => meeting.teacher_status === 'present').length
  const absentCount = completedMeetings.filter((meeting) => meeting.teacher_status === 'absent').length
  const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0
  const rangeLabel = validDateRange ? `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}` : 'Select both dates'
  const nextScheduledClass = useMemo(() => {
    return scheduleOverview
      .flatMap((item) => {
        const occurrence = getNextScheduleOccurrences(item.schedules, 1)[0]
        return occurrence ? [{ ...item, occurrence }] : []
      })
      .sort((a, b) => a.occurrence.date.getTime() - b.occurrence.date.getTime())[0] ?? null
  }, [scheduleOverview])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  const summaryCards = [
    { label: 'Classes', value: classes, icon: 'group' as const, color: 'text-blue-700', iconBg: 'bg-blue-50', to: '/teacher/teaching-groups' as const },
    { label: 'Active Students', value: activeStudents, icon: 'users' as const, color: 'text-emerald-700', iconBg: 'bg-emerald-50', to: '/teacher/teaching-groups' as const },
    { label: 'Total Attendance', value: attendanceCount, icon: 'calendar' as const, color: 'text-violet-700', iconBg: 'bg-violet-50', to: '/teacher/attendance' as const },
    { label: 'Unpaid Fee', value: formatRupiah(unpaidFee), icon: 'wallet' as const, color: 'text-amber-800', iconBg: 'bg-amber-50', to: '/teacher/fee' as const },
  ]

  return (
    <div className="teacher-dashboard-v2 mx-auto max-w-7xl space-y-4">
      <header className="border-b border-slate-200 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Teacher Portal</p>
          <h1 className="mt-1 text-[30px] font-extrabold leading-tight tracking-[-0.025em] text-[#102449] sm:text-[30px]">Welcome back, {profile.full_name || 'Teacher'}.</h1>
          <p className="mt-2 text-[15px] leading-6 text-slate-600">Here is your current teaching operations overview.</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white shadow-sm" aria-labelledby="teacher-next-class-title">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-none stroke-current stroke-[1.8]">
                <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
                <path d="M8 2.5v4M16 2.5v4M3 9h18" />
                <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Next Class</p>
                {nextScheduledClass && !scheduleLoading && !scheduleError && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] text-blue-800">
                    {getScheduleDayStatus(nextScheduledClass.occurrence.date)}
                  </span>
                )}
              </div>

              <h2 id="teacher-next-class-title" className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-[28px]">
                {scheduleLoading
                  ? 'Loading schedule…'
                  : scheduleError
                    ? 'Unable to load schedule'
                    : nextScheduledClass
                      ? formatScheduleDate(nextScheduledClass.occurrence.date)
                      : 'No upcoming class scheduled'}
              </h2>

              <p className="mt-2 text-lg font-extrabold text-blue-700">
                {scheduleLoading
                  ? 'Checking your planned classes.'
                  : scheduleError
                    ? 'Open Schedule to retry.'
                    : nextScheduledClass
                      ? `${formatScheduleTime(nextScheduledClass.occurrence.schedule.start_time)} – ${formatScheduleTime(nextScheduledClass.occurrence.schedule.end_time)} WIB`
                      : 'Set a weekly schedule from Teaching Groups to see your next class here.'}
              </p>

              {nextScheduledClass && !scheduleLoading && !scheduleError && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
                  <span className="font-bold text-[#102449]">{nextScheduledClass.group.teaching_group_name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{nextScheduledClass.group.level_name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{nextScheduledClass.group.students.length} student{nextScheduledClass.group.students.length === 1 ? '' : 's'}</span>
                </div>
              )}
            </div>
          </div>

          <Link
            to="/teacher/schedule"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#102449] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#17325f] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449] lg:w-auto"
          >
            View Full Schedule <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="border-t border-blue-100 bg-white/70 px-5 py-3.5 text-xs font-semibold leading-5 text-slate-500 sm:px-6 lg:px-7">
          Planned schedule only. Actual class time and attendance are recorded separately.
        </div>
      </section>

      <section className="teacher-period-filter flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="Reporting period">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Reporting Period</p>
          <p className="mt-0.5 text-sm text-slate-600">Select the date range for your teaching activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            ariaLabel="From Date"
            value={dateRange.from}
            max={dateRange.to || today}
            onChange={(from) => setDateRange((current) => ({ ...current, from }))}
          />
          <DatePicker
            ariaLabel="To Date"
            value={dateRange.to}
            min={dateRange.from || undefined}
            max={today}
            onChange={(to) => {
              setDateRange((current) => {
                if (!current.from && to === today) {
                  return { from: `${to.slice(0, 7)}-01`, to }
                }
                return { ...current, to }
              })
            }}
          />
        </div>
      </section>

      {dateRange.from > dateRange.to && <p className="text-sm font-semibold text-rose-700">From Date cannot be later than To Date.</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" /></div>)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <article>
                  <div className={`flex size-10 items-center justify-center rounded-xl border border-white shadow-sm ${card.iconBg}`}><span className={card.color}><Icon name={card.icon} /></span></div>
                  <p className="mt-4 text-[14px] font-bold text-slate-600">{card.label}</p>
                  <p className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.025em] text-[#102449]">{card.value}</p>
                </article>
              </Link>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">Period Overview</p>
                <h2 className="mt-1 text-[20px] font-bold text-[#102449]">Attendance overview</h2>
              </div>
              <p className="text-[14px] font-semibold text-slate-500">{rangeLabel}</p>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4"><dt className="text-[13px] font-semibold text-slate-500">Total Attendance</dt><dd className="mt-1 text-[22px] font-extrabold text-[#102449]">{attendanceCount}</dd></div>
              <div className="rounded-xl bg-emerald-50 p-4"><dt className="text-[13px] font-semibold text-emerald-700">Present</dt><dd className="mt-1 text-[22px] font-extrabold text-emerald-800">{presentCount}</dd></div>
              <div className="rounded-xl bg-rose-50 p-4"><dt className="text-[13px] font-semibold text-rose-700">Absent</dt><dd className="mt-1 text-[22px] font-extrabold text-rose-800">{absentCount}</dd></div>
              <div className="rounded-xl bg-blue-50 p-4"><dt className="text-[13px] font-semibold text-blue-700">Attendance Rate</dt><dd className="mt-1 text-[22px] font-extrabold text-blue-800">{attendanceRate}%</dd></div>
            </dl>
            <p className="mt-5 border-t border-slate-200 pt-4 text-[14px] leading-6 text-slate-600">Metrics update from teaching activity inside the selected date range.</p>
          </section>
        </>
      )}
    </div>
  )
}
