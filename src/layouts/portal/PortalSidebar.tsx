import { Link } from '@tanstack/react-router'
import { portalNavigation, type PortalRole } from './portal-navigation'

type PortalSidebarProps = {
  id?: string
  role: PortalRole
  pathname: string
  userName?: string
  avatarUrl?: string | null
  onNavigate?: () => void
}

function isActivePath(pathname: string, to: string, activePrefixes: string[] = []) {
  return pathname === to || activePrefixes.some((prefix) => pathname.startsWith(prefix))
}

function getInitials(userName: string) {
  return userName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function PortalSidebar({ id, role, pathname, userName = 'QuickSpeak user', avatarUrl, onNavigate }: PortalSidebarProps) {
  return (
    <nav id={id} aria-label="Portal navigation" className="flex h-full flex-col overflow-y-auto p-4">
      <div className="px-3 pb-5 pt-1">
        {role === 'student' ? (
          <>
            <p className="text-sm font-semibold text-slate-900">Profil</p>
            <div className="mt-4 flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
                >
                  {getInitials(userName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                <p className="mt-0.5 text-xs text-slate-500">Student</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-900">{role.charAt(0).toUpperCase()}{role.slice(1)}</p>
            <p className="mt-1 text-xs text-slate-500">QuickSpeak</p>
          </>
        )}
      </div>

      <div className="space-y-6">
        {portalNavigation[role].map((group) => (
          <section key={group.label} aria-label={group.label}>
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.to, item.activePrefixes)

                return (
                  <li key={item.to}>
                    <Link
                      to={item.to as never}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex min-h-10 items-center rounded-lg border-l-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                        isActive
                          ? 'border-slate-900 bg-slate-100 text-slate-950'
                          : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  )
}
