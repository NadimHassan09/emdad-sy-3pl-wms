import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';

/** Daily refresh of excess volume/weight lines for all active billing cycles. */
@Injectable()
export class BillingUsageProcessorService {
  private readonly log = new Logger(BillingUsageProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  @Cron('0 4 * * *')
  async tick() {
    await this.cronLeader.runExclusive('billing-usage-processor', 7200, () => this.runTick());
  }

  private async runTick() {
    try {
      const now = new Date();
      const cycles = await this.prisma.billingCycle.findMany({
        where: {
          status: { in: ['active', 'renewed'] },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { companyId: true },
        distinct: ['companyId'],
      });

      let n = 0;
      for (const { companyId } of cycles) {
        const result = await this.invoiceCalc.recalculateForCompany(
          companyId,
          'scheduled_usage',
        );
        if (result) n++;
      }
      if (n > 0) {
        this.log.log(`Recalculated usage billing for ${n} active cycle(s).`);
      }
    } catch (err) {
      this.log.error('Billing usage processor tick failed', err);
    }
  }
}
