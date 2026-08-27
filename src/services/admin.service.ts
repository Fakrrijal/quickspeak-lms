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

export type UpdateTeachingGroupInput = {
  teachingGroupId: string
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
      teaching_group_students (
        student_id,
        students (id, student_code, profiles (full_name))
      )
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
    const membershipCount = group.teaching_group_students?.length ?? 0
    const memberships = group.teaching_group_students
      .filter((membership) => membership.student_id)
      .map((membership) => {
        const student = Array.isArray(membership.students)
          ? membership.students[0] ?? null
          : membership.students
        const profile = student && Array.isArray(student.profiles)
          ? student.profiles[0] ?? null
          : student?.profiles ?? null

        return {
          student_id: membership.student_id,
          students: student
            ? {
                ...student,
                profiles: profile,
              }
            : null,
        }
      })

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
      memberships,
    }
  }) as TeachingGroup[]
}

export async function getActiveStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('id, student_code, profiles (full_name)')
    .eq('is_active', true)
    .order('student_code', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((student) => ({
    ...student,
    profiles: Array.isArray(student.profiles)
      ? student.profiles[0] ?? null
      : student.profiles,
  })) as ActiveStudent[]
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

export async function updateTeachingGroup({
  teachingGroupId,
  name,
  teacherId,
  levelId,
  groupType,
}: UpdateTeachingGroupInput) {
  const { data, error } = await supabase.rpc(
    'admin_update_teaching_group',
    {
      p_teaching_group_id: teachingGroupId,
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

export async function setTeachingGroupStatus(
  teachingGroupId: string,
  isActive: boolean,
) {
  const { data, error } = await supabase.rpc(
    'admin_set_teaching_group_status',
    {
      p_teaching_group_id: teachingGroupId,
      p_is_active: isActive,
    },
  )

  if (error) {
    throw error
  }

  return data
}

export async function assignStudentToTeachingGroup(
  teachingGroupId: string,
  studentId: string,
) {
  const { data, error } = await supabase.rpc(
    'admin_assign_student_to_teaching_group',
    {
      p_teaching_group_id: teachingGroupId,
      p_student_id: studentId,
    },
  )

  if (error) {
    throw error
  }

  return data
}

export async function removeStudentFromTeachingGroup(
  teachingGroupId: string,
  studentId: string,
) {
  const { data, error } = await supabase.rpc(
    'admin_remove_student_from_teaching_group',
    {
      p_teaching_group_id: teachingGroupId,
      p_student_id: studentId,
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
