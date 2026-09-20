import { supabase } from '../lib/supabase'

export type StudentRenewalNextAction =
  | 'package_selection'
  | 'renewal'
  | 'renewal_payment'
  | 'waiting_approval'
  | 'activation_pending'
  | 'learning'
  | 'level_completed'

export type StudentRenewalContext = {
  student_id: string
  current_level_id: string
  current_level_name: string
  current_level_number: number
  active_enrollment_id: string | null
  active_package_type: 'private' | 'semi_private' | null
  active_enrollment_status: string | null
  active_session_count: number
  active_session_limit: number
  previous_enrollment_id: string | null
  previous_package_type: 'private' | 'semi_private' | null
  previous_enrollment_status: string | null
  previous_session_count: number
  previous_session_limit: number
  teaching_group_id: string | null
  teaching_group_name: string | null
  teacher_id: string | null
  teacher_name: string | null
  teacher_code: string | null
  renewal_enrollment_id: string | null
  renewal_package_type: 'private' | 'semi_private' | null
  renewal_price: number | null
  renewal_status: string | null
  renewal_invoice_id: string | null
  renewal_invoice_number: string | null
  renewal_invoice_status: string | null
  renewal_payment_id: string | null
  renewal_payment_status: string | null
  renewal_available: boolean
  next_action: StudentRenewalNextAction
}

export async function getMyStudentRenewalContext(): Promise<StudentRenewalContext | null> {
  const { data, error } = await supabase.rpc('get_my_student_renewal_context')
  if (error) throw error

  const row = (Array.isArray(data) ? data[0] : data) as StudentRenewalContext | null
  if (!row) return null

  return row
}
