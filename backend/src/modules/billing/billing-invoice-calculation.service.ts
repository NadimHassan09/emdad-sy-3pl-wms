import { Injectable, Logger } from '@nestjs/common';
import {
  BillingInvoiceLineSource,
  BillingInvoiceLineType,
  BillingInvoiceStatus,
  Prisma,
} from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  parseRateSnapshot,
  rateSnapshotToDecimals,
} from './billing-rate-snapshot.util';
import {
  BillingLineComputation,
  BillingRecalcResult,
  BillingRecalcTrigger,
} from './billing-recalculation.types';
import { computeInvoiceTotals, sumLineTotals } from './billing-totals.util';

/** System lines still generated on each recalculation. */
const SYSTEM_LINE_TYPES: BillingInvoiceLineType[] = [
  'subscription',
  'inbound',
  'outbound',
];

/**
 * Former usage-based system charges kept retired (packaging / QC / storage).
 * Deleted on recalc so they cannot linger on draft invoices.
 */
const RETIRED_USAGE_LINE_TYPES: BillingInvoiceLineType[] = [
  'packaging',
  'quality_check',
  'excess_volume',
  'excess_weight',
];

type CycleOrderMetrics = {
  inboundCount: number;
  outboundCount: number;
};

const PLAN_RATE_SELECT = {
  id: true,
  fixedSubscriptionFee: true,
  inboundOrderFee: true,
  outboundOrderFee: true,
  outboundBaseFee: true,
  outboundIncludedItems: true,
  outboundAdditionalItemFee: true,
  packagingFee: true,
  qualityCheckFee: true,
  excessVolumeFeePerDay: true,
  excessWeightFeePerDay: true,
  reservedVolume: true,
  reservedWeight: true,
} satisfies Prisma.BillingPlanSelect;

@Injectable()
export class BillingInvoiceCalculationService {
  private readonly log = new Logger(BillingInvoiceCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async recalculateForCompany(
    companyId: string,
    trigger: BillingRecalcTrigger,
  ): Promise<BillingRecalcResult | null> {
    try {
      return await this.recalculateForCompanyInternal(companyId, trigger);
    } catch (err) {
      this.log.error(
        `Invoice recalculation failed company=${companyId} trigger=${trigger}`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }

  async finalizeCycleInvoice(
    tx: Prisma.TransactionClient,
    billingCycleId: string,
  ): Promise<void> {
    const now = new Date();
    const invoices = await tx.invoice.findMany({
      where: { billingCycleId, status: BillingInvoiceStatus.draft },
      select: { id: true, companyId: true },
    });

    for (const inv of invoices) {
      const company = await tx.company.findUnique({
        where: { id: inv.companyId },
        select: { paymentTermsDays: true },
      });
      const dueDate = new Date(now);
      dueDate.setUTCDate(dueDate.getUTCDate() + (company?.paymentTermsDays ?? 30));

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          status: BillingInvoiceStatus.unpaid,
          issuedAt: now,
          dueDate,
        },
      });
    }
  }

