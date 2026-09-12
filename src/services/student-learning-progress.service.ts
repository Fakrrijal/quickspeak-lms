import { supabase } from '../lib/supabase'

export type StudentLearningProgressRow = {
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
  completed_at: string | null
}

export async function getMyStudentLearningProgress(): Promise<StudentLearningProgressRow[]> {
  const { data, error } = await supabase.rpc('get_my_student_learning_progress')

  if (error) {
    throw error
  }

  const rows = (data ?? []) as StudentLearningProgressRow[]
  const currentLevelNumber = rows[0]?.current_level_number

  if (currentLevelNumber == null) {
    return []
  }

  return rows.filter((row) => row.level_number === currentLevelNumber)
}
