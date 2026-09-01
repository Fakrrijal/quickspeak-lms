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

export function PortalSidebar({ id, role, pathname, onNavigate }: PortalSidebarProps) {
  return (
    <nav id={id} aria-label="Portal navigation" className="flex h-full flex-col overflow-y-auto p-4">
      <div className="px-3 pb-5 pt-1">
        <p className="text-sm font-semibold text-slate-900">{role.charAt(0).toUpperCase()}{role.slice(1)}</p>
        <p className="mt-1 text-xs text-slate-500">QuickSpeak LMS</p>
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
