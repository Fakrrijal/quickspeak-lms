import { supabase } from '../lib/supabase'

export type EnrollmentCorrectionLevel = {
  id: string
  level_number: number
  name: string
}

export type EnrollmentCorrectionItem = {
  id: string
  status: 'payment_approved' | 'teacher_assignment'
  level_id: string
  package_type: 'private' | 'semi_private'
  updated_at: string
  price: number
  students: {
    student_code: string
    profiles: {
      full_name: string
      email: string
    } | null
  } | null
  levels: EnrollmentCorrectionLevel | null
}

function firstRelated<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getEnrollmentCorrectionLevels(): Promise<EnrollmentCorrectionLevel[]> {
  const { data, error } = await supabase
    .from('levels')
    .select('id, level_number, name')
    .order('level_number', { ascending: true })

  if (error) throw error
  return (data ?? []) as EnrollmentCorrectionLevel[]
}

export async function getEditablePaidEnrollments(): Promise<EnrollmentCorrectionItem[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      status,
      level_id,
      package_type,
      updated_at,
      price,
      students (student_code, profiles (full_name, email)),
      levels (id, level_number, name)
    `)
    .in('status', ['payment_approved', 'teacher_assignment'])
    .order('updated_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((enrollment) => ({
    ...enrollment,
    students: firstRelated(enrollment.students),
    levels: firstRelated(enrollment.levels),
  })) as EnrollmentCorrectionItem[]
}

export async function adminEditPaidEnrollment(
  enrollmentId: string,
  levelId: string,
  packageType: 'private' | 'semi_private',
) {
  const { data, error } = await supabase.rpc('admin_edit_paid_enrollment', {
    p_enrollment_id: enrollmentId,
    p_level_id: levelId,
    p_package_type: packageType,
  })

  if (error) throw error

  return (Array.isArray(data) ? data[0] : data) as EnrollmentCorrectionItem
}
