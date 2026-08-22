import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingInvoiceStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { BillingNotificationsService } from './billing-notifications.service';

/**
 * Sends reminders for unpaid invoices past due date (status remains unpaid).
 */
@Injectable()
export class BillingInvoiceOverdueProcessorService {
  private readonly log = new Logger(BillingInvoiceOverdueProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: BillingNotificationsService,
    private readonly billingAudit: BillingAuditService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  @Cron('0 6 * * *')
  async tick() {
    await this.cronLeader.runExclusive('billing-invoice-overdue-processor', 7200, () =>
      this.runTick(),
    );
  }

  private async runTick() {
    try {
      const n = await this.processOverdueInvoices();
      if (n > 0) this.log.log(`Notified ${n} past-due unpaid invoice(s).`);
    } catch (err) {
      this.log.error('Overdue invoice processor failed', err);
    }
  }

  async processOverdueInvoices(): Promise<number> {
    const now = new Date();
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        status: {
          in: [BillingInvoiceStatus.unpaid, BillingInvoiceStatus.open, BillingInvoiceStatus.overdue],
        },
        issuedAt: { not: null },
      },
      select: {
        id: true,
        companyId: true,
        invoiceNumber: true,
        issuedAt: true,
        dueDate: true,
        company: { select: { name: true, paymentTermsDays: true } },
      },
    });

    let updated = 0;
    for (const inv of unpaidInvoices) {
      if (!inv.issuedAt) continue;
      const dueAt = inv.dueDate
        ? new Date(inv.dueDate)
        : (() => {
            const d = new Date(inv.issuedAt!);
            d.setUTCDate(d.getUTCDate() + (inv.company.paymentTermsDays ?? 30));
            return d;
          })();
      if (dueAt >= now) continue;

      void this.billingAudit.system({
        action: BILLING_AUDIT_ACTIONS.INVOICE_OVERDUE,
        resourceType: 'invoice',
        resourceId: inv.id,
        companyId: inv.companyId,
        previousState: { status: 'unpaid' },
        newState: { pastDue: true, dueAt: dueAt.toISOString() },
      });

      void this.notifications.notifyInvoiceOverdue({
        companyId: inv.companyId,
        companyName: inv.company.name,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
      });

      updated += 1;
    }
    return updated;
  }
}
