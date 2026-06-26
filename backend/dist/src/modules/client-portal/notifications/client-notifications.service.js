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
exports.ClientNotificationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const realtime_activity_payload_1 = require("../../realtime/realtime-activity.payload");
const realtime_service_1 = require("../../realtime/realtime.service");
const IN_APP_CHANNELS = [
    client_1.NotificationChannel.in_app,
    client_1.NotificationChannel.both,
];
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
let ClientNotificationsService = class ClientNotificationsService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    scopeWhere(client) {
        return {
            channel: { in: IN_APP_CHANNELS },
            OR: [
                { companyId: client.companyId, userId: null },
                { userId: client.id },
            ],
        };
    }
    async list(client, params = {}) {
        const where = this.scopeWhere(client);
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
                where: { ...where, isRead: false },
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
    async markRead(client, id) {
        const row = await this.prisma.notification.findFirst({
            where: { id, ...this.scopeWhere(client) },
        });
        if (!row)
            throw new common_1.NotFoundException('Notification not found.');
        const updated = await this.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
        const dto = toDto(updated);
        this.realtime.emitNotificationRead(client.id, { notification: (0, realtime_activity_payload_1.notificationPayload)(updated) });
        return dto;
    }
    async markAllRead(client) {
        const result = await this.prisma.notification.updateMany({
            where: { ...this.scopeWhere(client), isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        this.realtime.emitNotificationRead(client.id, { markAllRead: true });
        return { updated: result.count };
    }
    async notifyCompany(companyId, input) {
        if (input.referenceType && input.referenceId) {
            const existing = await this.prisma.notification.findFirst({
                where: {
                    companyId,
                    userId: null,
                    type: input.type,
                    referenceType: input.referenceType,
                    referenceId: input.referenceId,
                },
                select: { id: true },
            });
            if (existing)
                return;
        }
        const created = await this.prisma.notification.create({
            data: {
                companyId,
                userId: null,
                type: input.type,
                title: input.title,
                body: input.body,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
                channel: client_1.NotificationChannel.in_app,
            },
        });
        this.realtime.emitNotificationCreated((0, realtime_activity_payload_1.notificationPayload)(created), { companyId });
    }
};
exports.ClientNotificationsService = ClientNotificationsService;
exports.ClientNotificationsService = ClientNotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_service_1.RealtimeService])
], ClientNotificationsService);
//# sourceMappingURL=client-notifications.service.js.map