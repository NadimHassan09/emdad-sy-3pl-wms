import type { AppNotification } from '../../services/notificationsService';

/** Deep-link from an admin notification to the relevant screen. */
export function adminNotificationHref(notification: AppNotification): string | undefined {
  const { referenceType, referenceId } = notification;
  if (!referenceType || !referenceId) return undefined;

  switch (referenceType) {
    case 'inbound_order':
      return `/orders/inbound/${referenceId}`;
    case 'outbound_order':
      return `/orders/outbound/${referenceId}`;
    case 'product':
      return `/products/${referenceId}`;
    case 'warehouse_task':
      return `/tasks/${referenceId}`;
    case 'invoice':
      return `/billing/invoices/${referenceId}`;
    case 'billing_cycle':
      return `/billing/dashboard`;
    default:
      return undefined;
  }
}

export function formatAdminNotificationTime(iso: string, isArabic: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return isArabic ? 'الآن' : 'Just now';
  if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isArabic ? `منذ ${days} ي` : `${days}d ago`;
  return new Date(iso).toLocaleString();
}

export type NotificationReadFilter = 'all' | 'unread' | 'read';

export function readFilterToQuery(filter: NotificationReadFilter): boolean | undefined {
  if (filter === 'unread') return false;
  if (filter === 'read') return true;
  return undefined;
}
