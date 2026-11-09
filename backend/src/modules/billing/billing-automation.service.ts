import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingChargeKind, OmsOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeProductVolumeCbm } from '../products/product-volume.util';
import { BillingOnDemandService } from './on-demand/billing-on-demand.service';
import {
  computeFulfillmentFee,
  type FulfillmentRule,
} from './on-demand/billing-fulfillment-pricing.util';

const DEFAULT_STORAGE_RATE_USD = 10;
const DEFAULT_INCENTIVE_THRESHOLD = 500;
const DEFAULT_INCENTIVE_DISCOUNT_PCT = 20;

function startOfDayUtc(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUtc(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

@Injectable()
export class BillingAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly onDemand: BillingOnDemandService,
  ) {}

  /**
   * GET /billing/storage-usage — CBM snapshot for a client (spec §1).
   * `date` is accepted for future as-of snapshots; current stock is used today.
   */
  async storageUsage(
    user: AuthPrincipal,
    clientId: string,
    _date?: string,
  ) {
    this.companyAccess.assertCompanyAccess(user, clientId);
    const company = await this.prisma.company.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const rows = await this.prisma.$queryRaw<
      {
        product_id: string;
        sku: string;
        name: string;
        qty: string;
        length_cm: string | null;
        width_cm: string | null;
        height_cm: string | null;
        volume_cbm: string | null;
      }[]
    >`
      SELECT
        p.id::text AS product_id,
        p.sku,
        p.name,
        SUM(GREATEST(cs.quantity_on_hand, 0))::text AS qty,
        p.length_cm::text AS length_cm,
        p.width_cm::text AS width_cm,
        p.height_cm::text AS height_cm,
        p.volume_cbm::text AS volume_cbm
      FROM current_stock cs
      INNER JOIN products p ON p.id = cs.product_id
      WHERE cs.company_id = ${clientId}::uuid
        AND cs.quantity_on_hand > 0
        AND p.status <> 'archived'::product_status
      GROUP BY p.id, p.sku, p.name, p.length_cm, p.width_cm, p.height_cm, p.volume_cbm
      ORDER BY p.sku ASC
    `;

    const storageRule = await this.prisma.billingChargeRule.findUnique({
      where: { companyId_kind: { companyId: clientId, kind: BillingChargeKind.storage } },
      select: { enabled: true, baseFee: true },
    });
    const rateUsd = storageRule?.baseFee?.gt(0)
      ? Number(storageRule.baseFee)
      : DEFAULT_STORAGE_RATE_USD;

    let totalCbm = new Prisma.Decimal(0);
    const lines = rows.map((r) => {
      const qty = new Prisma.Decimal(r.qty || '0');
      const l = r.length_cm != null ? Number(r.length_cm) : null;
      const w = r.width_cm != null ? Number(r.width_cm) : null;
      const h = r.height_cm != null ? Number(r.height_cm) : null;
      const missingDimensions = l == null || w == null || h == null || l <= 0 || w <= 0 || h <= 0;
      const unitCbm = missingDimensions
        ? new Prisma.Decimal(0)
        : r.volume_cbm
          ? new Prisma.Decimal(r.volume_cbm)
          : computeProductVolumeCbm(l, w, h);
      const lineCbm = unitCbm.mul(qty);
      totalCbm = totalCbm.plus(lineCbm);
      return {
        productId: r.product_id,
        sku: r.sku,
        name: r.name,
        qty: Number(qty),
        l,
        w,
        h,
        cbm: Number(lineCbm.toFixed(6)),
        missingDimensions,
        warning: missingDimensions
          ? 'Missing dimensions — update product to include in calculation.'
          : null,
      };
    });

    const amount = totalCbm.mul(rateUsd).toDecimalPlaces(2);
    return {
      clientId: company.id,
      clientName: company.name,
      totalCbm: Number(totalCbm.toFixed(6)),
      rateUsd,
      amount: Number(amount),
      chargeLineType: 'storage_fee',
      lines,
    };
  }

  /**
   * GET /billing/incentive-check — 20% fulfillment discount when ≥500 delivered (spec §2).
   */
  async incentiveCheck(
    user: AuthPrincipal,
    clientId: string,
    from: string,
    to: string,
  ) {
    this.companyAccess.assertCompanyAccess(user, clientId);
    if (!from || !to) {
      throw new BadRequestException('from and to dates are required (YYYY-MM-DD).');
    }
    const fromDate = startOfDayUtc(from);
    const toDate = endOfDayUtc(to);
    if (toDate < fromDate) {
      throw new BadRequestException('The end date must not be before the start date.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const deliveredCount = await this.prisma.omsOrder.count({
      where: {
        companyId: clientId,
        status: OmsOrderStatus.delivered,
        OR: [
          { deliveredAt: { gte: fromDate, lte: toDate } },
          {
            AND: [
              { deliveredAt: null },
              { updatedAt: { gte: fromDate, lte: toDate } },
            ],
          },
        ],
      },
    });

    const threshold = DEFAULT_INCENTIVE_THRESHOLD;
    const discountPct = DEFAULT_INCENTIVE_DISCOUNT_PCT;
    const qualifies = deliveredCount >= threshold;

    const rules = await this.onDemand.getRules(user, clientId);
    const omsRuleRaw = rules.find((r) => r.kind === BillingChargeKind.oms_order);
    const omsRule: FulfillmentRule = {
      enabled: omsRuleRaw?.enabled ?? false,
      baseFee: omsRuleRaw?.baseFee ?? 0,
      includedLines: omsRuleRaw?.includedLines ?? 1,
      extraLineFee: omsRuleRaw?.extraLineFee ?? 0,
      includedWeightKg: omsRuleRaw?.includedWeightKg ?? 0,
      extraKgFee: omsRuleRaw?.extraKgFee ?? 0,
    };

    // Approximate fulfillment total for delivered OMS at the per-order base fee
    // (exact line/weight extras need per-order metrics; base fee × count is the invoice preview).
    const perOrder = omsRule.enabled
      ? computeFulfillmentFee(omsRule, { linesCount: omsRule.includedLines || 1, weightKg: 0 })
      : new Prisma.Decimal(0);
    const fulfillmentTotal = perOrder.mul(deliveredCount).toDecimalPlaces(2);
    const discountAmount = qualifies
      ? fulfillmentTotal.mul(discountPct).div(100).toDecimalPlaces(2).negated()
      : new Prisma.Decimal(0);

    return {
      clientId: company.id,
      clientName: company.name,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      deliveredCount,
      threshold,
      qualifies,
      discountPct,
      fulfillmentTotal: Number(fulfillmentTotal),
      discountAmount: Number(discountAmount),
      needMore: qualifies ? 0 : Math.max(0, threshold - deliveredCount),
      chargeLineType: 'manual',
      chargeLineLabel: `Incentive discount (${discountPct}% for ≥${threshold} delivered)`,
    };
  }

  /**
   * GET /billing/invoice-orders — three order tables for the redesigned invoice page.
   */
  async invoiceOrders(
    user: AuthPrincipal,
    clientId: string,
    from: string,
    to: string,
  ) {
    this.companyAccess.assertCompanyAccess(user, clientId);
    if (!from || !to) {
      throw new BadRequestException('from and to dates are required (YYYY-MM-DD).');
    }

    const preview = await this.onDemand.preview(user, {
      companyId: clientId,
      from,
      to,
      include: {
        inbound: true,
        outbound: true,
        oms: true,
        shipping: true,
        storage: false,
      },
    });

    const inbound = preview.items
      .filter((i) => i.orderKind === 'inbound')
      .map((i) => ({
        orderId: i.orderId,
        orderNumber: i.orderNumber,
        orderStatus: i.orderStatus,
        date: null as string | null,
        products: i.linesCount,
        unitsReceived: null as number | null,
        fulfillmentCost: i.fulfillmentFee,
        total: i.fulfillmentFee,
      }));

    const outbound = preview.items
      .filter((i) => i.orderKind === 'outbound')
      .map((i) => ({
        orderId: i.orderId,
        orderNumber: i.orderNumber,
        orderStatus: i.orderStatus,
        date: null as string | null,
        destination: null as string | null,
        unitsShipped: null as number | null,
        fulfillmentCost: i.fulfillmentFee,
        total: i.fulfillmentFee,
      }));

    const oms = preview.items
      .filter((i) => i.orderKind === 'oms')
      .map((i) => {
        const fulfillment = Number(i.fulfillmentFee);
        const shipping = Number(i.shippingFee);
        return {
          orderId: i.orderId,
          orderNumber: i.orderNumber,
          orderStatus: i.orderStatus,
          date: null as string | null,
          recipient: null as string | null,
          fulfillmentCost: i.fulfillmentFee,
          emdadShippingFee: i.shippingFee,
          carrierCostUsd: i.carrierCostUsd,
          total: (fulfillment + shipping).toFixed(2),
        };
      });

    // Enrich OMS/outbound/inbound with display fields from DB.
    const omsIds = oms.map((o) => o.orderId);
    if (omsIds.length) {
      const rows = await this.prisma.omsOrder.findMany({
        where: { id: { in: omsIds } },
        select: {
          id: true,
          recipientName: true,
          createdAt: true,
          deliveredAt: true,
        },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const row of oms) {
        const r = byId.get(row.orderId);
        if (!r) continue;
        row.recipient = r.recipientName;
        row.date = (r.deliveredAt ?? r.createdAt).toISOString().slice(0, 10);
      }
    }

    const inboundIds = inbound.map((o) => o.orderId);
    if (inboundIds.length) {
      const rows = await this.prisma.inboundOrder.findMany({
        where: { id: { in: inboundIds } },
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          lines: { select: { receivedQuantity: true, expectedQuantity: true } },
        },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const row of inbound) {
        const r = byId.get(row.orderId);
        if (!r) continue;
        row.date = (r.completedAt ?? r.createdAt).toISOString().slice(0, 10);
        row.unitsReceived = r.lines.reduce(
          (sum, l) => sum + Number(l.receivedQuantity ?? l.expectedQuantity ?? 0),
          0,
        );
      }
    }

    const outboundIds = outbound.map((o) => o.orderId);
    if (outboundIds.length) {
      const rows = await this.prisma.outboundOrder.findMany({
        where: { id: { in: outboundIds } },
        select: {
          id: true,
          createdAt: true,
          shippedAt: true,
          city: true,
          recipientName: true,
          destinationAddress: true,
          lines: { select: { pickedQuantity: true, requestedQuantity: true } },
        },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const row of outbound) {
        const r = byId.get(row.orderId);
        if (!r) continue;
        row.date = (r.shippedAt ?? r.createdAt).toISOString().slice(0, 10);
        row.destination = r.city || r.recipientName || r.destinationAddress || null;
        row.unitsShipped = r.lines.reduce(
          (sum, l) => sum + Number(l.pickedQuantity ?? l.requestedQuantity ?? 0),
          0,
        );
      }
    }

    return {
      clientId,
      from,
      to,
      inbound,
      outbound,
      oms,
      totals: preview.totals,
    };
  }
}
