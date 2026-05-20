import { apiClient } from './apiClient';

export interface ClientNotification {
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

export interface ClientNotificationsResponse {
  items: ClientNotification[];
  unreadCount: number;
}

export async function fetchClientNotifications(
  limit = 50,
): Promise<ClientNotificationsResponse> {
  const { data } = await apiClient.get<ClientNotificationsResponse>('/notifications', {
    params: { limit },
  });
  return data;
}

export async function markClientNotificationRead(id: string): Promise<ClientNotification> {
  const { data } = await apiClient.patch<ClientNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllClientNotificationsRead(): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>('/notifications/read-all');
  return data;
}

export function clientNotificationHref(notification: ClientNotification): string | undefined {
  if (notification.referenceType === 'inbound_order' && notification.referenceId) {
    return `/inbound-orders/${notification.referenceId}`;
  }
  if (notification.referenceType === 'outbound_order' && notification.referenceId) {
    return `/outbound-orders/${notification.referenceId}`;
  }
  return undefined;
}
