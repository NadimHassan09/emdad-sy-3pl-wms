import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useNotificationSoundEffect } from '../../../shared/design-system/lib/use-notification-sound-effect';
import { QK } from '../constants/query-keys';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../services/notificationsService';

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.notifications,
    queryFn: () => fetchNotifications(),
    refetchInterval: 60_000,
  });

  const unreadCount = query.data?.unreadCount ?? 0;

  useNotificationSoundEffect(query.data?.items);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        QK.notifications,
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
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        QK.notifications,
        (prev) => {
          if (!prev) return prev;
          return {
            items: prev.items.map((n) => ({
              ...n,
              isRead: true,
              readAt: n.readAt ?? new Date().toISOString(),
            })),
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
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
  };
}
