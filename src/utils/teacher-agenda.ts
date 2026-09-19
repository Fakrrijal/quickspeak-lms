import type { AgendaScheduleRule, TeacherAgendaOccurrence } from '../services/teacher-agenda.service'

export const AGENDA_WEEKDAYS = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 7, label: 'Sunday', shortLabel: 'Sun' },
] as const

export type AgendaPreviewOccurrence = TeacherAgendaOccurrence

export function formatAgendaDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value + 'T12:00:00'))
}

export function formatAgendaTime(value: string) {
  return value.slice(0, 5)
}

export function getWeekdayFromIsoDate(value: string) {
  const date = new Date(value + 'T12:00:00')
  const day = date.getDay()
  return day === 0 ? 7 : day
}

export function buildAgendaPreview(
  startDate: string,
  schedule: AgendaScheduleRule[],
): AgendaPreviewOccurrence[] {
  if (!startDate || schedule.length === 0) return []

  const byWeekday = new Map(schedule.map((rule) => [rule.weekday, rule]))
  const result: AgendaPreviewOccurrence[] = []
  const start = new Date(startDate + 'T12:00:00')
  let cursor = new Date(start.getTime())

  while (result.length < 8 && cursor.getTime() <= start.getTime() + 366 * 24 * 60 * 60 * 1000) {
    const isoDate = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, '0'),
      String(cursor.getDate()).padStart(2, '0'),
    ].join('-')
    const weekday = getWeekdayFromIsoDate(isoDate)
    const rule = byWeekday.get(weekday)

    if (rule) {
      result.push({
        id: 'preview-' + String(result.length + 1),
        series_id: 'preview',
        teacher_id: 'preview',
        teaching_group_id: 'preview',
        occurrence_number: result.length + 1,
        scheduled_date: isoDate,
        start_time: rule.start_time,
        end_time: rule.end_time,
      })
    }

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  return result
}

export function isAgendaOccurrenceVisible(occurrence: TeacherAgendaOccurrence, now = new Date()) {
  const endAt = new Date(occurrence.scheduled_date + 'T' + occurrence.end_time)
  return endAt.getTime() >= now.getTime()
}

export function getActiveAgendaOccurrences(occurrences: TeacherAgendaOccurrence[], now = new Date()) {
  return occurrences
    .filter((occurrence) => isAgendaOccurrenceVisible(occurrence, now))
    .sort((left, right) =>
      left.scheduled_date.localeCompare(right.scheduled_date)
      || left.start_time.localeCompare(right.start_time)
      || left.occurrence_number - right.occurrence_number,
    )
}

export function normalizeAgendaSchedule(value: unknown): AgendaScheduleRule[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      weekday: Number(item.weekday),
      start_time: String(item.start_time ?? ''),
      end_time: String(item.end_time ?? ''),
    }))
    .filter((item) => Number.isInteger(item.weekday) && item.weekday >= 1 && item.weekday <= 7)
    .sort((left, right) => left.weekday - right.weekday)
}

export function validateAgendaSchedule(schedule: AgendaScheduleRule[]) {
  if (schedule.length < 1) return 'Select at least one meeting day.'
  if (schedule.length > 7) return 'A maximum of seven meeting days can be selected.'

  const weekdays = new Set<number>()
  for (const rule of schedule) {
    if (weekdays.has(rule.weekday)) return 'Each weekday can only be selected once.'
    weekdays.add(rule.weekday)

    if (!rule.start_time || !rule.end_time) return 'Enter a start and end time for every selected day.'
    if (rule.end_time <= rule.start_time) return 'End time must be later than start time for every selected day.'
  }

  return null
}
