import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'

function Icon({ name }: { name: 'book' | 'calendar' | 'user' | 'arrow' | 'check' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'book') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  if (name === 'user') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function formatPackage(value: StudentLearningState['package_type']) {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

export function StudentDashboardV2() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [learningState, setLearningState] = useState<StudentLearningState | null>(null)
  const [learningStateLoading, setLearningStateLoading] = useState(true)
  const [learningStateError, setLearningStateError] = useState(false)

  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'student' && status === 'active'
  const { attendance, loading: attendanceLoading, error: attendanceError } = useStudentAttendance(canLoad)

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setLearningStateLoading(true)
    setLearningStateError(false)
    getMyLearningState()
      .then((nextState) => { if (!cancelled) setLearningState(nextState) })
      .catch(() => { if (!cancelled) setLearningStateError(true) })
      .finally(() => { if (!cancelled) setLearningStateLoading(false) })
    return () => { cancelled = true }
  }, [canLoad])

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  if (authLoading || profileLoading || learningStateLoading) {
    return <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-base font-medium text-slate-600">Loading your dashboard...</p></div>
  }
  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-5 text-base font-medium text-rose-800">Access denied.</div>

  const completed = Boolean(learningState && (learningState.enrollment_status === 'completed' || learningState.completed_at || learningState.completed_sessions >= learningState.session_limit))
  const assigned = Boolean(learningState?.teaching_group_id && learningState?.teacher_id)
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null

  return (
    <div className="space-y-5 pb-2">
      <section className="relative overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 px-6 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-blue-100/60 blur-2xl" />
        <div className="pointer-events-none absolute bottom-[-96px] left-1/3 size-72 rounded-full bg-sky-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Welcome back</p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#102449] sm:text-[36px]">Good to see you, {profile.full_name}.</h1>
            <p className="mt-2 text-base leading-6 text-slate-600">Keep learning and make today count.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
            <span className="size-2 rounded-full bg-emerald-500" /> Account active
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Student summary">
        <Link to="/student/learning" className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Icon name="book" /></div>
            <Icon name="arrow" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">My Class</p>
          <p className="mt-1 text-[25px] font-extrabold leading-none tracking-[-0.03em] text-[#102449]">{learningState ? `Level ${learningState.level_number}` : '—'}</p>
          <p className="mt-2 text-base font-semibold text-blue-700">{learningState ? formatPackage(learningState.package_type) : 'No package yet'}</p>
        </Link>

        <Link to="/student/attendance" className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Icon name="calendar" /></div>
            <Icon name="arrow" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Attendance</p>
          <p className="mt-1 text-[30px] font-extrabold leading-none tracking-[-0.04em] text-[#102449]">{attendanceLoading ? '…' : attendanceError ? '—' : rate === null ? '—' : `${rate.toFixed(0)}%`}</p>
          <p className="mt-2 text-base font-medium text-slate-600">Overall attendance rate</p>
        </Link>

        <Link to="/student/profile" className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><Icon name="user" /></div>
            <Icon name="arrow" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account Status</p>
          <p className="mt-1 text-[25px] font-extrabold leading-none tracking-[-0.03em] text-[#102449]">Active</p>
          <p className="mt-2 max-w-[18ch] text-base font-medium text-slate-600">Your account is ready for learning.</p>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <article className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name="book" /></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">My Class</p><h2 className="mt-1 text-[22px] font-bold leading-tight text-[#102449]">Current learning stage</h2></div>
            </div>
            <Link to="/student/learning" className="text-sm font-bold text-blue-700">View details →</Link>
          </div>

          {learningStateError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-base text-rose-700">Unable to load your learning status. Please open My Learning and try again.</div>
          ) : learningState ? (
            <div className="mt-6">
              <div className="flex flex-col gap-5 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium text-slate-500">Level {learningState.level_number}</p><h3 className="mt-1 text-[24px] font-extrabold tracking-[-0.025em] text-[#102449]">{learningState.level_name}</h3><p className="mt-1 text-base font-semibold text-blue-700">{formatPackage(learningState.package_type)}</p></div>
                <span className={`inline-flex w-fit rounded-full px-3.5 py-2 text-sm font-bold ${completed ? 'bg-emerald-50 text-emerald-700' : assigned ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{completed ? 'Stage completed' : assigned ? 'Active learning' : 'Waiting for class assignment'}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Teaching Group</p><p className="mt-2 text-base font-bold text-slate-900">{learningState.teaching_group_name ?? 'Not assigned yet'}</p></div>
                <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Teacher</p><p className="mt-2 text-base font-bold text-slate-900">{learningState.teacher_code ?? 'Not assigned yet'}</p></div>
              </div>
              {!assigned && !completed && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-base leading-6 text-amber-900">Payment approved. Your teaching group and teacher will appear here after administrator assignment.</div>}
              {completed && <Link to="/student/learning" className="mt-4 inline-flex items-center gap-2 text-base font-bold text-blue-700">Continue to Next Stage <Icon name="arrow" /></Link>}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5"><p className="text-base font-bold text-slate-900">No learning package yet</p><p className="mt-1 text-base leading-6 text-slate-600">Choose a package to start your learning stage.</p><Link to="/student/learning" className="mt-4 inline-flex items-center gap-2 text-base font-bold text-blue-700">Choose Package <Icon name="arrow" /></Link></div>
          )}
        </article>

        <article className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name="calendar" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Attendance</p><h2 className="mt-1 text-[22px] font-bold leading-tight text-[#102449]">Attendance Summary</h2></div></div>
            <Link to="/student/attendance" className="text-sm font-bold text-blue-700">View all →</Link>
          </div>
          <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <div className="relative flex size-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(rgb(34 197 94) ${rate ?? 0}%, rgb(226 232 240) 0)` }}>
              <div className="flex size-24 items-center justify-center rounded-full bg-white"><span className="text-[24px] font-extrabold tracking-[-0.03em] text-[#102449]">{attendanceLoading ? '…' : rate === null ? '—' : `${rate.toFixed(0)}%`}</span></div>
            </div>
            <dl className="grid w-full grid-cols-3 gap-2 sm:flex-1">
              <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Present</dt><dd className="mt-2 text-xl font-extrabold text-slate-900">{present}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Absent</dt><dd className="mt-2 text-xl font-extrabold text-slate-900">{absent}</dd></div>
              <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Records</dt><dd className="mt-2 text-xl font-extrabold text-slate-900">{total}</dd></div>
            </dl>
          </div>
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-base leading-6 text-emerald-800">Keep your attendance consistent to support your learning progress.</div>
        </article>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Icon name="check" /></div><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-amber-700">Account Status</p><h2 className="mt-1 text-[22px] font-bold text-[#102449]">Your account is active</h2><p className="mt-1 text-base leading-6 text-slate-600">You can access your learning area and continue your current stage.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Student</p><p className="mt-2 text-base font-bold text-slate-900">{profile.full_name}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Email</p><p className="mt-2 truncate text-base font-bold text-slate-900">{profile.email}</p></div></div>
        </div>
      </section>
    </div>
  )
}
