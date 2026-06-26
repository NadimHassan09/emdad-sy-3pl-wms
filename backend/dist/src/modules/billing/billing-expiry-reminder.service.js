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
var BillingExpiryReminderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingExpiryReminderService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const billing_notifications_service_1 = require("./billing-notifications.service");
const MS_PER_DAY = 86_400_000;
let BillingExpiryReminderService = BillingExpiryReminderService_1 = class BillingExpiryReminderService {
    prisma;
    notifications;
    cronLeader;
    log = new common_1.Logger(BillingExpiryReminderService_1.name);
    constructor(prisma, notifications, cronLeader) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.cronLeader = cronLeader;
    }
    async tick() {
        await this.cronLeader.runExclusive('billing-expiry-reminder', 7200, () => this.runTick());
    }
    async runTick() {
        try {
            const sent = await this.sendDueReminders();
            if (sent > 0) {
                this.log.log(`Sent ${sent} billing expiry reminder(s).`);
            }
        }
        catch (err) {
            this.log.error('Billing expiry reminder tick failed', err);
        }
    }
    async sendDueReminders() {
        const now = new Date();
        let sent = 0;
        for (const days of this.notifications.expiryReminderDays()) {
            const windowStart = new Date(now.getTime() + (days - 1) * MS_PER_DAY);
            const windowEnd = new Date(now.getTime() + days * MS_PER_DAY);
            const cycles = await this.prisma.billingCycle.findMany({
                where: {
                    status: { in: ['active', 'renewed'] },
                    endsAt: { gt: now, gte: windowStart, lt: windowEnd },
                },
                select: {
                    id: true,
                    companyId: true,
                    endsAt: true,
                    company: { select: { name: true } },
                },
            });
            for (const cycle of cycles) {
                const daysRemaining = Math.ceil((cycle.endsAt.getTime() - now.getTime()) / MS_PER_DAY);
                if (!this.notifications.expiryReminderDays().includes(daysRemaining))
                    continue;
                await this.notifications.notifyCycleExpiring({
                    companyId: cycle.companyId,
                    companyName: cycle.company.name,
                    cycleId: cycle.id,
                    endsAt: cycle.endsAt,
                    daysRemaining,
                });
                sent += 1;
            }
        }
        return sent;
    }
};
exports.BillingExpiryReminderService = BillingExpiryReminderService;
__decorate([
    (0, schedule_1.Cron)('0 8 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingExpiryReminderService.prototype, "tick", null);
exports.BillingExpiryReminderService = BillingExpiryReminderService = BillingExpiryReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_notifications_service_1.BillingNotificationsService,
        cron_leader_service_1.CronLeaderService])
], BillingExpiryReminderService);
//# sourceMappingURL=billing-expiry-reminder.service.js.map