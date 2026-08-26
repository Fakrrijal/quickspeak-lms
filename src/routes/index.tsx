import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import { useEffect } from 'react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { isAuthenticated, loading, profileLoading, status, profileError } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    // Auth session loading
    if (loading) {
      return
    }

    // Not authenticated
    if (!isAuthenticated) {
      navigate({ to: '/login' })
      return
    }

    // Profile still loading
    if (profileLoading) {
      return
    }

    // Profile fetch error or missing
    if (profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    // Status-based routing
    if (status !== 'active') {
      navigate({ to: '/waiting' })
      return
    }
  }, [isAuthenticated, loading, profileLoading, status, profileError, navigate])

  // Show loading while auth or profile is loading
  if (loading || profileLoading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading...</p>
      </main>
    )
  }

  // Don't show content if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Don't show content if profile error or missing
  if (profileError || status === null) {
    return null
  }

  // Don't show content if status is not active
  if (status !== 'active') {
    return null
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">QuickSpeak LMS</h1>
      <p className="mt-2">Routing foundation is ready.</p>
    </main>
  )
}