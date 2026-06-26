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
var BillingInvoiceOverdueProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingInvoiceOverdueProcessorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const billing_audit_service_1 = require("./billing-audit.service");
const billing_notifications_service_1 = require("./billing-notifications.service");
let BillingInvoiceOverdueProcessorService = BillingInvoiceOverdueProcessorService_1 = class BillingInvoiceOverdueProcessorService {
    prisma;
    notifications;
    billingAudit;
    cronLeader;
    log = new common_1.Logger(BillingInvoiceOverdueProcessorService_1.name);
    constructor(prisma, notifications, billingAudit, cronLeader) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.billingAudit = billingAudit;
        this.cronLeader = cronLeader;
    }
    async tick() {
        await this.cronLeader.runExclusive('billing-invoice-overdue-processor', 7200, () => this.runTick());
    }
    async runTick() {
        try {
            const n = await this.processOverdueInvoices();
            if (n > 0)
                this.log.log(`Marked ${n} invoice(s) overdue.`);
        }
        catch (err) {
            this.log.error('Overdue invoice processor failed', err);
        }
    }
    async processOverdueInvoices() {
        const now = new Date();
        const openInvoices = await this.prisma.invoice.findMany({
            where: { status: client_1.BillingInvoiceStatus.open, issuedAt: { not: null } },
            select: {
                id: true,
                companyId: true,
                invoiceNumber: true,
                issuedAt: true,
                company: { select: { name: true, paymentTermsDays: true } },
            },
        });
        let updated = 0;
        for (const inv of openInvoices) {
            if (!inv.issuedAt)
                continue;
            const dueAt = new Date(inv.issuedAt);
            dueAt.setUTCDate(dueAt.getUTCDate() + (inv.company.paymentTermsDays ?? 30));
            if (dueAt >= now)
                continue;
            await this.prisma.invoice.update({
                where: { id: inv.id },
                data: { status: client_1.BillingInvoiceStatus.overdue },
            });
            void this.billingAudit.system({
                action: billing_audit_service_1.BILLING_AUDIT_ACTIONS.INVOICE_OVERDUE,
                resourceType: 'invoice',
                resourceId: inv.id,
                companyId: inv.companyId,
                previousState: { status: 'open' },
                newState: { status: 'overdue', dueAt: dueAt.toISOString() },
            });
            void this.notifications.notifyInvoiceOverdue({
                companyId: inv.companyId,
                companyName: inv.company.name,
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
            });
            updated += 1;
        }
        return updated;
    }
};
exports.BillingInvoiceOverdueProcessorService = BillingInvoiceOverdueProcessorService;
__decorate([
    (0, schedule_1.Cron)('0 6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingInvoiceOverdueProcessorService.prototype, "tick", null);
exports.BillingInvoiceOverdueProcessorService = BillingInvoiceOverdueProcessorService = BillingInvoiceOverdueProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_notifications_service_1.BillingNotificationsService,
        billing_audit_service_1.BillingAuditService,
        cron_leader_service_1.CronLeaderService])
], BillingInvoiceOverdueProcessorService);
//# sourceMappingURL=billing-invoice-overdue-processor.service.js.map