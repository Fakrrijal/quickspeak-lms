import { supabase } from '../lib/supabase'

export type StudentActiveEnrollment = {
  enrollment_id: string
  level_id: string
  level_name: string
  level_number: number
  package_type: 'private' | 'semi_private'
  enrollment_status: 'active'
  created_at: string
  teaching_group_id: string
  teaching_group_name: string
  teacher_id: string
  teacher_code: string
}

export async function getMyActiveEnrollments(): Promise<StudentActiveEnrollment[]> {
  const { data, error } = await supabase.rpc('get_my_active_enrollments')

  if (error) {
    throw error
  }

  return (data ?? []) as StudentActiveEnrollment[]
}
