import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  addTeacherLevel,
  getLevels,
  getTeachers,
  removeTeacherLevel,
  setTeacherStatus,
  type AdminTeacher,
  type TeacherLevelEligibility,
} from '../../services/admin.service'

export const Route = createFileRoute('/admin/teachers')({
  component: AdminTeachersPage,
})

function AdminTeachersPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<AdminTeacher[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [updatingTeacherId, setUpdatingTeacherId] = useState<string | null>(null)
  const [managingTeacherId, setManagingTeacherId] = useState<string | null>(null)
  const [levels, setLevels] = useState<TeacherLevelEligibility[]>([])
  const [isLoadingLevels, setIsLoadingLevels] = useState(false)
  const [draftLevelIds, setDraftLevelIds] = useState<string[]>([])
  const [isSavingLevels, setIsSavingLevels] = useState(false)

  useEffect(() => {
    if (loading || profileLoading) {
      return
    }

    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    if (status !== 'active') {
      navigate({ to: '/waiting' })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadTeachers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setTeachers(await getTeachers())
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teachers.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const canViewTeachers =
    isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (canViewTeachers) {
      void loadTeachers()
    }
  }, [canViewTeachers, loadTeachers])

  const handleToggleStatus = async (teacher: AdminTeacher) => {
    const isActive = !teacher.is_active

    setUpdatingTeacherId(teacher.id)
    setActionError(null)
    setSuccessMessage(null)

    try {
      await setTeacherStatus(teacher.id, isActive)
      await loadTeachers()
      setSuccessMessage(
        isActive
          ? 'Teacher reactivated successfully.'
          : 'Teacher deactivated successfully.',
      )
    } catch (statusError) {
      const backendMessage =
        statusError &&
        typeof statusError === 'object' &&
        'message' in statusError &&
        typeof statusError.message === 'string'
          ? statusError.message
          : null

      setActionError(
        backendMessage ??
          (statusError instanceof Error
            ? statusError.message
            : 'Unable to update teacher status.'),
      )
    } finally {
      setUpdatingTeacherId(null)
    }
  }

  const openManageLevels = async (teacher: AdminTeacher) => {
    setManagingTeacherId(teacher.id)
    setDraftLevelIds(teacher.eligible_levels.map((level) => level.id))
    setActionError(null)
    setSuccessMessage(null)
    setIsLoadingLevels(true)

    try {
      setLevels(await getLevels())
    } catch (loadError) {
      const backendMessage =
        loadError &&
        typeof loadError === 'object' &&
        'message' in loadError &&
        typeof loadError.message === 'string'
          ? loadError.message
          : null

      setActionError(
        backendMessage ??
          (loadError instanceof Error
            ? loadError.message
            : 'Unable to load levels.'),
      )
    } finally {
      setIsLoadingLevels(false)
    }
  }

  const handleDraftLevelChange = (levelId: string, isEligible: boolean) => {
    setDraftLevelIds((currentLevelIds) => (
      isEligible
        ? currentLevelIds.filter((currentLevelId) => currentLevelId !== levelId)
        : [...currentLevelIds, levelId]
    ))
  }

  const closeManageLevels = () => {
    setManagingTeacherId(null)
    setDraftLevelIds([])
  }

  const handleSaveLevels = async (teacher: AdminTeacher) => {
    const currentLevelIds = teacher.eligible_levels.map((level) => level.id)
    const levelIdsToAdd = draftLevelIds.filter(
      (levelId) => !currentLevelIds.includes(levelId),
    )
    const levelIdsToRemove = currentLevelIds.filter(
      (levelId) => !draftLevelIds.includes(levelId),
    )

    setIsSavingLevels(true)
    setActionError(null)
    setSuccessMessage(null)

    try {
      for (const levelId of levelIdsToRemove) {
        await removeTeacherLevel(teacher.id, levelId)
      }

      for (const levelId of levelIdsToAdd) {
        await addTeacherLevel(teacher.id, levelId)
      }

      await loadTeachers()
      closeManageLevels()
      setSuccessMessage('Teacher levels updated successfully.')
    } catch (levelError) {
      const backendMessage =
        levelError &&
        typeof levelError === 'object' &&
        'message' in levelError &&
        typeof levelError.message === 'string'
          ? levelError.message
          : null

      setActionError(
        backendMessage ??
          (levelError instanceof Error
            ? levelError.message
            : 'Unable to update teacher level eligibility.'),
      )
    } finally {
      setIsSavingLevels(false)
    }
  }

  const managingTeacher = managingTeacherId
    ? teachers.find((teacher) => teacher.id === managingTeacherId) ?? null
    : null

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
        <p className="mt-2">You do not have permission to view teachers.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900">Admin Teachers</h2>

      {successMessage && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {managingTeacher && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Manage Levels: {managingTeacher.profiles?.full_name ?? managingTeacher.teacher_code}
              </h3>
              {!managingTeacher.is_active && (
                <p className="mt-1 text-sm text-slate-600">
                  Inactive teachers cannot receive new level eligibility.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeManageLevels}
              disabled={isSavingLevels}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Close
            </button>
          </div>

          {isLoadingLevels ? (
            <p className="mt-5 text-sm text-slate-600">Loading levels...</p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {levels.map((level) => {
                const isEligible = draftLevelIds.includes(level.id)

                return (
                  <li key={level.id} className="flex items-center justify-between gap-4 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <input
                        type="checkbox"
                        checked={isEligible}
                        onChange={() => handleDraftLevelChange(level.id, isEligible)}
                        disabled={isSavingLevels || (!isEligible && !managingTeacher.is_active)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {level.name}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          {!isLoadingLevels && (
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleSaveLevels(managingTeacher)}
                disabled={isSavingLevels}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSavingLevels ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={closeManageLevels}
                disabled={isSavingLevels}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
        {isLoading && (
          <p className="p-6 text-sm text-slate-600">Loading teachers...</p>
        )}

        {error && (
          <p className="m-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Unable to load teachers: {error}
          </p>
        )}

        {!isLoading && !error && teachers.length === 0 && (
          <p className="p-6 text-sm text-slate-600">There are no teachers.</p>
        )}

        {!isLoading && !error && teachers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">Teacher Name</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Teacher Code</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Allowed Levels</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="text-slate-700">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {teacher.profiles?.full_name ?? 'Unknown teacher'}
                    </td>
                    <td className="px-6 py-4">
                      {teacher.profiles?.email ?? 'No email'}
                    </td>
                    <td className="px-6 py-4">{teacher.teacher_code}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        teacher.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {teacher.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {teacher.eligible_levels.length > 0
                        ? teacher.eligible_levels.map((level) => level.name).join(', ')
                        : 'No allowed levels'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void openManageLevels(teacher)}
                          className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Manage Levels
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(teacher)}
                          disabled={updatingTeacherId === teacher.id}
                          className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                            teacher.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {updatingTeacherId === teacher.id
                            ? 'Updating...'
                            : teacher.is_active
                              ? 'Deactivate'
                              : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
