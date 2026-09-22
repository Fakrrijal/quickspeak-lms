import { useEffect, useState } from 'react'
import { SCHEDULE_DAYS, formatScheduleTime, getScheduleDayLabel } from '../../lib/schedule'
import {
  deleteTeachingGroupSchedule,
  getScheduleForTeachingGroup,
  saveTeachingGroupSchedule,
  type ClassSchedule,
} from '../../services/class-schedule.service'

type TeacherScheduleEditorProps = {
  teachingGroupId: string
}

export function TeacherScheduleEditor({ teachingGroupId }: TeacherScheduleEditorProps) {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessage(null)
    setError(null)

    getScheduleForTeachingGroup(teachingGroupId)
      .then((values) => {
        if (cancelled) return
        setSchedules(values)
        setSelectedDays(values.map((value) => value.day_of_week))
        setStartTime(values[0]?.start_time.slice(0, 5) ?? '')
        setEndTime(values[0]?.end_time.slice(0, 5) ?? '')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load schedule')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [teachingGroupId])

  function toggleDay(dayOfWeek: number) {
    setSelectedDays((current) => (
      current.includes(dayOfWeek)
        ? current.filter((value) => value !== dayOfWeek)
        : [...current, dayOfWeek].sort((a, b) => a - b)
    ))
  }

  async function handleSave() {
    setError(null)
    setMessage(null)

    if (selectedDays.length === 0 || !startTime || !endTime) {
      setError('Please select at least one day and enter a start and end time.')
      return
    }

    if (startTime >= endTime) {
      setError('End time must be later than start time.')
      return
    }

    setSaving(true)
    try {
      const saved = await saveTeachingGroupSchedule({
        teachingGroupId,
        daysOfWeek: selectedDays,
        startTime,
        endTime,
      })
      setSchedules(saved)
      setSelectedDays(saved.map((value) => value.day_of_week))
      setStartTime(saved[0]?.start_time.slice(0, 5) ?? '')
      setEndTime(saved[0]?.end_time.slice(0, 5) ?? '')
      setMessage('Schedule saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save schedule')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (schedules.length === 0 || !window.confirm('Remove the schedule for this teaching group?')) return

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await deleteTeachingGroupSchedule(teachingGroupId)
      setSchedules([])
      setSelectedDays([])
      setStartTime('')
      setEndTime('')
      setMessage('Schedule removed.')
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove schedule')
    } finally {
      setSaving(false)
    }
  }

  const currentDays = schedules.map((schedule) => getScheduleDayLabel(schedule.day_of_week)).join(' · ')

  return (
    <section className="border-t border-slate-200 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Class Schedule</p>
          <h3 className="mt-1 text-lg font-bold text-[#102449]">Planned weekly class time</h3>
          <p className="mt-1 text-sm text-slate-600">Select all class days, then set one time for the selected days.</p>
        </div>
        {schedules.length > 0 && (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            Current: {currentDays} · {formatScheduleTime(schedules[0].start_time)}–{formatScheduleTime(schedules[0].end_time)} WIB
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <>
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-700">Class days</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {SCHEDULE_DAYS.map((day) => {
                const checked = selectedDays.includes(day.value)
                return (
                  <label
                    key={day.value}
                    className={[
                      'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition',
                      checked
                        ? 'border-blue-300 bg-blue-50 text-blue-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDay(day.value)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={[
                        'flex size-5 shrink-0 items-center justify-center rounded-md border text-xs font-extrabold',
                        checked
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-transparent',
                      ].join(' ')}
                    >
                      ✓
                    </span>
                    <span>{day.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm font-semibold text-slate-700">
              Start
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              End
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#102449] px-4 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
              {schedules.length > 0 && (
                <button type="button" onClick={handleRemove} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                  Remove
                </button>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            One selected time is applied to every checked day. This is informational only; it does not create attendance or consume a session.
          </p>
          {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
          {message && <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
        </>
      )}
    </section>
  )
}
