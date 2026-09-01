import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyNotifications, getMyUnreadNotificationCount, markAllMyNotificationsRead, markNotificationRead } from '../services/notification.service'

export function useNotifications(enabled: boolean) {
  const queryClient = useQueryClient()
  const notificationsKey = ['my-notifications'] as const
  const unreadKey = ['my-notifications-unread-count'] as const
  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: notificationsKey }), queryClient.invalidateQueries({ queryKey: unreadKey })])
  const notifications = useQuery({ queryKey: notificationsKey, queryFn: () => getMyNotifications(), enabled, refetchInterval: 60_000 })
  const unreadCount = useQuery({ queryKey: unreadKey, queryFn: getMyUnreadNotificationCount, enabled, refetchInterval: 60_000 })
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate })
  const markAll = useMutation({ mutationFn: markAllMyNotificationsRead, onSuccess: invalidate })
  return { notifications: notifications.data ?? [], unreadCount: unreadCount.data ?? 0, loading: notifications.isLoading, error: notifications.isError ? 'Unable to load notifications.' : null, markRead: markOne.mutateAsync, markAllRead: markAll.mutateAsync, markingAllRead: markAll.isPending }
}
