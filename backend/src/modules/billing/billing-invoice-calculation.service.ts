import { Injectable, Logger } from '@nestjs/common';
import {
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
import { BillingUsageService } from './billing-usage.service';

const MS_PER_DAY = 86_400_000;

const PLAN_RATE_SELECT = {
  id: true,
  fixedSubscriptionFee: true,
  inboundOrderFee: true,
  outboundOrderFee: true,
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
    private readonly usage: BillingUsageService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Recalculates the draft invoice for the client's current billing cycle.
   * Historical (non-draft) invoices are never modified.
   */
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

  /** Finalize draft invoice when a billing cycle ends (immutable historical record). */
  async finalizeCycleInvoice(
    tx: Prisma.TransactionClient,
    billingCycleId: string,
  ): Promise<void> {
    const now = new Date();
    await tx.invoice.updateMany({
      where: { billingCycleId, status: BillingInvoiceStatus.draft },
      data: {
        status: BillingInvoiceStatus.open,
        issuedAt: now,
      },
    });
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
    const metrics = await this.collectCycleMetrics(companyId, cycle.startsAt, windowEnd);
    const daysElapsed = this.daysElapsedInCycle(cycle.startsAt, windowEnd);
    const lines = this.computeLines(rates, metrics, daysElapsed);

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await this.getOrCreateDraftInvoice(tx, companyId, cycle.id);
      const previousTotal = invoice.totalAmount.toString();

      for (const line of lines) {
        await this.upsertInvoiceLine(tx, invoice.id, line);
      }

      const totalAmount = lines.reduce(
        (sum, l) => sum.add(new Prisma.Decimal(l.totalPrice)),
        new Prisma.Decimal(0),
      );

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { totalAmount },
      });

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
    return rateSnapshotToDecimals({
      billingPlanId: plan.id,
      fixedSubscriptionFee: plan.fixedSubscriptionFee.toString(),
      inboundOrderFee: plan.inboundOrderFee.toString(),
      outboundOrderFee: plan.outboundOrderFee.toString(),
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
  ) {
    const [inboundCount, outboundCount, packagingCount, qcCount, usage] =
      await Promise.all([
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
        this.prisma.warehouseTask.count({
          where: {
            taskType: 'pack',
            status: 'completed',
            completedAt: { gte: windowStart, lte: windowEnd },
            workflowInstance: { companyId, referenceType: 'outbound_order' },
          },
        }),
        this.prisma.warehouseTask.count({
          where: {
            taskType: 'qc',
            status: 'completed',
            completedAt: { gte: windowStart, lte: windowEnd },
            workflowInstance: { companyId, referenceType: 'inbound_order' },
          },
        }),
        this.usage.getCompanyUsage(companyId),
      ]);

    return {
      inboundCount,
      outboundCount,
      packagingCount,
      qcCount,
      usageVolumeCbm: usage.volumeCbm,
      usageWeightKg: usage.weightKg,
    };
  }

  private computeLines(
    rates: ReturnType<typeof rateSnapshotToDecimals>,
    metrics: Awaited<ReturnType<typeof this.collectCycleMetrics>>,
    daysElapsed: number,
  ): BillingLineComputation[] {
    const excessVolume = Prisma.Decimal.max(
      metrics.usageVolumeCbm.sub(rates.reservedVolume),
      new Prisma.Decimal(0),
    );
    const excessWeight = Prisma.Decimal.max(
      metrics.usageWeightKg.sub(rates.reservedWeight),
      new Prisma.Decimal(0),
    );

    const dayFactor = new Prisma.Decimal(daysElapsed);

    const specs: Array<{
      type: BillingInvoiceLineType;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
    }> = [
      {
        type: 'subscription',
        quantity: new Prisma.Decimal(1),
        unitPrice: rates.fixedSubscriptionFee,
      },
      {
        type: 'inbound',
        quantity: new Prisma.Decimal(metrics.inboundCount),
        unitPrice: rates.inboundOrderFee,
      },
      {
        type: 'outbound',
        quantity: new Prisma.Decimal(metrics.outboundCount),
        unitPrice: rates.outboundOrderFee,
      },
      {
        type: 'packaging',
        quantity: new Prisma.Decimal(metrics.packagingCount),
        unitPrice: rates.packagingFee,
      },
      {
        type: 'quality_check',
        quantity: new Prisma.Decimal(metrics.qcCount),
        unitPrice: rates.qualityCheckFee,
      },
      {
        type: 'excess_volume',
        quantity: excessVolume.mul(dayFactor),
        unitPrice: rates.excessVolumeFeePerDay,
      },
      {
        type: 'excess_weight',
        quantity: excessWeight.mul(dayFactor),
        unitPrice: rates.excessWeightFeePerDay,
      },
    ];

    return specs.map(({ type, quantity, unitPrice }) => {
      const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
      return {
        type,
        quantity: quantity.toFixed(4),
        unitPrice: unitPrice.toFixed(4),
        totalPrice: totalPrice.toFixed(2),
      };
    });
  }

  private daysElapsedInCycle(startsAt: Date, asOf: Date): number {
    const ms = Math.max(0, asOf.getTime() - startsAt.getTime());
    return Math.max(1, Math.ceil(ms / MS_PER_DAY));
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
      data: { companyId, billingCycleId, status: BillingInvoiceStatus.draft },
    });
  }

  private async upsertInvoiceLine(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    line: BillingLineComputation,
  ) {
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const totalPrice = new Prisma.Decimal(line.totalPrice);

    const existing = await tx.invoiceLine.findFirst({
      where: { invoiceId, type: line.type },
    });

    if (existing) {
      return tx.invoiceLine.update({
        where: { id: existing.id },
        data: { quantity, unitPrice, totalPrice },
      });
    }

    return tx.invoiceLine.create({
      data: {
        invoiceId,
        type: line.type,
        quantity,
        unitPrice,
        totalPrice,
      },
    });
  }
}
