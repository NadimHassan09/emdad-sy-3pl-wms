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
var BillingInvoiceCalculationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingInvoiceCalculationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_rate_snapshot_util_1 = require("./billing-rate-snapshot.util");
const billing_usage_service_1 = require("./billing-usage.service");
const MS_PER_DAY = 86_400_000;
const PLAN_RATE_SELECT = {
    id: true,
    fixedSubscriptionFee: true,
    inboundOrderFee: true,
    outboundOrderFee: true,
    packagingFee: true,
    qualityCheckFee: true,
    excessVolumeFeePerDay: true,
    excessWeightFeePerDay: true,
    reservedVolume: true,
    reservedWeight: true,
};
let BillingInvoiceCalculationService = BillingInvoiceCalculationService_1 = class BillingInvoiceCalculationService {
    prisma;
    usage;
    audit;
    log = new common_1.Logger(BillingInvoiceCalculationService_1.name);
    constructor(prisma, usage, audit) {
        this.prisma = prisma;
        this.usage = usage;
        this.audit = audit;
    }
    async recalculateForCompany(companyId, trigger) {
        try {
            return await this.recalculateForCompanyInternal(companyId, trigger);
        }
        catch (err) {
            this.log.error(`Invoice recalculation failed company=${companyId} trigger=${trigger}`, err instanceof Error ? err.stack : String(err));
            return null;
        }
    }
    async finalizeCycleInvoice(tx, billingCycleId) {
        const now = new Date();
        await tx.invoice.updateMany({
            where: { billingCycleId, status: client_1.BillingInvoiceStatus.draft },
            data: {
                status: client_1.BillingInvoiceStatus.open,
                issuedAt: now,
            },
        });
    }
    async recalculateForCompanyInternal(companyId, trigger) {
        const now = new Date();
        const cycle = await this.prisma.billingCycle.findFirst({
            where: {
                companyId,
                status: { in: ['active', 'renewed'] },
                startsAt: { lte: now },
                endsAt: { gt: now },
            },
            select: {
                id: true,
                companyId: true,
                billingPlanId: true,
                startsAt: true,
                endsAt: true,
                rateSnapshot: true,
            },
        });
        if (!cycle)
            return null;
        const rates = await this.resolveCycleRates(cycle);
        if (!rates)
            return null;
        const windowEnd = cycle.endsAt < now ? cycle.endsAt : now;
        const metrics = await this.collectCycleMetrics(companyId, cycle.startsAt, windowEnd);
        const daysElapsed = this.daysElapsedInCycle(cycle.startsAt, windowEnd);
        const lines = this.computeLines(rates, metrics, daysElapsed);
        const result = await this.prisma.$transaction(async (tx) => {
            const invoice = await this.getOrCreateDraftInvoice(tx, companyId, cycle.id);
            const previousTotal = invoice.totalAmount.toString();
            for (const line of lines) {
                await this.upsertInvoiceLine(tx, invoice.id, line);
            }
            const totalAmount = lines.reduce((sum, l) => sum.add(new client_1.Prisma.Decimal(l.totalPrice)), new client_1.Prisma.Decimal(0));
            await tx.invoice.update({
                where: { id: invoice.id },
                data: { totalAmount },
            });
            return {
                invoiceId: invoice.id,
                billingCycleId: cycle.id,
                companyId,
                totalAmount: totalAmount.toString(),
                lines,
                trigger,
                previousTotal,
            };
        });
        await this.audit.logBestEffort({
            actorId: null,
            actorEmail: 'billing-engine@system.local',
            actorName: 'Billing Engine',
            actorRole: 'system',
            companyId,
            action: 'BILLING_INVOICE_RECALCULATED',
            resourceType: 'invoice',
            resourceId: result.invoiceId,
            previousState: { totalAmount: result.previousTotal },
            newState: {
                trigger,
                billingCycleId: result.billingCycleId,
                totalAmount: result.totalAmount,
                lines: result.lines,
            },
        });
        return {
            invoiceId: result.invoiceId,
            billingCycleId: result.billingCycleId,
            companyId: result.companyId,
            totalAmount: result.totalAmount,
            lines: result.lines,
            trigger: result.trigger,
        };
    }
    async resolveCycleRates(cycle) {
        const fromSnapshot = (0, billing_rate_snapshot_util_1.parseRateSnapshot)(cycle.rateSnapshot);
        if (fromSnapshot)
            return (0, billing_rate_snapshot_util_1.rateSnapshotToDecimals)(fromSnapshot);
        const plan = await this.prisma.billingPlan.findUnique({
            where: { id: cycle.billingPlanId },
            select: PLAN_RATE_SELECT,
        });
        if (!plan)
            return null;
        return (0, billing_rate_snapshot_util_1.rateSnapshotToDecimals)({
            billingPlanId: plan.id,
            fixedSubscriptionFee: plan.fixedSubscriptionFee.toString(),
            inboundOrderFee: plan.inboundOrderFee.toString(),
            outboundOrderFee: plan.outboundOrderFee.toString(),
            packagingFee: plan.packagingFee.toString(),
            qualityCheckFee: plan.qualityCheckFee.toString(),
            excessVolumeFeePerDay: plan.excessVolumeFeePerDay.toString(),
            excessWeightFeePerDay: plan.excessWeightFeePerDay.toString(),
            reservedVolume: plan.reservedVolume.toString(),
            reservedWeight: plan.reservedWeight.toString(),
            snapshottedAt: new Date(0).toISOString(),
        });
    }
    async collectCycleMetrics(companyId, windowStart, windowEnd) {
        const [inboundCount, outboundCount, packagingCount, qcCount, usage] = await Promise.all([
            this.prisma.inboundOrder.count({
                where: {
                    companyId,
                    status: 'completed',
                    completedAt: { gte: windowStart, lte: windowEnd },
                },
            }),
            this.prisma.outboundOrder.count({
                where: {
                    companyId,
                    status: 'shipped',
                    shippedAt: { gte: windowStart, lte: windowEnd },
                },
            }),
            this.prisma.warehouseTask.count({
                where: {
                    taskType: 'pack',
                    status: 'completed',
                    completedAt: { gte: windowStart, lte: windowEnd },
                    workflowInstance: { companyId, referenceType: 'outbound_order' },
                },
            }),
            this.prisma.warehouseTask.count({
                where: {
                    taskType: 'qc',
                    status: 'completed',
                    completedAt: { gte: windowStart, lte: windowEnd },
                    workflowInstance: { companyId, referenceType: 'inbound_order' },
                },
            }),
            this.usage.getCompanyUsage(companyId),
        ]);
        return {
            inboundCount,
            outboundCount,
            packagingCount,
            qcCount,
            usageVolumeCbm: usage.volumeCbm,
            usageWeightKg: usage.weightKg,
        };
    }
    computeLines(rates, metrics, daysElapsed) {
        const excessVolume = client_1.Prisma.Decimal.max(metrics.usageVolumeCbm.sub(rates.reservedVolume), new client_1.Prisma.Decimal(0));
        const excessWeight = client_1.Prisma.Decimal.max(metrics.usageWeightKg.sub(rates.reservedWeight), new client_1.Prisma.Decimal(0));
        const dayFactor = new client_1.Prisma.Decimal(daysElapsed);
        const specs = [
            {
                type: 'subscription',
                quantity: new client_1.Prisma.Decimal(1),
                unitPrice: rates.fixedSubscriptionFee,
            },
            {
                type: 'inbound',
                quantity: new client_1.Prisma.Decimal(metrics.inboundCount),
                unitPrice: rates.inboundOrderFee,
            },
            {
                type: 'outbound',
                quantity: new client_1.Prisma.Decimal(metrics.outboundCount),
                unitPrice: rates.outboundOrderFee,
            },
            {
                type: 'packaging',
                quantity: new client_1.Prisma.Decimal(metrics.packagingCount),
                unitPrice: rates.packagingFee,
            },
            {
                type: 'quality_check',
                quantity: new client_1.Prisma.Decimal(metrics.qcCount),
                unitPrice: rates.qualityCheckFee,
            },
            {
                type: 'excess_volume',
                quantity: excessVolume.mul(dayFactor),
                unitPrice: rates.excessVolumeFeePerDay,
            },
            {
                type: 'excess_weight',
                quantity: excessWeight.mul(dayFactor),
                unitPrice: rates.excessWeightFeePerDay,
            },
        ];
        return specs.map(({ type, quantity, unitPrice }) => {
            const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
            return {
                type,
                quantity: quantity.toFixed(4),
                unitPrice: unitPrice.toFixed(4),
                totalPrice: totalPrice.toFixed(2),
            };
        });
    }
    daysElapsedInCycle(startsAt, asOf) {
        const ms = Math.max(0, asOf.getTime() - startsAt.getTime());
        return Math.max(1, Math.ceil(ms / MS_PER_DAY));
    }
    async getOrCreateDraftInvoice(tx, companyId, billingCycleId) {
        const existing = await tx.invoice.findFirst({
            where: { billingCycleId, status: client_1.BillingInvoiceStatus.draft },
        });
        if (existing)
            return existing;
        return tx.invoice.create({
            data: { companyId, billingCycleId, status: client_1.BillingInvoiceStatus.draft },
        });
    }
    async upsertInvoiceLine(tx, invoiceId, line) {
        const quantity = new client_1.Prisma.Decimal(line.quantity);
        const unitPrice = new client_1.Prisma.Decimal(line.unitPrice);
        const totalPrice = new client_1.Prisma.Decimal(line.totalPrice);
        const existing = await tx.invoiceLine.findFirst({
            where: { invoiceId, type: line.type },
        });
        if (existing) {
            return tx.invoiceLine.update({
                where: { id: existing.id },
                data: { quantity, unitPrice, totalPrice },
            });
        }
        return tx.invoiceLine.create({
            data: {
                invoiceId,
                type: line.type,
                quantity,
                unitPrice,
                totalPrice,
            },
        });
    }
};
exports.BillingInvoiceCalculationService = BillingInvoiceCalculationService;
exports.BillingInvoiceCalculationService = BillingInvoiceCalculationService = BillingInvoiceCalculationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_usage_service_1.BillingUsageService,
        audit_log_service_1.AuditLogService])
], BillingInvoiceCalculationService);
//# sourceMappingURL=billing-invoice-calculation.service.js.map