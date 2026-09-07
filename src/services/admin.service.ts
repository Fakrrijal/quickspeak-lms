import { supabase } from '../lib/supabase'

export type WaitingStudent = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  registration_date: string
  starting_level: ActiveLevel | null
  class_type: ClassType | null
}

export type WaitingTeacher = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  registration_date: string
  class_type: ClassType | null
  supported_levels: ActiveLevel[]
}

export type ApprovedTeacher = {
  teacher_id: string
  teacher_code: string
  full_name: string
}

export type ActiveTeachingGroup = {
  id: string
  name: string
  group_type: 'private' | 'semi_private'
  level_id: string
  teacher_id: string
  is_active: boolean
  levels: {
    name: string
    level_number: number
  } | null
  teachers: {
    teacher_code: string
    profiles: {
      full_name: string
    } | null
  } | null
}

export type TeachingGroup = ActiveTeachingGroup & {
  student_count: number
  memberships: TeachingGroupMembership[]
}

export type TeachingGroupMembership = {
  student_id: string
  students: {
    id: string
    student_code: string
    profiles: {
      full_name: string
    } | null
  } | null
}

export type ActiveStudent = {
  id: string
  student_code: string
  profiles: {
    full_name: string
  } | null
}

export type AdminStudentDirectoryItem = {
  id: string
  student_code: string
  is_active: boolean
  profile: {
    full_name: string
    email: string
    phone: string | null
    status: string
    created_at: string
  } | null
  level: {
    id: string
    name: string
    level_number: number
  } | null
  teaching_group_names: string[]
  class_types: ClassType[]
}

export type ClassType = 'private' | 'semi_private'

export type ActiveTeacher = {
  id: string
  teacher_code: string
  profiles: {
    full_name: string
  } | null
}

export type AdminTeacher = {
  id: string
  teacher_code: string
  is_active: boolean
  profiles: {
    full_name: string
    email: string
    phone: string | null
    created_at: string
  } | null
  eligible_levels: {
    id: string
    level_number: number
    name: string
  }[]
  active_teaching_group_names: string[]
  active_class_types: ClassType[]
}

export type TeacherLevelEligibility = {
  id: string
  level_number: number
  name: string
}

export type ActiveLevel = {
  id: string
  level_number: number
  name: string
}

export type StudentProtectedEnrollment = {
  id: string
  status: string
  level_id: string
  level: ActiveLevel | null
}

export type CreateTeachingGroupInput = {
  name: string
  teacherId: string
  levelId: string
  groupType: 'private' | 'semi_private'
}

export type UpdateTeachingGroupInput = {
  teachingGroupId: string
  name: string
  teacherId: string
  levelId: string
  groupType: 'private' | 'semi_private'
}

export async function getWaitingStudents() {
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

export async function getWaitingTeachers() {
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

export async function approveTeacher(profileId: string) {
  const { data, error } = await supabase.rpc('admin_approve_teacher', {
    p_profile_id: profileId,
  })

  if (error) {
    throw error
  }

  const approvedTeacher = Array.isArray(data) ? data[0] ?? null : data
  if (!approvedTeacher) {
    throw new Error('Teacher approval did not return a teacher.')
  }

  return approvedTeacher as ApprovedTeacher
}

export async function rejectWaitingStudent(profileId: string) {
  const { data, error } = await supabase.rpc('admin_reject_waiting_student', {
    p_profile_id: profileId,
  })

  if (error) {
    throw error
  }

  return data
}

export async function rejectWaitingTeacher(profileId: string) {
  const { data, error } = await supabase.rpc('admin_reject_waiting_teacher', {
    p_profile_id: profileId,
  })

  if (error) {
    throw error
  }

  return data
}
