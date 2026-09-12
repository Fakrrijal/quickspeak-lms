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

function ProfileIdentity({
  role,
  userName,
  avatarUrl,
}: {
  role: 'student' | 'teacher'
  userName: string
  avatarUrl?: string | null
}) {
  const roleLabel = role === 'student' ? 'Student' : 'Teacher'
  const heading = role === 'student' ? 'Profil' : 'Teacher'

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#102449] px-4 py-4 text-white shadow-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-8 size-32 rounded-full bg-white/[0.07]"
      />
      <p className="relative text-sm font-bold text-white">{heading}</p>
      <div className="relative mt-4 flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover ring-2 ring-white/70"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/30"
          >
            {getInitials(userName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{userName}</p>
          <p className="mt-0.5 text-xs font-medium text-blue-100">{roleLabel}</p>
        </div>
      </div>
    </div>
  )
}

export function PortalSidebar({
  id,
  role,
  pathname,
  userName = 'QuickSpeak user',
  avatarUrl,
  onNavigate,
}: PortalSidebarProps) {
  return (
    <nav
      id={id}
      aria-label="Portal navigation"
      data-portal-sidebar={role}
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-white px-4 py-4"
    >
      <div className="shrink-0">
        {role === 'student' || role === 'teacher' ? (
          <ProfileIdentity role={role} userName={userName} avatarUrl={avatarUrl} />
        ) : (
          <div className="rounded-xl bg-[#102449] px-4 py-4 text-white shadow-sm">
            <p className="text-sm font-bold text-white">
              {role.charAt(0).toUpperCase()}
              {role.slice(1)}
            </p>
            <p className="mt-1 text-xs text-blue-100">QuickSpeak</p>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {portalNavigation[role].map((group) => (
          <section key={group.label} aria-label={group.label}>
            <p className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {group.label}
            </p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.to, item.activePrefixes)

                return (
                  <li key={item.to}>
                    <Link
                      to={item.to as never}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={[
                        'flex min-h-10 items-center rounded-lg border-l-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]',
                        isActive
                          ? 'border-blue-600 bg-[#eaf2ff] text-blue-700'
                          : 'border-transparent text-slate-700 hover:bg-[#f3f7ff] hover:text-[#102449]',
                      ].join(' ')}
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
