import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useNotificationSoundEffect } from '../../../shared/design-system/lib/use-notification-sound-effect';

import {
  fetchClientNotifications,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  type ClientNotification,
} from '../services/clientNotificationsService';

export const CLIENT_NOTIFICATIONS_QUERY_KEY = ['client', 'notifications'] as const;

export function useClientNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CLIENT_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchClientNotifications(),
  });

  const unreadCount = query.data?.unreadCount ?? 0;

  useNotificationSoundEffect(query.data?.items);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markClientNotificationRead(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<{ items: ClientNotification[]; unreadCount: number }>(
        CLIENT_NOTIFICATIONS_QUERY_KEY,
        (prev) => {
          if (!prev) return prev;
          const wasUnread = prev.items.find((n) => n.id === updated.id && !n.isRead);
          return {
            items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
            unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
          };
        },
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllClientNotificationsRead(),
    onSuccess: () => {
      queryClient.setQueryData<{ items: ClientNotification[]; unreadCount: number }>(
        CLIENT_NOTIFICATIONS_QUERY_KEY,
        (prev) => {
          if (!prev) return prev;
          return {
            items: prev.items.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() })),
            unreadCount: 0,
          };
        },
      );
    },
  });

  return {
    items: query.data?.items ?? [],
    unreadCount,
    isLoading: query.isLoading,
    refetch: query.refetch,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
  };
}
