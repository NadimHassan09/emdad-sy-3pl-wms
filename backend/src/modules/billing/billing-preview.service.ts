import { Injectable, NotFoundException } from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingInvoiceCalculationService } from './billing-invoice-calculation.service';
import { BillingUsageService } from './billing-usage.service';

@Injectable()
export class BillingPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly usage: BillingUsageService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
  ) {}

  /**
   * Live draft-invoice preview for the client's current billing cycle.
   * Triggers recalculation before returning (preview is not persisted as open).
   */
  async getCompanyPreview(user: AuthPrincipal, companyId: string) {
    this.companyAccess.assertCompanyAccess(user, companyId);

    const plan = await this.prisma.billingPlan.findFirst({
      where: { companyId, active: true },
      select: {
        id: true,
        cycleLengthDays: true,
        reservedVolume: true,
        reservedWeight: true,
        fixedSubscriptionFee: true,
      },
    });
    if (!plan) throw new NotFoundException('No active billing plan for this client.');

    const now = new Date();
    const cycle = await this.prisma.billingCycle.findFirst({
      where: {
        companyId,
        status: { in: ['active', 'renewed'] },
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        rateSnapshot: true,
      },
    });
    if (!cycle) throw new NotFoundException('No active billing cycle for this client.');

    await this.invoiceCalc.recalculateForCompany(companyId, 'manual_preview');

    const invoice = await this.prisma.invoice.findFirst({
      where: { billingCycleId: cycle.id, status: 'draft' },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        lines: {
          select: {
            id: true,
            type: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
    });

    const usageTotals = await this.usage.getCompanyUsage(companyId);
    const daysRemaining = Math.max(
      0,
      Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000),
    );

    return {
      companyId,
      plan,
      cycle: {
        id: cycle.id,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        status: cycle.status,
        daysRemaining,
        rateSnapshot: cycle.rateSnapshot,
      },
      usage: {
        usedVolumeCbm: usageTotals.volumeCbm.toString(),
        usedWeightKg: usageTotals.weightKg.toString(),
        allocatedVolumeCbm: plan.reservedVolume.toString(),
        allocatedWeightKg: plan.reservedWeight.toString(),
      },
      preview: invoice
        ? {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            subtotal: invoice.totalAmount.toString(),
            tax: '0',
            discount: '0',
            grandTotal: invoice.totalAmount.toString(),
            lines: invoice.lines.map((l) => ({
              ...l,
              quantity: l.quantity.toString(),
              unitPrice: l.unitPrice.toString(),
              totalPrice: l.totalPrice.toString(),
            })),
          }
        : null,
    };
  }
}