  async applyInvoiceTotals(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ): Promise<Prisma.Decimal> {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        discountType: true,
        discountValue: true,
        vatPercentage: true,
        lines: { select: { totalPrice: true } },
      },
    });
    if (!invoice) return new Prisma.Decimal(0);

    const subtotalAmount = sumLineTotals(invoice.lines);
    const totals = computeInvoiceTotals({
      subtotalAmount,
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      vatPercentage: invoice.vatPercentage,
    });

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotalAmount: totals.subtotalAmount,
        discountAmount: totals.discountAmount,
        vatAmount: totals.vatAmount,
        grandTotal: totals.grandTotal,
        totalAmount: totals.grandTotal,
      },
    });

    return totals.grandTotal;
  }

  private async recalculateForCompanyInternal(
    companyId: string,
    trigger: BillingRecalcTrigger,
  ): Promise<BillingRecalcResult | null> {
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
        companyId: true,
        billingPlanId: true,
        startsAt: true,
        endsAt: true,
        rateSnapshot: true,
      },
    });
    if (!cycle) return null;

    const rates = await this.resolveCycleRates(cycle);
    if (!rates) return null;

    const windowEnd = cycle.endsAt < now ? cycle.endsAt : now;
    const metrics = await this.collectCycleMetrics(
      companyId,
      cycle.startsAt,
      windowEnd,
    );
    const lines = this.computeLines(rates, metrics);

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await this.getOrCreateDraftInvoice(tx, companyId, cycle.id);
      const previousTotal = invoice.grandTotal.toString();

      await tx.invoiceLine.deleteMany({
        where: {
          invoiceId: invoice.id,
          lineSource: BillingInvoiceLineSource.system,
          type: { in: RETIRED_USAGE_LINE_TYPES },
        },
      });

      for (const line of lines) {
        await this.upsertSystemInvoiceLine(tx, invoice.id, line);
      }

      await this.syncOrderChargeLines(tx, invoice.id, companyId, cycle.startsAt, windowEnd);

      const totalAmount = await this.applyInvoiceTotals(tx, invoice.id);

      return {
        invoiceId: invoice.id,
        billingCycleId: cycle.id,
        companyId,
        totalAmount: totalAmount.toString(),
        lines,
        trigger,
        previousTotal,
      };
    });

    await this.audit.logBestEffort({
      actorId: null,
      actorEmail: 'billing-engine@system.local',
      actorName: 'Billing Engine',
      actorRole: 'system',
      companyId,
      action: 'BILLING_INVOICE_RECALCULATED',
      resourceType: 'invoice',
      resourceId: result.invoiceId,
      previousState: { totalAmount: result.previousTotal },
      newState: {
        trigger,
        billingCycleId: result.billingCycleId,
        totalAmount: result.totalAmount,
        lines: result.lines,
      },
    });

    return {
      invoiceId: result.invoiceId,
      billingCycleId: result.billingCycleId,
      companyId: result.companyId,
      totalAmount: result.totalAmount,
      lines: result.lines,
      trigger: result.trigger,
    };
  }

  private async resolveCycleRates(cycle: {
    billingPlanId: string;
    rateSnapshot: unknown;
  }) {
    const fromSnapshot = parseRateSnapshot(cycle.rateSnapshot);
    if (fromSnapshot) return rateSnapshotToDecimals(fromSnapshot);

    const plan = await this.prisma.billingPlan.findUnique({
      where: { id: cycle.billingPlanId },
      select: PLAN_RATE_SELECT,
    });
    if (!plan) return null;

    const outboundBaseFee = plan.outboundBaseFee.gt(0)
      ? plan.outboundBaseFee
      : plan.outboundOrderFee;

    return rateSnapshotToDecimals({
      billingPlanId: plan.id,
      fixedSubscriptionFee: plan.fixedSubscriptionFee.toString(),
      inboundOrderFee: plan.inboundOrderFee.toString(),
      outboundOrderFee: plan.outboundOrderFee.toString(),
      outboundBaseFee: outboundBaseFee.toString(),
      outboundIncludedItems: plan.outboundIncludedItems,
      outboundAdditionalItemFee: plan.outboundAdditionalItemFee.toString(),
      packagingFee: plan.packagingFee.toString(),
      qualityCheckFee: plan.qualityCheckFee.toString(),
      excessVolumeFeePerDay: plan.excessVolumeFeePerDay.toString(),
      excessWeightFeePerDay: plan.excessWeightFeePerDay.toString(),
      reservedVolume: plan.reservedVolume.toString(),
      reservedWeight: plan.reservedWeight.toString(),
      snapshottedAt: new Date(0).toISOString(),
    });
  }

  private async collectCycleMetrics(
    companyId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<CycleOrderMetrics> {
    const [inboundCount, outboundCount] = await Promise.all([
      this.prisma.inboundOrder.count({
        where: {
          companyId,
          status: 'completed',
          completedAt: { gte: windowStart, lte: windowEnd },
        },
      }),
      this.prisma.outboundOrder.count({
        where: {
          companyId,
          status: 'shipped',
          shippedAt: { gte: windowStart, lte: windowEnd },
        },
      }),
    ]);
    return { inboundCount, outboundCount };
  }

  /** Exported for unit tests — keeps line math pure and free of Prisma. */
  static computeSystemLines(
    rates: ReturnType<typeof rateSnapshotToDecimals>,
    metrics: CycleOrderMetrics,
  ): BillingLineComputation[] {
    const lines: BillingLineComputation[] = [];

    for (const type of SYSTEM_LINE_TYPES) {
      let quantity: Prisma.Decimal;
      let unitPrice: Prisma.Decimal;

      if (type === 'subscription') {
        quantity = new Prisma.Decimal(1);
        unitPrice = rates.fixedSubscriptionFee;
      } else if (type === 'inbound') {
        quantity = new Prisma.Decimal(metrics.inboundCount);
        unitPrice = rates.inboundOrderFee;
      } else {
        quantity = new Prisma.Decimal(metrics.outboundCount);
        unitPrice = rates.outboundOrderFee;
      }

      const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
      lines.push({
        type,
        quantity: quantity.toFixed(4),
        unitPrice: unitPrice.toFixed(4),
        totalPrice: totalPrice.toFixed(2),
      });
    }

    return lines;
  }

  private computeLines(
    rates: ReturnType<typeof rateSnapshotToDecimals>,
    metrics: CycleOrderMetrics,
  ): BillingLineComputation[] {
    return BillingInvoiceCalculationService.computeSystemLines(rates, metrics);
  }

  private async syncOrderChargeLines(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    companyId: string,
    windowStart: Date,
    windowEnd: Date,
  ) {
    const [inboundOrders, outboundOrders] = await Promise.all([
      tx.inboundOrder.findMany({
        where: {
          companyId,
          status: 'completed',
          completedAt: { gte: windowStart, lte: windowEnd },
        },
        select: { id: true },
      }),
      tx.outboundOrder.findMany({
        where: {
          companyId,
          status: 'shipped',
          shippedAt: { gte: windowStart, lte: windowEnd },
        },
        select: { id: true },
      }),
    ]);

    const inboundIds = inboundOrders.map((o) => o.id);
    const outboundIds = outboundOrders.map((o) => o.id);

    const charges =
      inboundIds.length || outboundIds.length
        ? await tx.orderManualCharge.findMany({
            where: {
              companyId,
              OR: [
                ...(inboundIds.length
                  ? [{ referenceType: 'inbound_order', referenceId: { in: inboundIds } }]
                  : []),
                ...(outboundIds.length
                  ? [{ referenceType: 'outbound_order', referenceId: { in: outboundIds } }]
                  : []),
              ],
            },
          })
        : [];

    const chargeIds = charges.map((c) => c.id);

    await tx.invoiceLine.deleteMany({
      where: {
        invoiceId,
        lineSource: BillingInvoiceLineSource.order,
        ...(chargeIds.length ? { orderChargeId: { notIn: chargeIds } } : {}),
      },
    });

    if (!chargeIds.length) {
      await tx.invoiceLine.deleteMany({
        where: { invoiceId, lineSource: BillingInvoiceLineSource.order },
      });
      return;
    }

    for (const charge of charges) {
      const existing = await tx.invoiceLine.findFirst({
        where: { invoiceId, orderChargeId: charge.id },
      });

      const data = {
        type: BillingInvoiceLineType.order_charge,
        lineSource: BillingInvoiceLineSource.order,
        description: charge.description,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        totalPrice: charge.totalPrice,
        orderChargeId: charge.id,
      };

      if (existing) {
        await tx.invoiceLine.update({ where: { id: existing.id }, data });
      } else {
        await tx.invoiceLine.create({ data: { invoiceId, ...data } });
      }
    }
  }

  private async getOrCreateDraftInvoice(
    tx: Prisma.TransactionClient,
    companyId: string,
    billingCycleId: string,
  ) {
    const existing = await tx.invoice.findFirst({
      where: { billingCycleId, status: BillingInvoiceStatus.draft },
    });
    if (existing) return existing;

    return tx.invoice.create({
      data: {
        companyId,
        billingCycleId,
        invoiceSource: 'cycle',
        status: BillingInvoiceStatus.draft,
      },
    });
  }

  private async upsertSystemInvoiceLine(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    line: BillingLineComputation,
  ) {
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const totalPrice = new Prisma.Decimal(line.totalPrice);

    const existing = await tx.invoiceLine.findFirst({
      where: {
        invoiceId,
        type: line.type,
        lineSource: BillingInvoiceLineSource.system,
      },
    });

    const data = { quantity, unitPrice, totalPrice };

    if (existing) {
      return tx.invoiceLine.update({ where: { id: existing.id }, data });
    }

    return tx.invoiceLine.create({
      data: {
        invoiceId,
        type: line.type,
        lineSource: BillingInvoiceLineSource.system,
        ...data,
      },
    });
  }
}
