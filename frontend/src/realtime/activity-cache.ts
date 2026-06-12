import type { QueryClient } from '@tanstack/react-query';

import type { AuditLogSummary } from '../api/audit-logs';
import type { AppNotification } from '../services/notificationsService';
import { QK } from '../constants/query-keys';

type AuditListCache = {
  items?: AuditLogSummary[];
  total: number;
  nextCursor?: string | null;
};

function auditMatchesFilters(entry: AuditLogSummary, params: Record<string, unknown>): boolean {
  const action = String(params.action ?? '').trim();
  if (action && entry.action !== action) return false;
  const resourceType = String(params.resource_type ?? '').trim();
  if (resourceType && entry.resourceType !== resourceType) return false;
  const companyId = String(params.company_id ?? '').trim();
  if (companyId && entry.companyId !== companyId) return false;
  const actorEmail = String(params.actor_email ?? '').trim().toLowerCase();
  if (actorEmail && entry.actorEmail.toLowerCase() !== actorEmail) return false;
  const search = String(params.search ?? '').trim().toLowerCase();
  if (search) {
    const hay = [
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.actorEmail,
      entry.actorName,
    ]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(search)) return false;
  }
  return true;
}

/** Live tail — prepend newest audit row to first-page list queries only. */
export function patchAuditLogCreated(qc: QueryClient, auditLog: AuditLogSummary): void {
  qc.setQueriesData<AuditListCache>(
    {
      queryKey: QK.auditLogs.all,
      predicate: (query) => {
        const params = (query.queryKey[2] ?? {}) as Record<string, unknown>;
        const offset = Number(params.offset ?? 0);
        const sortBy = String(params.sort_by ?? 'created_at');
        const sortDir = String(params.sort_dir ?? 'desc');
        return (
          offset === 0 &&
          sortBy === 'created_at' &&
          sortDir === 'desc' &&
          auditMatchesFilters(auditLog, params)
        );
      },
    },
    (prev) => {
      if (!prev?.items) return prev;
      if (prev.items.some((row) => row.id === auditLog.id)) return prev;
      const limit = Math.max(prev.items.length, 1);
      return {
        ...prev,
        items: [auditLog, ...prev.items].slice(0, limit),
        total: prev.total + 1,
      };
    },
  );
}

export function patchNotificationCreated(
  qc: QueryClient,
  notification: AppNotification,
): void {
  qc.setQueryData<{ items: AppNotification[]; unreadCount: number }>(QK.notifications.all, (prev) => {
    if (!prev) return prev;
    if (prev.items.some((n) => n.id === notification.id)) return prev;
    return {
      items: [notification, ...prev.items],
      unreadCount: prev.unreadCount + (notification.isRead ? 0 : 1),
    };
  });
}

export function patchNotificationRead(
  qc: QueryClient,
  payload: { notification?: AppNotification; markAllRead?: boolean },
): void {
  qc.setQueryData<{ items: AppNotification[]; unreadCount: number }>(QK.notifications.all, (prev) => {
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
    const updated = payload.notification;
    if (!updated) return prev;
    const wasUnread = prev.items.find((n) => n.id === updated.id && !n.isRead);
    return {
      items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
      unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
    };
  });
}

export function patchNotificationDeleted(qc: QueryClient, notificationId: string): void {
  qc.setQueryData<{ items: AppNotification[]; unreadCount: number }>(QK.notifications.all, (prev) => {
    if (!prev) return prev;
    const removed = prev.items.find((n) => n.id === notificationId);
    if (!removed) return prev;
    return {
      items: prev.items.filter((n) => n.id !== notificationId),
      unreadCount: removed.isRead ? prev.unreadCount : Math.max(0, prev.unreadCount - 1),
    };
  });
}
