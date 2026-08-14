import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BillingVolumeCapacityService } from './billing-access.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { BillingNotificationsService } from './billing-notifications.service';
import { BillingUsageService } from './billing-usage.service';
import { buildRateSnapshotFromPlan } from './billing-rate-snapshot.util';
import {
  billingPlansOverviewCountSql,
  billingPlansOverviewListSql,
  type BillingPlanOverviewSqlRow,
} from './billing-plans-list.query';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
import { ListBillingPlansQueryDto } from './dto/list-billing-plans-query.dto';
import { UpdateBillingPlanDto } from './dto/update-billing-plan.dto';
import { toAvatarPublicUrl } from '../media/avatar-url';

const PLAN_SELECT = {
  id: true,
  companyId: true,
  active: true,
  autoRenew: true,
  cycleLengthDays: true,
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BillingPlanSelect;

@Injectable()
export class BillingPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly volumeCapacity: BillingVolumeCapacityService,
    private readonly usage: BillingUsageService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
    private readonly billingAudit: BillingAuditService,
    private readonly billingNotifications: BillingNotificationsService,
    private readonly realtime: RealtimeService,
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
          autoRenew: dto.autoRenew ?? true,
          cycleLengthDays: dto.cycleLengthDays,
          fixedSubscriptionFee: dto.fixedSubscriptionFee ?? 0,
          inboundOrderFee: dto.inboundOrderFee ?? 0,
          outboundOrderFee: dto.outboundOrderFee ?? dto.outboundBaseFee ?? 0,
          outboundBaseFee: dto.outboundBaseFee ?? dto.outboundOrderFee ?? 0,
          outboundIncludedItems: dto.outboundIncludedItems ?? 0,
          outboundAdditionalItemFee: dto.outboundAdditionalItemFee ?? 0,
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
      this.realtime.emitPlanUpdated(plan.companyId, {
        planId: plan.id,
        companyId: plan.companyId,
        active: plan.active,
        action: 'plan_created',
      });
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

    const applyMode = dto.applyMode ?? 'next_cycle';

    // Keep simple per-order outbound fee and legacy base fee in sync when only one is sent.
    const outboundOrderFee =
      dto.outboundOrderFee != null
        ? dto.outboundOrderFee
        : dto.outboundBaseFee != null
          ? dto.outboundBaseFee
          : undefined;
    const outboundBaseFee =
      dto.outboundBaseFee != null
        ? dto.outboundBaseFee
        : dto.outboundOrderFee != null
          ? dto.outboundOrderFee
          : undefined;

    const updated = await this.prisma.billingPlan.update({
      where: { id },
      data: {
        active: dto.active,
        autoRenew: dto.autoRenew,
        cycleLengthDays: dto.cycleLengthDays,
        fixedSubscriptionFee: dto.fixedSubscriptionFee,
        inboundOrderFee: dto.inboundOrderFee,
        outboundOrderFee,
        outboundBaseFee,
        outboundIncludedItems: dto.outboundIncludedItems,
        outboundAdditionalItemFee: dto.outboundAdditionalItemFee,
        packagingFee: dto.packagingFee,
        qualityCheckFee: dto.qualityCheckFee,
        excessVolumeFeePerDay: dto.excessVolumeFeePerDay,
        excessWeightFeePerDay: dto.excessWeightFeePerDay,
        reservedVolume: dto.reservedVolume,
        reservedWeight: dto.reservedWeight,
      },
      select: PLAN_SELECT,
    });

    if (applyMode === 'immediate') {
      const now = new Date();
      const liveCycle = await this.prisma.billingCycle.findFirst({
        where: {
          companyId: updated.companyId,
          billingPlanId: updated.id,
          status: { in: ['active', 'renewed'] },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { id: true },
        orderBy: { endsAt: 'desc' },
      });

      if (liveCycle) {
        await this.prisma.billingCycle.update({
          where: { id: liveCycle.id },
          data: { rateSnapshot: buildRateSnapshotFromPlan(updated) },
        });
        void this.invoiceCalc.recalculateForCompany(
          updated.companyId,
          'plan_rates_updated',
        );
      }
    }

    void this.billingAudit.fromUser(user, {
      action: BILLING_AUDIT_ACTIONS.PLAN_UPDATED,
      resourceType: 'billing_plan',
      resourceId: id,
      companyId: updated.companyId,
      previousState: previous,
      newState: { ...updated, applyMode },
    });

    this.realtime.emitPlanUpdated(updated.companyId, {
      planId: updated.id,
      companyId: updated.companyId,
      active: updated.active,
      action: 'plan_updated',
    });

    return updated;
  }

  /**
   * Renew a billing plan:
   * - If there is a live **active** cycle → mark it for deferred renewal at expiry.
   * - If the company is restricted / cycle expired / no live cycle → start a new
   *   cycle immediately, reactivate the plan, and clear company restriction.
   */
  async renew(user: AuthPrincipal, planId: string) {
    const plan = await this.findById(user, planId);
    const company = await this.prisma.company.findUnique({
      where: { id: plan.companyId },
      select: { id: true, name: true, status: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const now = new Date();
    const liveCycle = await this.prisma.billingCycle.findFirst({
      where: {
        companyId: plan.companyId,
        billingPlanId: plan.id,
        status: { in: ['active', 'renewed'] },
        endsAt: { gt: now },
      },
      orderBy: { endsAt: 'desc' },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        companyId: true,
        billingPlanId: true,
      },
    });

    if (liveCycle?.status === 'renewed') {
      throw new InvalidStateException(
        'This billing cycle is already marked for renewal.',
      );
    }

    if (liveCycle?.status === 'active') {
      const updated = await this.prisma.billingCycle.update({
        where: { id: liveCycle.id },
        data: { status: 'renewed' },
        select: {
          id: true,
          companyId: true,
          billingPlanId: true,
          startsAt: true,
          endsAt: true,
          status: true,
          rateSnapshot: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      void this.billingAudit.fromUser(user, {
        action: BILLING_AUDIT_ACTIONS.PLAN_RENEWED,
        resourceType: 'billing_cycle',
        resourceId: liveCycle.id,
        companyId: plan.companyId,
        previousState: { status: 'active' },
        newState: { status: 'renewed', mode: 'deferred' },
      });

      return {
        mode: 'deferred' as const,
        plan,
        cycle: updated,
      };
    }

    const previousCycle = await this.prisma.billingCycle.findFirst({
      where: { companyId: plan.companyId, billingPlanId: plan.id },
      orderBy: { endsAt: 'desc' },
      select: { id: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.billingPlan.update({
        where: { id: plan.id },
        data: { active: true },
        select: PLAN_SELECT,
      });

      const startsAt = now;
      const endsAt = new Date(startsAt);
      endsAt.setUTCDate(endsAt.getUTCDate() + updatedPlan.cycleLengthDays);

      const nextCycle = await tx.billingCycle.create({
        data: {
          companyId: plan.companyId,
          billingPlanId: plan.id,
          startsAt,
          endsAt,
          status: 'active',
          rateSnapshot: buildRateSnapshotFromPlan(updatedPlan),
        },
        select: {
          id: true,
          companyId: true,
          billingPlanId: true,
          startsAt: true,
          endsAt: true,
          status: true,
          rateSnapshot: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.company.update({
        where: { id: plan.companyId },
        data: { status: CompanyStatus.active },
      });

      return { plan: updatedPlan, cycle: nextCycle };
    });

    void this.billingAudit.fromUser(user, {
      action: BILLING_AUDIT_ACTIONS.PLAN_RENEWED,
      resourceType: 'billing_plan',
      resourceId: plan.id,
      companyId: plan.companyId,
      previousState: { companyStatus: company.status, planActive: plan.active },
      newState: {
        mode: 'reactivated',
        companyStatus: 'active',
        cycleId: result.cycle.id,
      },
    });

    void this.billingNotifications.notifyAccountRenewed({
      companyId: plan.companyId,
      companyName: company.name,
      previousCycleId: previousCycle?.id ?? result.cycle.id,
      nextCycleId: result.cycle.id,
    });

    void this.invoiceCalc.recalculateForCompany(plan.companyId, 'cycle_started');

    this.realtime.emitBillingRestrictionChanged(plan.companyId, {
      companyId: plan.companyId,
      restricted: false,
      status: 'active',
    });
    this.realtime.emitCompanyLifecycleChanged(plan.companyId, {
      companyId: plan.companyId,
      status: 'active',
      action: 'billing_renewed',
    });
    this.realtime.emitPlanUpdated(plan.companyId, {
      planId: plan.id,
      companyId: plan.companyId,
      active: true,
      action: 'plan_renewed',
    });

    return {
      mode: 'reactivated' as const,
      plan: result.plan,
      cycle: result.cycle,
    };
  }

  async getCapacitySummary() {
    const [storage, totalWt, allocatedWt] = await Promise.all([
      this.usage.getSystemStorageSnapshot(),
      this.volumeCapacity.getTotalWarehouseWeight(),
      this.volumeCapacity.getAllocatedWeight(),
    ]);
    const allocatableWt = totalWt.mul(0.9);
    return {
      // Inventory × product CBM (billing source of truth)
      usedStorageCbm: storage.usedStorageCbm.toString(),
      reservedStorageCbm: storage.reservedStorageCbm.toString(),
      remainingStorageCbm: storage.remainingStorageCbm.toString(),
      storageUsagePercent: storage.storageUsagePercent,
      // Legacy field names mapped to inventory-based storage for existing UI
      totalWarehouseVolumeCbm: storage.reservedStorageCbm.toString(),
      allocatableCapacityCbm: storage.reservedStorageCbm.toString(),
      allocatedVolumeCbm: storage.usedStorageCbm.toString(),
      remainingAllocatableCbm: storage.remainingStorageCbm.toString(),
      totalWarehouseWeightKg: totalWt.toString(),
      allocatableCapacityKg: allocatableWt.toString(),
      allocatedWeightKg: allocatedWt.toString(),
      remainingAllocatableKg: Prisma.Decimal.max(
        allocatableWt.sub(allocatedWt),
        new Prisma.Decimal(0),
      ).toString(),
      allocationRatio: 1,
      sparePoolRatio: 0,
      basis: 'inventory_product_cbm' as const,
    };
  }

  async getCompanyStorageSummary(companyId: string, user: AuthPrincipal) {
    this.companyAccess.assertCompanyAccess(user, companyId);
    const storage = await this.usage.getCompanyStorageSnapshot(companyId);
    return {
      companyId,
      usedStorageCbm: storage.usedStorageCbm.toString(),
      reservedStorageCbm: storage.reservedStorageCbm.toString(),
      remainingStorageCbm: storage.remainingStorageCbm.toString(),
      storageUsagePercent: storage.storageUsagePercent,
      basis: 'inventory_product_cbm' as const,
    };
  }
}

function mapOverviewSqlRow(row: BillingPlanOverviewSqlRow) {
  const plan = {
    id: row.plan_id,
    companyId: row.company_id,
    active: row.active,
    autoRenew: row.auto_renew,
    cycleLengthDays: row.cycle_length_days,
    fixedSubscriptionFee: row.fixed_subscription_fee.toString(),
    inboundOrderFee: row.inbound_order_fee.toString(),
    outboundOrderFee: row.outbound_order_fee.toString(),
    outboundBaseFee: (row.outbound_base_fee ?? row.outbound_order_fee).toString(),
    outboundIncludedItems: row.outbound_included_items ?? 0,
    outboundAdditionalItemFee: (row.outbound_additional_item_fee ?? 0).toString(),
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
    companyLogoUrl: toAvatarPublicUrl(row.company_logo_path),
    currentCycle,
    cycleStart: currentCycle?.startsAt ?? null,
    cycleEnd: currentCycle?.endsAt ?? null,
    daysRemaining: row.days_remaining,
    cycleStatus: row.cycle_display_status as 'active' | 'renewed' | 'expired' | 'none',
    billingStatus: row.billing_status as 'operational' | 'restricted' | 'inactive',
  };
}
