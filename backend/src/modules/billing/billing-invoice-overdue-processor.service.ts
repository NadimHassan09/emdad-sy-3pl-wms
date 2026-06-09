import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingInvoiceStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingAuditService, BILLING_AUDIT_ACTIONS } from './billing-audit.service';
import { BillingNotificationsService } from './billing-notifications.service';

/**
 * Marks open invoices overdue when past company payment terms.
 */
@Injectable()
export class BillingInvoiceOverdueProcessorService {
  private readonly log = new Logger(BillingInvoiceOverdueProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: BillingNotificationsService,
    private readonly billingAudit: BillingAuditService,
  ) {}

  @Cron('0 6 * * *')
  async tick() {
    try {
      const n = await this.processOverdueInvoices();
      if (n > 0) this.log.log(`Marked ${n} invoice(s) overdue.`);
    } catch (err) {
      this.log.error('Overdue invoice processor failed', err);
    }
  }

  async processOverdueInvoices(): Promise<number> {
    const now = new Date();
    const openInvoices = await this.prisma.invoice.findMany({
      where: { status: BillingInvoiceStatus.open, issuedAt: { not: null } },
      select: {
        id: true,
        companyId: true,
        invoiceNumber: true,
        issuedAt: true,
        company: { select: { name: true, paymentTermsDays: true } },
      },
    });

    let updated = 0;
    for (const inv of openInvoices) {
      if (!inv.issuedAt) continue;
      const dueAt = new Date(inv.issuedAt);
      dueAt.setUTCDate(dueAt.getUTCDate() + (inv.company.paymentTermsDays ?? 30));
      if (dueAt >= now) continue;

      await this.prisma.invoice.update({
        where: { id: inv.id },
        data: { status: BillingInvoiceStatus.overdue },
      });

      void this.billingAudit.system({
        action: BILLING_AUDIT_ACTIONS.INVOICE_OVERDUE,
        resourceType: 'invoice',
        resourceId: inv.id,
        companyId: inv.companyId,
        previousState: { status: 'open' },
        newState: { status: 'overdue', dueAt: dueAt.toISOString() },
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
