import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CompanyStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingCyclesService } from './billing-cycles.service';

/**
 * Processes billing cycle expiry, account restriction, and deferred renewals.
 */
@Injectable()
export class BillingCycleProcessorService {
  private readonly log = new Logger(BillingCycleProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingCycles: BillingCyclesService,
  ) {}

  @Cron('*/15 * * * *')
  async tick() {
    try {
      const n = await this.processExpiredCycles();
      if (n > 0) {
        this.log.log(`Processed ${n} expired billing cycle(s).`);
      }
    } catch (err) {
      this.log.error('Billing cycle processor tick failed', err);
    }
  }

  async processExpiredCycles(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.billingCycle.findMany({
      where: {
        status: { in: ['active', 'renewed'] },
        endsAt: { lte: now },
      },
      select: {
        id: true,
        companyId: true,
        billingPlanId: true,
        endsAt: true,
        status: true,
      },
    });

    for (const cycle of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.billingCycle.update({
          where: { id: cycle.id },
          data: { status: 'expired' },
        });

        if (cycle.status === 'renewed') {
          const next = await this.billingCycles.createNextCycleFromPlan(tx, cycle);
          if (next) {
            await tx.company.update({
              where: { id: cycle.companyId },
              data: { status: CompanyStatus.active },
            });
            this.log.log(
              `Renewed billing cycle for company ${cycle.companyId}: ${next.id}`,
            );
            return;
          }
        }

        await tx.company.update({
          where: { id: cycle.companyId },
          data: { status: CompanyStatus.restricted },
        });
        this.log.warn(
          `Restricted company ${cycle.companyId} — billing cycle ${cycle.id} expired without renewal.`,
        );
      });
    }

    return due.length;
  }
}
