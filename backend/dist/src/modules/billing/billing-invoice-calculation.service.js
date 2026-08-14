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
const billing_totals_util_1 = require("./billing-totals.util");
const SYSTEM_LINE_TYPES = [
    'subscription',
    'inbound',
    'outbound',
];
const RETIRED_USAGE_LINE_TYPES = [
    'packaging',
    'quality_check',
    'excess_volume',
    'excess_weight',
];
const PLAN_RATE_SELECT = {
    id: true,
    fixedSubscriptionFee: true,
    inboundOrderFee: true,
    outboundOrderFee: true,
    outboundBaseFee: true,
    outboundIncludedItems: true,
    outboundAdditionalItemFee: true,
    packagingFee: true,
    qualityCheckFee: true,
    excessVolumeFeePerDay: true,
    excessWeightFeePerDay: true,
    reservedVolume: true,
    reservedWeight: true,
};
let BillingInvoiceCalculationService = BillingInvoiceCalculationService_1 = class BillingInvoiceCalculationService {
    prisma;
    audit;
    log = new common_1.Logger(BillingInvoiceCalculationService_1.name);
    constructor(prisma, audit) {
        this.prisma = prisma;
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
        const invoices = await tx.invoice.findMany({
            where: { billingCycleId, status: client_1.BillingInvoiceStatus.draft },
            select: { id: true, companyId: true },
        });
        for (const inv of invoices) {
            const company = await tx.company.findUnique({
                where: { id: inv.companyId },
                select: { paymentTermsDays: true },
            });
            const dueDate = new Date(now);
            dueDate.setUTCDate(dueDate.getUTCDate() + (company?.paymentTermsDays ?? 30));
            await tx.invoice.update({
                where: { id: inv.id },
                data: {
                    status: client_1.BillingInvoiceStatus.unpaid,
                    issuedAt: now,
                    dueDate,
                },
            });
        }
    }
    async applyInvoiceTotals(tx, invoiceId) {
        const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                discountType: true,
                discountValue: true,
                vatPercentage: true,
                lines: { select: { totalPrice: true } },
            },
        });
        if (!invoice)
            return new client_1.Prisma.Decimal(0);
        const subtotalAmount = (0, billing_totals_util_1.sumLineTotals)(invoice.lines);
        const totals = (0, billing_totals_util_1.computeInvoiceTotals)({
            subtotalAmount,
            discountType: invoice.discountType,
            discountValue: invoice.discountValue,
            vatPercentage: invoice.vatPercentage,
        });
        await tx.invoice.update({
            where: { id: invoiceId },
            data: {
                subtotalAmount: totals.subtotalAmount,
                discountAmount: totals.discountAmount,
                vatAmount: totals.vatAmount,
                grandTotal: totals.grandTotal,
                totalAmount: totals.grandTotal,
            },
        });
        return totals.grandTotal;
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
        const lines = this.computeLines(rates, metrics);
        const result = await this.prisma.$transaction(async (tx) => {
            const invoice = await this.getOrCreateDraftInvoice(tx, companyId, cycle.id);
            const previousTotal = invoice.grandTotal.toString();
            await tx.invoiceLine.deleteMany({
                where: {
                    invoiceId: invoice.id,
                    lineSource: client_1.BillingInvoiceLineSource.system,
                    type: { in: RETIRED_USAGE_LINE_TYPES },
                },
            });
            for (const line of lines) {
                await this.upsertSystemInvoiceLine(tx, invoice.id, line);
            }
            await this.syncOrderChargeLines(tx, invoice.id, companyId, cycle.startsAt, windowEnd);
            const totalAmount = await this.applyInvoiceTotals(tx, invoice.id);
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
        const outboundBaseFee = plan.outboundBaseFee.gt(0)
            ? plan.outboundBaseFee
            : plan.outboundOrderFee;
        return (0, billing_rate_snapshot_util_1.rateSnapshotToDecimals)({
            billingPlanId: plan.id,
            fixedSubscriptionFee: plan.fixedSubscriptionFee.toString(),
            inboundOrderFee: plan.inboundOrderFee.toString(),
            outboundOrderFee: plan.outboundOrderFee.toString(),
            outboundBaseFee: outboundBaseFee.toString(),
            outboundIncludedItems: plan.outboundIncludedItems,
            outboundAdditionalItemFee: plan.outboundAdditionalItemFee.toString(),
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
        const [inboundCount, outboundCount] = await Promise.all([
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
        ]);
        return { inboundCount, outboundCount };
    }
    static computeSystemLines(rates, metrics) {
        const lines = [];
        for (const type of SYSTEM_LINE_TYPES) {
            let quantity;
            let unitPrice;
            if (type === 'subscription') {
                quantity = new client_1.Prisma.Decimal(1);
                unitPrice = rates.fixedSubscriptionFee;
            }
            else if (type === 'inbound') {
                quantity = new client_1.Prisma.Decimal(metrics.inboundCount);
                unitPrice = rates.inboundOrderFee;
            }
            else {
                quantity = new client_1.Prisma.Decimal(metrics.outboundCount);
                unitPrice = rates.outboundOrderFee;
            }
            const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
            lines.push({
                type,
                quantity: quantity.toFixed(4),
                unitPrice: unitPrice.toFixed(4),
                totalPrice: totalPrice.toFixed(2),
            });
        }
        return lines;
    }
    computeLines(rates, metrics) {
        return BillingInvoiceCalculationService_1.computeSystemLines(rates, metrics);
    }
    async syncOrderChargeLines(tx, invoiceId, companyId, windowStart, windowEnd) {
        const [inboundOrders, outboundOrders] = await Promise.all([
            tx.inboundOrder.findMany({
                where: {
                    companyId,
                    status: 'completed',
                    completedAt: { gte: windowStart, lte: windowEnd },
                },
                select: { id: true },
            }),
            tx.outboundOrder.findMany({
                where: {
                    companyId,
                    status: 'shipped',
                    shippedAt: { gte: windowStart, lte: windowEnd },
                },
                select: { id: true },
            }),
        ]);
        const inboundIds = inboundOrders.map((o) => o.id);
        const outboundIds = outboundOrders.map((o) => o.id);
        const charges = inboundIds.length || outboundIds.length
            ? await tx.orderManualCharge.findMany({
                where: {
                    companyId,
                    OR: [
                        ...(inboundIds.length
                            ? [{ referenceType: 'inbound_order', referenceId: { in: inboundIds } }]
                            : []),
                        ...(outboundIds.length
                            ? [{ referenceType: 'outbound_order', referenceId: { in: outboundIds } }]
                            : []),
                    ],
                },
            })
            : [];
        const chargeIds = charges.map((c) => c.id);
        await tx.invoiceLine.deleteMany({
            where: {
                invoiceId,
                lineSource: client_1.BillingInvoiceLineSource.order,
                ...(chargeIds.length ? { orderChargeId: { notIn: chargeIds } } : {}),
            },
        });
        if (!chargeIds.length) {
            await tx.invoiceLine.deleteMany({
                where: { invoiceId, lineSource: client_1.BillingInvoiceLineSource.order },
            });
            return;
        }
        for (const charge of charges) {
            const existing = await tx.invoiceLine.findFirst({
                where: { invoiceId, orderChargeId: charge.id },
            });
            const data = {
                type: client_1.BillingInvoiceLineType.order_charge,
                lineSource: client_1.BillingInvoiceLineSource.order,
                description: charge.description,
                quantity: charge.quantity,
                unitPrice: charge.unitPrice,
                totalPrice: charge.totalPrice,
                orderChargeId: charge.id,
            };
            if (existing) {
                await tx.invoiceLine.update({ where: { id: existing.id }, data });
            }
            else {
                await tx.invoiceLine.create({ data: { invoiceId, ...data } });
            }
        }
    }
    async getOrCreateDraftInvoice(tx, companyId, billingCycleId) {
        const existing = await tx.invoice.findFirst({
            where: { billingCycleId, status: client_1.BillingInvoiceStatus.draft },
        });
        if (existing)
            return existing;
        return tx.invoice.create({
            data: {
                companyId,
                billingCycleId,
                invoiceSource: 'cycle',
                status: client_1.BillingInvoiceStatus.draft,
            },
        });
    }
    async upsertSystemInvoiceLine(tx, invoiceId, line) {
        const quantity = new client_1.Prisma.Decimal(line.quantity);
        const unitPrice = new client_1.Prisma.Decimal(line.unitPrice);
        const totalPrice = new client_1.Prisma.Decimal(line.totalPrice);
        const existing = await tx.invoiceLine.findFirst({
            where: {
                invoiceId,
                type: line.type,
                lineSource: client_1.BillingInvoiceLineSource.system,
            },
        });
        const data = { quantity, unitPrice, totalPrice };
        if (existing) {
            return tx.invoiceLine.update({ where: { id: existing.id }, data });
        }
        return tx.invoiceLine.create({
            data: {
                invoiceId,
                type: line.type,
                lineSource: client_1.BillingInvoiceLineSource.system,
                ...data,
            },
        });
    }
};
exports.BillingInvoiceCalculationService = BillingInvoiceCalculationService;
exports.BillingInvoiceCalculationService = BillingInvoiceCalculationService = BillingInvoiceCalculationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], BillingInvoiceCalculationService);
//# sourceMappingURL=billing-invoice-calculation.service.js.map