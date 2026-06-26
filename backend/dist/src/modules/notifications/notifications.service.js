"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_activity_payload_1 = require("../realtime/realtime-activity.payload");
const realtime_service_1 = require("../realtime/realtime.service");
const IN_APP_CHANNELS = [
    client_1.NotificationChannel.in_app,
    client_1.NotificationChannel.both,
];
const ADMIN_NOTIFY_ROLES = [
    client_1.UserRole.super_admin,
    client_1.UserRole.wh_manager,
    client_1.UserRole.wh_operator,
];
const SLA_MANAGER_NOTIFY_ROLES = [client_1.UserRole.super_admin, client_1.UserRole.wh_manager];
function toDto(row) {
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
    };
}
let NotificationsService = class NotificationsService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    scopeWhere(user) {
        return {
            channel: { in: IN_APP_CHANNELS },
            userId: user.id,
        };
    }
    async list(user, params = {}) {
        const baseWhere = this.scopeWhere(user);
        const where = { ...baseWhere };
        if (params.isRead === true)
            where.isRead = true;
        if (params.isRead === false)
            where.isRead = false;
        const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
        const offset = Math.max(params.offset ?? 0, 0);
        const [items, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({
                where: { ...baseWhere, isRead: false },
            }),
        ]);
        return {
            items: items.map(toDto),
            unreadCount,
            total,
            limit,
            offset,
        };
    }
    async markRead(user, id) {
        const row = await this.prisma.notification.findFirst({
            where: { id, ...this.scopeWhere(user) },
        });
        if (!row)
            throw new common_1.NotFoundException('Notification not found.');
        const updated = await this.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
        const dto = toDto(updated);
        this.realtime.emitNotificationRead(user.id, { notification: dto });
        return dto;
    }
    async markAllRead(user) {
        const result = await this.prisma.notification.updateMany({
            where: { ...this.scopeWhere(user), isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        if (result.count > 0) {
            this.realtime.emitNotificationRead(user.id, { markAllRead: true });
        }
        return { updated: result.count };
    }
    async notifyManagersSlaBreach(input) {
        const type = `admin_sla_breach_l${input.escalationLevel}`;
        const existing = await this.prisma.notification.findFirst({
            where: {
                type,
                referenceType: 'warehouse_task',
                referenceId: input.taskId,
            },
            select: { id: true },
        });
        if (existing)
            return 0;
        const managers = await this.prisma.user.findMany({
            where: {
                status: client_1.UserStatus.active,
                role: { in: SLA_MANAGER_NOTIFY_ROLES },
            },
            select: { id: true },
        });
        if (managers.length === 0)
            return 0;
        const taskRef = input.taskId.slice(0, 8);
        const title = input.escalationLevel === 1
            ? 'Task SLA breached'
            : `Task SLA breach — escalation ${input.escalationLevel}`;
        const body = `${input.taskTypeLabel} task ${taskRef} at ${input.warehouseName} (${input.companyName}) ` +
            `is ${input.overdueMinutes} min past its ${input.slaMinutes} min SLA.`;
        await this.prisma.notification.createMany({
            data: managers.map((manager) => ({
                userId: manager.id,
                type,
                title,
                body,
                referenceType: 'warehouse_task',
                referenceId: input.taskId,
                channel: client_1.NotificationChannel.in_app,
            })),
        });
        const rows = await this.prisma.notification.findMany({
            where: {
                type,
                referenceType: 'warehouse_task',
                referenceId: input.taskId,
                userId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        for (const row of rows) {
            if (!row.userId)
                continue;
            this.realtime.emitNotificationCreated((0, realtime_activity_payload_1.notificationPayload)(row), { userId: row.userId });
        }
        return managers.length;
    }
    async notifyAdminsClientProductAdded(input) {
        const admins = await this.prisma.user.findMany({
            where: {
                status: client_1.UserStatus.active,
                role: { in: ADMIN_NOTIFY_ROLES },
            },
            select: { id: true },
        });
        if (admins.length === 0)
            return;
        const skuRef = input.productSku || input.productId.slice(0, 8);
        await this.prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.id,
                type: 'admin_client_product_added',
                title: 'New client product',
                body: `${input.companyName} added product ${skuRef} — ${input.productName}.`,
                referenceType: 'product',
                referenceId: input.productId,
                channel: client_1.NotificationChannel.in_app,
            })),
        });
        await this.emitRecentAdminNotifications({
            type: 'admin_client_product_added',
            referenceType: 'product',
            referenceId: input.productId,
        });
    }
    async notifyAdminsPendingApproval(input) {
        const admins = await this.prisma.user.findMany({
            where: {
                status: client_1.UserStatus.active,
                role: { in: ADMIN_NOTIFY_ROLES },
            },
            select: { id: true },
        });
        if (admins.length === 0)
            return;
        const type = input.orderType === 'inbound'
            ? 'admin_inbound_pending_approval'
            : 'admin_outbound_pending_approval';
        const referenceType = input.orderType === 'inbound' ? 'inbound_order' : 'outbound_order';
        const label = input.orderType === 'inbound' ? 'Inbound' : 'Outbound';
        const orderRef = input.orderNumber || input.orderId.slice(0, 8);
        await this.prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.id,
                type,
                title: `${label} order needs approval`,
                body: `${input.companyName}: ${label.toLowerCase()} order ${orderRef} is waiting for your approval.`,
                referenceType,
                referenceId: input.orderId,
                channel: client_1.NotificationChannel.in_app,
            })),
        });
        await this.emitRecentAdminNotifications({
            type,
            referenceType,
            referenceId: input.orderId,
        });
    }
    async dismissPendingAdminNotifications(referenceType, referenceId) {
        const type = referenceType === 'inbound_order'
            ? 'admin_inbound_pending_approval'
            : 'admin_outbound_pending_approval';
        const rows = await this.prisma.notification.findMany({
            where: { referenceType, referenceId, type, isRead: false },
            select: { id: true, userId: true },
        });
        if (rows.length === 0)
            return;
        await this.prisma.notification.updateMany({
            where: { referenceType, referenceId, type, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        for (const row of rows) {
            if (row.userId) {
                this.realtime.emitNotificationDeleted(row.userId, row.id);
            }
        }
    }
    async notifyClientOrderConfirmed(input) {
        const referenceType = input.orderType === 'inbound' ? 'inbound_order' : 'outbound_order';
        const type = input.orderType === 'inbound' ? 'inbound_order_confirmed' : 'outbound_order_confirmed';
        const label = input.orderType === 'inbound' ? 'Inbound' : 'Outbound';
        const ref = input.orderNumber || input.orderId.slice(0, 8);
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type,
            title: `${label} order confirmed`,
            body: `Your ${label.toLowerCase()} order ${ref} was confirmed by the warehouse.`,
            referenceType,
            referenceId: input.orderId,
        });
    }
    async notifyClientOrderCompleted(input) {
        const referenceType = input.orderType === 'inbound' ? 'inbound_order' : 'outbound_order';
        const type = input.orderType === 'inbound' ? 'inbound_order_completed' : 'outbound_order_completed';
        const label = input.orderType === 'inbound' ? 'Inbound' : 'Outbound';
        const ref = input.orderNumber || input.orderId.slice(0, 8);
        const title = input.orderType === 'inbound' ? `${label} order completed` : `${label} order shipped`;
        const body = input.orderType === 'inbound'
            ? `Your inbound order ${ref} has been received and completed.`
            : `Your outbound order ${ref} has been shipped.`;
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type,
            title,
            body,
            referenceType,
            referenceId: input.orderId,
        });
    }
    async createClientNotificationOnce(input) {
        const existing = await this.prisma.notification.findFirst({
            where: {
                companyId: input.companyId,
                type: input.type,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
            },
            select: { id: true },
        });
        if (existing)
            return;
        const created = await this.prisma.notification.create({
            data: {
                companyId: input.companyId,
                type: input.type,
                title: input.title,
                body: input.body,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
                channel: client_1.NotificationChannel.in_app,
            },
        });
        this.realtime.emitNotificationCreated((0, realtime_activity_payload_1.notificationPayload)(created), {
            companyId: input.companyId,
        });
    }
    async emitRecentAdminNotifications(filter) {
        const rows = await this.prisma.notification.findMany({
            where: {
                type: filter.type,
                referenceType: filter.referenceType,
                referenceId: filter.referenceId,
                userId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        for (const row of rows) {
            if (!row.userId)
                continue;
            this.realtime.emitNotificationCreated((0, realtime_activity_payload_1.notificationPayload)(row), { userId: row.userId });
        }
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_service_1.RealtimeService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map