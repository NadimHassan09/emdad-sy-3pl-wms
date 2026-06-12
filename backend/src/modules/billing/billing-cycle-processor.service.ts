import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CompanyStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { BillingCyclesService } from './billing-cycles.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { BillingNotificationsService } from './billing-notifications.service';

/**
 * Processes billing cycle expiry, account restriction, and deferred renewals.
 */
@Injectable()
export class BillingCycleProcessorService {
  private readonly log = new Logger(BillingCycleProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingCycles: BillingCyclesService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
    private readonly billingNotifications: BillingNotificationsService,
    private readonly billingAudit: BillingAuditService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  @Cron('*/15 * * * *')
  async tick() {
    await this.cronLeader.runExclusive('billing-cycle-processor', 960, () => this.runTick());
  }

  private async runTick() {
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
      let renewedCompanyId: string | null = null;
      let nextCycleId: string | null = null;
      const company = await this.prisma.company.findUnique({
        where: { id: cycle.companyId },
        select: { name: true },
      });
      const companyName = company?.name ?? cycle.companyId;

      await this.prisma.$transaction(async (tx) => {
        await this.invoiceCalc.finalizeCycleInvoice(tx, cycle.id);

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
            renewedCompanyId = cycle.companyId;
            nextCycleId = next.id;
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

      const issuedInvoice = await this.prisma.invoice.findFirst({
        where: { billingCycleId: cycle.id, status: 'open' },
        orderBy: { issuedAt: 'desc' },
        select: { id: true, invoiceNumber: true },
      });
      if (issuedInvoice) {
        void this.billingAudit.system({
          action: BILLING_AUDIT_ACTIONS.INVOICE_GENERATED,
          resourceType: 'invoice',
          resourceId: issuedInvoice.id,
          companyId: cycle.companyId,
          newState: { invoiceNumber: issuedInvoice.invoiceNumber, billingCycleId: cycle.id },
        });
        void this.billingNotifications.notifyInvoiceGenerated({
          companyId: cycle.companyId,
          companyName,
          invoiceId: issuedInvoice.id,
          invoiceNumber: issuedInvoice.invoiceNumber,
          billingCycleId: cycle.id,
        });
      }

      if (renewedCompanyId && nextCycleId) {
        void this.billingNotifications.notifyAccountRenewed({
          companyId: cycle.companyId,
          companyName,
          previousCycleId: cycle.id,
          nextCycleId,
        });
        void this.invoiceCalc.recalculateForCompany(renewedCompanyId, 'cycle_started');
      } else {
        void this.billingAudit.system({
          action: BILLING_AUDIT_ACTIONS.PLAN_SUSPENDED,
          resourceType: 'billing_cycle',
          resourceId: cycle.id,
          companyId: cycle.companyId,
          newState: { companyStatus: 'restricted' },
        });
        void this.billingNotifications.notifyAccountSuspended({
          companyId: cycle.companyId,
          companyName,
          cycleId: cycle.id,
        });
      }
    }

    return due.length;
  }
}
