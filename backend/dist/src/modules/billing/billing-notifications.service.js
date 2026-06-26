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
exports.BillingNotificationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_activity_payload_1 = require("../realtime/realtime-activity.payload");
const realtime_service_1 = require("../realtime/realtime.service");
const ADMIN_NOTIFY_ROLES = [
    client_1.UserRole.super_admin,
    client_1.UserRole.wh_manager,
    client_1.UserRole.finance,
];
const EXPIRY_REMINDER_DAYS = [30, 14, 7, 3, 1];
let BillingNotificationsService = class BillingNotificationsService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    async notifyInvoiceOverdue(input) {
        await this.notifyAdminsOnce({
            type: 'admin_billing_invoice_overdue',
            title: 'Invoice overdue',
            body: `${input.companyName}: invoice ${input.invoiceNumber} is past payment terms.`,
            referenceType: 'invoice',
            referenceId: input.invoiceId,
        });
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type: 'client_billing_invoice_overdue',
            title: 'Invoice overdue',
            body: `Your invoice ${input.invoiceNumber} is overdue. Please contact finance.`,
            referenceType: 'invoice',
            referenceId: input.invoiceId,
        });
    }
    async notifyInvoiceGenerated(input) {
        await this.notifyAdminsOnce({
            type: 'admin_billing_invoice_generated',
            title: 'Invoice generated',
            body: `${input.companyName}: invoice ${input.invoiceNumber} was issued for the billing cycle.`,
            referenceType: 'invoice',
            referenceId: input.invoiceId,
        });
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type: 'client_billing_invoice_generated',
            title: 'Invoice generated',
            body: `Your invoice ${input.invoiceNumber} has been generated and is ready for review.`,
            referenceType: 'invoice',
            referenceId: input.invoiceId,
        });
    }
    async notifyCycleExpiring(input) {
        const type = `admin_billing_cycle_expiring_${input.daysRemaining}d`;
        const clientType = `client_billing_cycle_expiring_${input.daysRemaining}d`;
        const endLabel = input.endsAt.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
        await this.notifyAdminsOnce({
            type,
            title: `Billing cycle expiring in ${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'}`,
            body: `${input.companyName}: billing cycle ends ${endLabel} (${input.daysRemaining} days remaining).`,
            referenceType: 'billing_cycle',
            referenceId: input.cycleId,
        });
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type: clientType,
            title: `Billing cycle expiring in ${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'}`,
            body: `Your billing cycle ends on ${endLabel}. Contact your account manager to renew.`,
            referenceType: 'billing_cycle',
            referenceId: input.cycleId,
        });
    }
    async notifyAccountSuspended(input) {
        await this.notifyAdminsOnce({
            type: 'admin_billing_account_suspended',
            title: 'Account suspended',
            body: `${input.companyName} was restricted — billing cycle expired without renewal.`,
            referenceType: 'billing_cycle',
            referenceId: input.cycleId,
        });
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type: 'client_billing_account_suspended',
            title: 'Account suspended',
            body: 'Your account has been restricted because your billing cycle expired. Please renew to restore access.',
            referenceType: 'billing_cycle',
            referenceId: input.cycleId,
        });
    }
    async notifyAccountRenewed(input) {
        await this.notifyAdminsOnce({
            type: 'admin_billing_account_renewed',
            title: 'Account renewed',
            body: `${input.companyName}: billing cycle renewed automatically.`,
            referenceType: 'billing_cycle',
            referenceId: input.nextCycleId,
        });
        await this.createClientNotificationOnce({
            companyId: input.companyId,
            type: 'client_billing_account_renewed',
            title: 'Account renewed',
            body: 'Your billing cycle has been renewed. Your account remains active.',
            referenceType: 'billing_cycle',
            referenceId: input.nextCycleId,
        });
    }
    expiryReminderDays() {
        return EXPIRY_REMINDER_DAYS;
    }
    async notifyAdminsOnce(input) {
        const existing = await this.prisma.notification.findFirst({
            where: {
                type: input.type,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
            },
            select: { id: true },
        });
        if (existing)
            return;
        const admins = await this.prisma.user.findMany({
            where: {
                status: client_1.UserStatus.active,
                role: { in: ADMIN_NOTIFY_ROLES },
            },
            select: { id: true },
        });
        if (admins.length === 0)
            return;
        await this.prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.id,
                type: input.type,
                title: input.title,
                body: input.body,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
                channel: client_1.NotificationChannel.in_app,
            })),
        });
        const rows = await this.prisma.notification.findMany({
            where: {
                type: input.type,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
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
};
exports.BillingNotificationsService = BillingNotificationsService;
exports.BillingNotificationsService = BillingNotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_service_1.RealtimeService])
], BillingNotificationsService);
//# sourceMappingURL=billing-notifications.service.js.map