import { ForbiddenException, Injectable } from '@nestjs/common';
import { CarrierShipmentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { FinancialPoliciesService } from './financial-policies.service';

const TERMINAL_TRACKING = new Set([
  'delivered',
  'returned',
  'returned_to_sender',
  'cancelled',
  'canceled',
  'failed',
]);

/**
 * B12 — In-transit float indicator + carrier reconciliation (admin-only).
 * Gated by financial policy flags; returns empty/disabled when the flag is off.
 */
@Injectable()
export class FinancialFloatReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: FinancialPoliciesService,
  ) {}

  async getInTransitFloat(params?: { providerCode?: string; alertLimitUsd?: number }) {
    const enabled = await this.policies.isFlagEnabled('in_transit_float_enabled');
    if (!enabled) {
      return {
        enabled: false as const,
        message: 'In-transit float is disabled in Finance Policies.',
        totalsByCurrency: [] as Array<{ currency: string; amount: string; shipmentCount: number }>,
        alert: null as null,
        items: [] as unknown[],
      };
    }

    const where: Prisma.CarrierShipmentWhereInput = {
      status: CarrierShipmentStatus.created,
      supersededAt: null,
      shippingCost: { not: null },
      costPaidAt: null,
      ...(params?.providerCode ? { providerCode: params.providerCode } : {}),
      OR: [
        { lastTrackingStatus: null },
        { lastTrackingStatus: { notIn: [...TERMINAL_TRACKING] } },
      ],
    };

    const shipments = await this.prisma.carrierShipment.findMany({
      where,
      include: {
        provider: { select: { code: true, name: true } },
        outboundOrder: {
          select: {
            orderNumber: true,
            company: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const byCurrency = new Map<string, { amount: Prisma.Decimal; count: number }>();
    for (const s of shipments) {
      if (!s.shippingCost) continue;
      const cur = (s.currency || 'USD').toUpperCase();
      const row = byCurrency.get(cur) ?? { amount: new Prisma.Decimal(0), count: 0 };
      row.amount = row.amount.add(s.shippingCost);
      row.count += 1;
      byCurrency.set(cur, row);
    }

    const totalsByCurrency = [...byCurrency.entries()].map(([currency, v]) => ({
      currency,
      amount: v.amount.toFixed(4),
      shipmentCount: v.count,
    }));

    const usdTotal = byCurrency.get('USD')?.amount ?? new Prisma.Decimal(0);
    const alertLimit = params?.alertLimitUsd ?? 0;
    const alert =
      alertLimit > 0 && usdTotal.gte(alertLimit)
        ? {
            level: 'warning' as const,
            message: `In-transit float USD ${usdTotal.toFixed(2)} is at or above the alert limit ${alertLimit.toFixed(2)}.`,
          }
        : null;

    return {
      enabled: true as const,
      totalsByCurrency,
      alert,
      itemCount: shipments.length,
      items: shipments.map((s) => ({
        id: s.id,
        providerCode: s.providerCode,
        providerName: s.provider?.name ?? s.providerCode,
        externalAwb: s.externalAwb,
        trackingNumber: s.trackingNumber,
        lastTrackingStatus: s.lastTrackingStatus,
        outboundOrderNumber: s.outboundOrder?.orderNumber ?? null,
        clientName: s.outboundOrder?.company?.name ?? null,
        shippingCost: s.shippingCost?.toString() ?? null,
        currency: s.currency ?? 'USD',
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * Compare EMDAD carrier shipments vs a pasted carrier statement (AWB + amount rows).
   * Flags missing AWBs, amount mismatches, and duplicate AWBs in our DB.
   */
  async reconcileCarrierStatement(input: {
    providerCode?: string;
    rows: Array<{ awb: string; amount: number; currency?: string }>;
  }) {
    const enabled = await this.policies.isFlagEnabled('carrier_reconciliation_enabled');
    if (!enabled) {
      throw new ForbiddenException(
        'Carrier reconciliation is disabled in Finance Policies. Enable it under /finance/policies.',
      );
    }

    const normalized = input.rows
      .map((r) => ({
        awb: String(r.awb || '').trim(),
        amount: Number(r.amount),
        currency: (r.currency || 'USD').toUpperCase(),
      }))
      .filter((r) => r.awb.length > 0);

    const awbs = [...new Set(normalized.map((r) => r.awb))];
    const shipments = await this.prisma.carrierShipment.findMany({
      where: {
        supersededAt: null,
        ...(input.providerCode ? { providerCode: input.providerCode } : {}),
        OR: [
          { externalAwb: { in: awbs } },
          { trackingNumber: { in: awbs } },
        ],
      },
      include: {
        outboundOrder: { select: { orderNumber: true } },
      },
    });

    const byAwb = new Map<string, typeof shipments>();
    for (const s of shipments) {
      for (const key of [s.externalAwb, s.trackingNumber].filter(Boolean) as string[]) {
        const list = byAwb.get(key) ?? [];
        list.push(s);
        byAwb.set(key, list);
      }
    }

    // Duplicate AWBs already in our DB (potential double billing)
    const dbDuplicates = await this.findDuplicateAwbs(input.providerCode);

    const matches: Array<{
      awb: string;
      statementAmount: number;
      statementCurrency: string;
      emdadAmount: string | null;
      emdadCurrency: string | null;
      outboundOrderNumber: string | null;
      status: 'match' | 'amount_mismatch' | 'missing_in_emdad' | 'duplicate_in_emdad';
    }> = [];

    for (const row of normalized) {
      const found = byAwb.get(row.awb) ?? [];
      if (found.length === 0) {
        matches.push({
          awb: row.awb,
          statementAmount: row.amount,
          statementCurrency: row.currency,
          emdadAmount: null,
          emdadCurrency: null,
          outboundOrderNumber: null,
          status: 'missing_in_emdad',
        });
        continue;
      }
      if (found.length > 1) {
        matches.push({
          awb: row.awb,
          statementAmount: row.amount,
          statementCurrency: row.currency,
          emdadAmount: found[0].shippingCost?.toString() ?? null,
          emdadCurrency: found[0].currency ?? null,
          outboundOrderNumber: found[0].outboundOrder?.orderNumber ?? null,
          status: 'duplicate_in_emdad',
        });
        continue;
      }
      const s = found[0];
      const emdadAmt = s.shippingCost ? Number(s.shippingCost.toString()) : null;
      const sameCurrency = (s.currency || 'USD').toUpperCase() === row.currency;
      const amountOk =
        emdadAmt !== null && sameCurrency && Math.abs(emdadAmt - row.amount) < 0.01;
      matches.push({
        awb: row.awb,
        statementAmount: row.amount,
        statementCurrency: row.currency,
        emdadAmount: s.shippingCost?.toString() ?? null,
        emdadCurrency: s.currency ?? null,
        outboundOrderNumber: s.outboundOrder?.orderNumber ?? null,
        status: amountOk ? 'match' : 'amount_mismatch',
      });
    }

    const summary = {
      statementRows: normalized.length,
      match: matches.filter((m) => m.status === 'match').length,
      amountMismatch: matches.filter((m) => m.status === 'amount_mismatch').length,
      missingInEmdad: matches.filter((m) => m.status === 'missing_in_emdad').length,
      duplicateInEmdad: matches.filter((m) => m.status === 'duplicate_in_emdad').length,
      dbDuplicateAwbs: dbDuplicates.length,
    };

    return {
      enabled: true as const,
      summary,
      dbDuplicateAwbs: dbDuplicates,
      matches,
    };
  }

  private async findDuplicateAwbs(providerCode?: string) {
    const groups = await this.prisma.carrierShipment.groupBy({
      by: ['externalAwb'],
      where: {
        supersededAt: null,
        externalAwb: { not: null },
        ...(providerCode ? { providerCode } : {}),
      },
      _count: { _all: true },
      having: { externalAwb: { _count: { gt: 1 } } },
    });
    return groups
      .filter((g) => g.externalAwb)
      .map((g) => ({ awb: g.externalAwb as string, count: g._count._all }));
  }
}
