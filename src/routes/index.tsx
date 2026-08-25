import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import { useEffect } from 'react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { isAuthenticated, loading } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: '/login' })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading...</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">QuickSpeak LMS</h1>
      <p className="mt-2">Routing foundation is ready.</p>
    </main>
  )
}