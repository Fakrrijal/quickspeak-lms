import type { PortalRole } from './portal-navigation'
import { NotificationCenter } from '../../components/NotificationCenter'

type PortalHeaderProps = {
  role: PortalRole
  userName: string
  isMenuOpen: boolean
  isLoggingOut: boolean
  logoutError: string | null
  onMenuToggle: () => void
  onLogout: () => void
}

export function PortalHeader({
  role,
  userName,
  isMenuOpen,
  isLoggingOut,
  logoutError,
  onMenuToggle,
  onLogout,
}: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-controls="portal-navigation-mobile"
          aria-expanded={isMenuOpen}
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 lg:hidden"
        >
          <span className="sr-only">{isMenuOpen ? 'Close navigation' : 'Open navigation'}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
            <path d={isMenuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>

        <div className="min-w-0">
          <img src="/branding/quickspeak-logo.png" alt="QuickSpeak" className="h-8 w-auto object-contain sm:h-9" />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          {logoutError && <p role="alert" className="hidden text-sm text-red-700 md:block">{logoutError}</p>}
          <NotificationCenter />
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">{role.charAt(0).toUpperCase()}{role.slice(1)}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
      {logoutError && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 md:hidden">{logoutError}</p>}
    </header>
  )
}
