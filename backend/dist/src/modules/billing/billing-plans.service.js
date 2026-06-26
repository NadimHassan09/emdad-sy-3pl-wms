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
exports.BillingPlansService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_access_service_1 = require("./billing-access.service");
const billing_audit_service_1 = require("./billing-audit.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
const billing_rate_snapshot_util_1 = require("./billing-rate-snapshot.util");
const billing_plans_list_query_1 = require("./billing-plans-list.query");
const PLAN_SELECT = {
    id: true,
    companyId: true,
    active: true,
    cycleLengthDays: true,
    fixedSubscriptionFee: true,
    inboundOrderFee: true,
    outboundOrderFee: true,
    packagingFee: true,
    qualityCheckFee: true,
    excessVolumeFeePerDay: true,
    excessWeightFeePerDay: true,
    reservedVolume: true,
    reservedWeight: true,
    createdAt: true,
    updatedAt: true,
};
let BillingPlansService = class BillingPlansService {
    prisma;
    companyAccess;
    volumeCapacity;
    invoiceCalc;
    billingAudit;
    constructor(prisma, companyAccess, volumeCapacity, invoiceCalc, billingAudit) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.volumeCapacity = volumeCapacity;
        this.invoiceCalc = invoiceCalc;
        this.billingAudit = billingAudit;
    }
    async listPage(user, query) {
        if (query.companyId) {
            this.companyAccess.assertCompanyAccess(user, query.companyId);
        }
        const tenantCompanyIds = user.tenantScope === 'restricted' ? user.authorizedCompanyIds : null;
        const [countRows, items] = await Promise.all([
            this.prisma.$queryRaw((0, billing_plans_list_query_1.billingPlansOverviewCountSql)(query, tenantCompanyIds)),
            this.prisma.$queryRaw((0, billing_plans_list_query_1.billingPlansOverviewListSql)(query, tenantCompanyIds)),
        ]);
        return {
            items: items.map(mapOverviewSqlRow),
            total: countRows[0]?.total ?? 0,
            limit: query.limit,
            offset: query.offset,
        };
    }
    list(user, companyId) {
        const where = {};
        if (companyId) {
            this.companyAccess.assertCompanyAccess(user, companyId);
            where.companyId = companyId;
        }
        else if (user.tenantScope === 'restricted') {
            where.companyId = { in: user.authorizedCompanyIds };
        }
        return this.prisma.billingPlan.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: PLAN_SELECT,
        });
    }
    async findById(user, id) {
        const plan = await this.prisma.billingPlan.findUnique({
            where: { id },
            select: PLAN_SELECT,
        });
        if (!plan)
            throw new common_1.NotFoundException('Billing plan not found.');
        this.companyAccess.assertCompanyAccess(user, plan.companyId);
        return plan;
    }
    async create(user, dto) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.volumeCapacity.assertVolumeAllocation(dto.reservedVolume ?? 0);
        await this.volumeCapacity.assertWeightAllocation(dto.reservedWeight ?? 0);
        const existing = await this.prisma.billingPlan.findFirst({
            where: { companyId, active: true },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.BadRequestException('This client already has an active billing plan. Deactivate it before creating a new one.');
        }
        return this.prisma.$transaction(async (tx) => {
            const plan = await tx.billingPlan.create({
                data: {
                    companyId,
                    active: dto.active ?? true,
                    cycleLengthDays: dto.cycleLengthDays,
                    fixedSubscriptionFee: dto.fixedSubscriptionFee ?? 0,
                    inboundOrderFee: dto.inboundOrderFee ?? 0,
                    outboundOrderFee: dto.outboundOrderFee ?? 0,
                    packagingFee: dto.packagingFee ?? 0,
                    qualityCheckFee: dto.qualityCheckFee ?? 0,
                    excessVolumeFeePerDay: dto.excessVolumeFeePerDay ?? 0,
                    excessWeightFeePerDay: dto.excessWeightFeePerDay ?? 0,
                    reservedVolume: dto.reservedVolume ?? 0,
                    reservedWeight: dto.reservedWeight ?? 0,
                },
                select: PLAN_SELECT,
            });
            const startsAt = dto.cycleStartsAt ? new Date(dto.cycleStartsAt) : new Date();
            const endsAt = new Date(startsAt);
            endsAt.setUTCDate(endsAt.getUTCDate() + dto.cycleLengthDays);
            await tx.billingCycle.create({
                data: {
                    companyId,
                    billingPlanId: plan.id,
                    startsAt,
                    endsAt,
                    status: 'active',
                    rateSnapshot: (0, billing_rate_snapshot_util_1.buildRateSnapshotFromPlan)(plan),
                },
            });
            return plan;
        }).then(async (plan) => {
            void this.billingAudit.fromUser(user, {
                action: billing_audit_service_1.BILLING_AUDIT_ACTIONS.PLAN_CREATED,
                resourceType: 'billing_plan',
                resourceId: plan.id,
                companyId: plan.companyId,
                newState: plan,
            });
            void this.invoiceCalc.recalculateForCompany(plan.companyId, 'cycle_started');
            return plan;
        });
    }
    async update(user, id, dto) {
        await this.findById(user, id);
        const previous = await this.findById(user, id);
        if (dto.reservedVolume != null) {
            await this.volumeCapacity.assertVolumeAllocation(dto.reservedVolume, id);
        }
        if (dto.reservedWeight != null) {
            await this.volumeCapacity.assertWeightAllocation(dto.reservedWeight, id);
        }
        const updated = await this.prisma.billingPlan.update({
            where: { id },
            data: {
                active: dto.active,
                cycleLengthDays: dto.cycleLengthDays,
                fixedSubscriptionFee: dto.fixedSubscriptionFee,
                inboundOrderFee: dto.inboundOrderFee,
                outboundOrderFee: dto.outboundOrderFee,
                packagingFee: dto.packagingFee,
                qualityCheckFee: dto.qualityCheckFee,
                excessVolumeFeePerDay: dto.excessVolumeFeePerDay,
                excessWeightFeePerDay: dto.excessWeightFeePerDay,
                reservedVolume: dto.reservedVolume,
                reservedWeight: dto.reservedWeight,
            },
            select: PLAN_SELECT,
        });
        void this.billingAudit.fromUser(user, {
            action: billing_audit_service_1.BILLING_AUDIT_ACTIONS.PLAN_UPDATED,
            resourceType: 'billing_plan',
            resourceId: id,
            companyId: updated.companyId,
            previousState: previous,
            newState: updated,
        });
        return updated;
    }
    async getCapacitySummary() {
        const [totalVol, allocatedVol, totalWt, allocatedWt] = await Promise.all([
            this.volumeCapacity.getTotalWarehouseVolume(),
            this.volumeCapacity.getAllocatedVolume(),
            this.volumeCapacity.getTotalWarehouseWeight(),
            this.volumeCapacity.getAllocatedWeight(),
        ]);
        const allocatableVol = totalVol.mul(0.9);
        const allocatableWt = totalWt.mul(0.9);
        return {
            totalWarehouseVolumeCbm: totalVol.toString(),
            allocatableCapacityCbm: allocatableVol.toString(),
            allocatedVolumeCbm: allocatedVol.toString(),
            remainingAllocatableCbm: client_1.Prisma.Decimal.max(allocatableVol.sub(allocatedVol), new client_1.Prisma.Decimal(0)).toString(),
            totalWarehouseWeightKg: totalWt.toString(),
            allocatableCapacityKg: allocatableWt.toString(),
            allocatedWeightKg: allocatedWt.toString(),
            remainingAllocatableKg: client_1.Prisma.Decimal.max(allocatableWt.sub(allocatedWt), new client_1.Prisma.Decimal(0)).toString(),
            allocationRatio: 0.9,
            sparePoolRatio: 0.1,
        };
    }
};
exports.BillingPlansService = BillingPlansService;
exports.BillingPlansService = BillingPlansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        billing_access_service_1.BillingVolumeCapacityService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService,
        billing_audit_service_1.BillingAuditService])
], BillingPlansService);
function mapOverviewSqlRow(row) {
    const plan = {
        id: row.plan_id,
        companyId: row.company_id,
        active: row.active,
        cycleLengthDays: row.cycle_length_days,
        fixedSubscriptionFee: row.fixed_subscription_fee.toString(),
        inboundOrderFee: row.inbound_order_fee.toString(),
        outboundOrderFee: row.outbound_order_fee.toString(),
        packagingFee: row.packaging_fee.toString(),
        qualityCheckFee: row.quality_check_fee.toString(),
        excessVolumeFeePerDay: row.excess_volume_fee_per_day.toString(),
        excessWeightFeePerDay: row.excess_weight_fee_per_day.toString(),
        reservedVolume: row.reserved_volume.toString(),
        reservedWeight: row.reserved_weight.toString(),
        createdAt: row.plan_created_at.toISOString(),
        updatedAt: row.plan_updated_at.toISOString(),
    };
    const currentCycle = row.cycle_id
        ? {
            id: row.cycle_id,
            companyId: row.company_id,
            billingPlanId: row.plan_id,
            startsAt: row.cycle_starts_at.toISOString(),
            endsAt: row.cycle_ends_at.toISOString(),
            status: row.cycle_status,
            createdAt: row.cycle_created_at.toISOString(),
            updatedAt: row.cycle_updated_at.toISOString(),
        }
        : null;
    return {
        plan,
        companyId: row.company_id,
        companyName: row.company_name,
        companyStatus: row.company_status,
        currentCycle,
        cycleStart: currentCycle?.startsAt ?? null,
        cycleEnd: currentCycle?.endsAt ?? null,
        daysRemaining: row.days_remaining,
        cycleStatus: row.cycle_display_status,
        billingStatus: row.billing_status,
    };
}
//# sourceMappingURL=billing-plans.service.js.map