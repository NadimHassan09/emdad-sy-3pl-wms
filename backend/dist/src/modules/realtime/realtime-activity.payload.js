"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogSummaryPayload = auditLogSummaryPayload;
exports.notificationPayload = notificationPayload;
function auditLogSummaryPayload(row) {
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
function notificationPayload(row) {
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
//# sourceMappingURL=realtime-activity.payload.js.map