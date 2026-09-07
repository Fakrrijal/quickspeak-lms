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
  const { data, error } = await supabase
    .from('registration_applications')
    .select('submitted_at, student_class_type, profiles!registration_applications_profile_id_fkey!inner (id, full_name, email, phone, role, status), levels:student_starting_level_id (id, level_number, name)')
    .eq('role', 'student')
    .eq('profiles.role', 'student')
    .eq('profiles.status', 'waiting')
    .order('submitted_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).flatMap((application) => {
    const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles
    const level = Array.isArray(application.levels) ? application.levels[0] : application.levels
    return profile ? [{ id: profile.id, full_name: profile.full_name, email: profile.email, phone: profile.phone, status: profile.status, registration_date: application.submitted_at, starting_level: level ?? null, class_type: application.student_class_type as ClassType | null }] : []
  }) as WaitingStudent[]
}

export async function getWaitingTeachers() {
  const { data, error } = await supabase
    .from('registration_applications')
    .select('submitted_at, teacher_class_type, profiles!registration_applications_profile_id_fkey!inner (id, full_name, email, phone, role, status), registration_application_supported_levels (levels (id, level_number, name))')
    .eq('role', 'teacher')
    .eq('profiles.role', 'teacher')
    .eq('profiles.status', 'waiting')
    .order('submitted_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).flatMap((application) => {
    const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles
    if (!profile) return []
    const supportedLevels = (application.registration_application_supported_levels ?? []).flatMap((item) => {
      const level = Array.isArray(item.levels) ? item.levels[0] : item.levels
      return level ? [level] : []
    })
    return [{ id: profile.id, full_name: profile.full_name, email: profile.email, phone: profile.phone, status: profile.status, registration_date: application.submitted_at, class_type: application.teacher_class_type as ClassType | null, supported_levels: supportedLevels }]
  }) as WaitingTeacher[]
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

