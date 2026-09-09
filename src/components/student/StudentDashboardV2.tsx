import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'

function Icon({ name }: { name: 'book' | 'calendar' | 'user' | 'arrow' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'book') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  if (name === 'user') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function formatPackage(packageType: StudentLearningState['package_type']) {
  return packageType === 'private' ? 'Private' : 'Semi-Private'
}

export function StudentDashboardV2() {
  const {
    isAuthenticated,
    loading: authLoading,
    profile,
    profileError,
    profileLoading,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [learningState, setLearningState] = useState<StudentLearningState | null>(null)
  const [learningStateLoading, setLearningStateLoading] = useState(true)
  const [learningStateError, setLearningStateError] = useState(false)

  const canLoad = !authLoading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'student'
    && status === 'active'

  const {
    attendance,
    loading: attendanceLoading,
    error: attendanceError,
  } = useStudentAttendance(canLoad)

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setLearningStateLoading(true)
    setLearningStateError(false)

    getMyLearningState()
      .then((nextState) => {
        if (!cancelled) setLearningState(nextState)
      })
      .catch(() => {
        if (!cancelled) setLearningStateError(true)
      })
      .finally(() => {
        if (!cancelled) setLearningStateLoading(false)
      })

    return () => { cancelled = true }
  }, [canLoad])

  useEffect(() => {
    if (authLoading || profileLoading) return

    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  if (authLoading || profileLoading || learningStateLoading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Loading your dashboard...</p>
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null

  if (role !== 'student') {
    return <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>
  }

  const completed = Boolean(
    learningState
    && (
      learningState.enrollment_status === 'completed'
      || learningState.completed_at
      || learningState.completed_sessions >= learningState.session_limit
    ),
  )
  const assigned = Boolean(learningState?.teaching_group_id && learningState?.teacher_id)
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null
  const attendanceLabel = attendanceLoading
    ? '…'
    : attendanceError
      ? '—'
      : rate === null
        ? '—'
        : `${rate.toFixed(1)}%`

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-700">Student Portal</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-[#102449] sm:text-3xl">Welcome back, {profile.full_name}.</h1>
          <p className="mt-2 text-sm text-slate-600">Your learning overview at a glance.</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-700">
          <span className="mr-2 size-2 rounded-full bg-emerald-500" /> Account active
        </span>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr_1fr]" aria-label="Student dashboard">
        <article className="flex min-h-[300px] flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <Icon name="book" />
            </div>
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">My Class</span>
          </div>

          <div className="mt-6 flex flex-1 flex-col">
            {learningStateError ? (
              <div className="flex flex-1 items-center">
                <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <p className="font-bold text-rose-800">Unable to load class status</p>
                  <p className="mt-1 text-sm leading-6 text-rose-700">Open My Learning to retry and view your current learning stage.</p>
                  <Link to="/student/learning" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Open My Learning <Icon name="arrow" /></Link>
                </div>
              </div>
            ) : learningState ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Current Level</p>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Level {learningState.level_number}</h2>
                    <p className="mt-1 text-sm font-semibold text-blue-700">{learningState.level_name}</p>
                  </div>
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">{formatPackage(learningState.package_type)}</span>
                </div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3.5">
                    <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Teaching Group</dt>
                    <dd className="mt-1.5 truncate text-sm font-bold text-slate-900">{learningState.teaching_group_name ?? 'Not assigned yet'}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3.5">
                    <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Teacher</dt>
                    <dd className="mt-1.5 truncate text-sm font-bold text-slate-900">{learningState.teacher_code ?? 'Not assigned yet'}</dd>
                  </div>
                </dl>
                {!completed && !assigned && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-6 text-amber-900">Payment approved. Your teaching group and teacher will appear here after administrator assignment.</div>}
                {completed && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-6 text-emerald-800">You have completed this 8-session stage. Continue to the next stage from My Learning.</div>}
                <Link to="/student/learning" className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-sm font-bold text-blue-700 hover:text-blue-800">
                  {completed ? 'Continue to Next Stage' : 'Open My Learning'} <Icon name="arrow" />
                </Link>
              </>
            ) : (
              <div className="flex flex-1 items-center">
                <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5">
                  <p className="font-bold text-slate-900">No learning package yet</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Choose a learning package to start your next stage.</p>
                  <Link to="/student/learning" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Choose Package <Icon name="arrow" /></Link>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="flex min-h-[300px] flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <Icon name="calendar" />
            </div>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Attendance</span>
          </div>

          <div className="mt-6 flex flex-1 flex-col">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Attendance Rate</p>
            <div className="mt-1 flex items-end gap-2">
              <p className="text-4xl font-extrabold tracking-[-0.04em] text-[#102449]">{attendanceLabel}</p>
              {!attendanceError && rate !== null && <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Overall</span>}
            </div>

            {attendanceError ? (
              <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-700">Unable to load attendance summary.</p>
            ) : (
              <dl className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Present</dt>
                  <dd className="mt-1.5 text-xl font-extrabold text-slate-900">{present}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Absent</dt>
                  <dd className="mt-1.5 text-xl font-extrabold text-slate-900">{absent}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Records</dt>
                  <dd className="mt-1.5 text-xl font-extrabold text-slate-900">{total}</dd>
                </div>
              </dl>
            )}

            <Link to="/student/attendance" className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-blue-700 hover:text-blue-800">
              View Attendance History <Icon name="arrow" />
            </Link>
          </div>
        </article>

        <article className="flex min-h-[300px] flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <Icon name="user" />
            </div>
            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-700">Account</span>
          </div>

          <div className="mt-6 flex flex-1 flex-col">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Account Status</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[#102449]">Your account is active.</h2>
            <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500" /> Active
            </div>

            <dl className="mt-auto space-y-3 pt-6">
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Student</dt>
                <dd className="mt-1.5 truncate text-sm font-bold text-slate-900">{profile.full_name}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Email</dt>
                <dd className="mt-1.5 truncate text-sm font-bold text-slate-900">{profile.email}</dd>
              </div>
            </dl>

            <Link to="/student/profile" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">
              Open Profile <Icon name="arrow" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
