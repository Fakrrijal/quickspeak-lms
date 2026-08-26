import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  getTeachingGroups,
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
      <h2 className="text-3xl font-bold text-slate-900">
        Admin Teaching Groups
      </h2>

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
