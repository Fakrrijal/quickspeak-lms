import { supabase } from '../lib/supabase'

export type AgendaScheduleRule = {
  weekday: number
  start_time: string
  end_time: string
}

export type TeacherAgendaOccurrence = {
  id: string
  series_id: string
  teacher_id: string
  teaching_group_id: string
  occurrence_number: number
  scheduled_date: string
  start_time: string
  end_time: string
}

export type TeacherAgendaSeries = {
  id: string
  teacher_id: string
  teaching_group_id: string
  start_date: string
  meeting_count: 8
  schedule_definition: AgendaScheduleRule[]
  title: string | null
  notes: string | null
  created_at: string
  updated_at: string
  occurrences: TeacherAgendaOccurrence[]
}

export type SaveTeacherAgendaInput = {
  teachingGroupId: string
  startDate: string
  schedule: AgendaScheduleRule[]
  title?: string
  notes?: string
}

export type UpdateTeacherAgendaInput = SaveTeacherAgendaInput & {
  seriesId: string
}

function normalizeSeries(row: Omit<TeacherAgendaSeries, 'occurrences'>): TeacherAgendaSeries {
  return {
    ...row,
    meeting_count: 8,
    schedule_definition: Array.isArray(row.schedule_definition) ? row.schedule_definition : [],
    occurrences: [],
  }
}

export async function getMyTeacherAgenda(): Promise<TeacherAgendaSeries[]> {
  const [{ data: series, error: seriesError }, { data: occurrences, error: occurrencesError }] = await Promise.all([
    supabase
      .from('teacher_agenda_series')
      .select('id, teacher_id, teaching_group_id, start_date, meeting_count, schedule_definition, title, notes, created_at, updated_at')
      .order('start_date', { ascending: true }),
    supabase
      .from('teacher_agenda_occurrences')
      .select('id, series_id, teacher_id, teaching_group_id, occurrence_number, scheduled_date, start_time, end_time')
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  if (seriesError) throw seriesError
  if (occurrencesError) throw occurrencesError

  const bySeries = new Map<string, TeacherAgendaSeries>()
  for (const row of (series ?? []) as unknown as Array<Omit<TeacherAgendaSeries, 'occurrences'>>) {
    bySeries.set(row.id, normalizeSeries(row))
  }

  for (const occurrence of (occurrences ?? []) as unknown as TeacherAgendaOccurrence[]) {
    const seriesRow = bySeries.get(occurrence.series_id)
    if (seriesRow) seriesRow.occurrences.push(occurrence)
  }

  return [...bySeries.values()]
}

export async function getMyStudentAgenda(): Promise<TeacherAgendaSeries[]> {
  const [{ data: series, error: seriesError }, { data: occurrences, error: occurrencesError }] = await Promise.all([
    supabase
      .from('teacher_agenda_series')
      .select('id, teacher_id, teaching_group_id, start_date, meeting_count, schedule_definition, title, notes, created_at, updated_at')
      .order('start_date', { ascending: true }),
    supabase
      .from('teacher_agenda_occurrences')
      .select('id, series_id, teacher_id, teaching_group_id, occurrence_number, scheduled_date, start_time, end_time')
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  if (seriesError) throw seriesError
  if (occurrencesError) throw occurrencesError

  const bySeries = new Map<string, TeacherAgendaSeries>()
  for (const row of (series ?? []) as unknown as Array<Omit<TeacherAgendaSeries, 'occurrences'>>) {
    bySeries.set(row.id, normalizeSeries(row))
  }

  for (const occurrence of (occurrences ?? []) as unknown as TeacherAgendaOccurrence[]) {
    const seriesRow = bySeries.get(occurrence.series_id)
    if (seriesRow) seriesRow.occurrences.push(occurrence)
  }

  return [...bySeries.values()]
}

export async function createTeacherAgenda(input: SaveTeacherAgendaInput) {
  const { data, error } = await supabase.rpc('create_teacher_agenda_series', {
    p_teaching_group_id: input.teachingGroupId,
    p_start_date: input.startDate,
    p_schedule: input.schedule,
    p_title: input.title?.trim() || null,
    p_notes: input.notes?.trim() || null,
  })

  if (error) throw error
  return data as string
}

export async function updateTeacherAgenda(input: UpdateTeacherAgendaInput) {
  const { data, error } = await supabase.rpc('update_teacher_agenda_series', {
    p_series_id: input.seriesId,
    p_start_date: input.startDate,
    p_schedule: input.schedule,
    p_title: input.title?.trim() || null,
    p_notes: input.notes?.trim() || null,
  })

  if (error) throw error
  return data as string
}

export async function deleteTeacherAgenda(seriesId: string) {
  const { data, error } = await supabase.rpc('delete_teacher_agenda_series', {
    p_series_id: seriesId,
  })

  if (error) throw error
  return Boolean(data)
}
