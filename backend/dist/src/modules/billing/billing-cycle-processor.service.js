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
var BillingCycleProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingCycleProcessorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const billing_cycles_service_1 = require("./billing-cycles.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
const billing_audit_service_1 = require("./billing-audit.service");
const billing_notifications_service_1 = require("./billing-notifications.service");
let BillingCycleProcessorService = BillingCycleProcessorService_1 = class BillingCycleProcessorService {
    prisma;
    billingCycles;
    invoiceCalc;
    billingNotifications;
    billingAudit;
    cronLeader;
    log = new common_1.Logger(BillingCycleProcessorService_1.name);
    constructor(prisma, billingCycles, invoiceCalc, billingNotifications, billingAudit, cronLeader) {
        this.prisma = prisma;
        this.billingCycles = billingCycles;
        this.invoiceCalc = invoiceCalc;
        this.billingNotifications = billingNotifications;
        this.billingAudit = billingAudit;
        this.cronLeader = cronLeader;
    }
    async tick() {
        await this.cronLeader.runExclusive('billing-cycle-processor', 960, () => this.runTick());
    }
    async runTick() {
        try {
            const n = await this.processExpiredCycles();
            if (n > 0) {
                this.log.log(`Processed ${n} expired billing cycle(s).`);
            }
        }
        catch (err) {
            this.log.error('Billing cycle processor tick failed', err);
        }
    }
    async processExpiredCycles() {
        const now = new Date();
        const due = await this.prisma.billingCycle.findMany({
            where: {
                status: { in: ['active', 'renewed'] },
                endsAt: { lte: now },
            },
            select: {
                id: true,
                companyId: true,
                billingPlanId: true,
                endsAt: true,
                status: true,
            },
        });
        for (const cycle of due) {
            let renewedCompanyId = null;
            let nextCycleId = null;
            const company = await this.prisma.company.findUnique({
                where: { id: cycle.companyId },
                select: { name: true, status: true },
            });
            const companyName = company?.name ?? cycle.companyId;
            const billingLockedStatuses = [
                client_1.CompanyStatus.archived,
                client_1.CompanyStatus.purged,
                client_1.CompanyStatus.closed,
                client_1.CompanyStatus.offboarding,
            ];
            const billingLocked = !!company && billingLockedStatuses.includes(company.status);
            if (billingLocked) {
                await this.prisma.billingCycle.update({
                    where: { id: cycle.id },
                    data: { status: 'expired' },
                });
                this.log.log(`Skipped billing renewal/invoicing for ${company.status} company ${cycle.companyId}.`);
                continue;
            }
            await this.prisma.$transaction(async (tx) => {
                await this.invoiceCalc.finalizeCycleInvoice(tx, cycle.id);
                await tx.billingCycle.update({
                    where: { id: cycle.id },
                    data: { status: 'expired' },
                });
                if (cycle.status === 'renewed') {
                    const next = await this.billingCycles.createNextCycleFromPlan(tx, cycle);
                    if (next) {
                        await tx.company.update({
                            where: { id: cycle.companyId },
                            data: { status: client_1.CompanyStatus.active },
                        });
                        renewedCompanyId = cycle.companyId;
                        nextCycleId = next.id;
                        this.log.log(`Renewed billing cycle for company ${cycle.companyId}: ${next.id}`);
                        return;
                    }
                }
                await tx.company.update({
                    where: { id: cycle.companyId },
                    data: { status: client_1.CompanyStatus.restricted },
                });
                this.log.warn(`Restricted company ${cycle.companyId} — billing cycle ${cycle.id} expired without renewal.`);
            });
            const issuedInvoice = await this.prisma.invoice.findFirst({
                where: { billingCycleId: cycle.id, status: 'open' },
                orderBy: { issuedAt: 'desc' },
                select: { id: true, invoiceNumber: true },
            });
            if (issuedInvoice) {
                void this.billingAudit.system({
                    action: billing_audit_service_1.BILLING_AUDIT_ACTIONS.INVOICE_GENERATED,
                    resourceType: 'invoice',
                    resourceId: issuedInvoice.id,
                    companyId: cycle.companyId,
                    newState: { invoiceNumber: issuedInvoice.invoiceNumber, billingCycleId: cycle.id },
                });
                void this.billingNotifications.notifyInvoiceGenerated({
                    companyId: cycle.companyId,
                    companyName,
                    invoiceId: issuedInvoice.id,
                    invoiceNumber: issuedInvoice.invoiceNumber,
                    billingCycleId: cycle.id,
                });
            }
            if (renewedCompanyId && nextCycleId) {
                void this.billingNotifications.notifyAccountRenewed({
                    companyId: cycle.companyId,
                    companyName,
                    previousCycleId: cycle.id,
                    nextCycleId,
                });
                void this.invoiceCalc.recalculateForCompany(renewedCompanyId, 'cycle_started');
            }
            else {
                void this.billingAudit.system({
                    action: billing_audit_service_1.BILLING_AUDIT_ACTIONS.PLAN_SUSPENDED,
                    resourceType: 'billing_cycle',
                    resourceId: cycle.id,
                    companyId: cycle.companyId,
                    newState: { companyStatus: 'restricted' },
                });
                void this.billingNotifications.notifyAccountSuspended({
                    companyId: cycle.companyId,
                    companyName,
                    cycleId: cycle.id,
                });
            }
        }
        return due.length;
    }
};
exports.BillingCycleProcessorService = BillingCycleProcessorService;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingCycleProcessorService.prototype, "tick", null);
exports.BillingCycleProcessorService = BillingCycleProcessorService = BillingCycleProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_cycles_service_1.BillingCyclesService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService,
        billing_notifications_service_1.BillingNotificationsService,
        billing_audit_service_1.BillingAuditService,
        cron_leader_service_1.CronLeaderService])
], BillingCycleProcessorService);
//# sourceMappingURL=billing-cycle-processor.service.js.map