import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { QuickSpeakLanding } from '../components/public/QuickSpeakLanding'
import { useAuthContext } from '../providers/AuthProvider'
import { useEffect } from 'react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    role,
    status,
    profileError,
  } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!isAuthenticated) {
      return
    }

    if (profileLoading) {
      return
    }

    if (profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    if (status !== 'active') {
      navigate({ to: '/waiting' })
      return
    }

    if (role === 'admin') {
      navigate({ to: '/admin/dashboard' })
      return
    }

    if (role === 'teacher') {
      navigate({ to: '/teacher' })
      return
    }

    if (role === 'student') {
      navigate({ to: '/student' })
      return
    }
  }, [isAuthenticated, loading, profileLoading, profileError, role, status, navigate])

  if (loading || profileLoading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading...</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <QuickSpeakLanding />
  }

  if (profileError || status === null) {
    return null
  }

  if (status !== 'active') {
    return null
  }

  if (role === 'admin' || role === 'teacher' || role === 'student') {
    return null
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Access error</h1>
      <p className="mt-2">Your account has an unrecognized role.</p>
    </main>
  )
}
