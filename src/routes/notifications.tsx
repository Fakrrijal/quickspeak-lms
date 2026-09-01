/* eslint-disable react-refresh/only-export-components -- TanStack file routes export Route alongside their component. */
import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import { useNotifications } from '../hooks/useNotifications'
import type { NotificationCategory } from '../services/notification.service'

export const Route = createFileRoute('/notifications')({ component: NotificationsPage })

const categoriesByRole: Record<string, NotificationCategory[]> = {
  student: ['finance', 'system'],
  teacher: ['academic', 'finance', 'operational', 'system'],
  admin: ['registration', 'finance', 'operational', 'system'],
}

function NotificationsPage() {
  const { isAuthenticated, loading: authLoading, profileLoading, role, status } = useAuthContext()
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all')
  const navigate = useNavigate()
  const { notifications, loading, error, markRead } = useNotifications(isAuthenticated && status === 'active')
  const categories = categoriesByRole[role ?? ''] ?? []
  const visible = useMemo(() => notifications.filter((item) => category === 'all' || item.category === category), [category, notifications])

  const openNotification = async (id: string, isRead: boolean, targetPath: string) => {
    try {
      if (!isRead) await markRead(id)
      await navigate({ to: targetPath as never })
    } catch { /* Keep the user on the list if the read update fails. */ }
  }

  if (authLoading || profileLoading || loading) return <p>Loading notifications...</p>
  if (!isAuthenticated || status !== 'active') return null

  return <section><h2 className="text-3xl font-bold text-slate-900">Notifications</h2><p className="mt-2 text-slate-600">Updates that need your attention.</p>
    <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => setCategory('all')} className={`rounded-full px-3 py-1.5 text-sm font-medium ${category === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}>All</button>{categories.map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${category === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}>{value === 'operational' ? 'Learning / Operational' : value}</button>)}</div>
    {error && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!error && <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{visible.length === 0 ? <p className="p-6 text-sm text-slate-600">No notifications in this category.</p> : <ul className="divide-y divide-slate-200">{visible.map((item) => <li key={item.id}><button type="button" onClick={() => void openNotification(item.id, item.is_read, item.target_path)} className={`w-full px-5 py-4 text-left hover:bg-slate-50 ${item.is_read ? '' : 'bg-sky-50/70'}`}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.category}</p><p className="mt-1 font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-500">{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</p></button></li>)}</ul>}</div>}
  </section>
}
