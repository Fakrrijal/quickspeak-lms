import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherAttendanceGroups, type TeacherAttendanceGroup } from '../../services/teacher-attendance.service'
import {
  createTeacherAgenda,
  deleteTeacherAgenda,
  getMyTeacherAgenda,
  updateTeacherAgenda,
  type AgendaScheduleRule,
  type TeacherAgendaSeries,
} from '../../services/teacher-agenda.service'
import {
  AGENDA_WEEKDAYS,
  buildAgendaPreview,
  formatAgendaDate,
  formatAgendaTime,
  getActiveAgendaOccurrences,
  normalizeAgendaSchedule,
  validateAgendaSchedule,
} from '../../utils/teacher-agenda'

export const Route = createFileRoute('/teacher/agenda')({
  component: TeacherAgendaPage,
})

type ScheduleDraft = {
  enabled: boolean
  startTime: string
  endTime: string
}

type ScheduleDraftMap = Record<number, ScheduleDraft>

function createEmptyScheduleDraft(): ScheduleDraftMap {
  return Object.fromEntries(
    AGENDA_WEEKDAYS.map((day) => [
      day.value,
      {
        enabled: false,
        startTime: '19:00',
        endTime: '20:00',
      },
    ]),
  ) as ScheduleDraftMap
}

function scheduleToDraft(schedule: AgendaScheduleRule[]): ScheduleDraftMap {
  const draft = createEmptyScheduleDraft()
  for (const rule of schedule) {
    draft[rule.weekday] = {
      enabled: true,
      startTime: rule.start_time.slice(0, 5),
      endTime: rule.end_time.slice(0, 5),
    }
  }
  return draft
}

function draftToSchedule(draft: ScheduleDraftMap) {
  return AGENDA_WEEKDAYS
    .filter((day) => draft[day.value].enabled)
    .map((day) => ({
      weekday: day.value,
      start_time: draft[day.value].startTime,
      end_time: draft[day.value].endTime,
    }))
}

function getTodayIsoDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function AgendaOccurrenceList({ series }: { series: TeacherAgendaSeries }) {
  const occurrences = getActiveAgendaOccurrences(series.occurrences)

  return (
    <div className="space-y-2">
      {occurrences.map((occurrence) => (
        <article
          key={occurrence.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
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
          <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
            Agenda
          </span>
        </article>
      ))}
    </div>
  )
}

function TeacherAgendaPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()

  const [groups, setGroups] = useState<TeacherAttendanceGroup[]>([])
  const [series, setSeries] = useState<TeacherAgendaSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [startDate, setStartDate] = useState(getTodayIsoDate())
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraftMap>(createEmptyScheduleDraft())
  const [preview, setPreview] = useState<ReturnType<typeof buildAgendaPreview>>([])

  const canLoad = !authLoading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'teacher'
    && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [nextGroups, nextSeries] = await Promise.all([
        getMyTeacherAttendanceGroups(),
        getMyTeacherAgenda(),
      ])
      setGroups(nextGroups)
      setSeries(nextSeries)
      setSelectedGroupId((current) => current || nextGroups[0]?.teaching_group_id || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load agenda data.')
    } finally {
      setLoading(false)
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canLoad) return
    void loadData()
  }, [canLoad, loadData])

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

  const resetForm = (defaultGroupId = groups[0]?.teaching_group_id ?? '') => {
    setEditingSeriesId(null)
    setSelectedGroupId(defaultGroupId)
    setStartDate(getTodayIsoDate())
    setTitle('')
    setNotes('')
    setScheduleDraft(createEmptyScheduleDraft())
    setPreview([])
  }

  const toggleDay = (weekday: number) => {
    setScheduleDraft((current) => ({
      ...current,
      [weekday]: {
        ...current[weekday],
        enabled: !current[weekday].enabled,
      },
    }))
    setPreview([])
  }

  const updateDayTime = (weekday: number, field: 'startTime' | 'endTime', value: string) => {
    setScheduleDraft((current) => ({
      ...current,
      [weekday]: {
        ...current[weekday],
        [field]: value,
      },
    }))
    setPreview([])
  }

  const buildPreview = () => {
    setError(null)
    setSuccess(null)
    const schedule = draftToSchedule(scheduleDraft)
    const validationError = validateAgendaSchedule(schedule)
    if (validationError) {
      setPreview([])
      setError(validationError)
      return
    }

    const nextPreview = buildAgendaPreview(startDate, schedule)
    if (nextPreview.length !== 8) {
      setPreview([])
      setError('The selected pattern could not generate 8 agenda occurrences.')
      return
    }

    setPreview(nextPreview)
  }

  const startEdit = (item: TeacherAgendaSeries) => {
    setError(null)
    setSuccess(null)
    setEditingSeriesId(item.id)
    setSelectedGroupId(item.teaching_group_id)
    setStartDate(item.start_date)
    setTitle(item.title ?? '')
    setNotes(item.notes ?? '')
    setScheduleDraft(scheduleToDraft(normalizeAgendaSchedule(item.schedule_definition)))
    setPreview(buildAgendaPreview(item.start_date, normalizeAgendaSchedule(item.schedule_definition)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)

    if (!selectedGroupId) {
      setError('Select a Teaching Group.')
      return
    }

    if (!startDate) {
      setError('Select a start date.')
      return
    }

    const schedule = draftToSchedule(scheduleDraft)
    const validationError = validateAgendaSchedule(schedule)
    if (validationError) {
      setError(validationError)
      return
    }

    const nextPreview = buildAgendaPreview(startDate, schedule)
    if (nextPreview.length !== 8) {
      setError('The selected pattern could not generate 8 agenda occurrences.')
      return
    }

    setSaving(true)

    try {
      if (editingSeriesId) {
        await updateTeacherAgenda({
          seriesId: editingSeriesId,
          teachingGroupId: selectedGroupId,
          startDate,
          schedule,
          title,
          notes,
        })
        setSuccess('Agenda updated successfully.')
      } else {
        await createTeacherAgenda({
          teachingGroupId: selectedGroupId,
          startDate,
          schedule,
          title,
          notes,
        })
        setSuccess('Agenda created successfully.')
      }

      await loadData()
      resetForm(selectedGroupId)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save agenda.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (seriesId: string) => {
    if (!window.confirm('Delete this agenda series? The agenda entries will be removed from the portal.')) return

    setError(null)
    setSuccess(null)
    setDeletingId(seriesId)

    try {
      await deleteTeacherAgenda(seriesId)
      setSeries((current) => current.filter((item) => item.id !== seriesId))
      if (editingSeriesId === seriesId) resetForm(selectedGroupId)
      setSuccess('Agenda deleted successfully.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete agenda.')
    } finally {
      setDeletingId(null)
    }
  }

  if (authLoading || profileLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'teacher') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Access denied.</div>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Agenda</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Create an 8-entry agenda for each Teaching Group. Past agenda entries disappear automatically.
            </p>
          </div>
          {editingSeriesId && (
            <button
              type="button"
              onClick={() => resetForm(selectedGroupId)}
              className="inline-flex w-fit items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </header>

      {(error || success) && (
        <div className={error ? 'rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'}>
          {error ?? success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
            {editingSeriesId ? 'Edit Agenda Series' : 'Create Agenda Series'}
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#102449]">
            Set the weekly pattern once, then review all 8 entries before saving.
          </h2>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Teaching Group</span>
              <select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                disabled={Boolean(editingSeriesId) || groupsLoading}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              >
                {groups.length === 0 && <option value="">No active Teaching Group</option>}
                {groups.map((group) => (
                  <option key={group.teaching_group_id} value={group.teaching_group_id}>
                    {group.teaching_group_name} · {group.level_name} · {group.package_type === 'semi_private' ? 'Semi-Private' : 'Private'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setPreview([])
                }}
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Meeting Days</p>
                <p className="mt-1 text-sm text-slate-600">Select every day used by this Teaching Group. Each selected day has its own time.</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">8 agenda entries</span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {AGENDA_WEEKDAYS.map((day) => {
                const current = scheduleDraft[day.value]
                return (
                  <label
                    key={day.value}
                    className={[
                      'rounded-xl border p-4 transition',
                      current.enabled ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={current.enabled}
                        onChange={() => toggleDay(day.value)}
                        className="size-4 accent-blue-700"
                      />
                      <span className="text-sm font-extrabold text-[#102449]">{day.label}</span>
                    </div>

                    {current.enabled && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="text-[11px] font-bold text-slate-500">
                          Start
                          <input
                            type="time"
                            value={current.startTime}
                            onChange={(event) => updateDayTime(day.value, 'startTime', event.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800"
                          />
                        </label>
                        <label className="text-[11px] font-bold text-slate-500">
                          End
                          <input
                            type="time"
                            value={current.endTime}
                            onChange={(event) => updateDayTime(day.value, 'endTime', event.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800"
                          />
                        </label>
                      </div>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Title (optional)</span>
              <input
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Level 1 Evening Class"
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Notes (optional)</span>
              <input
                value={notes}
                maxLength={1000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional information for your students"
                className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={buildPreview}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Preview 8 Agendas
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !selectedGroupId}
              className="inline-flex items-center justify-center rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingSeriesId ? 'Save Changes' : 'Save Agenda'}
            </button>
          </div>
        </div>
      </section>

      {preview.length > 0 && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/40 shadow-sm">
          <div className="border-b border-blue-100 px-5 py-4 sm:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Preview</p>
            <h2 className="mt-1 text-lg font-bold text-[#102449]">8 agenda entries that will be created</h2>
          </div>
          <div className="grid gap-2 p-5 sm:grid-cols-2 sm:p-6">
            {preview.map((occurrence) => (
              <div key={occurrence.id} className="flex items-center gap-3 rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-700">{occurrence.occurrence_number}</span>
                <div>
                  <p className="text-sm font-bold text-[#102449]">{formatAgendaDate(occurrence.scheduled_date)}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatAgendaTime(occurrence.start_time)} – {formatAgendaTime(occurrence.end_time)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Active Agenda</p>
          <h2 className="mt-1 text-xl font-bold text-[#102449]">Upcoming agenda entries</h2>
        </header>

        {activeSeries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-bold text-[#102449]">No active agenda</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Create an agenda series to show upcoming meeting information to your students.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSeries.map(({ series: item, occurrences }) => {
              const group = groups.find((candidate) => candidate.teaching_group_id === item.teaching_group_id)
              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Teaching Group</p>
                      <h3 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{group?.teaching_group_name ?? 'Teaching Group'}</h3>
                      <p className="mt-2 text-sm text-slate-600">{item.title || 'Agenda'}</p>
                      {item.notes && <p className="mt-1 text-xs leading-5 text-slate-500">{item.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Edit</button>
                      <button type="button" onClick={() => void handleDelete(item.id)} disabled={deletingId === item.id} className="rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{deletingId === item.id ? 'Deleting...' : 'Delete'}</button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <p className="mb-3 text-xs font-semibold text-slate-500">Only upcoming or ongoing agenda entries are shown.</p>
                    <AgendaOccurrenceList series={{ ...item, occurrences }} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
