import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useNotifications } from '../hooks/useNotifications'

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, error, markRead, markAllRead, markingAllRead } = useNotifications(true)

  const openNotification = async (notification: typeof notifications[number]) => {
    setActionError(null)
    try {
      if (!notification.is_read) await markRead(notification.id)
      setIsOpen(false)
      await navigate({ to: notification.target_path as never })
    } catch {
      setActionError('Unable to open this notification. Please try again.')
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative inline-flex size-10 items-center justify-center rounded-lg text-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <span aria-hidden="true">🔔</span><span className="sr-only">Notifications</span>
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <section role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Notifications</h2>
            {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} disabled={markingAllRead} className="text-sm font-medium text-slate-700 underline disabled:opacity-50">Mark all read</button>}
          </div>
          {actionError && <p role="alert" className="m-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{actionError}</p>}
          {error && <p role="alert" className="m-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          {loading && <p className="px-4 py-6 text-sm text-slate-600">Loading notifications...</p>}
          {!loading && !error && notifications.length === 0 && <p className="px-4 py-6 text-sm text-slate-600">You have no notifications.</p>}
          {!loading && notifications.length > 0 && <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {notifications.map((notification) => <li key={notification.id}>
              <button type="button" onClick={() => void openNotification(notification)} className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${notification.is_read ? '' : 'bg-sky-50/70'}`}>
                <div className="flex items-start gap-2"><span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.is_read ? 'bg-transparent' : 'bg-sky-600'}`} /><div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{notification.category}</p><p className="mt-0.5 font-medium text-slate-900">{notification.title}</p><p className="mt-1 text-sm text-slate-600">{notification.message}</p><p className="mt-1 text-xs text-slate-500">{relativeTime(notification.created_at)}</p></div></div>
              </button>
            </li>)}
          </ul>}
          <button type="button" onClick={() => { setIsOpen(false); void navigate({ to: '/notifications' }) }} className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">View all notifications</button>
        </section>
      )}
    </div>
  )
}
