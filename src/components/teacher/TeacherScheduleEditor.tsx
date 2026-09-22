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
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null)
  const [dayOfWeek, setDayOfWeek] = useState('')
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
      .then((value) => {
        if (cancelled) return
        setSchedule(value)
        setDayOfWeek(value ? String(value.day_of_week) : '')
        setStartTime(value ? value.start_time.slice(0, 5) : '')
        setEndTime(value ? value.end_time.slice(0, 5) : '')
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

  async function handleSave() {
    setError(null)
    setMessage(null)

    if (!dayOfWeek || !startTime || !endTime) {
      setError('Please select a day and enter a start and end time.')
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
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
      })
      setSchedule(saved)
      setDayOfWeek(String(saved.day_of_week))
      setStartTime(saved.start_time.slice(0, 5))
      setEndTime(saved.end_time.slice(0, 5))
      setMessage('Schedule saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save schedule')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!schedule || !window.confirm('Remove the schedule for this teaching group?')) return

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await deleteTeachingGroupSchedule(teachingGroupId)
      setSchedule(null)
      setDayOfWeek('')
      setStartTime('')
      setEndTime('')
      setMessage('Schedule removed.')
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="border-t border-slate-200 px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Class Schedule</p>
          <h3 className="mt-1 text-lg font-bold text-[#102449]">Planned weekly class time</h3>
          <p className="mt-1 text-sm text-slate-600">This is informational only. It does not create attendance or consume a session.</p>
        </div>
        {schedule && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Current: {getScheduleDayLabel(schedule.day_of_week)} · {formatScheduleTime(schedule.start_time)}–{formatScheduleTime(schedule.end_time)} WIB</span>}
      </div>

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
            <label className="text-sm font-semibold text-slate-700">
              Day
              <select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="">Select day</option>
                {SCHEDULE_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Start
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              End
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#102449] px-4 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving…' : 'Save Schedule'}</button>
              {schedule && <button type="button" onClick={handleRemove} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">Remove</button>}
            </div>
          </div>

          {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
          {message && <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
        </>
      )}
    </section>
  )
}
