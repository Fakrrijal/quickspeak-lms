import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authService } from '../services/auth.service'

export const Route = createFileRoute('/waiting')({
  component: WaitingPage,
})

function WaitingPage() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await authService.signOut()
      navigate({ to: '/login' })
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Logout failed')
      console.error('Logout error:', err)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          QuickSpeak LMS
        </h2>

        <div className="mt-6">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h3 className="text-lg font-semibold text-amber-900">
              Account Status: Waiting for Activation
            </h3>
            <p className="mt-2 text-sm text-amber-800">
              Your registration was successful, but your account is currently waiting for activation.
            </p>
            <p className="mt-2 text-sm text-amber-800">
              You will be notified when your account has been activated.
            </p>
          </div>
        </div>

        {logoutError && (
          <p className="mt-4 text-sm text-red-600">
            {logoutError}
          </p>
        )}

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  )
}
