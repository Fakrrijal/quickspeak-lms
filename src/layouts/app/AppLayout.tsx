import { HeadContent, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
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
  const shouldLoadPortalProfile = Boolean(
    isAuthenticated && profile && (role === 'student' || role === 'teacher'),
  )
  const { avatarUrl } = useProfile(user?.id ?? null, shouldLoadPortalProfile)

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
      <>
        <HeadContent />
        <EnterprisePortalShell
        role={portalRole}
        userName={profile.full_name || 'QuickSpeak user'}
        avatarUrl={portalRole === 'student' || portalRole === 'teacher' ? avatarUrl : null}
        pathname={pathname}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        onLogout={() => void handleLogout()}
      >
        {pathname === '/student' ? <StudentDashboardV2 /> : <Outlet />}
        </EnterprisePortalShell>
      </>
    )
  }

  const isPartnerPage = pathname === '/partner'
  const isHomePage = pathname === '/'
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname)

  if (isHomePage) {
    return (
      <>
        <HeadContent />
        <Outlet />
      </>
    )
  }

  return (
    <>
      <HeadContent />
      <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      {!isPartnerPage && (
        <header className="border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between px-5 py-2 sm:px-6">
            <a href="/" className="inline-flex items-center gap-2.5" aria-label="QuickSpeak home">
              <img src="/favicon.png" alt="QuickSpeak" className="h-9 w-9 shrink-0" />
              <div className="leading-tight">
                <div className="text-[17px] font-extrabold tracking-[-0.02em] text-[#102449]">QuickSpeak</div>
                <div className="text-[8px] font-bold uppercase tracking-[0.28em] text-[#1b5dd7]">English</div>
              </div>
            </a>
            {isAuthenticated && !isAuthPage && (
              <div className="flex items-center gap-4">
                {logoutError && <span className="text-sm text-red-600">{logoutError}</span>}
                <button onClick={handleLogout} disabled={isLoggingOut} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50">
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <main className={isAuthPage ? 'mx-auto max-w-7xl px-6 py-8 sm:py-10' : 'mx-auto max-w-7xl px-6 py-8'} id={isAuthPage ? undefined : 'top'}>
        <Outlet />
      </main>
      </div>
    </>
  )
}
