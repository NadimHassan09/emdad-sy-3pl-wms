import { api } from '../api/client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export async function fetchNotifications(limit = 50): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>('/notifications', { params: { limit } });
  return data;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data } = await api.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const { data } = await api.post<{ updated: number }>('/notifications/read-all');
  return data;
}

export function notificationHref(notification: AppNotification): string | undefined {
  if (notification.referenceType === 'inbound_order' && notification.referenceId) {
    return `/orders/inbound/${notification.referenceId}`;
  }
  if (notification.referenceType === 'outbound_order' && notification.referenceId) {
    return `/orders/outbound/${notification.referenceId}`;
  }
  if (notification.referenceType === 'product' && notification.referenceId) {
    return `/products/${notification.referenceId}`;
  }
  return undefined;
}
