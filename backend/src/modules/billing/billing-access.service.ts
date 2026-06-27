import { Injectable } from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BillingCycleExpiredException,
  BillingPlanRequiredException,
  VolumeAllocationExceededException,
} from '../../common/errors/billing-exceptions';

/** Warehouse capacity that may be allocated to client billing plans (10% reserved). */
export const WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO = 0.9;

/** Lifecycle statuses that block operational/billing access (no new cycles or invoices). */
export const BILLING_BLOCKED_STATUSES: CompanyStatus[] = [
  CompanyStatus.restricted,
  CompanyStatus.suspended,
  CompanyStatus.archived,
  CompanyStatus.closed,
  CompanyStatus.offboarding,
  CompanyStatus.purged,
];

@Injectable()
export class BillingVolumeCapacityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sum of maxCbm across active internal storage locations. */
  async getTotalWarehouseVolume(): Promise<Prisma.Decimal> {
    const agg = await this.prisma.location.aggregate({
      where: {
        status: 'active',
        type: { in: ['internal', 'fridge', 'quarantine'] },
        maxCbm: { not: null },
      },
      _sum: { maxCbm: true },
    });
    return agg._sum.maxCbm ?? new Prisma.Decimal(0);
  }

  async getTotalWarehouseWeight(): Promise<Prisma.Decimal> {
    const agg = await this.prisma.location.aggregate({
      where: {
        status: 'active',
        type: { in: ['internal', 'fridge', 'quarantine'] },
        maxWeightKg: { not: null },
      },
      _sum: { maxWeightKg: true },
    });
    return agg._sum.maxWeightKg ?? new Prisma.Decimal(0);
  }

  async getAllocatedWeight(excludePlanId?: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.billingPlan.aggregate({
      where: {
        active: true,
        ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
      },
      _sum: { reservedWeight: true },
    });
    return agg._sum.reservedWeight ?? new Prisma.Decimal(0);
  }

  async assertWeightAllocation(
    requestedWeight: Prisma.Decimal | number,
    excludePlanId?: string,
  ): Promise<void> {
    const total = await this.getTotalWarehouseWeight();
    if (total.lte(0)) return;

    const allocatable = total.mul(WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO);
    const allocated = await this.getAllocatedWeight(excludePlanId);
    const requested = new Prisma.Decimal(requestedWeight);
    const nextTotal = allocated.add(requested);

    if (nextTotal.gt(allocatable)) {
      throw new VolumeAllocationExceededException(
        `Total reserved weight (${nextTotal.toFixed(4)} kg) exceeds the 90% allocatable capacity (${allocatable.toFixed(4)} kg of ${total.toFixed(4)} kg).`,
        {
          totalWarehouseWeightKg: total.toString(),
          allocatableCapacityKg: allocatable.toString(),
          currentlyAllocatedKg: allocated.toString(),
          requestedWeightKg: requested.toString(),
        },
      );
    }
  }

  async getAllocatedVolume(excludePlanId?: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.billingPlan.aggregate({
      where: {
        active: true,
        ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
      },
      _sum: { reservedVolume: true },
    });
    return agg._sum.reservedVolume ?? new Prisma.Decimal(0);
  }

  async assertVolumeAllocation(
    requestedVolume: Prisma.Decimal | number,
    excludePlanId?: string,
  ): Promise<void> {
    const total = await this.getTotalWarehouseVolume();
    if (total.lte(0)) return;

    const allocatable = total.mul(WAREHOUSE_ALLOCATABLE_CAPACITY_RATIO);
    const allocated = await this.getAllocatedVolume(excludePlanId);
    const requested = new Prisma.Decimal(requestedVolume);
    const nextTotal = allocated.add(requested);

    if (nextTotal.gt(allocatable)) {
      throw new VolumeAllocationExceededException(
        `Total reserved volume (${nextTotal.toFixed(4)} CBM) exceeds the 90% allocatable capacity (${allocatable.toFixed(4)} CBM of ${total.toFixed(4)} CBM).`,
        {
          totalWarehouseVolume: total.toString(),
          allocatableCapacity: allocatable.toString(),
          currentlyAllocated: allocated.toString(),
          requestedVolume: requested.toString(),
        },
      );
    }
  }
}

@Injectable()
export class BillingAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures the client has an active billing plan and a non-expired billing cycle.
   * Also rejects companies in `restricted` status (set on cycle expiry).
   */
  async getOperationalAccess(companyId: string): Promise<{
    operationalAllowed: boolean;
    accountStatus: 'active' | 'expiring' | 'restricted' | 'no_plan';
    daysRemaining: number | null;
  }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    if (!company) {
      return { operationalAllowed: false, accountStatus: 'no_plan', daysRemaining: null };
    }
    if (BILLING_BLOCKED_STATUSES.includes(company.status)) {
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

    const daysRemaining = Math.max(
      0,
      Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000),
    );
    const accountStatus = daysRemaining <= 7 ? 'expiring' : 'active';

    return { operationalAllowed: true, accountStatus, daysRemaining };
  }

  async assertOperationalBilling(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    if (!company) {
      throw new BillingPlanRequiredException('Company not found.');
    }
    if (BILLING_BLOCKED_STATUSES.includes(company.status)) {
      throw new BillingCycleExpiredException();
    }

    const plan = await this.prisma.billingPlan.findFirst({
      where: { companyId, active: true },
      select: { id: true },
    });
    if (!plan) {
      throw new BillingPlanRequiredException();
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
      throw new BillingCycleExpiredException();
    }
  }
}
