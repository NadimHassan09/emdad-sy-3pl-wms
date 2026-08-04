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
  total: number;
  limit: number;
  offset: number;
}

export async function fetchClientNotifications(
  params: { limit?: number; offset?: number } = {},
): Promise<ClientNotificationsResponse> {
  const { data } = await apiClient.get<ClientNotificationsResponse>('/notifications', {
    params: { limit: params.limit ?? 50, offset: params.offset ?? 0 },
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

/** Deep-link from notification entity fields already returned by the API (no new endpoints). */
export function clientNotificationHref(notification: ClientNotification): string | undefined {
  const type = (notification.referenceType || '').toLowerCase();
  const notifType = (notification.type || '').toLowerCase();
  const id = notification.referenceId;

  if ((type === 'inbound_order' || type === 'inbound') && id) {
    return `/inbound-orders/${id}`;
  }
  if ((type === 'outbound_order' || type === 'outbound') && id) {
    return `/outbound-orders/${id}`;
  }
  if (
    (type === 'oms_order' ||
      type === 'ecommerce_order' ||
      type === 'online_order' ||
      type === 'store_order') &&
    id
  ) {
    return `/ecommerce-orders/${id}`;
  }
  if ((type === 'return_order' || type === 'return' || type === 'oms_return') && id) {
    return `/ecommerce-orders/returns/${id}`;
  }
  if (type === 'product' && id) {
    return `/products/${id}`;
  }
  if (type === 'billing_cycle') {
    return '/billing';
  }
  if ((type === 'billing_invoice' || type === 'invoice') && id) {
    return `/invoices/${id}`;
  }
  if (type === 'cod' || type === 'cod_report' || type === 'payment') {
    return id ? `/my-profits` : '/my-profits';
  }

  // Type-string fallbacks when referenceType is sparse
  if (notifType.includes('cod') || notifType.includes('profit') || notifType.includes('payment')) {
    return '/my-profits';
  }
  if (notifType.includes('return')) {
    return id ? `/ecommerce-orders/returns/${id}` : '/ecommerce-orders/returns';
  }
  if (
    notifType.includes('oms') ||
    notifType.includes('ecommerce') ||
    notifType.includes('online_order') ||
    notifType.includes('store_order')
  ) {
    return id ? `/ecommerce-orders/${id}` : '/ecommerce-orders';
  }
  if (notifType.includes('inbound')) {
    return id ? `/inbound-orders/${id}` : '/inbound-orders';
  }
  if (notifType.includes('outbound')) {
    return id ? `/outbound-orders/${id}` : '/outbound-orders';
  }

  return undefined;
}
