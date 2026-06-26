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
exports.BillingCyclesService = void 0;
const common_1 = require("@nestjs/common");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_audit_service_1 = require("./billing-audit.service");
const billing_rate_snapshot_util_1 = require("./billing-rate-snapshot.util");
const PLAN_RATE_SELECT = {
    id: true,
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
};
const CYCLE_SELECT = {
    id: true,
    companyId: true,
    billingPlanId: true,
    startsAt: true,
    endsAt: true,
    status: true,
    rateSnapshot: true,
    createdAt: true,
    updatedAt: true,
};
let BillingCyclesService = class BillingCyclesService {
    prisma;
    companyAccess;
    billingAudit;
    constructor(prisma, companyAccess, billingAudit) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.billingAudit = billingAudit;
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
        return this.prisma.billingCycle.findMany({
            where,
            orderBy: { startsAt: 'desc' },
            select: CYCLE_SELECT,
        });
    }
    async findById(user, id) {
        const cycle = await this.prisma.billingCycle.findUnique({
            where: { id },
            select: CYCLE_SELECT,
        });
        if (!cycle)
            throw new common_1.NotFoundException('Billing cycle not found.');
        this.companyAccess.assertCompanyAccess(user, cycle.companyId);
        return cycle;
    }
    async renew(user, cycleId) {
        const cycle = await this.findById(user, cycleId);
        if (cycle.status !== 'active') {
            throw new domain_exceptions_1.InvalidStateException('Only an active billing cycle can be marked for renewal.');
        }
        const now = new Date();
        if (cycle.endsAt <= now) {
            throw new common_1.BadRequestException('This billing cycle has already ended.');
        }
        const updated = await this.prisma.billingCycle.update({
            where: { id: cycleId },
            data: { status: 'renewed' },
            select: CYCLE_SELECT,
        });
        void this.billingAudit.fromUser(user, {
            action: billing_audit_service_1.BILLING_AUDIT_ACTIONS.PLAN_RENEWED,
            resourceType: 'billing_cycle',
            resourceId: cycleId,
            companyId: cycle.companyId,
            previousState: { status: cycle.status },
            newState: { status: 'renewed' },
        });
        return updated;
    }
    async listExpiringSoon(user, limit = 5) {
        const now = new Date();
        const where = {
            status: { in: ['active', 'renewed'] },
            endsAt: { gt: now },
        };
        if (user.tenantScope === 'restricted') {
            where.companyId = { in: user.authorizedCompanyIds };
        }
        const cycles = await this.prisma.billingCycle.findMany({
            where,
            orderBy: { endsAt: 'asc' },
            take: Math.min(Math.max(limit, 1), 20),
            select: {
                ...CYCLE_SELECT,
                company: { select: { id: true, name: true } },
            },
        });
        return cycles.map((cycle) => ({
            ...cycle,
            daysRemaining: Math.max(0, Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000)),
        }));
    }
    async createNextCycleFromPlan(tx, expiredCycle) {
        const plan = await tx.billingPlan.findUnique({
            where: { id: expiredCycle.billingPlanId },
            select: PLAN_RATE_SELECT,
        });
        if (!plan?.active)
            return null;
        const startsAt = expiredCycle.endsAt;
        const endsAt = new Date(startsAt);
        endsAt.setUTCDate(endsAt.getUTCDate() + plan.cycleLengthDays);
        return tx.billingCycle.create({
            data: {
                companyId: expiredCycle.companyId,
                billingPlanId: plan.id,
                startsAt,
                endsAt,
                status: 'active',
                rateSnapshot: (0, billing_rate_snapshot_util_1.buildRateSnapshotFromPlan)(plan),
            },
            select: CYCLE_SELECT,
        });
    }
};
exports.BillingCyclesService = BillingCyclesService;
exports.BillingCyclesService = BillingCyclesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        billing_audit_service_1.BillingAuditService])
], BillingCyclesService);
//# sourceMappingURL=billing-cycles.service.js.map