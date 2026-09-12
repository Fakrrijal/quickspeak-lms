import { supabase } from '../lib/supabase'

export type TeacherLearningProgressRow = {
  student_id: string
  student_name: string
  level_id: string
  level_name: string
  ebook_id: string | null
  ebook_title: string | null
  chapter_id: string | null
  chapter_number: number | null
  chapter_title: string | null
  material_id: string | null
  material_number: number | null
  material_title: string | null
  completed_at: string | null
}

export async function getMyTeacherLearningProgress(search?: string) {
  const { data, error } = await supabase.rpc('get_my_teacher_learning_progress', {
    p_search: search?.trim() || null,
  })
  if (error) throw error
  return (data ?? []) as TeacherLearningProgressRow[]
}

export async function markTeacherMaterialCompleted(studentId: string, materialId: string) {
  const { data, error } = await supabase.rpc('mark_teacher_material_completed', {
    p_student_id: studentId,
    p_material_id: materialId,
  })
  if (error) throw error
  return data
}
