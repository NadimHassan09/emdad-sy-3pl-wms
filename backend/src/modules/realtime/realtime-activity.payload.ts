/** Payload serializers for audit log + notification WS events. */

export function auditLogSummaryPayload(row: {
  id: string;
  actor_id: string | null;
  actor_email: string;
  actor_name: string;
  actor_role: string;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    companyId: row.company_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
    createdAt: row.created_at.toISOString(),
  };
}

export function notificationPayload(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  userId?: string | null;
  companyId?: string | null;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId ?? null,
    companyId: row.companyId ?? null,
  };
}
