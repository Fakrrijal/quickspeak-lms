import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { formatScheduleDate, formatScheduleTime, getNextScheduleOccurrences, getScheduleDayLabel } from '../../lib/schedule'
import { getMyTeacherScheduleOverview, type TeacherScheduleOverview } from '../../services/class-schedule.service'

type WeeklyScheduleRow = {
  key: string
  days: string[]
  startTime: string
  endTime: string
  groupName: string
  levelName: string
  studentCount: number
}

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

  const scheduleData = useMemo(() => {
    const scheduled = overview.filter((item) => item.schedules.length > 0)
    const unscheduledCount = overview.length - scheduled.length

    const nextScheduledClass = scheduled
      .flatMap((item) => {
        const occurrence = getNextScheduleOccurrences(item.schedules, 1)[0]
        return occurrence ? [{ ...item, occurrence }] : []
      })
      .sort((a, b) => a.occurrence.date.getTime() - b.occurrence.date.getTime())[0] ?? null

    const rowMap = new Map<string, WeeklyScheduleRow>()
    for (const item of scheduled) {
      const schedules = [...item.schedules].sort((a, b) => a.day_of_week - b.day_of_week)
      const grouped = new Map<string, WeeklyScheduleRow>()

      for (const schedule of schedules) {
        const key = `${item.group.teaching_group_id}-${schedule.start_time}-${schedule.end_time}`
        const current = grouped.get(key) ?? {
          key,
          days: [],
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          groupName: item.group.teaching_group_name,
          levelName: item.group.level_name,
          studentCount: item.group.students.length,
        }

        current.days.push(getScheduleDayLabel(schedule.day_of_week))
        grouped.set(key, current)
      }

      for (const [key, row] of grouped) {
        rowMap.set(key, row)
      }
    }

    const weeklyRows = [...rowMap.values()].sort((a, b) => {
      const firstDayA = overview
        .find((item) => item.group.teaching_group_name === a.groupName)
        ?.schedules
        .find((schedule) => schedule.start_time === a.startTime && schedule.end_time === a.endTime)?.day_of_week ?? 8
      const firstDayB = overview
        .find((item) => item.group.teaching_group_name === b.groupName)
        ?.schedules
        .find((schedule) => schedule.start_time === b.startTime && schedule.end_time === b.endTime)?.day_of_week ?? 8

      return firstDayA - firstDayB || a.startTime.localeCompare(b.startTime) || a.groupName.localeCompare(b.groupName)
    })

    return { nextScheduledClass, weeklyRows, unscheduledCount, scheduledCount: scheduled.length }
  }, [overview])

  if (authLoading || profileLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'teacher') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Schedule</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">See your next class and weekly teaching schedule in one place.</p>
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
      ) : overview.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#102449]">No teaching groups assigned</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your teaching groups and planned schedules will appear here once assigned.</p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-blue-100 bg-blue-50/60 shadow-sm" aria-labelledby="teacher-next-class-title">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Next Class</p>
                <h2 id="teacher-next-class-title" className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">
                  {scheduleData.nextScheduledClass
                    ? formatScheduleDate(scheduleData.nextScheduledClass.occurrence.date)
                    : 'No upcoming class scheduled'}
                </h2>
                <p className="mt-1.5 text-sm font-semibold text-blue-700">
                  {scheduleData.nextScheduledClass
                    ? `${formatScheduleTime(scheduleData.nextScheduledClass.occurrence.schedule.start_time)} – ${formatScheduleTime(scheduleData.nextScheduledClass.occurrence.schedule.end_time)} WIB`
                    : 'Set a weekly schedule from Teaching Groups to see your next class here.'}
                </p>
                {scheduleData.nextScheduledClass && (
                  <p className="mt-2 text-sm text-slate-600">
                    {scheduleData.nextScheduledClass.group.teaching_group_name} · {scheduleData.nextScheduledClass.group.level_name} · {scheduleData.nextScheduledClass.group.students.length} student{scheduleData.nextScheduledClass.group.students.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <Link
                to="/teacher/teaching-groups"
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#102449] transition hover:border-slate-400 hover:bg-white"
              >
                View Group <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="teacher-weekly-schedule-title">
            <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Weekly Schedule</p>
              <h2 id="teacher-weekly-schedule-title" className="text-xl font-extrabold text-[#102449]">Your teaching timetable</h2>
            </div>

            {scheduleData.weeklyRows.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {scheduleData.weeklyRows.map((row) => (
                  <div key={row.key} className="flex flex-col gap-3 px-5 py-4 sm:grid sm:grid-cols-[minmax(110px,0.9fr)_150px_minmax(0,1.6fr)] sm:items-center sm:px-6">
                    <div>
                      <p className="text-sm font-extrabold text-[#102449]">{row.days.join(', ')}</p>
                    </div>
                    <p className="text-sm font-bold text-blue-700">{formatScheduleTime(row.startTime)} – {formatScheduleTime(row.endTime)} WIB</p>
                    <div className="flex min-w-0 items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{row.groupName}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{row.levelName} · {row.studentCount} student{row.studentCount === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center sm:px-6">
                <p className="text-sm font-bold text-[#102449]">No weekly schedule set yet.</p>
                <p className="mt-1 text-sm text-slate-600">Open Teaching Groups to set the planned class time.</p>
              </div>
            )}

            {scheduleData.unscheduledCount > 0 && (
              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-slate-600">
                    {scheduleData.unscheduledCount} teaching group{scheduleData.unscheduledCount === 1 ? '' : 's'} {scheduleData.unscheduledCount === 1 ? 'has' : 'have'} no schedule yet.
                  </p>
                  <Link to="/teacher/teaching-groups" className="inline-flex w-fit text-sm font-bold text-blue-700 hover:underline">Manage Teaching Groups →</Link>
                </div>
              </div>
            )}
          </section>

          <p className="text-xs font-semibold leading-5 text-slate-500">
            Planned schedule only. Actual class time and attendance are recorded separately.
          </p>
        </>
      )}
    </div>
  )
}
