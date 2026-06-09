import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingVolumeCapacityService } from './billing-access.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { buildRateSnapshotFromPlan } from './billing-rate-snapshot.util';
import {
  billingPlansOverviewCountSql,
  billingPlansOverviewListSql,
  type BillingPlanOverviewSqlRow,
} from './billing-plans-list.query';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
import { ListBillingPlansQueryDto } from './dto/list-billing-plans-query.dto';
import { UpdateBillingPlanDto } from './dto/update-billing-plan.dto';

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
} satisfies Prisma.BillingPlanSelect;

@Injectable()
export class BillingPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly volumeCapacity: BillingVolumeCapacityService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
    private readonly billingAudit: BillingAuditService,
  ) {}

  async listPage(user: AuthPrincipal, query: ListBillingPlansQueryDto) {
    if (query.companyId) {
      this.companyAccess.assertCompanyAccess(user, query.companyId);
    }

    const tenantCompanyIds =
      user.tenantScope === 'restricted' ? user.authorizedCompanyIds : null;

    const [countRows, items] = await Promise.all([
      this.prisma.$queryRaw<{ total: number }[]>(
        billingPlansOverviewCountSql(query, tenantCompanyIds),
      ),
      this.prisma.$queryRaw<BillingPlanOverviewSqlRow[]>(
        billingPlansOverviewListSql(query, tenantCompanyIds),
      ),
    ]);

    return {
      items: items.map(mapOverviewSqlRow),
      total: countRows[0]?.total ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  list(user: AuthPrincipal, companyId?: string) {
    const where: Prisma.BillingPlanWhereInput = {};
    if (companyId) {
      this.companyAccess.assertCompanyAccess(user, companyId);
      where.companyId = companyId;
    } else if (user.tenantScope === 'restricted') {
      where.companyId = { in: user.authorizedCompanyIds };
    }
    return this.prisma.billingPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: PLAN_SELECT,
    });
  }

  async findById(user: AuthPrincipal, id: string) {
    const plan = await this.prisma.billingPlan.findUnique({
      where: { id },
      select: PLAN_SELECT,
    });
    if (!plan) throw new NotFoundException('Billing plan not found.');
    this.companyAccess.assertCompanyAccess(user, plan.companyId);
    return plan;
  }

  async create(user: AuthPrincipal, dto: CreateBillingPlanDto) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    await this.volumeCapacity.assertVolumeAllocation(dto.reservedVolume ?? 0);
    await this.volumeCapacity.assertWeightAllocation(dto.reservedWeight ?? 0);

    const existing = await this.prisma.billingPlan.findFirst({
      where: { companyId, active: true },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'This client already has an active billing plan. Deactivate it before creating a new one.',
      );
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
          rateSnapshot: buildRateSnapshotFromPlan(plan),
        },
      });

      return plan;
    }).then(async (plan) => {
      void this.billingAudit.fromUser(user, {
        action: BILLING_AUDIT_ACTIONS.PLAN_CREATED,
        resourceType: 'billing_plan',
        resourceId: plan.id,
        companyId: plan.companyId,
        newState: plan,
      });
      void this.invoiceCalc.recalculateForCompany(plan.companyId, 'cycle_started');
      return plan;
    });
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateBillingPlanDto) {
    await this.findById(user, id);
    const previous = await this.findById(user, id);
    if (dto.reservedVolume != null) {
      await this.volumeCapacity.assertVolumeAllocation(dto.reservedVolume, id);
    }
    if (dto.reservedWeight != null) {
      await this.volumeCapacity.assertWeightAllocation(dto.reservedWeight, id);
    }

    // Plan updates apply to future cycles only; active cycle invoices use rate_snapshot.
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
      action: BILLING_AUDIT_ACTIONS.PLAN_UPDATED,
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
      remainingAllocatableCbm: Prisma.Decimal.max(
        allocatableVol.sub(allocatedVol),
        new Prisma.Decimal(0),
      ).toString(),
      totalWarehouseWeightKg: totalWt.toString(),
      allocatableCapacityKg: allocatableWt.toString(),
      allocatedWeightKg: allocatedWt.toString(),
      remainingAllocatableKg: Prisma.Decimal.max(
        allocatableWt.sub(allocatedWt),
        new Prisma.Decimal(0),
      ).toString(),
      allocationRatio: 0.9,
      sparePoolRatio: 0.1,
    };
  }
}

function mapOverviewSqlRow(row: BillingPlanOverviewSqlRow) {
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
        startsAt: row.cycle_starts_at!.toISOString(),
        endsAt: row.cycle_ends_at!.toISOString(),
        status: row.cycle_status as 'active' | 'renewed' | 'expired',
        createdAt: row.cycle_created_at!.toISOString(),
        updatedAt: row.cycle_updated_at!.toISOString(),
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
    cycleStatus: row.cycle_display_status as 'active' | 'renewed' | 'expired' | 'none',
    billingStatus: row.billing_status as 'operational' | 'restricted' | 'inactive',
  };
}
