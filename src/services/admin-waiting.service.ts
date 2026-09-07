import { supabase } from '../lib/supabase'
import type { ActiveLevel, ClassType, WaitingStudent, WaitingTeacher } from './admin.service'

export async function getVerifiedWaitingStudents(): Promise<WaitingStudent[]> {
  const { data, error } = await supabase.rpc('get_waiting_students')

  if (error) {
    throw error
  }

  return (data ?? []).map((student) => ({
    id: student.id,
    full_name: student.full_name,
    email: student.email,
    phone: student.phone,
    status: student.status,
    registration_date: student.registration_date,
    starting_level: student.starting_level_id
      ? {
          id: student.starting_level_id,
          level_number: student.starting_level_number,
          name: student.starting_level_name,
        }
      : null,
    class_type: student.class_type as ClassType | null,
  })) as WaitingStudent[]
}

export async function getVerifiedWaitingTeachers(): Promise<WaitingTeacher[]> {
  const { data, error } = await supabase.rpc('get_waiting_teachers')

  if (error) {
    throw error
  }

  return (data ?? []).map((teacher) => ({
    id: teacher.id,
    full_name: teacher.full_name,
    email: teacher.email,
    phone: teacher.phone,
    status: teacher.status,
    registration_date: teacher.registration_date,
    class_type: teacher.class_type as ClassType | null,
    supported_levels: Array.isArray(teacher.supported_levels)
      ? teacher.supported_levels as ActiveLevel[]
      : [],
  })) as WaitingTeacher[]
}
