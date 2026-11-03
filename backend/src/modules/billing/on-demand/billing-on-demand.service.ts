import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingChargeKind,
  BillingInvoiceLineSource,
  BillingInvoiceLineType,
  BillingInvoiceSource,
  BillingInvoiceStatus,
  FinancialTransactionCategory,
  FinancialTransactionType,
  Prisma,
} from '@prisma/client';

import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { CompanyAccessService } from '../../../common/company-access/company-access.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { readManagedUsdToSypRate } from '../../financial/account-currency';
import { FinancialAccountsService } from '../../financial/financial-accounts.service';
import { FinancialTransactionsService } from '../../financial/financial-transactions.service';
import { carrierSypUnit, rateForCarrierUnit } from '../../shipping/carrier-currency';
import { BillingInvoiceCalculationService } from '../billing-invoice-calculation.service';
import {
  computeFulfillmentFee,
  computeStorageFee,
  inclusiveDays,
  roundMoney,
  settlementStatement,
  type FulfillmentRule,
} from './billing-fulfillment-pricing.util';

export type OnDemandInclude = {
  inbound: boolean;
  outbound: boolean;
  oms: boolean;
  storage: boolean;
  shipping: boolean;
};

export type OnDemandInput = {
  companyId: string;
  from: string;
  to: string;
  include: OnDemandInclude;
};

export type RuleInput = {
  kind: BillingChargeKind;
  enabled: boolean;
  baseFee: number;
  includedLines: number;
  extraLineFee: number;
  includedWeightKg: number;
  extraKgFee: number;
};

type OrderKind = 'inbound' | 'outbound' | 'oms';

type PreviewItem = {
  orderKind: OrderKind;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  linesCount: number;
  weightKg: string;
  charged: boolean;
  fulfillmentFee: string;
  shippingFee: string;
  shippingFeeAlreadySettled: boolean;
  carrierCostUsd: string | null;
};

const RULE_KIND_BY_ORDER: Record<OrderKind, BillingChargeKind> = {
  inbound: BillingChargeKind.inbound_order,
  outbound: BillingChargeKind.outbound_order,
  oms: BillingChargeKind.oms_order,
};

