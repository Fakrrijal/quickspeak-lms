import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  createTeachingGroup,
  getActiveTeachers,
  getTeacherLevelEligibility,
  getTeachingGroups,
  moveStudentBetweenTeachingGroups,
  replaceTeachingGroupTeacher,
  removeStudentFromTeachingGroup,
  setTeachingGroupStatus,
  updateTeachingGroup,
  type ActiveTeacher,
  type TeacherLevelEligibility,
  type TeachingGroup,
} from '../../services/admin.service'
import {
  assignPaidEnrollmentToTeachingGroup,
  getEligibleTeachingGroupEnrollments,
  type EligibleTeachingGroupEnrollment,
} from '../../services/admin-enrollment-assignment.service'

export const Route = createFileRoute('/admin/teaching-groups')({
  component: AdminTeachingGroupsPage,
})

function AdminTeachingGroupsPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [teachingGroups, setTeachingGroups] = useState<TeachingGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [activeTeachers, setActiveTeachers] = useState<ActiveTeacher[]>([])
  const [eligibleLevels, setEligibleLevels] = useState<TeacherLevelEligibility[]>([])
  const [groupName, setGroupName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [levelId, setLevelId] = useState('')
  const [groupType, setGroupType] = useState<'' | 'private' | 'semi_private'>('')
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [isLoadingLevels, setIsLoadingLevels] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState('')
  const [editGroupName, setEditGroupName] = useState('')
  const [editTeacherId, setEditTeacherId] = useState('')
  const [editLevelId, setEditLevelId] = useState('')
  const [editGroupType, setEditGroupType] = useState<'' | 'private' | 'semi_private'>('')
  const [editEligibleLevels, setEditEligibleLevels] = useState<TeacherLevelEligibility[]>([])
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editFormError, setEditFormError] = useState<string | null>(null)
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null)
  const [eligibleEnrollments, setEligibleEnrollments] = useState<EligibleTeachingGroupEnrollment[]>([])
  const [eligibleStudentSearch, setEligibleStudentSearch] = useState('')
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isManagingStudents, setIsManagingStudents] = useState(false)
  const [studentManagementError, setStudentManagementError] = useState<string | null>(null)
  const [movingStudentId, setMovingStudentId] = useState<string | null>(null)
  const [moveTargetGroupId, setMoveTargetGroupId] = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'private' | 'semi_private'>('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')

  useEffect(() => {
    if (loading || profileLoading) {
      return
    }

    if (!isAuthenticated) {
      navigate({ to: '/login' })
      return
    }

    if (profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    if (status !== 'active') {
      navigate({ to: '/waiting' })
    }
  }, [
    isAuthenticated,
    loading,
    navigate,
    profileError,
    profileLoading,
    status,
  ])

  const loadTeachingGroups = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setTeachingGroups(await getTeachingGroups())
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teaching groups.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const canViewTeachingGroups =
    isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (canViewTeachingGroups) {
      void loadTeachingGroups()
    }
  }, [canViewTeachingGroups, loadTeachingGroups])

  const resetCreateForm = () => {
    setGroupName('')
    setTeacherId('')
    setLevelId('')
    setGroupType('')
    setEligibleLevels([])
    setFormError(null)
  }

  const loadActiveTeachers = useCallback(async () => {
    setIsLoadingTeachers(true)
    setFormError(null)

    try {
      setActiveTeachers(await getActiveTeachers())
    } catch (loadError) {
      setFormError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load active teachers.',
      )
    } finally {
      setIsLoadingTeachers(false)
    }
  }, [])

  const openCreateForm = () => {
    resetCreateForm()
    setSuccessMessage(null)
    setIsCreateOpen(true)
    void loadActiveTeachers()
  }

  const closeCreateForm = () => {
    setIsCreateOpen(false)
    resetCreateForm()
  }

  const handleTeacherChange = async (nextTeacherId: string) => {
    setTeacherId(nextTeacherId)
    setLevelId('')
    setEligibleLevels([])
    setFormError(null)

    if (!nextTeacherId) {
      return
    }

    setIsLoadingLevels(true)

    try {
      setEligibleLevels(await getTeacherLevelEligibility(nextTeacherId))
    } catch (loadError) {
      setFormError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teacher eligibility.',
      )
    } finally {
      setIsLoadingLevels(false)
    }
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = groupName.trim()

    if (!trimmedName) {
      setFormError('Teaching group name is required.')
      return
    }

    if (!teacherId || !levelId || !groupType) {
      setFormError('Select a teacher, eligible level, and group type.')
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    setSuccessMessage(null)

    try {
      await createTeachingGroup({
        name: trimmedName,
        teacherId,
        levelId,
        groupType,
      })
      setSuccessMessage(`Teaching group “${trimmedName}” was created successfully.`)
      closeCreateForm()
      await loadTeachingGroups()
    } catch (createError) {
      setFormError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create teaching group.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetEditForm = () => {
    setEditGroupName('')
    setEditTeacherId('')
    setEditLevelId('')
    setEditGroupType('')
    setEditEligibleLevels([])
    setEditFormError(null)
  }

  const openEditForm = (group: TeachingGroup) => {
    resetEditForm()
    setSuccessMessage(null)
    setEditingGroupId(group.id)
    setEditGroupName(group.name)
    setEditTeacherId(group.teacher_id)
    setEditLevelId(group.level_id)
    setEditGroupType(group.group_type)
    setIsEditOpen(true)
    void loadActiveTeachers()
    // Load eligible levels for current teacher
    if (group.teacher_id) {
      void handleEditTeacherChange(group.teacher_id, group.level_id)
    }
  }

  const closeEditForm = () => {
    setIsEditOpen(false)
    resetEditForm()
    setEditingGroupId('')
  }

  const handleEditTeacherChange = async (nextTeacherId: string, preserveLevelId?: string) => {
    setEditTeacherId(nextTeacherId)
    setEditLevelId(preserveLevelId || '')
    setEditEligibleLevels([])
    setEditFormError(null)

    if (!nextTeacherId) {
      return
    }

    setIsLoadingLevels(true)

    try {
      setEditEligibleLevels(await getTeacherLevelEligibility(nextTeacherId))
    } catch (loadError) {
      setEditFormError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teacher eligibility.',
      )
    } finally {
      setIsLoadingLevels(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = editGroupName.trim()

    if (!trimmedName) {
      setEditFormError('Teaching group name is required.')
      return
    }

    if (!editTeacherId || !editLevelId || !editGroupType) {
      setEditFormError('Select a teacher, eligible level, and group type.')
      return
    }

    setIsSubmittingEdit(true)
    setEditFormError(null)
    setSuccessMessage(null)

    try {
      const originalGroup = teachingGroups.find((group) => group.id === editingGroupId)
      if (originalGroup
        && originalGroup.name === trimmedName
        && originalGroup.level_id === editLevelId
        && originalGroup.group_type === editGroupType
        && originalGroup.teacher_id !== editTeacherId) {
        await replaceTeachingGroupTeacher(editingGroupId, editTeacherId)
      } else {
        await updateTeachingGroup({
          teachingGroupId: editingGroupId,
          name: trimmedName,
          teacherId: editTeacherId,
          levelId: editLevelId,
          groupType: editGroupType,
        })
      }
      setSuccessMessage(`Teaching group “${trimmedName}” was updated successfully.`)
      closeEditForm()
      await loadTeachingGroups()
    } catch (updateError) {
      setEditFormError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update teaching group.',
      )
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleToggleStatus = async (group: TeachingGroup) => {
    const newStatus = !group.is_active
    const action = newStatus ? 'reactivate' : 'deactivate'

    try {
      await setTeachingGroupStatus(group.id, newStatus)
      setSuccessMessage(`Teaching group ${action}d successfully.`)
      await loadTeachingGroups()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : `Unable to ${action} teaching group.`,
      )
    }
  }

  const openManageStudents = async (group: TeachingGroup) => {
    setManagingGroupId(group.id)
    setEligibleEnrollments([])
    setEligibleStudentSearch('')
    setStudentManagementError(null)
    setSuccessMessage(null)
    setIsLoadingStudents(true)

    try {
      setEligibleEnrollments(await getEligibleTeachingGroupEnrollments(group.level_id, group.group_type))
    } catch (loadError) {
      setStudentManagementError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load active students.',
      )
    } finally {
      setIsLoadingStudents(false)
    }
  }

  const closeManageStudents = () => {
    setManagingGroupId(null)
    setEligibleEnrollments([])
    setEligibleStudentSearch('')
    setStudentManagementError(null)
    setMovingStudentId(null)
    setMoveTargetGroupId('')
  }

  const handleAssignEnrollment = async (
    group: TeachingGroup,
    enrollment: EligibleTeachingGroupEnrollment,
  ) => {
    setIsManagingStudents(true)
    setStudentManagementError(null)
    setSuccessMessage(null)

    try {
      await assignPaidEnrollmentToTeachingGroup(enrollment.id, group.id)
      await loadTeachingGroups()
      setEligibleEnrollments(await getEligibleTeachingGroupEnrollments(group.level_id, group.group_type))
      setSuccessMessage('Enrollment assigned to the teaching group successfully.')
    } catch (assignError) {
      setStudentManagementError(
        assignError instanceof Error
          ? assignError.message
          : 'Unable to assign student.',
      )
    } finally {
      setIsManagingStudents(false)
    }
  }

  const handleRemoveStudent = async (group: TeachingGroup, studentId: string) => {
    setIsManagingStudents(true)
    setStudentManagementError(null)
    setSuccessMessage(null)

    try {
      await removeStudentFromTeachingGroup(group.id, studentId)
      await loadTeachingGroups()
      setSuccessMessage('Student removed successfully.')
    } catch (removeError) {
      setStudentManagementError(
        removeError instanceof Error
          ? removeError.message
          : 'Unable to remove student.',
      )
    } finally {
      setIsManagingStudents(false)
    }
  }

  const handleMoveStudent = async (group: TeachingGroup, studentId: string) => {
    if (!moveTargetGroupId) return
    const target = teachingGroups.find((candidate) => candidate.id === moveTargetGroupId)
    if (!target || !window.confirm(`Move this student to ${target.name}?`)) return

    setIsManagingStudents(true)
    setStudentManagementError(null)
    setSuccessMessage(null)
    try {
      await moveStudentBetweenTeachingGroups(group.id, target.id, studentId)
      await loadTeachingGroups()
      setMovingStudentId(null)
      setMoveTargetGroupId('')
      setSuccessMessage('Student moved to the teaching group successfully.')
    } catch (moveError) {
      setStudentManagementError(moveError instanceof Error ? moveError.message : 'Unable to move student.')
    } finally {
      setIsManagingStudents(false)
    }
  }

  const managingGroup = managingGroupId
    ? teachingGroups.find((group) => group.id === managingGroupId) ?? null
    : null
  const normalizedEligibleStudentSearch = eligibleStudentSearch.trim().toLowerCase()
  const filteredEligibleEnrollments = eligibleEnrollments.filter((enrollment) => {
    if (!normalizedEligibleStudentSearch) return true

    const student = enrollment.students
    return [student?.profiles?.full_name, student?.student_code]
      .some((value) => value?.toLowerCase().includes(normalizedEligibleStudentSearch))
  })
  const levelOptions = [...new Map(
    teachingGroups
      .filter((group) => group.levels)
      .map((group) => [group.level_id, { id: group.level_id, ...group.levels! }]),
  ).values()].sort((left, right) => left.level_number - right.level_number)
  const normalizedGroupSearch = groupSearch.trim().toLowerCase()
  const filteredTeachingGroups = teachingGroups.filter((group) => {
    const matchesSearch = !normalizedGroupSearch || [
      group.name,
      group.teachers?.profiles?.full_name,
      group.teachers?.teacher_code,
      ...group.memberships.flatMap((membership) => [
        membership.students?.profiles?.full_name,
        membership.students?.student_code,
      ]),
    ].some((value) => value?.toLowerCase().includes(normalizedGroupSearch))
    const matchesLevel = !levelFilter || group.level_id === levelFilter
    const matchesType = !typeFilter || group.group_type === typeFilter
    const matchesStatus = !statusFilter
      || (statusFilter === 'active' ? group.is_active : !group.is_active)

    return matchesSearch && matchesLevel && matchesType && matchesStatus
  })
  const hasActiveGroupFilters = Boolean(
    groupSearch.trim() || levelFilter || typeFilter || statusFilter,
  )

  const clearGroupFilters = () => {
    setGroupSearch('')
    setLevelFilter('')
    setTypeFilter('')
    setStatusFilter('')
  }

  if (loading || profileLoading) {
    return <p>Loading...</p>
  }

  if (!isAuthenticated || profileError || status === null || status !== 'active') {
    return null
  }

  if (role !== 'admin') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You do not have permission to view teaching groups.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900">
          Admin Teaching Groups
        </h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Create Teaching Group
        </button>
      </div>

      {successMessage && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      {isCreateOpen && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-slate-900">Create Teaching Group</h3>
            <button
              type="button"
              onClick={closeCreateForm}
              disabled={isSubmitting}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <form className="mt-5 grid gap-5 md:grid-cols-2" onSubmit={handleCreate}>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Group Name
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Teacher
              <select
                value={teacherId}
                onChange={(event) => void handleTeacherChange(event.target.value)}
                disabled={isLoadingTeachers || isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">{isLoadingTeachers ? 'Loading teachers...' : 'Select a teacher'}</option>
                {activeTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.profiles?.full_name ?? 'Unknown teacher'} — {teacher.teacher_code}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Level
              <select
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
                disabled={!teacherId || isLoadingLevels || isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">
                  {!teacherId
                    ? 'Select a teacher first'
                    : isLoadingLevels
                      ? 'Loading eligible levels...'
                      : 'Select an eligible level'}
                </option>
                {eligibleLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Type
              <select
                value={groupType}
                onChange={(event) => setGroupType(event.target.value as '' | 'private' | 'semi_private')}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">Select a type</option>
                <option value="private">Private</option>
                <option value="semi_private">Semi-private</option>
              </select>
            </label>

            {formError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
                {formError}
              </p>
            )}

            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Teaching Group'}
              </button>
              <button
                type="button"
                onClick={closeCreateForm}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isEditOpen && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold text-slate-900">Edit Teaching Group</h3>
            <button
              type="button"
              onClick={closeEditForm}
              disabled={isSubmittingEdit}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <form className="mt-5 grid gap-5 md:grid-cols-2" onSubmit={handleUpdate}>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Group Name
              <input
                value={editGroupName}
                onChange={(event) => setEditGroupName(event.target.value)}
                disabled={isSubmittingEdit}
                className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Teacher
              <select
                value={editTeacherId}
                onChange={(event) => void handleEditTeacherChange(event.target.value)}
                disabled={isLoadingTeachers || isSubmittingEdit}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">{isLoadingTeachers ? 'Loading teachers...' : 'Select a teacher'}</option>
                {activeTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.profiles?.full_name ?? 'Unknown teacher'} — {teacher.teacher_code}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Level
              <select
                value={editLevelId}
                onChange={(event) => setEditLevelId(event.target.value)}
                disabled={!editTeacherId || isLoadingLevels || isSubmittingEdit}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">
                  {!editTeacherId
                    ? 'Select a teacher first'
                    : isLoadingLevels
                      ? 'Loading eligible levels...'
                      : 'Select an eligible level'}
                </option>
                {editEligibleLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Type
              <select
                value={editGroupType}
                onChange={(event) => setEditGroupType(event.target.value as '' | 'private' | 'semi_private')}
                disabled={isSubmittingEdit}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">Select a type</option>
                <option value="private">Private</option>
                <option value="semi_private">Semi-private</option>
              </select>
            </label>

            {editFormError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
                {editFormError}
              </p>
            )}

            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingEdit ? 'Updating...' : 'Update Teaching Group'}
              </button>
              <button
                type="button"
                onClick={closeEditForm}
                disabled={isSubmittingEdit}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {managingGroup && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Manage Students: {managingGroup.name}
              </h3>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                <div><dt className="font-medium text-slate-700">Teacher</dt><dd>{managingGroup.teachers?.profiles?.full_name ?? 'Not Assigned'}</dd><dd className="text-xs text-slate-500">{managingGroup.teachers?.teacher_code ?? ''}</dd></div>
                <div><dt className="font-medium text-slate-700">Level</dt><dd>{managingGroup.levels?.name ?? 'Unknown level'}</dd></div>
                <div><dt className="font-medium text-slate-700">Type</dt><dd>{managingGroup.group_type === 'private' ? 'Private' : 'Semi-private'}</dd></div>
                <div><dt className="font-medium text-slate-700">Capacity</dt><dd>{managingGroup.student_count} / {managingGroup.group_type === 'private' ? 1 : 4}</dd></div>
              </dl>
            </div>
            <button
              type="button"
              onClick={closeManageStudents}
              disabled={isManagingStudents}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Close
            </button>
          </div>

          {studentManagementError && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {studentManagementError}
            </p>
          )}

          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">Eligible Students</h4>
            {!managingGroup.is_active ? (
              <p className="mt-2 text-sm text-slate-600">This teaching group is inactive.</p>
            ) : managingGroup.student_count >= (managingGroup.group_type === 'private' ? 1 : 4) ? (
              <p className="mt-2 text-sm text-slate-600">This teaching group is at capacity.</p>
            ) : isLoadingStudents ? (
              <p className="mt-2 text-sm text-slate-600">Loading eligible paid enrollments...</p>
            ) : eligibleEnrollments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No eligible students available.</p>
            ) : (
              <>
                <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
                  Search eligible students
                  <input
                    value={eligibleStudentSearch}
                    onChange={(event) => setEligibleStudentSearch(event.target.value)}
                    placeholder="Search by name or student code"
                    disabled={isManagingStudents}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-100"
                  />
                </label>
                {filteredEligibleEnrollments.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No eligible students match your search.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {filteredEligibleEnrollments.map((enrollment) => {
                  const placements = enrollment.students?.teaching_group_students
                    .flatMap((membership) => membership.teaching_groups?.name ?? []) ?? []

                  return (
                    <li key={enrollment.id} className="flex flex-wrap items-center justify-between gap-4 p-3">
                      <div className="text-sm text-slate-700">
                        <p className="font-medium text-slate-900">
                          {enrollment.students?.profiles?.full_name ?? 'Unknown student'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {enrollment.students?.student_code ?? 'No student code'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {managingGroup.levels?.name ?? 'Unknown level'} · {enrollment.package_type === 'private' ? 'Private' : 'Semi-private'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {enrollment.status === 'payment_approved' ? 'Payment Approved' : 'Teacher Assignment'}
                        </p>
                        {placements.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Current placement: {placements.join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAssignEnrollment(managingGroup, enrollment)}
                        disabled={isManagingStudents}
                        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {isManagingStudents ? 'Adding...' : 'Add'}
                      </button>
                    </li>
                  )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">Current Students</h4>
            {managingGroup.memberships.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No students assigned.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {managingGroup.memberships.map((membership) => (
                  <li key={membership.student_id} className="flex items-center justify-between gap-4 p-3">
                    <div className="text-sm text-slate-700">
                      <p className="font-medium text-slate-900">
                        {membership.students?.profiles?.full_name ?? 'Unknown student'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {membership.students?.student_code ?? 'No student code'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {managingGroup.levels?.name ?? 'Unknown level'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {movingStudentId === membership.student_id ? <>
                        <select value={moveTargetGroupId} onChange={(event) => setMoveTargetGroupId(event.target.value)} disabled={isManagingStudents} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
                          <option value="">Select compatible group</option>
                          {teachingGroups.filter((candidate) => candidate.id !== managingGroup.id && candidate.is_active && candidate.level_id === managingGroup.level_id && candidate.group_type === managingGroup.group_type && candidate.student_count < (candidate.group_type === 'private' ? 1 : 4)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                        </select>
                        <button type="button" onClick={() => void handleMoveStudent(managingGroup, membership.student_id)} disabled={!moveTargetGroupId || isManagingStudents} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Move Student</button>
                        <button type="button" onClick={() => { setMovingStudentId(null); setMoveTargetGroupId('') }} disabled={isManagingStudents} className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                      </> : <button type="button" onClick={() => { setMovingStudentId(membership.student_id); setMoveTargetGroupId('') }} disabled={isManagingStudents} className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">Move</button>}
                      <button type="button" onClick={() => void handleRemoveStudent(managingGroup, membership.student_id)} disabled={isManagingStudents} className="rounded px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,12rem))_auto] lg:items-end">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Search
            <input
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
              placeholder="Search group, teacher, student, or code..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Level
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">All Levels</option>
              {levelOptions.map((level) => (
                <option key={level.id} value={level.id}>{level.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Type
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as '' | 'private' | 'semi_private')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">All Types</option>
              <option value="private">Private</option>
              <option value="semi_private">Semi-private</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | 'active' | 'inactive')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {hasActiveGroupFilters && (
            <button
              type="button"
              onClick={clearGroupFilters}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm">
        {isLoading && (
          <p className="p-6 text-sm text-slate-600">Loading teaching groups...</p>
        )}

        {error && (
          <p className="m-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Unable to load teaching groups: {error}
          </p>
        )}

        {!isLoading && !error && teachingGroups.length === 0 && (
          <p className="p-6 text-sm text-slate-600">There are no teaching groups.</p>
        )}

        {!isLoading && !error && teachingGroups.length > 0 && filteredTeachingGroups.length === 0 && (
          <p className="p-6 text-sm text-slate-600">No teaching groups match the current filters.</p>
        )}

        {!isLoading && !error && filteredTeachingGroups.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">Group</th>
                  <th className="px-6 py-3 font-semibold">Teacher</th>
                  <th className="px-6 py-3 font-semibold">Level</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Students</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTeachingGroups.map((group) => {
                  const capacity = group.group_type === 'private' ? 1 : 4
                  const typeLabel = group.group_type === 'private'
                    ? 'Private'
                    : 'Semi-private'
                  const availableSeats = Math.max(capacity - group.student_count, 0)
                  const isFull = group.student_count >= capacity

                  return (
                    <tr key={group.id} className="text-slate-700">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{group.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{group.teachers?.profiles?.full_name ?? 'Not Assigned'}</p>
                        {group.teachers?.teacher_code && (
                          <p className="mt-1 text-xs text-slate-500">{group.teachers.teacher_code}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {group.levels?.name ?? 'Unknown level'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          group.group_type === 'private'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-sky-50 text-sky-700'
                        }`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{group.student_count} / {capacity}</p>
                        <p className={`mt-1 text-xs ${isFull ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
                          {isFull ? 'Full' : `${availableSeats} seat${availableSeats === 1 ? '' : 's'} available`}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          group.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {group.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void openManageStudents(group)}
                            className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Manage Students
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(group)}
                            className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(group)}
                            className={`rounded px-3 py-1.5 text-sm font-medium ${
                              group.is_active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {group.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
