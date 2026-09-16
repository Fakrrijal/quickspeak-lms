import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { PortalRole } from './portal-navigation'
import { NotificationCenter } from '../../components/NotificationCenter'

type PortalHeaderProps = {
  role: PortalRole
  userName: string
  avatarUrl?: string | null
  isMenuOpen: boolean
  isLoggingOut: boolean
  logoutError: string | null
  onMenuToggle: () => void
  onLogout: () => void
}

function getInitials(userName: string) {
  const initials = userName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return initials || 'QS'
}

function getProfilePath(role: PortalRole) {
  return role === 'student' ? '/student/profile' : '/teacher/profile'
}

export function PortalHeader({
  role,
  userName,
  avatarUrl,
  isMenuOpen,
  isLoggingOut,
  logoutError,
  onMenuToggle,
  onLogout,
}: PortalHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const isProfileMenuEnabled = role === 'student' || role === 'teacher'
  const profilePath = isProfileMenuEnabled ? getProfilePath(role) : null
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setIsProfileMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProfileMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!isProfileMenuEnabled) setIsProfileMenuOpen(false)
  }, [isProfileMenuEnabled])

  const handleLogout = () => {
    setIsProfileMenuOpen(false)
    onLogout()
  }

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

          {isProfileMenuEnabled ? (
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                className="inline-flex max-w-[min(16rem,70vw)] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#102449] text-xs font-extrabold text-white">
                    {getInitials(userName)}
                  </span>
                )}
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-base font-semibold text-slate-900">{userName}</span>
                  <span className="block text-xs text-slate-500">{roleLabel}</span>
                </span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-4 shrink-0 text-slate-500 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isProfileMenuOpen && profilePath && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" role="menu">
                  <div className="border-b border-slate-100 px-3 py-2.5 sm:hidden">
                    <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{roleLabel}</p>
                  </div>
                  <Link
                    to={profilePath as never}
                    onClick={() => setIsProfileMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#102449]"
                  >
                    Profil
                  </Link>
                  <a
                    href={`${profilePath}#account-security-title`}
                    onClick={() => setIsProfileMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#102449]"
                  >
                    Ganti Password
                  </a>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    role="menuitem"
                    className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-base font-semibold text-slate-900">{userName}</p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
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
          )}
        </div>
      </div>
      {logoutError && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 md:hidden">{logoutError}</p>}
    </header>
  )
}
