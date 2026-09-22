export const SCHEDULE_DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const

export type SchedulePatternRow = {
  day_of_week: number
  start_time: string
  end_time: string
}

export type PlannedScheduleOccurrence = {
  schedule: SchedulePatternRow
  date: Date
}

export function getScheduleDayLabel(dayOfWeek: number) {
  return SCHEDULE_DAYS.find((day) => day.value === dayOfWeek)?.label ?? 'Unknown day'
}

export function formatScheduleTime(value: string) {
  const [hours = '00', minutes = '00'] = value.split(':')
  return `${hours}:${minutes}`
}

export function getNextScheduleDate(dayOfWeek: number, startTime: string, now = new Date()) {
  const [hours = '0', minutes = '0'] = startTime.split(':')
  const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek
  const currentDay = now.getDay()
  let dayOffset = (targetDay - currentDay + 7) % 7
  const startMinutes = Number(hours) * 60 + Number(minutes)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  if (dayOffset === 0 && currentMinutes >= startMinutes) {
    dayOffset = 7
  }

  const next = new Date(now)
  next.setDate(now.getDate() + dayOffset)
  next.setHours(Number(hours), Number(minutes), 0, 0)
  return next
}

export function getNextScheduleOccurrences(
  schedules: SchedulePatternRow[],
  count = 8,
  now = new Date(),
): PlannedScheduleOccurrence[] {
  if (count <= 0 || schedules.length === 0) return []

  const results: PlannedScheduleOccurrence[] = []
  const uniqueSchedules = schedules
    .filter((schedule) => schedule.day_of_week >= 1 && schedule.day_of_week <= 7)
    .filter((schedule, index, rows) => rows.findIndex((row) => (
      row.day_of_week === schedule.day_of_week
      && row.start_time === schedule.start_time
      && row.end_time === schedule.end_time
    )) === index)

  for (let dayOffset = 0; dayOffset <= 63 && results.length < count; dayOffset += 1) {
    const date = new Date(now)
    date.setDate(now.getDate() + dayOffset)
    date.setHours(0, 0, 0, 0)

    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay()
    const daySchedules = uniqueSchedules.filter((schedule) => schedule.day_of_week === dayOfWeek)

    for (const schedule of daySchedules) {
      const [hours = '0', minutes = '0'] = schedule.start_time.split(':')
      const occurrenceDate = new Date(date)
      occurrenceDate.setHours(Number(hours), Number(minutes), 0, 0)

      if (occurrenceDate <= now) continue

      results.push({ schedule, date: occurrenceDate })
    }
  }

  return results
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, count)
}

export function formatScheduleDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
