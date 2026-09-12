import { supabase } from '../lib/supabase'

export type LevelResult = {
  result_id: string
  student_id: string
  level_id: string
  level_name?: string
  level_number?: number
  teacher_id: string
  teacher_code?: string
  speaking: number
  listening: number
  vocabulary: number
  grammar: number
  pronunciation: number
  final_score: number
  result: 'Excellent' | 'Good' | 'Satisfactory' | 'Needs Improvement'
  feedback: string | null
  completed_at: string
}

export type CompleteStudentLevelInput = {
  studentId: string
  levelId: string
  speaking: number
  listening: number
  vocabulary: number
  grammar: number
  pronunciation: number
  feedback?: string
}

export type StudentLevelPackageStatus = {
  student_id: string
  current_level_id: string
  current_level_name: string
  current_level_number: number
  level_completed: boolean
  current_enrollment_id: string | null
  current_package_type: 'private' | 'semi_private' | null
  current_package_price: number | null
  current_package_status: string | null
  current_package_session_count: number
  session_limit: number
  cumulative_level_session_count: number
  renewal_available: boolean
  next_level_id: string | null
  next_level_name: string | null
  next_level_number: number | null
  next_level_available: boolean
}

export type RenewalEnrollmentRequest = {
  enrollment_id: string
  level_id: string
  package_type: 'private' | 'semi_private'
  price: number
  session_limit: number
  enrollment_status: string
}

function firstRow<T>(data: T[] | T | null) {
  return Array.isArray(data) ? data[0] ?? null : data
}

export async function completeStudentLevel(input: CompleteStudentLevelInput): Promise<LevelResult> {
  const { data, error } = await supabase.rpc('complete_student_level', {
    p_student_id: input.studentId,
    p_level_id: input.levelId,
    p_speaking: input.speaking,
    p_listening: input.listening,
    p_vocabulary: input.vocabulary,
    p_grammar: input.grammar,
    p_pronunciation: input.pronunciation,
    p_feedback: input.feedback?.trim() || null,
  })

  if (error) throw error

  const result = firstRow(data)
  if (!result) throw new Error('Level completion did not return a result.')

  return result as LevelResult
}

export async function getTeacherLevelResult(
  studentId: string,
  levelId: string,
): Promise<LevelResult | null> {
  const { data, error } = await supabase.rpc('get_my_teacher_level_result', {
    p_student_id: studentId,
    p_level_id: levelId,
  })

  if (error) throw error
  return firstRow(data) as LevelResult | null
}

export async function getStudentLevelResults(levelId?: string): Promise<LevelResult[]> {
  const { data, error } = await supabase.rpc('get_my_student_level_results', {
    p_level_id: levelId ?? null,
  })

  if (error) throw error
  return (data ?? []) as LevelResult[]
}

export async function getStudentLevelPackageStatus(): Promise<StudentLevelPackageStatus | null> {
  const { data, error } = await supabase.rpc('get_my_student_level_package_status')

  if (error) throw error
  return firstRow(data) as StudentLevelPackageStatus | null
}

export async function requestCurrentLevelPackageRenewal(): Promise<RenewalEnrollmentRequest> {
  const { data, error } = await supabase.rpc('request_current_level_package_renewal')

  if (error) throw error

  const enrollment = firstRow(data)
  if (!enrollment) throw new Error('Package renewal did not return an enrollment.')

  return enrollment as RenewalEnrollmentRequest
}

export async function requestNextLevelEnrollmentFromResult(
  packageType: 'private' | 'semi_private',
) {
  const { data, error } = await supabase.rpc('request_next_level_enrollment', {
    p_package_type: packageType,
  })

  if (error) throw error

  const enrollment = firstRow(data)
  if (!enrollment) throw new Error('Next-level enrollment did not return an enrollment.')

  return enrollment as RenewalEnrollmentRequest
}
