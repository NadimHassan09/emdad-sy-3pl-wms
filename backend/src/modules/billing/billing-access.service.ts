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
  async assertOperationalBilling(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    if (!company) {
      throw new BillingPlanRequiredException('Company not found.');
    }
    if (company.status === CompanyStatus.restricted) {
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
