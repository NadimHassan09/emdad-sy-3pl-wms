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
exports.BillingPreviewService = void 0;
const common_1 = require("@nestjs/common");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
const billing_usage_service_1 = require("./billing-usage.service");
let BillingPreviewService = class BillingPreviewService {
    prisma;
    companyAccess;
    usage;
    invoiceCalc;
    constructor(prisma, companyAccess, usage, invoiceCalc) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.usage = usage;
        this.invoiceCalc = invoiceCalc;
    }
    async getCompanyPreview(user, companyId) {
        this.companyAccess.assertCompanyAccess(user, companyId);
        const plan = await this.prisma.billingPlan.findFirst({
            where: { companyId, active: true },
            select: {
                id: true,
                cycleLengthDays: true,
                reservedVolume: true,
                reservedWeight: true,
                fixedSubscriptionFee: true,
            },
        });
        if (!plan)
            throw new common_1.NotFoundException('No active billing plan for this client.');
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
                startsAt: true,
                endsAt: true,
                status: true,
                rateSnapshot: true,
            },
        });
        if (!cycle)
            throw new common_1.NotFoundException('No active billing cycle for this client.');
        await this.invoiceCalc.recalculateForCompany(companyId, 'manual_preview');
        const invoice = await this.prisma.invoice.findFirst({
            where: { billingCycleId: cycle.id, status: 'draft' },
            select: {
                id: true,
                invoiceNumber: true,
                status: true,
                totalAmount: true,
                lines: {
                    select: {
                        id: true,
                        type: true,
                        quantity: true,
                        unitPrice: true,
                        totalPrice: true,
                    },
                },
            },
        });
        const usageTotals = await this.usage.getCompanyUsage(companyId);
        const daysRemaining = Math.max(0, Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000));
        return {
            companyId,
            plan,
            cycle: {
                id: cycle.id,
                startsAt: cycle.startsAt.toISOString(),
                endsAt: cycle.endsAt.toISOString(),
                status: cycle.status,
                daysRemaining,
                rateSnapshot: cycle.rateSnapshot,
            },
            usage: {
                usedVolumeCbm: usageTotals.volumeCbm.toString(),
                usedWeightKg: usageTotals.weightKg.toString(),
                allocatedVolumeCbm: plan.reservedVolume.toString(),
                allocatedWeightKg: plan.reservedWeight.toString(),
            },
            preview: invoice
                ? {
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    status: invoice.status,
                    subtotal: invoice.totalAmount.toString(),
                    tax: '0',
                    discount: '0',
                    grandTotal: invoice.totalAmount.toString(),
                    lines: invoice.lines.map((l) => ({
                        ...l,
                        quantity: l.quantity.toString(),
                        unitPrice: l.unitPrice.toString(),
                        totalPrice: l.totalPrice.toString(),
                    })),
                }
                : null,
        };
    }
};
exports.BillingPreviewService = BillingPreviewService;
exports.BillingPreviewService = BillingPreviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        billing_usage_service_1.BillingUsageService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService])
], BillingPreviewService);
//# sourceMappingURL=billing-preview.service.js.map