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
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { buildRateSnapshotFromPlan } from './billing-rate-snapshot.util';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
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
  ) {}

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
      void this.invoiceCalc.recalculateForCompany(plan.companyId, 'cycle_started');
      return plan;
    });
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateBillingPlanDto) {
    await this.findById(user, id);
    if (dto.reservedVolume != null) {
      await this.volumeCapacity.assertVolumeAllocation(dto.reservedVolume, id);
    }

    // Plan updates apply to future cycles only; active cycle invoices use rate_snapshot.
    return this.prisma.billingPlan.update({
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
  }

  async getCapacitySummary() {
    const [total, allocated] = await Promise.all([
      this.volumeCapacity.getTotalWarehouseVolume(),
      this.volumeCapacity.getAllocatedVolume(),
    ]);
    const allocatable = total.mul(0.9);
    return {
      totalWarehouseVolumeCbm: total.toString(),
      allocatableCapacityCbm: allocatable.toString(),
      allocatedVolumeCbm: allocated.toString(),
      remainingAllocatableCbm: Prisma.Decimal.max(
        allocatable.sub(allocated),
        new Prisma.Decimal(0),
      ).toString(),
      allocationRatio: 0.9,
    };
  }
}