export async function getAdminStudents() {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      student_code,
      is_active,
      profiles (id, full_name, email, phone, status, created_at),
      levels!students_level_id_fkey (id, name, level_number),
      teaching_group_students (
        teaching_groups (name, group_type, is_active)
      )
    `)
    .order('student_code', { ascending: true })

  if (error) {
    throw error
  }

  const profileIds = (data ?? []).flatMap((student) => {
    const profile = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles
    return profile ? [profile.id] : []
  })
  const { data: applications, error: applicationsError } = profileIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('registration_applications')
      .select('profile_id, student_class_type')
      .eq('role', 'student')
      .in('profile_id', profileIds)

  if (applicationsError) {
    throw applicationsError
  }

  const classTypeByProfileId = new Map(
    (applications ?? []).map((application) => [application.profile_id, application.student_class_type as ClassType | null]),
  )

  return (data ?? []).map((student) => {
    const profile = Array.isArray(student.profiles)
      ? student.profiles[0] ?? null
      : student.profiles
    const level = Array.isArray(student.levels)
      ? student.levels[0] ?? null
      : student.levels
    const teachingGroupNames = (student.teaching_group_students ?? []).flatMap((membership) => {
      const group = Array.isArray(membership.teaching_groups)
        ? membership.teaching_groups[0] ?? null
        : membership.teaching_groups

      return group?.is_active ? [group.name] : []
    })
    const legacyClassTypes = (student.teaching_group_students ?? []).flatMap((membership) => {
      const group = Array.isArray(membership.teaching_groups)
        ? membership.teaching_groups[0] ?? null
        : membership.teaching_groups

      return group?.is_active && (group.group_type === 'private' || group.group_type === 'semi_private')
        ? [group.group_type]
        : []
    })
    const registrationClassType = profile ? classTypeByProfileId.get(profile.id) : null

    return {
      ...student,
      profile,
      level,
      teaching_group_names: [...new Set(teachingGroupNames)],
      class_types: registrationClassType
        ? [registrationClassType]
        : [...new Set(legacyClassTypes)],
    }
  }) as AdminStudentDirectoryItem[]
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

export async function getTeachers() {
  const { data, error } = await supabase
    .from('teachers')
    .select(`
      id,
      teacher_code,
      is_active,
      profiles (id, full_name, email, phone, created_at),
      teacher_levels!teacher_levels_teacher_id_fkey (levels (id, level_number, name)),
      teaching_groups (name, group_type, is_active)
    `)
    .order('teacher_code', { ascending: true })

  if (error) {
    throw error
  }

  const profileIds = (data ?? []).flatMap((teacher) => {
    const profile = Array.isArray(teacher.profiles) ? teacher.profiles[0] : teacher.profiles
    return profile ? [profile.id] : []
  })
  const { data: applications, error: applicationsError } = profileIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('registration_applications')
      .select('profile_id, teacher_class_type')
      .eq('role', 'teacher')
      .in('profile_id', profileIds)

  if (applicationsError) {
    throw applicationsError
  }

  const applicationByProfileId = new Map((applications ?? []).map((application) => [application.profile_id, application]))

  return (data ?? []).map((teacher) => {
    const profile = Array.isArray(teacher.profiles)
      ? teacher.profiles[0] ?? null
      : teacher.profiles
    const teacherLevels = (teacher.teacher_levels ?? []).flatMap((eligibility) => {
      const levels = Array.isArray(eligibility.levels)
        ? eligibility.levels
        : eligibility.levels
          ? [eligibility.levels]
          : []

      return levels
    })
    const application = profile ? applicationByProfileId.get(profile.id) : null
    const activeTeachingGroupNames = (teacher.teaching_groups ?? []).flatMap((group) => (
      group.is_active ? [group.name] : []
    ))
    const legacyClassTypes = (teacher.teaching_groups ?? []).flatMap((group) => (
      group.is_active && (group.group_type === 'private' || group.group_type === 'semi_private')
        ? [group.group_type]
        : []
    ))
    const registrationClassType = application?.teacher_class_type as ClassType | null | undefined

    return {
      ...teacher,
      profiles: profile,
      eligible_levels: teacherLevels,
      active_teaching_group_names: [...new Set(activeTeachingGroupNames)],
      active_class_types: registrationClassType
        ? [registrationClassType]
        : [...new Set(legacyClassTypes)],
    }
  }) as AdminTeacher[]
}

export async function getLevels() {
  const { data, error } = await supabase
    .from('levels')
    .select('id, level_number, name')
    .order('level_number', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ActiveLevel[]
}

export async function setTeacherStatus(
  teacherId: string,
  isActive: boolean,
) {
  const { data, error } = await supabase.rpc('admin_set_teacher_status', {
    p_teacher_id: teacherId,
    p_is_active: isActive,
  })

  if (error) {
    throw error
  }

  return data
}

export async function deactivateStudent(studentId: string) {
  const { data, error } = await supabase.rpc('admin_deactivate_student', {
    p_student_id: studentId,
  })

  if (error) {
    throw error
  }

  return data
}

export async function deactivateTeacher(teacherId: string) {
  const { data, error } = await supabase.rpc('admin_deactivate_teacher', {
    p_teacher_id: teacherId,
  })

  if (error) {
    throw error
  }

  return data
}

export async function addTeacherLevel(teacherId: string, levelId: string) {
  const { data, error } = await supabase.rpc('admin_add_teacher_level', {
    p_teacher_id: teacherId,
    p_level_id: levelId,
  })

  if (error) {
    throw error
  }

  return data
}

export async function removeTeacherLevel(teacherId: string, levelId: string) {
  const { data, error } = await supabase.rpc('admin_remove_teacher_level', {
    p_teacher_id: teacherId,
    p_level_id: levelId,
  })

  if (error) {
    throw error
  }

  return data
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

export async function moveStudentBetweenTeachingGroups(
  sourceTeachingGroupId: string,
  targetTeachingGroupId: string,
  studentId: string,
) {
  const { data, error } = await supabase.rpc('admin_move_student_between_teaching_groups', {
    p_source_teaching_group_id: sourceTeachingGroupId,
    p_target_teaching_group_id: targetTeachingGroupId,
    p_student_id: studentId,
  })

  if (error) throw error
  return data
}

export async function replaceTeachingGroupTeacher(
  teachingGroupId: string,
  teacherId: string,
) {
  const { data, error } = await supabase.rpc('admin_replace_teaching_group_teacher', {
    p_teaching_group_id: teachingGroupId,
    p_teacher_id: teacherId,
  })

  if (error) throw error
  return data
}

export async function approveStudent(profileId: string, levelId: string) {
  const { data, error } = await supabase.rpc(
    'admin_approve_student',
    {
      p_profile_id: profileId,
      p_level_id: levelId,
    },
  )

  if (error) {
    throw error
  }

  return data
}

export async function updateStudentLevel(studentId: string, levelId: string) {
  const { data, error } = await supabase.rpc('admin_update_student_level', {
    p_student_id: studentId,
    p_level_id: levelId,
  })

  if (error) {
    throw error
  }

  return data
}

export async function getStudentProtectedEnrollments(studentId: string) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, status, level_id, levels (id, level_number, name)')
    .eq('student_id', studentId)
    .in('status', [
      'pending',
      'payment_pending',
      'payment_submitted',
      'payment_rejected',
      'payment_approved',
      'teacher_assignment',
      'active',
    ])

  if (error) {
    throw error
  }

  return (data ?? []).map((enrollment) => ({
    ...enrollment,
    level: Array.isArray(enrollment.levels)
      ? enrollment.levels[0] ?? null
      : enrollment.levels,
  })) as StudentProtectedEnrollment[]
}

export async function correctStudentLevel(studentId: string, levelId: string) {
  const { data, error } = await supabase.rpc('admin_correct_student_level', {
    p_student_id: studentId,
    p_level_id: levelId,
  })

  if (error) {
    throw error
  }

  return data
}

export type AdminDashboardSummary = {
  totalStudents: number
  activeStudents: number
  waitingStudents: number
  totalTeachers: number
  activeTeachers: number
  waitingTeachers: number
  activeTeachingGroups: number
  pendingPaymentVerifications: number
  approvedEnrollmentsAwaitingAssignment: number
}

async function getCount(
  query: PromiseLike<{ count: number | null; error: unknown }>,
) {
  const { count, error } = await query

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const [
    totalStudents,
    activeStudents,
    waitingStudents,
    totalTeachers,
    activeTeachers,
    waitingTeachers,
    activeTeachingGroups,
    pendingPaymentVerifications,
    approvedEnrollmentsAwaitingAssignment,
  ] = await Promise.all([
    getCount(supabase.from('students').select('id', { count: 'exact', head: true })),
    getCount(supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true)),
    getCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'waiting')),
    getCount(supabase.from('teachers').select('id', { count: 'exact', head: true })),
    getCount(supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true)),
    getCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'waiting')),
    getCount(supabase.from('teaching_groups').select('id', { count: 'exact', head: true }).eq('is_active', true)),
    getCount(supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'proof_submitted')),
    getCount(supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('status', ['payment_approved', 'teacher_assignment'])),
  ])

  return {
    totalStudents,
    activeStudents,
    waitingStudents,
    totalTeachers,
    activeTeachers,
    waitingTeachers,
    activeTeachingGroups,
    pendingPaymentVerifications,
    approvedEnrollmentsAwaitingAssignment,
  }
}
