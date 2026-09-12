import { useEffect, useState, type ReactNode } from 'react'
import { PortalHeader } from './PortalHeader'
import { PortalSidebar } from './PortalSidebar'
import type { PortalRole } from './portal-navigation'
import { PortalFooter } from '../../components/portal/PortalFooter'

type EnterprisePortalShellProps = {
  role: PortalRole
  userName: string
  avatarUrl: string | null
  pathname: string
  isLoggingOut: boolean
  logoutError: string | null
  onLogout: () => void
  children: ReactNode
}

export function EnterprisePortalShell({
  role,
  userName,
  avatarUrl,
  pathname,
  isLoggingOut,
  logoutError,
  onLogout,
  children,
}: EnterprisePortalShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isStudentPortal = role === 'student'
  const isSupportPortal = role === 'student' || role === 'teacher'

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#portal-content"
        className="sr-only z-50 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <PortalHeader
        role={role}
        userName={userName}
        isMenuOpen={isMenuOpen}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        onMenuToggle={() => setIsMenuOpen((open) => !open)}
        onLogout={onLogout}
      />

      <div className="flex">
        <aside
          className={[
            'hidden w-[248px] shrink-0 border-r border-slate-200 bg-white lg:block',
            isStudentPortal
              ? 'self-stretch'
              : 'lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]',
          ].join(' ')}
        >
          <PortalSidebar role={role} pathname={pathname} userName={userName} avatarUrl={avatarUrl} />
        </aside>

        {isMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/20"
            />
            <aside className="relative h-full w-[min(248px,85vw)] border-r border-slate-200 bg-white shadow-sm">
              <PortalSidebar
                id="portal-navigation-mobile"
                role={role}
                pathname={pathname}
                userName={userName}
                avatarUrl={avatarUrl}
                onNavigate={() => setIsMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        <main id="portal-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div key={pathname} className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {isSupportPortal && <PortalFooter role={role === 'student' ? 'student' : 'teacher'} />}
    </div>
  )
}
