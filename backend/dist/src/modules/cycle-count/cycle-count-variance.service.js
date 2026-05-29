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
exports.CycleCountVarianceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const adjustments_service_1 = require("../adjustments/adjustments.service");
const cycle_count_variance_constants_1 = require("./cycle-count-variance.constants");
const VARIANCE_DETAIL_INCLUDE = {
    product: { select: { id: true, sku: true, name: true, uom: true } },
    location: { select: { id: true, name: true, fullPath: true, barcode: true } },
    lot: { select: { id: true, lotNumber: true } },
    reviewer: { select: { id: true, fullName: true } },
    stockAdjustment: {
        select: { id: true, status: true, approvedAt: true },
    },
    adjustmentLine: {
        select: { id: true, quantityBefore: true, quantityAfter: true },
    },
    cycleCount: { select: { id: true, status: true } },
};
let CycleCountVarianceService = class CycleCountVarianceService {
    prisma;
    companyAccess;
    adjustments;
    audit;
    constructor(prisma, companyAccess, adjustments, audit) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.adjustments = adjustments;
        this.audit = audit;
    }
    listReasonCodes() {
        return {
            codes: [
                'damaged',
                'lost',
                'misplaced',
                'theft_suspected',
                'counting_mistake',
                'operational_correction',
                'unknown',
            ],
        };
    }
    list(user, query) {
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        return this.prisma.cycleCountVariance.findMany({
            where: {
                companyId,
                ...(query.cycleCountId ? { cycleCountId: query.cycleCountId } : {}),
                ...(query.status ? { status: query.status } : {}),
            },
            include: VARIANCE_DETAIL_INCLUDE,
            orderBy: [{ createdAt: 'desc' }],
            take: 500,
        });
    }
    async listForCount(user, cycleCountId) {
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: cycleCountId },
            select: { id: true, companyId: true },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        return this.prisma.cycleCountVariance.findMany({
            where: { cycleCountId },
            include: VARIANCE_DETAIL_INCLUDE,
            orderBy: [{ productId: 'asc' }, { locationId: 'asc' }],
        });
    }
    async findById(user, id) {
        const row = await this.prisma.cycleCountVariance.findUnique({
            where: { id },
            include: VARIANCE_DETAIL_INCLUDE,
        });
        if (!row)
            throw new common_1.NotFoundException('Variance not found.');
        this.companyAccess.validateResourceOwnership(user, row);
        return row;
    }
    async review(user, varianceId, dto) {
        const variance = await this.prisma.cycleCountVariance.findUnique({
            where: { id: varianceId },
            include: { cycleCount: { select: { id: true, status: true, companyId: true } } },
        });
        if (!variance)
            throw new common_1.NotFoundException('Variance not found.');
        this.companyAccess.validateResourceOwnership(user, variance);
        if (variance.cycleCount.status !== client_1.CycleCountStatus.pending_review) {
            throw new domain_exceptions_1.InvalidStateException('Variances can only be reviewed while the cycle count is pending review.');
        }
        if (variance.status !== client_1.CycleCountVarianceStatus.pending_review) {
            throw new domain_exceptions_1.InvalidStateException('This variance has already been reviewed.');
        }
        const now = new Date();
        const approving = dto.action === 'approve';
        if (approving && !dto.reasonCode) {
            throw new common_1.BadRequestException('reasonCode is required when approving a variance.');
        }
        const reasonCode = approving
            ? dto.reasonCode
            : dto.reasonCode ?? client_1.VarianceReasonCode.unknown;
        const updated = await this.prisma.cycleCountVariance.update({
            where: { id: varianceId },
            data: {
                status: approving
                    ? client_1.CycleCountVarianceStatus.approved
                    : client_1.CycleCountVarianceStatus.rejected,
                reasonCode,
                reviewNotes: dto.reviewNotes?.trim() || null,
                reviewedBy: user.id,
                reviewedAt: now,
                updatedAt: now,
            },
            include: VARIANCE_DETAIL_INCLUDE,
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId: variance.companyId,
            action: approving ? 'cycle_count.variance.approved' : 'cycle_count.variance.rejected',
            resourceType: 'cycle_count_variance',
            resourceId: varianceId,
            previousState: {
                status: variance.status,
                reasonCode: variance.reasonCode,
            },
            newState: {
                status: updated.status,
                reasonCode: updated.reasonCode,
                reviewNotes: updated.reviewNotes,
                cycleCountId: variance.cycleCountId,
            },
        }));
        return updated;
    }
    async buildReconciliationDraft(user, cycleCountId) {
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: cycleCountId },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.pending_review) {
            throw new domain_exceptions_1.InvalidStateException('Reconciliation draft can only be built while count is pending review.');
        }
        await this.assertAllVariancesReviewed(cycleCountId);
        const pendingDraft = await this.prisma.stockAdjustment.findFirst({
            where: { cycleCountId, status: 'draft' },
            select: { id: true },
        });
        if (pendingDraft) {
            throw new common_1.ConflictException('A draft reconciliation adjustment already exists for this cycle count.');
        }
        const approved = await this.prisma.cycleCountVariance.findMany({
            where: {
                cycleCountId,
                status: client_1.CycleCountVarianceStatus.approved,
                stockAdjustmentId: null,
            },
            orderBy: { id: 'asc' },
        });
        if (approved.length === 0) {
            throw new common_1.BadRequestException('No approved variances require inventory adjustment.');
        }
        const reason = `Cycle count reconciliation (${cycleCountId.slice(0, 8)})`;
        return this.prisma.$transaction(async (tx) => {
            const adjustment = await tx.stockAdjustment.create({
                data: {
                    companyId: count.companyId,
                    warehouseId: count.warehouseId,
                    cycleCountId: count.id,
                    reason,
                    createdBy: user.id,
                },
            });
            for (const v of approved) {
                const line = await tx.stockAdjustmentLine.create({
                    data: {
                        adjustmentId: adjustment.id,
                        productId: v.productId,
                        locationId: v.locationId,
                        lotId: v.lotId,
                        quantityBefore: v.expectedQuantity,
                        quantityAfter: v.actualQuantity,
                        reasonNote: v.reasonCode
                            ? `Variance: ${v.reasonCode}${v.reviewNotes ? ` — ${v.reviewNotes}` : ''}`
                            : v.reviewNotes,
                        cycleCountVarianceId: v.id,
                    },
                });
                await tx.cycleCountVariance.update({
                    where: { id: v.id },
                    data: {
                        stockAdjustmentId: adjustment.id,
                        updatedAt: new Date(),
                    },
                });
                await this.audit.logTx(tx, {
                    ...this.audit.fromPrincipal(user, {
                        companyId: count.companyId,
                        action: 'cycle_count.variance.linked_to_adjustment',
                        resourceType: 'cycle_count_variance',
                        resourceId: v.id,
                        newState: {
                            stockAdjustmentId: adjustment.id,
                            stockAdjustmentLineId: line.id,
                        },
                    }),
                });
            }
            await this.audit.logTx(tx, {
                ...this.audit.fromPrincipal(user, {
                    companyId: count.companyId,
                    action: 'cycle_count.reconciliation.draft_created',
                    resourceType: 'stock_adjustment',
                    resourceId: adjustment.id,
                    newState: {
                        cycleCountId,
                        varianceCount: approved.length,
                    },
                }),
            });
            return tx.stockAdjustment.findUniqueOrThrow({
                where: { id: adjustment.id },
                include: {
                    lines: {
                        include: {
                            product: { select: { id: true, sku: true, name: true } },
                            location: { select: { id: true, fullPath: true } },
                            cycleCountVariance: { select: { id: true, reasonCode: true } },
                        },
                    },
                },
            });
        });
    }
    async postReconciliation(user, cycleCountId) {
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: cycleCountId },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        if (count.status !== client_1.CycleCountStatus.pending_review) {
            throw new domain_exceptions_1.InvalidStateException('Reconciliation can only be posted while count is pending review.');
        }
        const adjustment = await this.prisma.stockAdjustment.findFirst({
            where: { cycleCountId, status: 'draft' },
            include: { lines: true },
        });
        if (!adjustment) {
            throw new common_1.NotFoundException('No draft reconciliation adjustment found. Build reconciliation first.');
        }
        const approved = await this.prisma.cycleCountVariance.findMany({
            where: {
                cycleCountId,
                status: client_1.CycleCountVarianceStatus.approved,
                stockAdjustmentId: adjustment.id,
            },
        });
        if (approved.length === 0) {
            throw new common_1.BadRequestException('Draft adjustment has no linked approved variances.');
        }
        const posted = await this.adjustments.approve(user, adjustment.id, {
            ledgerReferenceType: client_1.LedgerRefType.cycle_count,
            ledgerReferenceId: cycleCountId,
        });
        const now = new Date();
        await this.prisma.cycleCountVariance.updateMany({
            where: {
                cycleCountId,
                stockAdjustmentId: adjustment.id,
                status: client_1.CycleCountVarianceStatus.approved,
            },
            data: {
                status: client_1.CycleCountVarianceStatus.posted,
                postedAt: now,
                updatedAt: now,
            },
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId: count.companyId,
            action: 'cycle_count.reconciliation.posted',
            resourceType: 'cycle_count',
            resourceId: cycleCountId,
            newState: {
                stockAdjustmentId: adjustment.id,
                varianceCount: approved.length,
            },
        }));
        return {
            cycleCountId,
            adjustment: posted,
            variancesPosted: approved.length,
        };
    }
    async listAdjustmentsForCount(user, cycleCountId) {
        const count = await this.prisma.cycleCount.findUnique({
            where: { id: cycleCountId },
            select: { id: true, companyId: true },
        });
        if (!count)
            throw new common_1.NotFoundException('Cycle count not found.');
        this.companyAccess.validateResourceOwnership(user, count);
        return this.prisma.stockAdjustment.findMany({
            where: { cycleCountId },
            include: {
                creator: { select: { id: true, fullName: true } },
                approver: { select: { id: true, fullName: true } },
                lines: {
                    include: {
                        product: { select: { id: true, sku: true, name: true } },
                        location: { select: { id: true, fullPath: true } },
                        cycleCountVariance: {
                            select: { id: true, reasonCode: true, discrepancyQuantity: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async assertCountCanComplete(cycleCountId) {
        const pendingReview = await this.prisma.cycleCountVariance.count({
            where: { cycleCountId, status: client_1.CycleCountVarianceStatus.pending_review },
        });
        if (pendingReview > 0) {
            throw new common_1.BadRequestException(`${pendingReview} variance(s) still pending review.`);
        }
        const approvedUnposted = await this.prisma.cycleCountVariance.count({
            where: { cycleCountId, status: client_1.CycleCountVarianceStatus.approved },
        });
        if (approvedUnposted > 0) {
            throw new common_1.BadRequestException(`${approvedUnposted} approved variance(s) not yet posted — build and post reconciliation.`);
        }
        const draftAdj = await this.prisma.stockAdjustment.findFirst({
            where: { cycleCountId, status: 'draft' },
            select: { id: true },
        });
        if (draftAdj) {
            throw new common_1.BadRequestException('A draft reconciliation adjustment exists — post or cancel it before completing the count.');
        }
    }
    async assertAllVariancesReviewed(cycleCountId) {
        const pending = await this.prisma.cycleCountVariance.count({
            where: { cycleCountId, status: client_1.CycleCountVarianceStatus.pending_review },
        });
        if (pending > 0) {
            throw new common_1.BadRequestException(`${pending} variance(s) still pending review before reconciliation.`);
        }
    }
    countUnresolved(cycleCountId) {
        return this.prisma.cycleCountVariance.count({
            where: {
                cycleCountId,
                status: { notIn: [...cycle_count_variance_constants_1.TERMINAL_VARIANCE_STATUSES] },
            },
        });
    }
};
exports.CycleCountVarianceService = CycleCountVarianceService;
exports.CycleCountVarianceService = CycleCountVarianceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        adjustments_service_1.AdjustmentsService,
        audit_log_service_1.AuditLogService])
], CycleCountVarianceService);
//# sourceMappingURL=cycle-count-variance.service.js.map