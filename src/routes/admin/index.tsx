import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  activateStudent,
  getActiveTeachingGroups,
  getWaitingStudents,
  type ActiveTeachingGroup,
  type WaitingStudent,
} from '../../services/admin.service'

export const Route = createFileRoute('/admin/')({
  component: AdminStudentManagementPage,
})

function AdminStudentManagementPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [waitingStudents, setWaitingStudents] = useState<WaitingStudent[]>([])
  const [teachingGroups, setTeachingGroups] = useState<ActiveTeachingGroup[]>([])
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({})
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [activationError, setActivationError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activatingProfileId, setActivatingProfileId] = useState<string | null>(null)

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

  const loadWaitingStudents = useCallback(async () => {
    setIsLoadingStudents(true)
    setStudentsError(null)

    try {
      setWaitingStudents(await getWaitingStudents())
    } catch (error) {
      setStudentsError(
        error instanceof Error ? error.message : 'Unable to load waiting students.',
      )
    } finally {
      setIsLoadingStudents(false)
    }
  }, [])

  const loadTeachingGroups = useCallback(async () => {
    setIsLoadingGroups(true)
    setGroupsError(null)

    try {
      setTeachingGroups(await getActiveTeachingGroups())
    } catch (error) {
      setGroupsError(
        error instanceof Error ? error.message : 'Unable to load teaching groups.',
      )
    } finally {
      setIsLoadingGroups(false)
    }
  }, [])

  const canManageStudents =
    isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (!canManageStudents) {
      return
    }

    void loadWaitingStudents()
    void loadTeachingGroups()
  }, [canManageStudents, loadTeachingGroups, loadWaitingStudents])

  const handleActivate = async (student: WaitingStudent) => {
    const teachingGroupId = selectedGroups[student.id]

    if (!teachingGroupId) {
      return
    }

    setActivatingProfileId(student.id)
    setActivationError(null)
    setSuccessMessage(null)

    try {
      await activateStudent(student.id, teachingGroupId)
      setSelectedGroups((current) => {
        const next = { ...current }
        delete next[student.id]
        return next
      })
      setSuccessMessage(`${student.full_name} was activated successfully.`)
      await loadWaitingStudents()
      void loadTeachingGroups()
    } catch (error) {
      setActivationError(
        error instanceof Error ? error.message : 'Unable to activate this student.',
      )
    } finally {
      setActivatingProfileId(null)
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
        <p className="mt-2">You do not have permission to manage students.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900">
        Admin Student Management
      </h2>

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Waiting Students</h3>

        {successMessage && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMessage}
          </p>
        )}

        {activationError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {activationError}
          </p>
        )}

        {studentsError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Unable to load waiting students: {studentsError}
          </p>
        )}

        {groupsError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Unable to load teaching groups: {groupsError}
          </p>
        )}

        {(isLoadingStudents || isLoadingGroups) && (
          <p className="mt-4 text-sm text-slate-600">Loading student management data...</p>
        )}

        {!isLoadingStudents && !studentsError && waitingStudents.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">There are no waiting students.</p>
        )}

        <div className="mt-4 space-y-4">
          {waitingStudents.map((student) => {
            const selectedGroupId = selectedGroups[student.id] ?? ''
            const isActivating = activatingProfileId === student.id

            return (
              <article
                key={student.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{student.full_name}</h4>
                    <p className="text-sm text-slate-600">{student.email}</p>
                    <p className="mt-1 text-sm text-amber-700">Status: {student.status}</p>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <label className="sr-only" htmlFor={`group-${student.id}`}>
                      Teaching group for {student.full_name}
                    </label>
                    <select
                      id={`group-${student.id}`}
                      value={selectedGroupId}
                      onChange={(event) => {
                        setSelectedGroups((current) => ({
                          ...current,
                          [student.id]: event.target.value,
                        }))
                      }}
                      disabled={isActivating || isLoadingGroups || teachingGroups.length === 0}
                      className="min-w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">Select a teaching group</option>
                      {teachingGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} — {group.levels?.name ?? 'Unknown level'} — {group.group_type === 'semi_private' ? 'Semi-private' : 'Private'}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => void handleActivate(student)}
                      disabled={!selectedGroupId || isActivating}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isActivating ? 'Activating...' : 'Activate'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
