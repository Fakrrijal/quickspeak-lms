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
