import { supabase } from '../lib/supabase'

export type NotificationCategory = 'finance' | 'academic' | 'operational' | 'system' | 'registration'

export type AppNotification = {
  id: string
  category: NotificationCategory
  event_type: string
  title: string
  message: string
  is_read: boolean
  target_path: string
  created_at: string
}

export async function getMyNotifications(limit = 20): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, category, event_type, title, message, is_read, target_path, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('is_read', false)
  if (error) throw error
}

export async function markAllMyNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) throw error
}
