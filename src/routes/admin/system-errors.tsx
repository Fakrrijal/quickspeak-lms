import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  getSystemErrorEvents,
  markSystemErrorResolved,
  type SystemErrorEvent,
  type SystemErrorStatus,
} from '../../services/admin-system-error.service'

export const Route = createFileRoute('/admin/system-errors')({
  component: AdminSystemErrorsPage,
})

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }

  return error instanceof Error ? error.message : fallback
}

function AdminSystemErrorsPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<SystemErrorEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<SystemErrorStatus>('open')
  const [actionErrorId, setActionErrorId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const canViewErrors =
    isAuthenticated && role === 'admin' && status === 'active'

  const loadErrors = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setErrors(await getSystemErrorEvents(statusFilter === 'all' ? undefined : statusFilter))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load system errors.'))
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (canViewErrors) {
      void loadErrors()
    }
  }, [canViewErrors, loadErrors])

  const handleMarkResolved = async (errorEvent: SystemErrorEvent) => {
    if (!window.confirm(
      `Mark this error as resolved?\n\nFeature: ${errorEvent.feature}\nAction: ${errorEvent.action}\nMessage: ${errorEvent.message}`,
    )) {
      return
    }

    setActionErrorId(errorEvent.id)
    setError(null)

    try {
      await markSystemErrorResolved(errorEvent.id)
      await loadErrors()
    } catch (resolveError) {
      setError(getErrorMessage(resolveError, 'Unable to mark error as resolved.'))
    } finally {
      setActionErrorId(null)
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
        <p className="mt-2">You do not have permission to view system errors.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900">System Errors</h2>
        <Link to="/admin" className="text-sm font-medium text-slate-700 underline">
          Back to Admin
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SystemErrorStatus)}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Feature</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Message</th>
              <th className="px-4 py-3 font-semibold">Occurrences</th>
              <th className="px-4 py-3 font-semibold">First Seen</th>
              <th className="px-4 py-3 font-semibold">Last Seen</th>
              <th className="px-4 py-3 font-semibold">User ID</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-600">
                  Loading system errors...
                </td>
              </tr>
            )}

            {!isLoading && errors.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-slate-600">
                  No system errors found.
                </td>
              </tr>
            )}

            {!isLoading && errors.map((errorEvent) => {
              const isProcessing = actionErrorId === errorEvent.id

              return (
                <tr key={errorEvent.id} className="align-top">
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        errorEvent.status === 'open'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {errorEvent.status === 'open' ? 'Open' : 'Resolved'}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {errorEvent.feature}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {errorEvent.action}
                  </td>
                  <td className="px-4 py-4 text-slate-700 max-w-md truncate">
                    {errorEvent.message}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {errorEvent.occurrence_count}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatDateTime(errorEvent.first_seen_at)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatDateTime(errorEvent.last_seen_at)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {errorEvent.user_id || '-'}
                  </td>
                  <td className="px-4 py-4">
                    {errorEvent.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => void handleMarkResolved(errorEvent)}
                        disabled={isProcessing}
                        className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white disabled:opacity-50"
                      >
                        {isProcessing ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
