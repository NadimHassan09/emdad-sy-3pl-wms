import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export type InboundTraceabilityStatus =
  | 'allocated'
  | 'fulfilled'
  | 'source_not_recorded'
  | 'unfulfilled';

export interface OmsInboundTraceabilityItem {
  id?: string;
  omsOrderLineId?: string | null;
  productId: string;
  productSku: string;
  productName: string;
  inboundOrderId: string | null;
  inboundOrderNumber: string | null;
  quantity: string;
  status: InboundTraceabilityStatus;
  lotNumber?: string | null;
  isHistoricalFallback?: boolean;
}

export interface InboundAllocationLineInput {
  outboundOrderLineId?: string;
  omsOrderLineId?: string;
  productId: string;
  requestedQty: Prisma.Decimal | number | string;
  specificLotId?: string | null;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class InboundTraceabilityService {
  private readonly logger = new Logger(InboundTraceabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  /**
   * Allocate inbound sources for an OMS / Outbound order using FIFO / FEFO inbound receipts.
   * Idempotent: credits existing allocations for this order and only reserves shortfalls.
   */
  async allocateInboundSources(
    tx: Tx,
    params: {
      companyId: string;
      omsOrderId: string;
      outboundOrderId?: string | null;
      lines: InboundAllocationLineInput[];
    },
  ): Promise<void> {
    for (const line of params.lines) {
      const requestedDecimal = new Prisma.Decimal(line.requestedQty.toString());
      if (requestedDecimal.lessThanOrEqualTo(0)) continue;

      // Check existing allocations for this order line or product
      const existing = await tx.inboundSourceAllocation.findMany({
        where: {
          omsOrderId: params.omsOrderId,
          productId: line.productId,
          ...(line.omsOrderLineId ? { omsOrderLineId: line.omsOrderLineId } : {}),
          status: { in: ['allocated', 'fulfilled'] },
        },
      });

      const alreadyAllocated = existing.reduce(
        (sum, a) => sum.plus(a.quantity),
        new Prisma.Decimal(0),
      );

      let shortfall = requestedDecimal.minus(alreadyAllocated);
      if (shortfall.lessThanOrEqualTo(0)) {
        // Line is already satisfied by existing source allocations
        continue;
      }

      // Find lot details if specificLotId was supplied
      let targetLotNumber: string | null = null;
      if (line.specificLotId) {
        const lotRow = await tx.lot.findUnique({
          where: { id: line.specificLotId },
          select: { lotNumber: true },
        });
        targetLotNumber = lotRow?.lotNumber ?? null;
      }

      // Query candidate inbound receipt lines for this product
      const candidateLines = await tx.inboundOrderLine.findMany({
        where: {
          productId: line.productId,
          receivedQuantity: { gt: 0 },
          order: {
            companyId: params.companyId,
            status: { in: ['confirmed', 'in_progress', 'partially_received', 'completed'] },
          },
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              confirmedAt: true,
              completedAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { order: { completedAt: 'asc' } },
          { order: { confirmedAt: 'asc' } },
          { order: { createdAt: 'asc' } },
          { lineNumber: 'asc' },
        ],
      });

      // Filter by lot if specific lot requested and inbound line specifies lot number
      const sortedCandidates = targetLotNumber
        ? [
            ...candidateLines.filter((c) => c.expectedLotNumber === targetLotNumber),
            ...candidateLines.filter((c) => c.expectedLotNumber !== targetLotNumber),
          ]
        : candidateLines;

      // Lock candidate inbound lines to serialize allocations against the same receipts
      if (sortedCandidates.length > 0 && typeof (tx as any).$executeRaw === 'function') {
        const sortedIds = sortedCandidates.map((c) => c.id).sort();
        await (tx as any).$executeRaw(
          Prisma.sql`SELECT id FROM inbound_order_lines WHERE id = ANY(${sortedIds}::uuid[]) ORDER BY id ASC FOR UPDATE`,
        );
      }

      for (const candidate of sortedCandidates) {
        if (shortfall.lessThanOrEqualTo(0)) break;

        // Sum allocations from other orders against this inbound line
        const allocAgg = await tx.inboundSourceAllocation.aggregate({
          where: {
            inboundOrderLineId: candidate.id,
            status: { in: ['allocated', 'fulfilled'] },
            omsOrderId: { not: params.omsOrderId },
          },
          _sum: { quantity: true },
        });

        const allocatedOther = allocAgg._sum.quantity ?? new Prisma.Decimal(0);
        const remainingInbound = candidate.receivedQuantity.minus(allocatedOther);

        if (remainingInbound.lessThanOrEqualTo(0)) continue;

        const take = Prisma.Decimal.min(shortfall, remainingInbound);
        if (take.lessThanOrEqualTo(0)) continue;

        await tx.inboundSourceAllocation.create({
          data: {
            companyId: params.companyId,
            omsOrderId: params.omsOrderId,
            omsOrderLineId: line.omsOrderLineId ?? null,
            outboundOrderId: params.outboundOrderId ?? null,
            outboundOrderLineId: line.outboundOrderLineId ?? null,
            productId: line.productId,
            inboundOrderId: candidate.order.id,
            inboundOrderLineId: candidate.id,
            lotId: line.specificLotId ?? null,
            quantity: take,
            status: 'allocated',
          },
        });

        shortfall = shortfall.minus(take);
      }
    }
  }

  /**
   * Mark source allocations as fulfilled once an order is shipped or picked.
   * Fulfilled allocations become permanent historical records.
   */
  async markFulfilled(
    tx: Tx,
    params: {
      omsOrderId?: string;
      outboundOrderId?: string;
    },
  ): Promise<void> {
    const whereOr: Prisma.InboundSourceAllocationWhereInput[] = [];
    if (params.omsOrderId) whereOr.push({ omsOrderId: params.omsOrderId });
    if (params.outboundOrderId) whereOr.push({ outboundOrderId: params.outboundOrderId });
    if (whereOr.length === 0) return;

    await tx.inboundSourceAllocation.updateMany({
      where: {
        OR: whereOr,
        status: 'allocated',
      },
      data: {
        status: 'fulfilled',
      },
    });
  }

  /**
   * Release active allocations when an order is cancelled or reservations are released.
   * Fulfilled allocations are never released (they preserve historical fulfillment).
   */
  async releaseAllocations(
    tx: Tx,
    params: {
      omsOrderId?: string;
      outboundOrderId?: string;
    },
  ): Promise<void> {
    const whereOr: Prisma.InboundSourceAllocationWhereInput[] = [];
    if (params.omsOrderId) whereOr.push({ omsOrderId: params.omsOrderId });
    if (params.outboundOrderId) whereOr.push({ outboundOrderId: params.outboundOrderId });
    if (whereOr.length === 0) return;

    await tx.inboundSourceAllocation.updateMany({
      where: {
        OR: whereOr,
        status: 'allocated',
      },
      data: {
        status: 'released',
      },
    });
  }

  /**
   * Get the inbound traceability breakdown for an OMS order.
   * Reuses explicit InboundSourceAllocation records, or for historical fulfilled orders,
   * accurately checks if a single unambiguous receipt existed without fabricating relationships.
   */
  async getTraceabilityForOrder(
    omsOrderId: string,
    user: AuthPrincipal,
  ): Promise<OmsInboundTraceabilityItem[]> {
    const order = await this.prisma.omsOrder.findUnique({
      where: { id: omsOrderId },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            product: { select: { id: true, sku: true, name: true } },
          },
        },
        outboundOrder: {
          select: { id: true, orderNumber: true, status: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('OMS order not found.');
    }
    this.companyAccess.validateResourceOwnership(user, order);

    const explicitAllocations = await this.prisma.inboundSourceAllocation.findMany({
      where: {
        OR: [
          { omsOrderId: order.id },
          order.outboundOrderId ? { outboundOrderId: order.outboundOrderId } : undefined,
        ].filter(Boolean) as Prisma.InboundSourceAllocationWhereInput[],
        status: { in: ['allocated', 'fulfilled'] },
      },
      include: {
        inboundOrder: { select: { id: true, orderNumber: true, status: true } },
        product: { select: { id: true, sku: true, name: true } },
        lot: { select: { id: true, lotNumber: true } },
      },
      orderBy: [
        { createdAt: 'asc' },
        { inboundOrder: { orderNumber: 'asc' } },
      ],
    });

    const results: OmsInboundTraceabilityItem[] = [];

    for (const line of order.lines) {
      // Find explicit allocations matching this line or product
      const lineAllocs = explicitAllocations.filter(
        (a) =>
          (a.omsOrderLineId && a.omsOrderLineId === line.id) ||
          (!a.omsOrderLineId && a.productId === line.productId),
      );

      if (lineAllocs.length > 0) {
        for (const alloc of lineAllocs) {
          results.push({
            id: alloc.id,
            omsOrderLineId: line.id,
            productId: line.productId,
            productSku: line.product.sku,
            productName: line.product.name,
            inboundOrderId: alloc.inboundOrder.id,
            inboundOrderNumber: alloc.inboundOrder.orderNumber,
            quantity: alloc.quantity.toString(),
            status: alloc.status as InboundTraceabilityStatus,
            lotNumber: alloc.lot?.lotNumber ?? null,
            isHistoricalFallback: false,
          });
        }
        continue;
      }

      // No explicit allocations recorded.
      // Check if order is unfulfilled or cancelled (never fabricate allocations)
      const isUnfulfilledOrCancelled =
        ['draft', 'pending', 'submitted', 'cancelled'].includes(order.status) &&
        (!order.outboundOrder || order.outboundOrder.status === 'cancelled');

      if (isUnfulfilledOrCancelled) {
        results.push({
          omsOrderLineId: line.id,
          productId: line.productId,
          productSku: line.product.sku,
          productName: line.product.name,
          inboundOrderId: null,
          inboundOrderNumber: null,
          quantity: line.requestedQuantity.toString(),
          status: 'unfulfilled',
          isHistoricalFallback: false,
        });
        continue;
      }

      // For older fulfilled/processing orders without explicit source allocations,
      // check if historical inventory receipts unambiguously establish the single source.
      const historicalInbounds = await this.prisma.inboundOrderLine.findMany({
        where: {
          productId: line.productId,
          receivedQuantity: { gt: 0 },
          order: {
            companyId: order.companyId,
            status: { in: ['confirmed', 'in_progress', 'partially_received', 'completed'] },
            createdAt: { lte: order.confirmedAt ?? order.createdAt },
          },
        },
        include: {
          order: { select: { id: true, orderNumber: true } },
        },
      });

      const uniqueInboundIds = Array.from(new Set(historicalInbounds.map((h) => h.order.id)));

      if (uniqueInboundIds.length === 1) {
        // Reliably established: only 1 inbound order ever supplied this product prior to the order
        const sourceOrder = historicalInbounds[0].order;
        results.push({
          omsOrderLineId: line.id,
          productId: line.productId,
          productSku: line.product.sku,
          productName: line.product.name,
          inboundOrderId: sourceOrder.id,
          inboundOrderNumber: sourceOrder.orderNumber,
          quantity: line.requestedQuantity.toString(),
          status: 'fulfilled',
          isHistoricalFallback: true,
        });
      } else {
        // Zero receipts or multiple candidate receipts — do not guess; accurately display source not recorded
        results.push({
          omsOrderLineId: line.id,
          productId: line.productId,
          productSku: line.product.sku,
          productName: line.product.name,
          inboundOrderId: null,
          inboundOrderNumber: null,
          quantity: line.requestedQuantity.toString(),
          status: 'source_not_recorded',
          isHistoricalFallback: false,
        });
      }
    }

    return results;
  }
}
