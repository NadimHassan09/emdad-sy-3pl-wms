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
    constructor(prisma) {
        this.prisma = prisma;
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
    async list(client, limit = 50) {
        const where = this.scopeWhere(client);
        const [items, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Math.min(Math.max(limit, 1), 100),
            }),
            this.prisma.notification.count({
                where: { ...where, isRead: false },
            }),
        ]);
        return {
            items: items.map(toDto),
            unreadCount,
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
        return toDto(updated);
    }
    async markAllRead(client) {
        const result = await this.prisma.notification.updateMany({
            where: { ...this.scopeWhere(client), isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
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
        await this.prisma.notification.create({
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
    }
};
exports.ClientNotificationsService = ClientNotificationsService;
exports.ClientNotificationsService = ClientNotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientNotificationsService);
//# sourceMappingURL=client-notifications.service.js.map