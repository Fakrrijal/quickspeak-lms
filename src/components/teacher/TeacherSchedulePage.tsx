import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { formatScheduleDate, formatScheduleTime, getNextScheduleOccurrences, getScheduleDayLabel } from '../../lib/schedule'
import { getMyTeacherScheduleOverview, type TeacherScheduleOverview } from '../../services/class-schedule.service'

export function TeacherSchedulePage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<TeacherScheduleOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'

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

    getMyTeacherScheduleOverview()
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load your schedule')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canLoad])

  const sortedOverview = useMemo(() => {
    return overview
      .map((item) => ({
        ...item,
        nextOccurrence: getNextScheduleOccurrences(item.schedules, 1)[0] ?? null,
      }))
      .sort((a, b) => {
        if (!a.nextOccurrence && !b.nextOccurrence) return a.group.teaching_group_name.localeCompare(b.group.teaching_group_name)
        if (!a.nextOccurrence) return 1
        if (!b.nextOccurrence) return -1
        return a.nextOccurrence.date.getTime() - b.nextOccurrence.date.getTime()
      })
  }, [overview])

  if (authLoading || profileLoading || loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />)}
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'teacher') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Schedule</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">View the planned weekly schedule for all of your active teaching groups.</p>
        </div>
        <Link
          to="/teacher/teaching-groups"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f]"
        >
          Manage Teaching Groups <span aria-hidden="true">→</span>
        </Link>
      </header>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm font-bold text-rose-800">Unable to load your schedule.</p>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
        </section>
      ) : sortedOverview.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#102449]">No teaching groups assigned</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your active teaching groups and planned schedules will appear here once assigned.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teaching Groups</p>
              <p className="mt-2 text-2xl font-extrabold text-[#102449]">{sortedOverview.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Scheduled Groups</p>
              <p className="mt-2 text-2xl font-extrabold text-[#102449]">{sortedOverview.filter((item) => item.schedules.length > 0).length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Students Covered</p>
              <p className="mt-2 text-2xl font-extrabold text-[#102449]">{sortedOverview.reduce((total, item) => total + item.group.students.length, 0)}</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Teacher schedules">
            {sortedOverview.map((item) => (
              <article key={item.group.teaching_group_id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Teaching Group</p>
                      <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{item.group.teaching_group_name}</h2>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{item.group.level_name}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{item.group.students.length} student{item.group.students.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    {item.nextOccurrence && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Next class</span>
                    )}
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {item.schedules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5">
                      <p className="text-sm font-bold text-[#102449]">Schedule not set</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Set the weekly class time from this group's Teaching Groups detail.</p>
                      <Link to="/teacher/teaching-groups" className="mt-3 inline-flex text-sm font-bold text-blue-700 hover:underline">Open Teaching Groups →</Link>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Weekly pattern</p>
                        <div className="mt-3 space-y-2">
                          {item.schedules.map((schedule) => (
                            <div key={schedule.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-extrabold text-[#102449]">{getScheduleDayLabel(schedule.day_of_week)}</p>
                              <p className="text-sm font-bold text-blue-700">{formatScheduleTime(schedule.start_time)} – {formatScheduleTime(schedule.end_time)} WIB</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {item.nextOccurrence && (
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Next class</p>
                          <p className="mt-1.5 text-base font-extrabold text-[#102449]">{formatScheduleDate(item.nextOccurrence.date)}</p>
                          <p className="mt-1 text-sm font-bold text-blue-700">{formatScheduleTime(item.nextOccurrence.schedule.start_time)} – {formatScheduleTime(item.nextOccurrence.schedule.end_time)} WIB</p>
                        </div>
                      )}
                    </>
                  )}

                  <p className="mt-4 border-t border-slate-200 pt-4 text-xs font-semibold leading-5 text-slate-500">
                    Planned schedule only. Actual class time and attendance are recorded separately.
                  </p>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
