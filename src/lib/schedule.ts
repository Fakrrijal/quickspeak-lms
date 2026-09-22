export const SCHEDULE_DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const

export function getScheduleDayLabel(dayOfWeek: number) {
  return SCHEDULE_DAYS.find((day) => day.value === dayOfWeek)?.label ?? 'Unknown day'
}

export function formatScheduleTime(value: string) {
  const [hours = '00', minutes = '00'] = value.split(':')
  return `${hours}:${minutes}`
}

export function getNextScheduleDate(dayOfWeek: number, startTime: string, now = new Date()) {
  const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek
  const currentDay = now.getDay()
  let dayOffset = (targetDay - currentDay + 7) % 7

  const [hours = '0', minutes = '0'] = startTime.split(':')
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

export function formatScheduleDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
