import { supabase } from '../lib/supabase'

export type ApprovedEnrollment = {
  id: string
  status: 'payment_approved' | 'teacher_assignment'
  level_id: string
  package_type: 'private' | 'semi_private'
  created_at: string
  updated_at: string
  students: {
    id: string
    student_code: string
    profiles: {
      full_name: string
    } | null
    teaching_group_students: ExistingTeachingGroupMembership[]
  } | null
  levels: {
    name: string
    level_number: number
  } | null
}

export type ExistingTeachingGroupMembership = {
  id: string
  teaching_group_id: string
  joined_at: string
  teaching_groups: {
    id: string
    name: string
    level_id: string
    teacher_id: string
    group_type: 'private' | 'semi_private'
    is_active: boolean
    teaching_group_students: { id: string }[]
    teachers: {
      teacher_code: string
      profiles: {
        full_name: string
      } | null
    } | null
  } | null
}

export type AssignmentCandidateGroup = {
  id: string
  name: string
  teacher_id: string
  group_type: 'private' | 'semi_private'
  teaching_group_students: { id: string }[]
  teachers: {
    teacher_code: string
    profiles: {
      full_name: string
    } | null
  } | null
}

export type EligibleTeachingGroupEnrollment = {
  id: string
  status: 'payment_approved' | 'teacher_assignment'
  level_id: string
  package_type: 'private' | 'semi_private'
  students: {
    id: string
    student_code: string
    profiles: {
      full_name: string
    } | null
    teaching_group_students: ExistingTeachingGroupMembership[]
  } | null
}

export type PaidEnrollmentAssignment = {
  enrollment_id: string
  student_id: string
  teaching_group_id: string
  teacher_id: string
  enrollment_status: string
}

export type ActiveEnrollmentAssignmentException = {
  enrollment_id: string
  student_id: string
  student_code: string
  student_display_name: string
  level_id: string
  level_name: string
  level_number: number
  package_type: 'private' | 'semi_private'
  teaching_group_id: string
  teaching_group_name: string
  teacher_id: string
  teacher_code: string
  assignment_state: 'missing'
}

function firstRelated<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getPaymentApprovedEnrollments() {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      status,
      level_id,
      package_type,
      created_at,
      updated_at,
      students (
        id,
        student_code,
        profiles (full_name),
        teaching_group_students (
          id,
          teaching_group_id,
          joined_at,
          teaching_groups (
            id,
            name,
            level_id,
            teacher_id,
            group_type,
            is_active,
            teaching_group_students (id),
            teachers (teacher_code, profiles (full_name))
          )
        )
      ),
      levels (name, level_number)
    `)
    .in('status', ['payment_approved', 'teacher_assignment'])
    .order('updated_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((enrollment) => {
    const student = firstRelated(enrollment.students)
    const level = firstRelated(enrollment.levels)
    const memberships = (student?.teaching_group_students ?? []).map((membership) => {
      const group = firstRelated(membership.teaching_groups)
      const teacher = firstRelated(group?.teachers ?? null)

      return {
        ...membership,
        teaching_groups: group
          ? {
              ...group,
              teaching_group_students: group.teaching_group_students ?? [],
              teachers: teacher
                ? {
                    ...teacher,
                    profiles: firstRelated(teacher.profiles),
                  }
                : null,
            }
          : null,
      }
    })

    return {
      ...enrollment,
      students: student
        ? {
            ...student,
            profiles: firstRelated(student.profiles),
            teaching_group_students: memberships,
          }
        : null,
      levels: level,
    }
  }) as ApprovedEnrollment[]
}

export async function getAssignmentCandidateGroups(
  levelId: string,
  groupType: 'private' | 'semi_private',
) {
  const { data, error } = await supabase
    .from('teaching_groups')
    .select(`
      id,
      name,
      teacher_id,
      group_type,
      teaching_group_students (id),
      teachers (teacher_code, profiles (full_name))
    `)
    .eq('is_active', true)
    .eq('level_id', levelId)
    .eq('group_type', groupType)
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((group) => {
    const teacher = firstRelated(group.teachers)

    return {
      ...group,
      teaching_group_students: group.teaching_group_students ?? [],
      teachers: teacher
        ? {
            ...teacher,
            profiles: firstRelated(teacher.profiles),
          }
        : null,
    }
  }) as AssignmentCandidateGroup[]
}

export async function getEligibleTeachingGroupEnrollments(
  levelId: string,
  groupType: 'private' | 'semi_private',
) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      status,
      level_id,
      package_type,
      students!inner (
        id,
        student_code,
        is_active,
        profiles (full_name),
        teaching_group_students (
          id,
          teaching_group_id,
          joined_at,
          teaching_groups (
            id,
            name,
            level_id,
            teacher_id,
            group_type,
            is_active,
            teaching_group_students (id),
            teachers (teacher_code, profiles (full_name))
          )
        )
      )
    `)
    .in('status', ['payment_approved', 'teacher_assignment'])
    .eq('level_id', levelId)
    .eq('package_type', groupType)
    .eq('students.is_active', true)
    .order('updated_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((enrollment) => {
    const student = firstRelated(enrollment.students)
    const memberships = (student?.teaching_group_students ?? []).map((membership) => {
      const group = firstRelated(membership.teaching_groups)
      const teacher = firstRelated(group?.teachers ?? null)

      return {
        ...membership,
        teaching_groups: group
          ? {
              ...group,
              teaching_group_students: group.teaching_group_students ?? [],
              teachers: teacher
                ? {
                    ...teacher,
                    profiles: firstRelated(teacher.profiles),
                  }
                : null,
            }
          : null,
      }
    })

    return {
      ...enrollment,
      students: student
        ? {
            ...student,
            profiles: firstRelated(student.profiles),
            teaching_group_students: memberships,
          }
        : null,
    }
  }) as EligibleTeachingGroupEnrollment[]
}

export async function assignPaidEnrollmentToTeachingGroup(
  enrollmentId: string,
  teachingGroupId: string,
) {
  const { data, error } = await supabase.rpc(
    'admin_assign_paid_enrollment_to_teaching_group',
    {
      p_enrollment_id: enrollmentId,
      p_teaching_group_id: teachingGroupId,
    },
  )

  if (error) {
    throw error
  }

  return (Array.isArray(data) ? data[0] : data) as PaidEnrollmentAssignment
}

export async function adoptExistingPaidEnrollmentAssignment(enrollmentId: string) {
  const { data, error } = await supabase.rpc(
    'admin_adopt_existing_paid_enrollment_assignment',
    {
      p_enrollment_id: enrollmentId,
    },
  )

  if (error) {
    throw error
  }

  return (Array.isArray(data) ? data[0] : data) as PaidEnrollmentAssignment
}

export async function getActiveEnrollmentAssignmentExceptions() {
  const { data, error } = await supabase.rpc(
    'admin_get_active_enrollment_assignment_exceptions',
  )

  if (error) {
    throw error
  }

  return (data ?? []) as ActiveEnrollmentAssignmentException[]
}

export async function reconcileActiveEnrollmentTeachingGroupAssignment(
  enrollmentId: string,
  teachingGroupId: string,
) {
  const { data, error } = await supabase.rpc(
    'admin_reconcile_active_enrollment_teaching_group_assignment',
    {
      p_enrollment_id: enrollmentId,
      p_teaching_group_id: teachingGroupId,
    },
  )

  if (error) {
    throw error
  }

  return (Array.isArray(data) ? data[0] : data) as Pick<
    ActiveEnrollmentAssignmentException,
    'enrollment_id' | 'teaching_group_id'
  >
}
