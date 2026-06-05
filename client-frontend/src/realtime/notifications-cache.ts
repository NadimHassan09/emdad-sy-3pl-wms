import type { QueryClient } from '@tanstack/react-query';

import { CLIENT_NOTIFICATIONS_QUERY_KEY } from '../hooks/useClientNotifications';
import type { ClientNotification } from '../services/clientNotificationsService';

export function patchClientNotificationCreated(
  qc: QueryClient,
  notification: ClientNotification,
): void {
  qc.setQueryData<{ items: ClientNotification[]; unreadCount: number }>(
    CLIENT_NOTIFICATIONS_QUERY_KEY,
    (prev) => {
      if (!prev) return prev;
      if (prev.items.some((n) => n.id === notification.id)) return prev;
      return {
        items: [notification, ...prev.items],
        unreadCount: prev.unreadCount + (notification.isRead ? 0 : 1),
      };
    },
  );
}

export function patchClientNotificationRead(
  qc: QueryClient,
  payload: { notification?: ClientNotification; markAllRead?: boolean },
): void {
  qc.setQueryData<{ items: ClientNotification[]; unreadCount: number }>(
    CLIENT_NOTIFICATIONS_QUERY_KEY,
    (prev) => {
      if (!prev) return prev;
      if (payload.markAllRead) {
        return {
          items: prev.items.map((n) => ({
            ...n,
            isRead: true,
            readAt: n.readAt ?? new Date().toISOString(),
          })),
          unreadCount: 0,
        };
      }
      if (!payload.notification) return prev;
      const updated = payload.notification;
      const wasUnread = prev.items.find((n) => n.id === updated.id && !n.isRead);
      return {
        items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
        unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
      };
    },
  );
}
