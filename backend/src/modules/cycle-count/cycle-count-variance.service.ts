import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CycleCountStatus,
  CycleCountVarianceStatus,
  LedgerRefType,
  Prisma,
  VarianceReasonCode,
} from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdjustmentsService } from '../adjustments/adjustments.service';
import { TERMINAL_VARIANCE_STATUSES } from './cycle-count-variance.constants';
import { ReviewVarianceDto, ListVariancesQueryDto } from './dto/variance.dto';

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
} satisfies Prisma.CycleCountVarianceInclude;

@Injectable()
export class CycleCountVarianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly adjustments: AdjustmentsService,
    private readonly audit: AuditLogService,
  ) {}

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
      ] as VarianceReasonCode[],
    };
  }

  list(user: AuthPrincipal, query: ListVariancesQueryDto) {
    const companyId = readCompanyIdFilterRequired(
      this.companyAccess,
      user,
      query.companyId,
    );
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

  async listForCount(user: AuthPrincipal, cycleCountId: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: { id: true, companyId: true },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, count);

    return this.prisma.cycleCountVariance.findMany({
      where: { cycleCountId },
      include: VARIANCE_DETAIL_INCLUDE,
      orderBy: [{ productId: 'asc' }, { locationId: 'asc' }],
    });
  }

  async findById(user: AuthPrincipal, id: string) {
    const row = await this.prisma.cycleCountVariance.findUnique({
      where: { id },
      include: VARIANCE_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Variance not found.');
    this.companyAccess.validateResourceOwnership(user, row);
    return row;
  }

  async review(user: AuthPrincipal, varianceId: string, dto: ReviewVarianceDto) {
    const variance = await this.prisma.cycleCountVariance.findUnique({
      where: { id: varianceId },
      include: { cycleCount: { select: { id: true, status: true, companyId: true } } },
    });
    if (!variance) throw new NotFoundException('Variance not found.');
    this.companyAccess.validateResourceOwnership(user, variance);

    if (variance.cycleCount.status !== CycleCountStatus.pending_review) {
      throw new InvalidStateException(
        'Variances can only be reviewed while the cycle count is pending review.',
      );
    }
    if (variance.status !== CycleCountVarianceStatus.pending_review) {
      throw new InvalidStateException('This variance has already been reviewed.');
    }

    const now = new Date();
    const approving = dto.action === 'approve';

    if (approving && !dto.reasonCode) {
      throw new BadRequestException('reasonCode is required when approving a variance.');
    }

    const reasonCode: VarianceReasonCode | null = approving
      ? (dto.reasonCode as VarianceReasonCode)
      : (dto.reasonCode as VarianceReasonCode | undefined) ?? VarianceReasonCode.unknown;

    const updated = await this.prisma.cycleCountVariance.update({
      where: { id: varianceId },
      data: {
        status: approving
          ? CycleCountVarianceStatus.approved
          : CycleCountVarianceStatus.rejected,
        reasonCode,
        reviewNotes: dto.reviewNotes?.trim() || null,
        reviewedBy: user.id,
        reviewedAt: now,
        updatedAt: now,
      },
      include: VARIANCE_DETAIL_INCLUDE,
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
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
      }),
    );

    return updated;
  }

  /** Build a draft stock adjustment from approved, unlinked variances. */
  async buildReconciliationDraft(user: AuthPrincipal, cycleCountId: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: cycleCountId },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, count);

    if (count.status !== CycleCountStatus.pending_review) {
      throw new InvalidStateException(
        'Reconciliation draft can only be built while count is pending review.',
      );
    }

    await this.assertAllVariancesReviewed(cycleCountId);

    const pendingDraft = await this.prisma.stockAdjustment.findFirst({
      where: { cycleCountId, status: 'draft' },
      select: { id: true },
    });
    if (pendingDraft) {
      throw new ConflictException(
        'A draft reconciliation adjustment already exists for this cycle count.',
      );
    }

    const approved = await this.prisma.cycleCountVariance.findMany({
      where: {
        cycleCountId,
        status: CycleCountVarianceStatus.approved,
        stockAdjustmentId: null,
      },
      orderBy: { id: 'asc' },
    });
    if (approved.length === 0) {
      throw new BadRequestException(
        'No approved variances require inventory adjustment.',
      );
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

  /** Approve draft reconciliation — posts inventory with cycle_count ledger reference. */
  async postReconciliation(user: AuthPrincipal, cycleCountId: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: cycleCountId },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    this.companyAccess.validateResourceOwnership(user, count);

    if (count.status !== CycleCountStatus.pending_review) {
      throw new InvalidStateException(
        'Reconciliation can only be posted while count is pending review.',
      );
    }

    const adjustment = await this.prisma.stockAdjustment.findFirst({
      where: { cycleCountId, status: 'draft' },
      include: { lines: true },
    });
    if (!adjustment) {
      throw new NotFoundException(
        'No draft reconciliation adjustment found. Build reconciliation first.',
      );
    }

    const approved = await this.prisma.cycleCountVariance.findMany({
      where: {
        cycleCountId,
        status: CycleCountVarianceStatus.approved,
        stockAdjustmentId: adjustment.id,
      },
    });
    if (approved.length === 0) {
      throw new BadRequestException('Draft adjustment has no linked approved variances.');
    }

    const posted = await this.adjustments.approve(user, adjustment.id, {
      ledgerReferenceType: LedgerRefType.cycle_count,
      ledgerReferenceId: cycleCountId,
    });

    const now = new Date();
    await this.prisma.cycleCountVariance.updateMany({
      where: {
        cycleCountId,
        stockAdjustmentId: adjustment.id,
        status: CycleCountVarianceStatus.approved,
      },
      data: {
        status: CycleCountVarianceStatus.posted,
        postedAt: now,
        updatedAt: now,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        companyId: count.companyId,
        action: 'cycle_count.reconciliation.posted',
        resourceType: 'cycle_count',
        resourceId: cycleCountId,
        newState: {
          stockAdjustmentId: adjustment.id,
          varianceCount: approved.length,
        },
      }),
    );

    return {
      cycleCountId,
      adjustment: posted,
      variancesPosted: approved.length,
    };
  }

  /** Adjustment history for a completed or in-review count. */
  async listAdjustmentsForCount(user: AuthPrincipal, cycleCountId: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: { id: true, companyId: true },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
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

  async assertCountCanComplete(cycleCountId: string): Promise<void> {
    const pendingReview = await this.prisma.cycleCountVariance.count({
      where: { cycleCountId, status: CycleCountVarianceStatus.pending_review },
    });
    if (pendingReview > 0) {
      throw new BadRequestException(
        `${pendingReview} variance(s) still pending review.`,
      );
    }

    const approvedUnposted = await this.prisma.cycleCountVariance.count({
      where: { cycleCountId, status: CycleCountVarianceStatus.approved },
    });
    if (approvedUnposted > 0) {
      throw new BadRequestException(
        `${approvedUnposted} approved variance(s) not yet posted — build and post reconciliation.`,
      );
    }

    const draftAdj = await this.prisma.stockAdjustment.findFirst({
      where: { cycleCountId, status: 'draft' },
      select: { id: true },
    });
    if (draftAdj) {
      throw new BadRequestException(
        'A draft reconciliation adjustment exists — post or cancel it before completing the count.',
      );
    }
  }

  private async assertAllVariancesReviewed(cycleCountId: string) {
    const pending = await this.prisma.cycleCountVariance.count({
      where: { cycleCountId, status: CycleCountVarianceStatus.pending_review },
    });
    if (pending > 0) {
      throw new BadRequestException(
        `${pending} variance(s) still pending review before reconciliation.`,
      );
    }
  }

  countUnresolved(cycleCountId: string) {
    return this.prisma.cycleCountVariance.count({
      where: {
        cycleCountId,
        status: { notIn: [...TERMINAL_VARIANCE_STATUSES] },
      },
    });
  }
}
