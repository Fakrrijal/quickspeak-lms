import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyLearningState } from '../../services/student-learning-state.service'
import { getMyStudentAgenda, type TeacherAgendaSeries } from '../../services/teacher-agenda.service'
import { formatAgendaDate, formatAgendaTime, getActiveAgendaOccurrences } from '../../utils/teacher-agenda'

export const Route = createFileRoute('/student/agenda')({
  component: StudentAgendaPage,
})

function StudentAgendaPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [series, setSeries] = useState<TeacherAgendaSeries[]>([])
  const [teacherName, setTeacherName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canLoad = !authLoading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'student'
    && status === 'active'

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
    setError(null)

    Promise.all([
      getMyStudentAgenda(),
      getMyLearningState(),
    ])
      .then(([nextSeries, learningState]) => {
        if (cancelled) return
        setSeries(nextSeries)
        setTeacherName(learningState?.teacher_name ?? '')
        setGroupName(learningState?.teaching_group_name ?? '')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load agenda.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [canLoad])

  const activeSeries = useMemo(
    () => series
      .map((item) => ({
        series: item,
        occurrences: getActiveAgendaOccurrences(item.occurrences),
      }))
      .filter((item) => item.occurrences.length > 0)
      .sort((left, right) => {
        const leftDate = left.occurrences[0].scheduled_date + left.occurrences[0].start_time
        const rightDate = right.occurrences[0].scheduled_date + right.occurrences[0].start_time
        return leftDate.localeCompare(rightDate)
      }),
    [series],
  )

  if (authLoading || profileLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Access denied.</div>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Agenda</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          See your upcoming learning schedule. Past agenda entries disappear automatically.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {activeSeries.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <path d="M8 2.5v4M16 2.5v4M3 9h18" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#102449]">No upcoming agenda</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your teacher has not published an upcoming agenda for your Teaching Group yet.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {activeSeries.map(({ series: item, occurrences }) => (
            <section key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Learning Agenda</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{item.title || 'Upcoming Schedule'}</h2>
                    {(groupName || teacherName) && (
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {[groupName, teacherName ? 'Teacher: ' + teacherName : ''].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    Informational
                  </span>
                </div>
                {item.notes && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{item.notes}</p>}
              </div>

              <div className="space-y-2 p-4 sm:p-5">
                {occurrences.map((occurrence) => (
                  <article key={occurrence.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-extrabold text-blue-700">
                        {occurrence.occurrence_number}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#102449]">{formatAgendaDate(occurrence.scheduled_date)}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {formatAgendaTime(occurrence.start_time)} – {formatAgendaTime(occurrence.end_time)}
                        </p>
                      </div>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">Agenda</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3.5 text-sm leading-6 text-slate-600">
        Agenda is informational only. Attendance, learning completion, and teacher fee remain recorded through their existing QuickSpeak processes.
      </div>
    </div>
  )
}
