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
    return (
      <div className="border border-slate-200 bg-white p-6 shadow-sm rounded-2xl">
        <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-slate-100" />
      </div>
    )
  }
  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-base font-medium text-rose-800">Access denied.</div>

  const completed = Boolean(learningState && (learningState.enrollment_status === 'completed' || learningState.completed_at || learningState.completed_sessions >= learningState.session_limit))
  const assigned = Boolean(learningState?.teaching_group_id && learningState?.teacher_id)
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null

  return (
    <div className="space-y-7 pb-4">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Dashboard</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#102449] sm:text-[34px]">Welcome back, {profile.full_name}.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Here is your current learning overview and attendance status.</p>
        </div>
        <Link to="/student/profile" className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">
          <span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon name="user" /></span>
          <span>Profile</span>
        </Link>
      </header>

      <main className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <section className="border border-slate-200 bg-white shadow-sm rounded-2xl" aria-labelledby="current-learning-title">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon name="book" /></div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">My Class</p>
                  <h2 id="current-learning-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449] sm:text-[21px]">Current learning stage</h2>
                </div>
              </div>
              <Link to="/student/learning" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">
                View details <Icon name="arrow" />
              </Link>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-7 sm:py-7">
            {learningStateError ? (
              <div className="border border-rose-200 bg-rose-50 p-5 rounded-xl">
                <p className="text-sm font-bold text-rose-800">Unable to load your learning status.</p>
                <p className="mt-1 text-sm leading-6 text-rose-700">Please open My Learning and try again.</p>
              </div>
            ) : learningState ? (
              <div>
                <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Level {learningState.level_number}</p>
                    <h3 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-[#102449]">{learningState.level_name}</h3>
                    <p className="mt-2 text-base font-bold text-blue-700">{formatPackage(learningState.package_type)}</p>
                  </div>
                  <span className={`inline-flex w-fit items-center rounded-md px-3 py-2 text-sm font-bold ${completed ? 'bg-emerald-50 text-emerald-700' : assigned ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>
                    {completed ? 'Stage completed' : assigned ? 'Active learning' : 'Waiting for class assignment'}
                  </span>
                </div>

                <div className="grid border-b border-slate-200 sm:grid-cols-2">
                  <div className="border-b border-slate-200 py-5 sm:border-b-0 sm:border-r sm:pr-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Teaching Group</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{learningState.teaching_group_name ?? 'Not assigned yet'}</p>
                  </div>
                  <div className="py-5 sm:pl-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Teacher</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{learningState.teacher_code ?? 'Not assigned yet'}</p>
                  </div>
                </div>

                {!assigned && !completed && (
                  <div className="mt-5 border border-amber-200 bg-amber-50 px-4 py-3.5 rounded-lg">
                    <p className="text-sm leading-6 text-amber-900">Payment approved. Your teaching group and teacher will appear here after administrator assignment.</p>
                  </div>
                )}

                {completed && (
                  <Link to="/student/learning" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">
                    Continue to Next Stage <Icon name="arrow" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-slate-300 bg-slate-50 p-6 rounded-xl">
                <p className="text-base font-bold text-slate-900">No learning package yet</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Choose a learning package to start your first learning stage.</p>
                <Link to="/student/learning" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">
                  Choose Learning Package <Icon name="arrow" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="border border-slate-200 bg-white shadow-sm rounded-2xl" aria-labelledby="attendance-title">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="calendar" /></div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Attendance</p>
                  <h2 id="attendance-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449]">Attendance summary</h2>
                </div>
              </div>
              <Link to="/student/attendance" className="text-sm font-bold text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">View all</Link>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-7">
            <div className="flex items-end justify-between gap-5 border-b border-slate-200 pb-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Overall rate</p>
                <p className="mt-2 text-4xl font-extrabold leading-none tracking-[-0.04em] text-[#102449]">{attendanceLoading ? '…' : attendanceError ? '—' : rate === null ? '—' : `${rate.toFixed(0)}%`}</p>
              </div>
              <div className="relative flex size-20 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(rgb(16 185 129) ${rate ?? 0}%, rgb(226 232 240) 0)` }}>
                <div className="flex size-14 items-center justify-center rounded-full bg-white">
                  <Icon name="check" />
                </div>
              </div>
            </div>

            <dl className="grid divide-x divide-slate-200 grid-cols-3 pt-5">
              <div className="pr-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Present</dt>
                <dd className="mt-1.5 text-xl font-extrabold text-slate-900">{present}</dd>
              </div>
              <div className="px-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Absent</dt>
                <dd className="mt-1.5 text-xl font-extrabold text-slate-900">{absent}</dd>
              </div>
              <div className="pl-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Records</dt>
                <dd className="mt-1.5 text-xl font-extrabold text-slate-900">{total}</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm leading-6 text-slate-600">Keep your attendance consistent to support your learning progress.</p>
            </div>
          </div>
        </section>
      </main>

      <section className="border border-slate-200 bg-white shadow-sm rounded-2xl" aria-labelledby="account-status-title">
        <div className="flex flex-col gap-6 px-6 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="check" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Account Status</p>
              <h2 id="account-status-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449]">Your account is active</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">You can access your learning area and continue your current stage.</p>
            </div>
          </div>

          <div className="grid divide-y divide-slate-200 border-t border-slate-200 lg:min-w-[420px] lg:grid-cols-2 lg:divide-x lg:divide-y-0 lg:border-y lg:border-t-0">
            <div className="py-4 lg:px-5 lg:py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Student</p>
              <p className="mt-1.5 text-sm font-bold text-slate-900">{profile.full_name}</p>
            </div>
            <div className="py-4 lg:px-5 lg:py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Email</p>
              <p className="mt-1.5 truncate text-sm font-bold text-slate-900">{profile.email}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
