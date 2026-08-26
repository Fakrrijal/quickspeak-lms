import { supabase } from '../lib/supabase'

export type WaitingStudent = {
  id: string
  full_name: string
  email: string
  role: string
  status: string
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
}

export type ActiveTeacher = {
  id: string
  teacher_code: string
  profiles: {
    full_name: string
  } | null
}

export type TeacherLevelEligibility = {
  id: string
  level_number: number
  name: string
}

export type CreateTeachingGroupInput = {
  name: string
  teacherId: string
  levelId: string
  groupType: 'private' | 'semi_private'
}

export async function getWaitingStudents() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status')
    .eq('role', 'student')
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as WaitingStudent[]
}

export async function getActiveTeachingGroups() {
  const { data, error } = await supabase
    .from('teaching_groups')
    .select(`
      id,
      name,
      group_type,
      level_id,
      teacher_id,
      is_active,
      levels (name, level_number),
      teachers (teacher_code, profiles (full_name))
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((group) => {
    const level = Array.isArray(group.levels)
      ? group.levels[0] ?? null
      : group.levels
    const teacher = Array.isArray(group.teachers)
      ? group.teachers[0] ?? null
      : group.teachers
    const teacherProfile = teacher && Array.isArray(teacher.profiles)
      ? teacher.profiles[0] ?? null
      : teacher?.profiles ?? null

    return {
      ...group,
      levels: level,
      teachers: teacher
        ? {
            ...teacher,
            profiles: teacherProfile,
          }
        : null,
    }
  }) as ActiveTeachingGroup[]
}

export async function getTeachingGroups() {
  const { data, error } = await supabase
    .from('teaching_groups')
    .select(`
      id,
      name,
      group_type,
      level_id,
      teacher_id,
      is_active,
      levels (name, level_number),
      teachers (teacher_code, profiles (full_name)),
      teaching_group_students (count)
    `)
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((group) => {
    const level = Array.isArray(group.levels)
      ? group.levels[0] ?? null
      : group.levels
    const teacher = Array.isArray(group.teachers)
      ? group.teachers[0] ?? null
      : group.teachers
    const teacherProfile = teacher && Array.isArray(teacher.profiles)
      ? teacher.profiles[0] ?? null
      : teacher?.profiles ?? null
    const membershipCount = group.teaching_group_students[0]?.count ?? 0

    return {
      ...group,
      levels: level,
      teachers: teacher
        ? {
            ...teacher,
            profiles: teacherProfile,
          }
        : null,
      student_count: membershipCount,
    }
  }) as TeachingGroup[]
}

export async function getActiveTeachers() {
  const { data, error } = await supabase
    .from('teachers')
    .select('id, teacher_code, profiles (full_name)')
    .eq('is_active', true)
    .order('teacher_code', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((teacher) => ({
    ...teacher,
    profiles: Array.isArray(teacher.profiles)
      ? teacher.profiles[0] ?? null
      : teacher.profiles,
  })) as ActiveTeacher[]
}

export async function getTeacherLevelEligibility(teacherId: string) {
  const { data, error } = await supabase
    .from('teacher_levels')
    .select('levels (id, level_number, name)')
    .eq('teacher_id', teacherId)

  if (error) {
    throw error
  }

  return (data ?? []).flatMap((eligibility) => {
    const levels = Array.isArray(eligibility.levels)
      ? eligibility.levels
      : eligibility.levels
        ? [eligibility.levels]
        : []

    return levels
  }) as TeacherLevelEligibility[]
}

export async function createTeachingGroup({
  name,
  teacherId,
  levelId,
  groupType,
}: CreateTeachingGroupInput) {
  const { data, error } = await supabase.rpc(
    'admin_create_teaching_group',
    {
      p_name: name,
      p_teacher_id: teacherId,
      p_level_id: levelId,
      p_group_type: groupType,
    },
  )

  if (error) {
    throw error
  }

  return data
}

export async function activateStudent(
  profileId: string,
  teachingGroupId: string,
) {
  const { data, error } = await supabase.rpc(
    'admin_activate_student',
    {
      p_profile_id: profileId,
      p_teaching_group_id: teachingGroupId,
    },
  )

  if (error) {
    throw error
  }

  return data
}
