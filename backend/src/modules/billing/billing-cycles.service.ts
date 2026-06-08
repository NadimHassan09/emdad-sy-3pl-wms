import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const CYCLE_SELECT = {
  id: true,
  companyId: true,
  billingPlanId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BillingCycleSelect;

@Injectable()
export class BillingCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  list(user: AuthPrincipal, companyId?: string) {
    const where: Prisma.BillingCycleWhereInput = {};
    if (companyId) {
      this.companyAccess.assertCompanyAccess(user, companyId);
      where.companyId = companyId;
    } else if (user.tenantScope === 'restricted') {
      where.companyId = { in: user.authorizedCompanyIds };
    }
    return this.prisma.billingCycle.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      select: CYCLE_SELECT,
    });
  }

  async findById(user: AuthPrincipal, id: string) {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id },
      select: CYCLE_SELECT,
    });
    if (!cycle) throw new NotFoundException('Billing cycle not found.');
    this.companyAccess.assertCompanyAccess(user, cycle.companyId);
    return cycle;
  }

  /**
   * Mark the current cycle for renewal. Does not create the next cycle immediately;
   * {@link BillingCycleProcessorService} creates it when the current cycle expires.
   */
  async renew(user: AuthPrincipal, cycleId: string) {
    const cycle = await this.findById(user, cycleId);
    if (cycle.status !== 'active') {
      throw new InvalidStateException(
        'Only an active billing cycle can be marked for renewal.',
      );
    }
    const now = new Date();
    if (cycle.endsAt <= now) {
      throw new BadRequestException('This billing cycle has already ended.');
    }

    return this.prisma.billingCycle.update({
      where: { id: cycleId },
      data: { status: 'renewed' },
      select: CYCLE_SELECT,
    });
  }

  /** Called by the expiry processor — not exposed via HTTP. */
  async createNextCycleFromPlan(
    tx: Prisma.TransactionClient,
    expiredCycle: {
      companyId: string;
      billingPlanId: string;
      endsAt: Date;
    },
  ) {
    const plan = await tx.billingPlan.findUnique({
      where: { id: expiredCycle.billingPlanId },
      select: { id: true, active: true, cycleLengthDays: true },
    });
    if (!plan?.active) return null;

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
      },
      select: CYCLE_SELECT,
    });
  }
}
