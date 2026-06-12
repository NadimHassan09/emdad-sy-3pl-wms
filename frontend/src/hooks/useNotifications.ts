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
    queryKey: QK.notifications.all,
    queryFn: () => fetchNotifications(),
  });

  const unreadCount = query.data?.unreadCount ?? 0;

  useNotificationSoundEffect(query.data?.items);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        QK.notifications.all,
        (prev) => {
          if (!prev) return prev;
          const wasUnread = prev.items.find((n) => n.id === updated.id && !n.isRead);
          return {
            items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
            unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: QK.notifications.all });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.setQueryData<{ items: AppNotification[]; unreadCount: number }>(
        QK.notifications.all,
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
      void queryClient.invalidateQueries({ queryKey: QK.notifications.all });
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
