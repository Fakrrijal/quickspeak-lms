import { createFileRoute } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { WaitingTeachersSection } from '../../components/admin/WaitingTeachersSection'

export const Route = createFileRoute('/admin/waiting-teachers')({ component: WaitingTeachersPage })

function WaitingTeachersPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status !== 'active') return null
  if (role !== 'admin') return <p>Access denied.</p>
  return <section><h2 className="text-3xl font-bold text-slate-900">Waiting Teachers</h2><p className="mt-2 text-slate-600">Review teacher registrations awaiting approval.</p><WaitingTeachersSection enabled /></section>
}
