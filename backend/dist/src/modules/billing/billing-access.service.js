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
exports.BillingAccessService = exports.BillingVolumeCapacityService = exports.BILLING_BLOCKED_STATUSES = exports.WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_exceptions_1 = require("../../common/errors/billing-exceptions");
exports.WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO = 0.9;
exports.BILLING_BLOCKED_STATUSES = [
    client_1.CompanyStatus.restricted,
    client_1.CompanyStatus.suspended,
    client_1.CompanyStatus.archived,
    client_1.CompanyStatus.closed,
    client_1.CompanyStatus.offboarding,
    client_1.CompanyStatus.purged,
];
let BillingVolumeCapacityService = class BillingVolumeCapacityService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTotalWarehouseVolume() {
        const agg = await this.prisma.location.aggregate({
            where: {
                status: 'active',
                type: { in: ['internal', 'fridge', 'quarantine'] },
                maxCbm: { not: null },
            },
            _sum: { maxCbm: true },
        });
        return agg._sum.maxCbm ?? new client_1.Prisma.Decimal(0);
    }
    async getTotalWarehouseWeight() {
        const agg = await this.prisma.location.aggregate({
            where: {
                status: 'active',
                type: { in: ['internal', 'fridge', 'quarantine'] },
                maxWeightKg: { not: null },
            },
            _sum: { maxWeightKg: true },
        });
        return agg._sum.maxWeightKg ?? new client_1.Prisma.Decimal(0);
    }
    async getAllocatedWeight(excludePlanId) {
        const agg = await this.prisma.billingPlan.aggregate({
            where: {
                active: true,
                ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
            },
            _sum: { reservedWeight: true },
        });
        return agg._sum.reservedWeight ?? new client_1.Prisma.Decimal(0);
    }
    async assertWeightAllocation(requestedWeight, excludePlanId) {
        const total = await this.getTotalWarehouseWeight();
        if (total.lte(0))
            return;
        const allocatable = total.mul(exports.WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO);
        const allocated = await this.getAllocatedWeight(excludePlanId);
        const requested = new client_1.Prisma.Decimal(requestedWeight);
        const nextTotal = allocated.add(requested);
        if (nextTotal.gt(allocatable)) {
            throw new billing_exceptions_1.VolumeAllocationExceededException(`Total reserved weight (${nextTotal.toFixed(4)} kg) exceeds the 90% allocatable capacity (${allocatable.toFixed(4)} kg of ${total.toFixed(4)} kg).`, {
                totalWarehouseWeightKg: total.toString(),
                allocatableCapacityKg: allocatable.toString(),
                currentlyAllocatedKg: allocated.toString(),
                requestedWeightKg: requested.toString(),
            });
        }
    }
    async getAllocatedVolume(excludePlanId) {
        const agg = await this.prisma.billingPlan.aggregate({
            where: {
                active: true,
                ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
            },
            _sum: { reservedVolume: true },
        });
        return agg._sum.reservedVolume ?? new client_1.Prisma.Decimal(0);
    }
    async assertVolumeAllocation(requestedVolume, excludePlanId) {
        const total = await this.getTotalWarehouseVolume();
        if (total.lte(0))
            return;
        const allocatable = total.mul(exports.WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO);
        const allocated = await this.getAllocatedVolume(excludePlanId);
        const requested = new client_1.Prisma.Decimal(requestedVolume);
        const nextTotal = allocated.add(requested);
        if (nextTotal.gt(allocatable)) {
            throw new billing_exceptions_1.VolumeAllocationExceededException(`Total reserved volume (${nextTotal.toFixed(4)} CBM) exceeds the 90% allocatable capacity (${allocatable.toFixed(4)} CBM of ${total.toFixed(4)} CBM).`, {
                totalWarehouseVolume: total.toString(),
                allocatableCapacity: allocatable.toString(),
                currentlyAllocated: allocated.toString(),
                requestedVolume: requested.toString(),
            });
        }
    }
};
exports.BillingVolumeCapacityService = BillingVolumeCapacityService;
exports.BillingVolumeCapacityService = BillingVolumeCapacityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingVolumeCapacityService);
let BillingAccessService = class BillingAccessService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOperationalAccess(companyId) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { status: true },
        });
        if (!company) {
            return { operationalAllowed: false, accountStatus: 'no_plan', daysRemaining: null };
        }
        if (exports.BILLING_BLOCKED_STATUSES.includes(company.status)) {
            return { operationalAllowed: false, accountStatus: 'restricted', daysRemaining: null };
        }
        const plan = await this.prisma.billingPlan.findFirst({
            where: { companyId, active: true },
            select: { id: true },
        });
        if (!plan) {
            return { operationalAllowed: false, accountStatus: 'no_plan', daysRemaining: null };
        }
        const now = new Date();
        const cycle = await this.prisma.billingCycle.findFirst({
            where: {
                companyId,
                status: { in: ['active', 'renewed'] },
                startsAt: { lte: now },
                endsAt: { gt: now },
            },
            select: { endsAt: true },
        });
        if (!cycle) {
            return { operationalAllowed: false, accountStatus: 'restricted', daysRemaining: null };
        }
        const daysRemaining = Math.max(0, Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000));
        const accountStatus = daysRemaining <= 7 ? 'expiring' : 'active';
        return { operationalAllowed: true, accountStatus, daysRemaining };
    }
    async assertOperationalBilling(companyId) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { status: true },
        });
        if (!company) {
            throw new billing_exceptions_1.BillingPlanRequiredException('Company not found.');
        }
        if (exports.BILLING_BLOCKED_STATUSES.includes(company.status)) {
            throw new billing_exceptions_1.BillingCycleExpiredException();
        }
        const plan = await this.prisma.billingPlan.findFirst({
            where: { companyId, active: true },
            select: { id: true },
        });
        if (!plan) {
            throw new billing_exceptions_1.BillingPlanRequiredException();
        }
        const now = new Date();
        const cycle = await this.prisma.billingCycle.findFirst({
            where: {
                companyId,
                status: { in: ['active', 'renewed'] },
                startsAt: { lte: now },
                endsAt: { gt: now },
            },
            select: { id: true },
        });
        if (!cycle) {
            throw new billing_exceptions_1.BillingCycleExpiredException();
        }
    }
};
exports.BillingAccessService = BillingAccessService;
exports.BillingAccessService = BillingAccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingAccessService);
//# sourceMappingURL=billing-access.service.js.map