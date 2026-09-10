import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { useAuthContext } from '../../providers/AuthProvider'
import type { StudentAttendanceRecord } from '../../services/student-attendance.service'
import { downloadAdminAttendancePdf } from '../../utils/admin-attendance-pdf'

export const Route = createFileRoute('/student/attendance')({ component: StudentAttendancePage })

function Icon({ name }: { name: 'calendar' | 'check' | 'x' | 'clock' | 'download' | 'arrow' | 'close' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  if (name === 'x') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M6 6l12 12M18 6 6 18" /></svg>
  if (name === 'clock') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  if (name === 'download') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M12 4v11M8 11l4 4 4-4M5 20h14" /></svg>
  if (name === 'close') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M6 6l12 12M18 6 6 18" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function date(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function period(year: number, month: number) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1))
}

function packageLabel(value: StudentAttendanceRecord['package_type']) {
  return value === 'semi_private' ? 'Semi-Private' : 'Private'
}

function StatusBadge({ status }: { status: StudentAttendanceRecord['teacher_status'] }) {
  const present = status === 'present'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        present ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      <span className={`size-1.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {present ? 'Present' : 'Absent'}
    </span>
  )
}

function AttendanceDetail({
  record,
  records,
  periodLabel,
  onClose,
}: {
  record: StudentAttendanceRecord
  records: StudentAttendanceRecord[]
  periodLabel: string
  onClose: () => void
}) {
  const present = records.filter((item) => item.teacher_status === 'present').length
  const absent = records.length - present
  const rate = records.length ? (present / records.length) * 100 : null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="attendance-detail-title" className="mx-auto my-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Attendance Detail</p>
            <h2 id="attendance-detail-title" className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{record.student_name}</h2>
            <p className="mt-1 text-sm text-slate-500">{record.student_code} · {periodLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attendance detail"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="space-y-5 p-6 sm:p-7">
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              ['Sessions', String(records.length)],
              ['Present', String(present)],
              ['Absent', String(absent)],
              ['Rate', rate === null ? '—' : `${rate.toFixed(1)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p>
                <p className="mt-1.5 text-xl font-extrabold tracking-[-0.03em] text-[#102449]">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Meeting History</p>
                <h3 className="mt-1 text-lg font-bold text-[#102449]">Meeting &amp; Attendance Detail</h3>
              </div>
            </div>
            <div className="space-y-3">
              {records.map((item, index) => (
                <article key={item.meeting_id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Meeting {index + 1} · {date(item.session_date)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="clock" /> Recorded {dateTime(item.teacher_recorded_at)}</p>
                    </div>
                    <StatusBadge status={item.teacher_status} />
                  </div>
                  <div className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Teacher</p><p className="mt-1 font-semibold text-slate-900">{item.teacher_name}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Teacher Code</p><p className="mt-1 font-semibold text-slate-900">{item.teacher_code}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Teaching Group</p><p className="mt-1 font-semibold text-slate-900">{item.teaching_group_name}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Level</p><p className="mt-1 font-semibold text-slate-900">{item.level_name}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Package</p><p className="mt-1 font-semibold text-slate-900">{packageLabel(item.package_type)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Recorded Time</p><p className="mt-1 font-semibold text-slate-900">{dateTime(item.teacher_recorded_at)}</p></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StudentAttendancePage() {
  const {
    isAuthenticated,
    loading,
    profile,
    profileError,
    profileLoading,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [detail, setDetail] = useState<StudentAttendanceRecord | null>(null)

  const canLoad = !loading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'student'
    && status === 'active'

  const { attendance, loading: attendanceLoading, error, reload } = useStudentAttendance(canLoad, month, year)

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [isAuthenticated, loading, navigate, profile, profileError, profileLoading, status])

  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const summary = useMemo(() => {
    const total = attendance.length
    return {
      total,
      present,
      absent: total - present,
      rate: total ? (present / total) * 100 : null,
    }
  }, [attendance, present])

  const periodLabel = period(year, month)
  const detailRecords = detail
    ? attendance.filter((item) => item.enrollment_id === detail.enrollment_id)
    : []

  const download = () => {
    if (!profile || !attendance.length) return
    downloadAdminAttendancePdf({
      records: attendance.map((item) => ({
        ...item,
        teacher_id: '',
        student_id: '',
        student_name: item.student_name,
        package_type: item.package_type,
        teaching_group_id: item.teaching_group_id,
      })),
      generatedBy: profile.full_name || 'Student',
      generatedAt: dateTime(new Date().toISOString()),
      filters: {
        student: `${attendance[0].student_name} (${attendance[0].student_code})`,
        teacher: 'All Teachers',
        teachingGroup: 'All Groups',
        period: periodLabel,
      },
      filename: `student-attendance-${attendance[0].student_code}-${year}-${String(month).padStart(2, '0')}.pdf`,
    })
  }

  if (loading || profileLoading) {
    return (
      <section className="border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-slate-100" />
      </section>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <p>Access denied.</p>

  return (
    <div className="space-y-6 pb-2">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Attendance</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#102449]">Attendance</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Review your attendance history, session records, and attendance rate.</p>
        </div>
        <Link to="/student" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">
          Back to Dashboard <Icon name="arrow" />
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Sessions', value: summary.total, icon: 'calendar' as const, tone: 'bg-blue-50 text-blue-700' },
          { label: 'Present', value: summary.present, icon: 'check' as const, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Absent', value: summary.absent, icon: 'x' as const, tone: 'bg-rose-50 text-rose-700' },
          { label: 'Attendance Rate', value: summary.rate === null ? '—' : `${summary.rate.toFixed(1)}%`, icon: 'clock' as const, tone: 'bg-amber-50 text-amber-700' },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#102449]">{item.value}</p>
              </div>
              <div className={`flex size-10 items-center justify-center rounded-lg ${item.tone}`}><Icon name={item.icon} /></div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Detailed History</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Attendance Records</h2>
            <p className="mt-1 text-sm text-slate-500">Showing {periodLabel}.</p>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={!attendance.length || attendanceLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="download" />
            Download PDF
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,160px)_1fr] sm:items-end">
            <label className="block text-sm font-semibold text-slate-700">
              Month
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index))}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Year
              <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="hidden sm:block">
              <p className="text-right text-xs text-slate-500">Attendance is recorded by your assigned teacher.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 my-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:mx-7">
            Unable to load attendance. <button type="button" onClick={() => void reload()} className="font-bold underline">Retry</button>
          </div>
        )}

        <div className="p-6 sm:p-7">
          {attendanceLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : attendance.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"><Icon name="calendar" /></div>
              <h3 className="mt-4 text-base font-bold text-slate-900">No attendance records</h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">There are no attendance records for {periodLabel}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1040px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5 font-bold">Date</th>
                    <th className="px-4 py-3.5 font-bold">Teaching Group</th>
                    <th className="px-4 py-3.5 font-bold">Teacher</th>
                    <th className="px-4 py-3.5 font-bold">Level</th>
                    <th className="px-4 py-3.5 font-bold">Package</th>
                    <th className="px-4 py-3.5 font-bold">Status</th>
                    <th className="px-4 py-3.5 font-bold">Recorded Time</th>
                    <th className="px-4 py-3.5 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((item) => (
                    <tr key={item.meeting_id} className="border-t border-slate-200 bg-white transition hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{date(item.session_date)}</td>
                      <td className="px-4 py-4 text-slate-700">{item.teaching_group_name}</td>
                      <td className="px-4 py-4"><p className="font-semibold text-slate-900">{item.teacher_name}</p><p className="mt-0.5 text-xs text-slate-500">{item.teacher_code}</p></td>
                      <td className="px-4 py-4 text-slate-700">{item.level_name}</td>
                      <td className="px-4 py-4 text-slate-700">{packageLabel(item.package_type)}</td>
                      <td className="px-4 py-4"><StatusBadge status={item.teacher_status} /></td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600">{dateTime(item.teacher_recorded_at)}</td>
                      <td className="px-4 py-4 text-right"><button type="button" onClick={() => setDetail(item)} className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-800">View Detail <Icon name="arrow" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {detail && <AttendanceDetail record={detail} records={detailRecords} periodLabel={periodLabel} onClose={() => setDetail(null)} />}
    </div>
  )
}
