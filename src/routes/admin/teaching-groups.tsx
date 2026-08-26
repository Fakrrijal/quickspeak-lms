import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  createTeachingGroup,
  getActiveTeachers,
  getTeacherLevelEligibility,
  getTeachingGroups,
  updateTeachingGroup,
  type ActiveTeacher,
  type TeacherLevelEligibility,
  type TeachingGroup,
} from '../../services/admin.service'

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
      await updateTeachingGroup({
        teachingGroupId: editingGroupId,
        name: trimmedName,
        teacherId: editTeacherId,
        levelId: editLevelId,
        groupType: editGroupType,
      })
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

      <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
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

        {!isLoading && !error && teachingGroups.length > 0 && (
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
                {teachingGroups.map((group) => {
                  const capacity = group.group_type === 'private' ? 1 : 4
                  const typeLabel = group.group_type === 'private'
                    ? 'Private'
                    : 'Semi-private'

                  return (
                    <tr key={group.id} className="text-slate-700">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {group.name}
                      </td>
                      <td className="px-6 py-4">
                        <p>{group.teachers?.profiles?.full_name ?? 'Unknown teacher'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.teachers?.teacher_code ?? 'No teacher code'}
                        </p>
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
                        {group.student_count} / {capacity}
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
                        <button
                          type="button"
                          onClick={() => openEditForm(group)}
                          className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
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