/** A commercial order counts as dispatched (fulfillment work done) once it left the warehouse. */
const OMS_DISPATCHED = ['shipped', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'];
const OUTBOUND_DISPATCHED = ['shipped', 'out_for_delivery', 'delivered', 'externally_fulfilled', 'returned'];

const ZERO = new Prisma.Decimal(0);

function startOfDayUtc(value: string): Date {
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
  return d;
}

function endOfDayUtc(value: string): Date {
  const d = startOfDayUtc(value);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function weightOf(lines: Array<{ qty: Prisma.Decimal.Value; weightKg: Prisma.Decimal | null | undefined }>): Prisma.Decimal {
  return lines.reduce(
    (sum, l) => sum.plus(new Prisma.Decimal(l.qty).times(l.weightKg ?? ZERO)),
    ZERO,
  );
}

@Injectable()
export class BillingOnDemandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly invoiceCalc: BillingInvoiceCalculationService,
    private readonly accounts: FinancialAccountsService,
    private readonly transactions: FinancialTransactionsService,
  ) {}

  // ---------------------------------------------------------------- charge rules

  async getRules(user: AuthPrincipal, companyId: string) {
    this.companyAccess.assertCompanyAccess(user, companyId);
    const rows = await this.prisma.billingChargeRule.findMany({ where: { companyId } });
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    return Object.values(BillingChargeKind).map((kind) => {
      const r = byKind.get(kind);
      return {
        kind,
        enabled: r?.enabled ?? false,
        baseFee: Number(r?.baseFee ?? 0),
        includedLines: r?.includedLines ?? 1,
        extraLineFee: Number(r?.extraLineFee ?? 0),
        includedWeightKg: Number(r?.includedWeightKg ?? 0),
        extraKgFee: Number(r?.extraKgFee ?? 0),
      };
    });
  }

  async saveRules(user: AuthPrincipal, companyId: string, rules: RuleInput[]) {
    this.companyAccess.assertCompanyAccess(user, companyId);
    for (const r of rules) {
      for (const [name, v] of Object.entries({
        baseFee: r.baseFee,
        extraLineFee: r.extraLineFee,
        includedWeightKg: r.includedWeightKg,
        extraKgFee: r.extraKgFee,
      })) {
        if (!Number.isFinite(v) || v < 0) throw new BadRequestException(`${name} must be zero or more.`);
      }
      if (!Number.isInteger(r.includedLines) || r.includedLines < 0) {
        throw new BadRequestException('includedLines must be a whole number, zero or more.');
      }
    }
    await this.prisma.$transaction(
      rules.map((r) =>
        this.prisma.billingChargeRule.upsert({
          where: { companyId_kind: { companyId, kind: r.kind } },
          create: { companyId, ...r },
          update: {
            enabled: r.enabled,
            baseFee: r.baseFee,
            includedLines: r.includedLines,
            extraLineFee: r.extraLineFee,
            includedWeightKg: r.includedWeightKg,
            extraKgFee: r.extraKgFee,
          },
        }),
      ),
    );
    return this.getRules(user, companyId);
  }

  private async ruleMap(companyId: string): Promise<Map<BillingChargeKind, FulfillmentRule>> {
    const rows = await this.prisma.billingChargeRule.findMany({ where: { companyId } });
    return new Map(
      rows.map((r) => [
        r.kind,
        {
          enabled: r.enabled,
          baseFee: r.baseFee,
          includedLines: r.includedLines,
          extraLineFee: r.extraLineFee,
          includedWeightKg: r.includedWeightKg,
          extraKgFee: r.extraKgFee,
        },
      ]),
    );
  }

  private rule(map: Map<BillingChargeKind, FulfillmentRule>, kind: BillingChargeKind): FulfillmentRule {
    return (
      map.get(kind) ?? {
        enabled: false,
        baseFee: 0,
        includedLines: 1,
        extraLineFee: 0,
        includedWeightKg: 0,
        extraKgFee: 0,
      }
    );
  }

  // ---------------------------------------------------------------- FX (USD is the internal currency)

  private async usdToSypRate(): Promise<number | null> {
    return (await readManagedUsdToSypRate(this.prisma))?.rate ?? null;
  }

  private toUsd(amount: Prisma.Decimal.Value, currency: string | null | undefined, rate: number | null, providerCode?: string | null) {
    const value = new Prisma.Decimal(amount);
    if ((currency ?? 'USD').toUpperCase() !== 'SYP') return value;
    if (!rate) return null;
    return value.div(rateForCarrierUnit(rate, carrierSypUnit(providerCode)));
  }

  // ---------------------------------------------------------------- preview

  async preview(user: AuthPrincipal, input: OnDemandInput) {
    this.companyAccess.assertCompanyAccess(user, input.companyId);
    const from = startOfDayUtc(input.from);
    const to = endOfDayUtc(input.to);
    if (to < from) throw new BadRequestException('The end date must not be before the start date.');
    if (inclusiveDays(from, to) > 366) {
      throw new BadRequestException('An invoice period cannot be longer than one year.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const rules = await this.ruleMap(input.companyId);
    const rate = await this.usdToSypRate();
    const items: PreviewItem[] = [];

    if (input.include.inbound) items.push(...(await this.inboundItems(input.companyId, from, to, rules)));
    if (input.include.outbound) items.push(...(await this.outboundItems(input.companyId, from, to, rules)));
    if (input.include.oms || input.include.shipping) {
      items.push(...(await this.omsItems(input, from, to, rules, rate)));
    }

    const days = inclusiveDays(from, to);
    const storageRule = this.rule(rules, BillingChargeKind.storage);
    const storageFee =
      input.include.storage && storageRule.enabled ? computeStorageFee(storageRule, days) : ZERO;

    const charged = items.filter((i) => i.charged);
    const sum = (pick: (i: PreviewItem) => string, kind?: OrderKind) =>
      charged
        .filter((i) => !kind || i.orderKind === kind)
        .reduce((s, i) => s.plus(pick(i)), ZERO);

    const totals = {
      inboundFulfillment: sum((i) => i.fulfillmentFee, 'inbound'),
      outboundFulfillment: sum((i) => i.fulfillmentFee, 'outbound'),
      omsFulfillment: sum((i) => i.fulfillmentFee, 'oms'),
      emdadShipping: charged
        .filter((i) => i.orderKind === 'oms' && !i.shippingFeeAlreadySettled)
        .reduce((s, i) => s.plus(i.shippingFee), ZERO),
      storage: storageFee,
    };
    const total = Object.values(totals).reduce((s, v) => s.plus(v), ZERO);

    const statusCounts: Record<string, Record<string, number>> = { inbound: {}, outbound: {}, oms: {} };
    for (const i of items) {
      statusCounts[i.orderKind][i.orderStatus] = (statusCounts[i.orderKind][i.orderStatus] ?? 0) + 1;
    }

    return {
      company,
      period: { from: input.from.slice(0, 10), to: input.to.slice(0, 10), days },
      include: input.include,
      items,
      statusCounts,
      totals: {
        inboundFulfillment: totals.inboundFulfillment.toFixed(2),
        outboundFulfillment: totals.outboundFulfillment.toFixed(2),
        omsFulfillment: totals.omsFulfillment.toFixed(2),
        emdadShipping: totals.emdadShipping.toFixed(2),
        storage: totals.storage.toFixed(2),
        total: roundMoney(total).toFixed(2),
      },
      warnings: [
        ...(rate == null && items.some((i) => i.orderKind === 'oms')
          ? ['No usable USD/SYP rate: orders priced in SYP could not be converted to USD.']
          : []),
      ],
    };
  }

  private async billedSet(kind: OrderKind, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.invoiceOrderItem.findMany({
      where: { orderKind: kind, orderId: { in: ids }, active: true, charged: true },
      select: { orderId: true },
    });
    return new Set(rows.map((r) => r.orderId));
  }

  private async inboundItems(
    companyId: string,
    from: Date,
    to: Date,
    rules: Map<BillingChargeKind, FulfillmentRule>,
  ): Promise<PreviewItem[]> {
    const rule = this.rule(rules, BillingChargeKind.inbound_order);
    const orders = await this.prisma.inboundOrder.findMany({
      where: {
        companyId,
        OR: [
          { status: 'completed', completedAt: { gte: from, lte: to } },
          { createdAt: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        completedAt: true,
        lines: { select: { expectedQuantity: true, receivedQuantity: true, product: { select: { weightKg: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const billed = await this.billedSet('inbound', orders.map((o) => o.id));
    const out: PreviewItem[] = [];
    for (const o of orders) {
      const doneInPeriod = o.status === 'completed' && !!o.completedAt && o.completedAt >= from && o.completedAt <= to;
      if (billed.has(o.id)) continue;
      const metrics = {
        linesCount: o.lines.length,
        weightKg: weightOf(
          o.lines.map((l) => ({
            qty: l.receivedQuantity.gt(0) ? l.receivedQuantity : l.expectedQuantity,
            weightKg: l.product?.weightKg,
          })),
        ),
      };
      const charged = doneInPeriod && rule.enabled;
      out.push({
        orderKind: 'inbound',
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        linesCount: metrics.linesCount,
        weightKg: metrics.weightKg.toFixed(4),
        charged,
        fulfillmentFee: (charged ? computeFulfillmentFee(rule, metrics) : ZERO).toFixed(2),
        shippingFee: '0.00',
        shippingFeeAlreadySettled: false,
        carrierCostUsd: null,
      });
    }
    return out;
  }

  private async outboundItems(
    companyId: string,
    from: Date,
    to: Date,
    rules: Map<BillingChargeKind, FulfillmentRule>,
  ): Promise<PreviewItem[]> {
    const rule = this.rule(rules, BillingChargeKind.outbound_order);
    const orders = await this.prisma.outboundOrder.findMany({
      where: {
        companyId,
        omsOrder: { is: null },
        OR: [{ shippedAt: { gte: from, lte: to } }, { createdAt: { gte: from, lte: to } }],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        shippedAt: true,
        updatedAt: true,
        lines: { select: { requestedQuantity: true, product: { select: { weightKg: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const billed = await this.billedSet('outbound', orders.map((o) => o.id));
    const out: PreviewItem[] = [];
    for (const o of orders) {
      if (billed.has(o.id)) continue;
      const doneAt = o.shippedAt ?? o.updatedAt;
      const doneInPeriod = OUTBOUND_DISPATCHED.includes(String(o.status)) && doneAt >= from && doneAt <= to;
      const metrics = {
        linesCount: o.lines.length,
        weightKg: weightOf(o.lines.map((l) => ({ qty: l.requestedQuantity, weightKg: l.product?.weightKg }))),
      };
      const charged = doneInPeriod && rule.enabled;
      out.push({
        orderKind: 'outbound',
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderStatus: String(o.status),
        linesCount: metrics.linesCount,
        weightKg: metrics.weightKg.toFixed(4),
        charged,
        fulfillmentFee: (charged ? computeFulfillmentFee(rule, metrics) : ZERO).toFixed(2),
        shippingFee: '0.00',
        shippingFeeAlreadySettled: false,
        carrierCostUsd: null,
      });
    }
    return out;
  }

  private async omsItems(
    input: OnDemandInput,
    from: Date,
    to: Date,
    rules: Map<BillingChargeKind, FulfillmentRule>,
    rate: number | null,
  ): Promise<PreviewItem[]> {
    const rule = this.rule(rules, BillingChargeKind.oms_order);
    const shipRule = this.rule(rules, BillingChargeKind.shipping_fee);
    const orders = await this.prisma.omsOrder.findMany({
      where: {
        companyId: input.companyId,
        OR: [
          { outboundOrder: { is: { shippedAt: { gte: from, lte: to } } } },
          { createdAt: { gte: from, lte: to } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        shippingFee: true,
        currency: true,
        updatedAt: true,
        lines: { select: { requestedQuantity: true, product: { select: { weightKg: true } } } },
        outboundOrder: {
          select: {
            id: true,
            shippedAt: true,
            carrierShipments: {
              where: { supersededAt: null, status: { in: ['created', 'pending'] } },
              select: { providerCode: true, shippingCost: true, currency: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const ids = orders.map((o) => o.id);
    const billed = await this.billedSet('oms', ids);
    const settledShipping = new Set(
      (
        await this.prisma.financialTransaction.findMany({
          where: {
            companyId: input.companyId,
            category: FinancialTransactionCategory.shipping_fee,
            status: 'posted',
            referenceType: 'oms_order',
            referenceId: { in: ids },
          },
          select: { referenceId: true },
        })
      ).map((t) => t.referenceId),
    );

    const out: PreviewItem[] = [];
    for (const o of orders) {
      if (billed.has(o.id)) continue;
      const doneAt = o.outboundOrder?.shippedAt ?? o.updatedAt;
      const dispatched = OMS_DISPATCHED.includes(String(o.status)) && doneAt >= from && doneAt <= to;
      const metrics = {
        linesCount: o.lines.length,
        weightKg: weightOf(o.lines.map((l) => ({ qty: l.requestedQuantity, weightKg: l.product?.weightKg }))),
      };
      const fulfillmentCharged = dispatched && input.include.oms && rule.enabled;
      const shippingCharged = dispatched && input.include.shipping && shipRule.enabled;
      const feeUsd = o.shippingFee ? this.toUsd(o.shippingFee, o.currency, rate) : ZERO;
      const alreadySettled = settledShipping.has(o.id);

      let carrierCost: Prisma.Decimal | null = null;
      for (const s of o.outboundOrder?.carrierShipments ?? []) {
        if (s.shippingCost == null) continue;
        const usd = this.toUsd(s.shippingCost, s.currency, rate, s.providerCode);
        if (usd) carrierCost = (carrierCost ?? ZERO).plus(usd);
      }

      out.push({
        orderKind: 'oms',
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderStatus: String(o.status),
        linesCount: metrics.linesCount,
        weightKg: metrics.weightKg.toFixed(4),
        charged: fulfillmentCharged || shippingCharged,
        fulfillmentFee: (fulfillmentCharged ? computeFulfillmentFee(rule, metrics) : ZERO).toFixed(2),
        shippingFee: (shippingCharged && feeUsd ? roundMoney(feeUsd) : ZERO).toFixed(2),
        shippingFeeAlreadySettled: shippingCharged ? alreadySettled : false,
        carrierCostUsd: carrierCost ? carrierCost.toFixed(4) : null,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- create

  async createOnDemand(user: AuthPrincipal, input: OnDemandInput & { notes?: string }) {
    const preview = await this.preview(user, input);
    const chargedItems = preview.items.filter((i) => i.charged);
    const t = preview.totals;
    const hasStorage = new Prisma.Decimal(t.storage).gt(0);
    if (chargedItems.length === 0 && !hasStorage) {
      throw new BadRequestException(
        'Nothing to invoice for this client and period. Check the charge rules and the dates.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          companyId: input.companyId,
          invoiceSource: BillingInvoiceSource.ad_hoc,
          status: BillingInvoiceStatus.draft,
          periodStart: startOfDayUtc(input.from),
          periodEnd: startOfDayUtc(input.to),
        },
      });

      const addLine = async (type: BillingInvoiceLineType, description: string, qty: number, total: string) => {
        const totalDec = new Prisma.Decimal(total);
        if (totalDec.lte(0)) return;
        await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            type,
            lineSource: BillingInvoiceLineSource.system,
            description,
            quantity: qty,
            unitPrice: qty > 0 ? totalDec.div(qty).toDecimalPlaces(4) : totalDec,
            totalPrice: totalDec,
          },
        });
      };
      const count = (kind: OrderKind, pick: (i: PreviewItem) => boolean = () => true) =>
        chargedItems.filter((i) => i.orderKind === kind && pick(i)).length;

      await addLine(BillingInvoiceLineType.fulfillment_inbound, 'Inbound order fulfillment', count('inbound'), t.inboundFulfillment);
      await addLine(BillingInvoiceLineType.fulfillment_outbound, 'Outbound order fulfillment', count('outbound'), t.outboundFulfillment);
      await addLine(BillingInvoiceLineType.fulfillment_oms, 'Online (OMS) order fulfillment', count('oms'), t.omsFulfillment);
      await addLine(
        BillingInvoiceLineType.emdad_shipping,
        'Shipping fees',
        count('oms', (i) => !i.shippingFeeAlreadySettled && new Prisma.Decimal(i.shippingFee).gt(0)),
        t.emdadShipping,
      );
      await addLine(BillingInvoiceLineType.storage_fee, `Storage (${preview.period.days} days)`, preview.period.days, t.storage);

      if (chargedItems.length > 0) {
        await tx.invoiceOrderItem.createMany({
          data: chargedItems.map((i) => ({
            invoiceId: invoice.id,
            companyId: input.companyId,
            orderKind: i.orderKind,
            orderId: i.orderId,
            orderNumber: i.orderNumber,
            orderStatus: i.orderStatus,
            linesCount: i.linesCount,
            weightKg: i.weightKg,
            charged: true,
            fulfillmentFee: i.fulfillmentFee,
            shippingFee: i.shippingFee,
            shippingFeeAlreadySettled: i.shippingFeeAlreadySettled,
            carrierCostUsd: i.carrierCostUsd,
          })),
        });
      }
      // Orders created in the period but not charged are listed for information, never charged.
      const infoItems = preview.items.filter((i) => !i.charged);
      if (infoItems.length > 0) {
        await tx.invoiceOrderItem.createMany({
          data: infoItems.map((i) => ({
            invoiceId: invoice.id,
            companyId: input.companyId,
            orderKind: i.orderKind,
            orderId: i.orderId,
            orderNumber: i.orderNumber,
            orderStatus: i.orderStatus,
            linesCount: i.linesCount,
            weightKg: i.weightKg,
            charged: false,
            carrierCostUsd: i.carrierCostUsd,
          })),
        });
      }
      await this.invoiceCalc.applyInvoiceTotals(tx, invoice.id);
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    }).catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('One of these orders was invoiced a moment ago. Run the preview again.');
      }
      throw err;
    });
    return { invoice: created, preview };
  }

  // ---------------------------------------------------------------- settle against the COD balance

  /**
   * Deducts the invoice from the client's available balance (their COD money EMDAD already holds).
   * Only what the balance can cover is deducted; any rest stays due. Safe to repeat: one deduction per invoice.
   */
  async settleFromBalance(user: AuthPrincipal, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    this.companyAccess.assertCompanyAccess(user, invoice.companyId);
    if (invoice.status !== BillingInvoiceStatus.unpaid) {
      throw new BadRequestException('Only an issued, unpaid invoice can be settled from the balance.');
    }
    if (invoice.settlementTransactionId) {
      throw new ConflictException('This invoice was already settled from the balance.');
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await this.accounts.ensureAccount(invoice.companyId, tx);
      const statement = settlementStatement({
        balance: account.availableBalance,
        owed: invoice.totalAmount.minus(invoice.settledAmount),
      });
      if (statement.deducted.lte(0)) {
        throw new BadRequestException('The client has no available balance to deduct from.');
      }
      const txn = await this.transactions.postTransaction(
        {
          companyId: invoice.companyId,
          type: FinancialTransactionType.debit,
          category: FinancialTransactionCategory.fulfillment_fee,
          amount: statement.deducted,
          currency: 'USD',
          description: `Invoice ${invoice.invoiceNumber} deducted from balance`,
          referenceType: 'invoice',
          referenceId: invoice.id,
          idempotencyKey: `invoice_settlement_${invoice.id}`,
          createdBy: user.id,
          debitAvailable: true,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            balanceBefore: statement.balanceBefore.toString(),
            owed: statement.owed.toString(),
            remainingDue: statement.remainingDue.toString(),
          },
        },
        tx,
      );
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          settledAmount: invoice.settledAmount.plus(statement.deducted),
          settledAt: new Date(),
          settledBalanceBefore: statement.balanceBefore,
          settledBalanceAfter: statement.balanceAfter,
          settlementTransactionId: txn.id,
          ...(statement.fullySettled ? { status: BillingInvoiceStatus.paid } : {}),
        },
      });
      return {
        invoiceId: invoice.id,
        balanceBefore: statement.balanceBefore.toFixed(2),
        owed: statement.owed.toFixed(2),
        deducted: statement.deducted.toFixed(2),
        balanceAfter: statement.balanceAfter.toFixed(2),
        remainingDue: statement.remainingDue.toFixed(2),
        status: statement.fullySettled ? 'paid' : 'unpaid',
      };
    });
  }

  // ---------------------------------------------------------------- breakdown (client or admin)

  async breakdown(user: AuthPrincipal | { companyId: string }, invoiceId: string, audience: 'admin' | 'client') {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { orderItems: { orderBy: [{ orderKind: 'asc' }, { orderNumber: 'asc' }] } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (audience === 'client') {
      if ((user as { companyId?: string }).companyId !== invoice.companyId) {
        throw new NotFoundException('Invoice not found.');
      }
    } else {
      this.companyAccess.assertCompanyAccess(user as AuthPrincipal, invoice.companyId);
    }

    const rules = await this.ruleMap(invoice.companyId);
    const sections = (['inbound', 'outbound', 'oms'] as OrderKind[]).map((kind) => {
      const rows = invoice.orderItems.filter((i) => i.orderKind === kind);
      const billedHere = this.rule(rules, RULE_KIND_BY_ORDER[kind]).enabled && rows.some((r) => r.charged);
      const statusCounts: Record<string, number> = {};
      for (const r of rows) statusCounts[r.orderStatus] = (statusCounts[r.orderStatus] ?? 0) + 1;
      const fulfillmentTotal = rows.reduce((s, r) => s.plus(r.fulfillmentFee), ZERO);
      const shippingTotal = rows.reduce(
        (s, r) => s.plus(r.shippingFeeAlreadySettled ? 0 : r.shippingFee),
        ZERO,
      );
      return {
        kind,
        orderCount: rows.length,
        statusCounts,
        // The fee columns appear only when this kind is billed to the client.
        billed: billedHere,
        fulfillmentTotal: billedHere ? fulfillmentTotal.toFixed(2) : null,
        shippingTotal: kind === 'oms' && shippingTotal.gt(0) ? shippingTotal.toFixed(2) : null,
        orders: rows.map((r) => ({
          orderNumber: r.orderNumber,
          status: r.orderStatus,
          linesCount: r.linesCount,
          weightKg: r.weightKg.toFixed(2),
          charged: r.charged,
          fulfillmentFee: billedHere && r.charged ? r.fulfillmentFee.toFixed(2) : null,
          shippingFee:
            kind === 'oms' && r.charged && r.shippingFee.gt(0) ? r.shippingFee.toFixed(2) : null,
          shippingFeeAlreadySettled: r.shippingFeeAlreadySettled,
          // External carrier cost and margin are admin only; the client never sees them.
          ...(audience === 'admin'
            ? {
                carrierCostUsd: r.carrierCostUsd ? r.carrierCostUsd.toFixed(2) : null,
                marginUsd:
                  r.carrierCostUsd && kind === 'oms'
                    ? r.shippingFee.minus(r.carrierCostUsd).toFixed(2)
                    : null,
              }
            : {}),
        })),
      };
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      period: { from: invoice.periodStart, to: invoice.periodEnd },
      total: invoice.totalAmount.toFixed(2),
      sections,
      statement:
        invoice.settledAt && invoice.settledBalanceBefore != null
          ? {
              balanceBefore: invoice.settledBalanceBefore.toFixed(2),
              deducted: invoice.settledAmount.toFixed(2),
              balanceAfter: invoice.settledBalanceAfter?.toFixed(2) ?? null,
              remainingDue: invoice.totalAmount.minus(invoice.settledAmount).toFixed(2),
            }
          : null,
    };
  }

  /**
   * Cancelling an invoice frees its orders to be billed again and gives back any amount that was
   * deducted from the client's balance, so no money is lost.
   */
  async onInvoiceCancelled(user: AuthPrincipal, invoiceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceOrderItem.updateMany({ where: { invoiceId }, data: { active: false } });
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.settledAmount.lte(0) || !invoice.settlementTransactionId) return;
      await this.transactions.postTransaction(
        {
          companyId: invoice.companyId,
          type: FinancialTransactionType.credit,
          category: FinancialTransactionCategory.fulfillment_fee,
          amount: invoice.settledAmount,
          currency: 'USD',
          description: `Invoice ${invoice.invoiceNumber} cancelled: deduction returned to balance`,
          referenceType: 'invoice',
          referenceId: invoice.id,
          idempotencyKey: `invoice_settlement_reversal_${invoice.id}`,
          createdBy: user.id,
          creditAvailable: true,
          metadata: { invoiceNumber: invoice.invoiceNumber, reverses: invoice.settlementTransactionId },
        },
        tx,
      );
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { settledAmount: 0, settledAt: null, settledBalanceBefore: null, settledBalanceAfter: null, settlementTransactionId: null },
      });
    });
  }
}
