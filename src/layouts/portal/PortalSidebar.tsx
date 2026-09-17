import { Link } from '@tanstack/react-router'
import { portalNavigation, type PortalRole } from './portal-navigation'

type PortalSidebarProps = {
  id?: string
  role: PortalRole
  pathname: string
  onNavigate?: () => void
}

function isActivePath(pathname: string, to: string, activePrefixes: string[] = []) {
  return pathname === to || activePrefixes.some((prefix) => pathname.startsWith(prefix))
}

function NavigationIcon({ to }: { to: string }) {
  const common = 'size-4 shrink-0 fill-none stroke-current stroke-2'

  if (to.includes('ebooks')) {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  }

  if (to.includes('attendance')) {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  }

  if (to.includes('payment')) {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7" /><path d="M16 13h.01" /></svg>
  }

  if (to.includes('learning')) {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16" /></svg>
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 6.5h16v13H4z" /><path d="m8 6.5 1-3h6l1 3M8 11h8M8 15h5" /></svg>
}

export function PortalSidebar({
  id,
  role,
  pathname,
  onNavigate,
}: PortalSidebarProps) {
  return (
    <nav
      id={id}
      aria-label="Portal navigation"
      data-portal-sidebar={role}
      className="flex min-h-full flex-col overflow-y-auto bg-white px-4 py-4 lg:overflow-visible"
    >
      <div className="shrink-0 rounded-xl bg-[#102449] px-4 py-4 text-white shadow-sm">
        <p className="text-sm font-bold text-white">
          {role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'Admin'}
        </p>
        <p className="mt-1 text-xs text-blue-100">QuickSpeak Portal</p>
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
                        'flex min-h-10 items-center gap-3 rounded-lg border-l-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]',
                        isActive
                          ? 'border-blue-600 bg-[#eaf2ff] text-blue-700'
                          : 'border-transparent text-slate-700 hover:bg-[#f3f7ff] hover:text-[#102449]',
                      ].join(' ')}
                    >
                      <NavigationIcon to={item.to} />
                      <span className="min-w-0 truncate">{item.label}</span>
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
