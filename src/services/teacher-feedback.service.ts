import { supabase } from '../lib/supabase'

export type TeacherFeedback = {
  level_result_id: string
  rating: number | null
  comment: string | null
  submitted_at: string
}

export type TeacherFeedbackForGroup = TeacherFeedback & {
  level_id: string
  level_name: string
}

export type AdminTeacherFeedback = TeacherFeedback & {
  feedback_id: string
  student_id: string
  student_name: string
  student_code: string
  teacher_id: string
  teacher_name: string
  teacher_code: string
  level_id: string
  level_name: string
  level_number: number
  teaching_group_id: string | null
  teaching_group_name: string | null
}

function firstRow<T>(data: T[] | T | null) {
  return Array.isArray(data) ? data[0] ?? null : data
}

export async function getMyTeacherFeedback(levelResultId?: string): Promise<TeacherFeedback[]> {
  const { data, error } = await supabase.rpc('get_my_teacher_feedback', {
    p_level_result_id: levelResultId ?? null,
  })

  if (error) throw error
  return (data ?? []) as TeacherFeedback[]
}

export async function submitTeacherFeedback(input: {
  levelResultId: string
  rating?: number | null
  comment?: string | null
}): Promise<TeacherFeedback> {
  const comment = input.comment?.trim() || null
  const rating = input.rating ?? null

  if (rating === null && comment === null) {
    throw new Error('Provide a rating or comment before submitting feedback.')
  }

  const { data, error } = await supabase.rpc('submit_teacher_feedback', {
    p_level_result_id: input.levelResultId,
    p_rating: rating,
    p_comment: comment,
  })

  if (error) throw error

  const result = firstRow(data)
  if (!result) throw new Error('Feedback submission did not return a result.')

  return result as TeacherFeedback
}

export async function getMyTeachingGroupTeacherFeedback(
  teachingGroupId: string,
): Promise<TeacherFeedbackForGroup[]> {
  const { data, error } = await supabase.rpc('get_my_teaching_group_teacher_feedback', {
    p_teaching_group_id: teachingGroupId,
  })

  if (error) throw error
  return (data ?? []) as TeacherFeedbackForGroup[]
}

export async function getAdminTeacherFeedback(
  teacherId: string,
): Promise<AdminTeacherFeedback[]> {
  const { data, error } = await supabase.rpc('get_admin_teacher_feedback', {
    p_teacher_id: teacherId,
  })

  if (error) throw error
  return (data ?? []) as AdminTeacherFeedback[]
}
