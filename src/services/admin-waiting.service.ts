import { supabase } from '../lib/supabase'
import type { ActiveLevel, ClassType, WaitingStudent, WaitingTeacher } from './admin.service'

type WaitingStudentRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  registration_date: string
  starting_level_id: string | null
  starting_level_number: number | null
  starting_level_name: string | null
  class_type: string | null
}

type WaitingTeacherRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  registration_date: string
  class_type: string | null
  supported_levels: unknown
}

export async function getVerifiedWaitingStudents(): Promise<WaitingStudent[]> {
  const { data, error } = await supabase.rpc('get_waiting_students')

  if (error) {
    throw error
  }

  const rows = (data ?? []) as WaitingStudentRow[]

  return rows.map((student) => ({
    id: student.id,
    full_name: student.full_name,
    email: student.email,
    phone: student.phone,
    status: student.status,
    registration_date: student.registration_date,
    starting_level: student.starting_level_id
      ? {
          id: student.starting_level_id,
          level_number: student.starting_level_number ?? 0,
          name: student.starting_level_name ?? '',
        }
      : null,
    class_type: student.class_type as ClassType | null,
  }))
}

export async function getVerifiedWaitingTeachers(): Promise<WaitingTeacher[]> {
  const { data, error } = await supabase.rpc('get_waiting_teachers')

  if (error) {
    throw error
  }

  const rows = (data ?? []) as WaitingTeacherRow[]

  return rows.map((teacher) => ({
    id: teacher.id,
    full_name: teacher.full_name,
    email: teacher.email,
    phone: teacher.phone,
    status: teacher.status,
    registration_date: teacher.registration_date,
    class_type: teacher.class_type as ClassType | null,
    supported_levels: Array.isArray(teacher.supported_levels)
      ? (teacher.supported_levels as ActiveLevel[])
      : [],
  }))
}
