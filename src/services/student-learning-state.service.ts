import { supabase } from '../lib/supabase'

export type StudentLearningState = {
  enrollment_id: string
  level_id: string
  level_name: string
  level_number: number
  package_type: 'private' | 'semi_private'
  enrollment_status: string
  session_limit: number
  completed_sessions: number
  started_at: string | null
  completed_at: string | null
  teaching_group_id: string | null
  teaching_group_name: string | null
  teacher_id: string | null
  teacher_code: string | null
}

export async function getMyLearningState(): Promise<StudentLearningState | null> {
  const { data, error } = await supabase.rpc('get_my_learning_state')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as StudentLearningState | null
}
