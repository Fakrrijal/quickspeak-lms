import { supabase } from '../lib/supabase'

export type TeacherLearningProgressRow = {
  student_id: string
  student_name: string
  current_level_id: string
  current_level_name: string
  current_level_number: number
  level_id: string
  level_name: string
  level_number: number
  ebook_id: string | null
  ebook_title: string | null
  chapter_id: string | null
  chapter_number: number | null
  chapter_title: string | null
  material_id: string | null
  material_number: number | null
  material_title: string | null
  completed_at: string | null
  teaching_group_id: string | null
  teaching_group_name: string | null
  teacher_id: string | null
  teacher_name: string | null
  teacher_code: string | null
}

export async function getMyTeacherLearningProgress(search?: string) {
  const { data, error } = await supabase.rpc('get_my_teacher_learning_progress', {
    p_search: search?.trim() || null,
  })
  if (error) throw error
  return (data ?? []) as TeacherLearningProgressRow[]
}

export async function markTeacherChapterCompleted(studentId: string, chapterId: string) {
  const { data, error } = await supabase.rpc('mark_teacher_chapter_completed', {
    p_student_id: studentId,
    p_chapter_id: chapterId,
  })
  if (error) throw error
  return data
}

export async function unmarkTeacherChapterCompleted(studentId: string, chapterId: string) {
  const { data, error } = await supabase.rpc('unmark_teacher_chapter_completed', {
    p_student_id: studentId,
    p_chapter_id: chapterId,
  })
  if (error) throw error
  return data
}
