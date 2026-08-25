import { Outlet } from '@tanstack/react-router'
import { authService } from '../../services/auth.service'
import { useAuthContext } from '../../providers/AuthProvider'
import { useState } from 'react'

export function AppLayout() {
  const { isAuthenticated } = useAuthContext()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await authService.signOut()
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Logout failed')
      console.error('Logout error:', err)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <h1 className="text-xl font-bold text-slate-900">
            QuickSpeak LMS
          </h1>

          {isAuthenticated && (
            <div className="flex items-center gap-4">
              {logoutError && (
                <span className="text-sm text-red-600">
                  {logoutError}
                </span>
              )}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}