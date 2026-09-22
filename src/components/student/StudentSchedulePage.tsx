import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'
import { getScheduleForTeachingGroup, type ClassSchedule } from '../../services/class-schedule.service'
import { formatScheduleTime, getScheduleDayLabel } from '../../lib/schedule'

export function StudentSchedulePage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [learningState, setLearningState] = useState<StudentLearningState | null>(null)
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'student' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  useEffect(() => {
    if (!canLoad) return

    let cancelled = false
    setLoading(true)
    setError(false)

    getMyLearningState()
      .then(async (state) => {
        if (cancelled) return
        setLearningState(state)

        if (!state?.teaching_group_id) {
          setSchedule(null)
          setLoading(false)
          return
        }

        const groupSchedule = await getScheduleForTeachingGroup(state.teaching_group_id)
        if (!cancelled) setSchedule(groupSchedule)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canLoad])

  if (authLoading || profileLoading || loading) {
    return (
      <div className="space-y-5">
        <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Class Schedule</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">View the planned class time for your current teaching group.</p>
      </header>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm font-bold text-rose-800">Unable to load your schedule.</p>
          <p className="mt-1 text-sm text-rose-700">Please refresh the page and try again.</p>
        </section>
      ) : !learningState ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#102449]">No active learning package</h2>
          <p className="mt-2 text-sm text-slate-600">Your class schedule will appear here once you have an active class assignment.</p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Current Class</p>
              <h2 className="mt-1 text-2xl font-extrabold text-[#102449]">{learningState.teaching_group_name ?? 'Teaching group'}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{learningState.level_name}</span>
                {learningState.teacher_name && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Teacher: {learningState.teacher_name}</span>}
                {learningState.teacher_code && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{learningState.teacher_code}</span>}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {!schedule ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                  <h3 className="text-lg font-bold text-[#102449]">Schedule not set yet</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Your teacher has not entered the planned class schedule yet.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Weekly Schedule</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-[-0.02em] text-[#102449]">{getScheduleDayLabel(schedule.day_of_week)}</p>
                      <p className="mt-1 text-xl font-bold text-blue-700">{formatScheduleTime(schedule.start_time)} – {formatScheduleTime(schedule.end_time)} WIB</p>
                    </div>
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8 fill-none stroke-current stroke-2">
                        <rect x="3" y="4.5" width="18" height="16" rx="2" />
                        <path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm sm:p-6">
            <p className="text-sm font-bold text-amber-900">Schedule is a planned class time.</p>
            <p className="mt-1.5 text-sm leading-6 text-amber-800">Actual class time and attendance are recorded separately by the teacher. The schedule does not mark attendance or consume a session.</p>
          </section>
        </>
      )}
    </div>
  )
}
