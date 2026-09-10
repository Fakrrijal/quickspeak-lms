import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { authService } from '../../services/auth.service'
import { useAuthContext } from '../../providers/AuthProvider'
import { useState } from 'react'
import { EnterprisePortalShell } from '../portal/EnterprisePortalShell'
import { isPortalPath, type PortalRole } from '../portal/portal-navigation'
import { StudentDashboardV2 } from '../../components/student/StudentDashboardV2'
import { useProfile } from '../../hooks/useProfile'

export function AppLayout() {
  const { isAuthenticated, profile, role, user } = useAuthContext()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const portalRole: PortalRole | null = (
    role === 'student' || role === 'teacher' || role === 'admin'
  ) ? role : null
  const { avatarUrl } = useProfile(
    user?.id ?? null,
    Boolean(isAuthenticated && profile && role === 'student'),
  )

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await authService.signOut()
      navigate({ to: '/login', replace: true })
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Logout failed')
      console.error('Logout error:', err)
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (isAuthenticated && profile && portalRole && isPortalPath(pathname)) {
    return (
      <EnterprisePortalShell
        role={portalRole}
        userName={profile.full_name || 'QuickSpeak user'}
        avatarUrl={portalRole === 'student' ? avatarUrl : null}
        pathname={pathname}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        onLogout={() => void handleLogout()}
      >
        {pathname === '/student' ? <StudentDashboardV2 /> : <Outlet />}
      </EnterprisePortalShell>
    )
  }

  const isPartnerPage = pathname === '/partner'

  return (
    <div className="min-h-screen bg-slate-50">
      {!isPartnerPage && (
        <header className="border-b bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <h1 className="text-xl font-bold text-slate-900">
              QuickSpeak
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
      )}

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
