import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OmsAllocationStatus, OutboundOrderStatus, Prisma, ReservationStatus } from '@prisma/client';

import { InsufficientStockException } from '../../common/errors/domain-exceptions';
import {
  findCompanyStockFefo,
  findWarehouseStockFefo,
} from '../warehouse-workflow/task-allocation.helper';
import { allocateOnOrderCreate } from '../warehouse-workflow/feature-flags';
import type { ReservationSnapshot } from '../warehouse-workflow/task-inventory-effects.service';
import { OmsOrderEventsService } from './oms-order-events.service';

type Tx = Prisma.TransactionClient;

export interface AllocationLineInput {
  outboundOrderLineId: string;
  productId: string;
  requestedQty: Prisma.Decimal;
  specificLotId: string | null;
}

@Injectable()
export class OrderAllocationService {
  constructor(
    private readonly config: ConfigService,
    private readonly events: OmsOrderEventsService,
  ) {}

  isEnabled(): boolean {
    return allocateOnOrderCreate(this.config);
  }

  async hasActiveReservations(tx: Tx, outboundOrderId: string): Promise<boolean> {
    const count = await tx.stockReservation.count({
      where: { outboundOrderId, status: ReservationStatus.active },
    });
    return count > 0;
  }

  /** Map DB reservations to pick-task snapshots (no extra reserved increment). */
  async loadActiveReservationSnapshots(
    tx: Tx,
    outboundOrderId: string,
  ): Promise<ReservationSnapshot[]> {
    const rows = await tx.stockReservation.findMany({
      where: { outboundOrderId, status: ReservationStatus.active },
      include: {
        location: { select: { warehouseId: true } },
      },
    });
    return rows.map((r) => ({
      outboundOrderLineId: r.outboundOrderLineId ?? '',
      companyId: r.companyId,
      productId: r.productId,
      locationId: r.locationId,
      warehouseId: r.location.warehouseId,
      lotId: r.lotId,
      quantity: r.quantity.toString(),
    }));
  }

  /**
   * Allocate stock for an outbound order using stock_reservations (trigger-synced reserved qty).
   * No-op when feature flag is off.
   *
   * Idempotent reuse: existing active reservations for this outbound are credited toward
   * each line's requested qty. Only the shortfall (if any) is newly reserved.
   * Linked OMS → Outbound share the same outbound_order_id soft-hold — never double-book.
   */
  async allocateOrder(
    tx: Tx,
    params: {
      outboundOrderId: string;
      companyId: string;
      lines: AllocationLineInput[];
      warehouseId?: string | null;
      actorUserId?: string;
      previousStatus?: OutboundOrderStatus;
    },
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const existingRows = await tx.stockReservation.findMany({
      where: {
        outboundOrderId: params.outboundOrderId,
        status: ReservationStatus.active,
      },
      select: {
        outboundOrderLineId: true,
        productId: true,
        quantity: true,
      },
    });

    const reservedByLineId = new Map<string, Prisma.Decimal>();
    for (const row of existingRows) {
      const key = row.outboundOrderLineId ?? `product:${row.productId}`;
      const prev = reservedByLineId.get(key) ?? new Prisma.Decimal(0);
      reservedByLineId.set(key, prev.plus(row.quantity));
    }

    let createdAny = false;

    for (const line of params.lines) {
      const already =
        reservedByLineId.get(line.outboundOrderLineId) ??
        reservedByLineId.get(`product:${line.productId}`) ??
        new Prisma.Decimal(0);
      let remaining = new Prisma.Decimal(line.requestedQty.toString()).minus(already);
      if (remaining.lessThanOrEqualTo(0)) continue;

      const candidates = params.warehouseId
        ? await findWarehouseStockFefo(
            tx,
            params.companyId,
            params.warehouseId,
            line.productId,
            line.specificLotId,
          )
        : await findCompanyStockFefo(
            tx,
            params.companyId,
            line.productId,
            line.specificLotId,
          );

      for (const row of candidates) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const take = Prisma.Decimal.min(remaining, row.quantityAvailable);
        if (take.lessThanOrEqualTo(0)) continue;

        await tx.stockReservation.create({
          data: {
            companyId: params.companyId,
            productId: line.productId,
            locationId: row.locationId,
            lotId: row.lotId,
            outboundOrderId: params.outboundOrderId,
            outboundOrderLineId: line.outboundOrderLineId,
            quantity: take,
            status: ReservationStatus.active,
          },
        });
        createdAny = true;
        remaining = remaining.minus(take);
      }

      if (remaining.greaterThan(0)) {
        throw new InsufficientStockException();
      }
    }

    // Fully covered by existing soft-holds — idempotent success (OMS→Outbound reuse).
    if (!createdAny && existingRows.length > 0) {
      return;
    }

    const allocatableStatuses: OutboundOrderStatus[] = [
      OutboundOrderStatus.draft,
      OutboundOrderStatus.confirmed,
      OutboundOrderStatus.pending_stock,
    ];
    // Keep pending_approval so client-portal approval UX still lists the order.
    // Soft-hold is tracked via allocationStatus + stock_reservations, not status flip.
    const canSetAllocated =
      !params.previousStatus || allocatableStatuses.includes(params.previousStatus);

    await tx.outboundOrder.update({
      where: { id: params.outboundOrderId },
      data: {
        allocationStatus: OmsAllocationStatus.allocated,
        allocatedAt: new Date(),
        ...(canSetAllocated ? { status: OutboundOrderStatus.allocated } : {}),
      },
    });

    if (createdAny || existingRows.length === 0) {
      await this.events.record(tx, {
        outboundOrderId: params.outboundOrderId,
        companyId: params.companyId,
        eventType: 'order.allocated',
        createdBy: params.actorUserId,
        payload: {
          lineCount: params.lines.length,
          reusedExisting: existingRows.length > 0,
        },
      });
    }
  }

  /** Sum active soft-hold qty for one outbound + product (credits own reservation). */
  async sumActiveReservedForProduct(
    tx: Tx,
    outboundOrderId: string,
    productId: string,
  ): Promise<Prisma.Decimal> {
    const agg = await tx.stockReservation.aggregate({
      where: {
        outboundOrderId,
        productId,
        status: ReservationStatus.active,
      },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? new Prisma.Decimal(0);
  }

  /** Release all active reservations for an order (cancel / manual release). */
  async releaseAllocation(
    tx: Tx,
    params: {
      outboundOrderId: string;
      companyId: string;
      actorUserId?: string;
    },
  ): Promise<void> {
    const active = await tx.stockReservation.findMany({
      where: {
        outboundOrderId: params.outboundOrderId,
        status: ReservationStatus.active,
      },
    });
    if (active.length === 0) return;

    await tx.stockReservation.updateMany({
      where: {
        outboundOrderId: params.outboundOrderId,
        status: ReservationStatus.active,
      },
      data: { status: ReservationStatus.released },
    });

    await tx.outboundOrder.update({
      where: { id: params.outboundOrderId },
      data: { allocationStatus: OmsAllocationStatus.released },
    });

    await this.events.record(tx, {
      outboundOrderId: params.outboundOrderId,
      companyId: params.companyId,
      eventType: 'inventory.released',
      createdBy: params.actorUserId,
      payload: { reservationCount: active.length },
    });
  }

  /** Mark reservations fulfilled after dispatch (pairs with on-hand decrement). */
  async fulfillReservations(
    tx: Tx,
    params: {
      outboundOrderId: string;
      companyId: string;
      actorUserId?: string;
    },
  ): Promise<void> {
    const active = await tx.stockReservation.count({
      where: {
        outboundOrderId: params.outboundOrderId,
        status: ReservationStatus.active,
      },
    });
    if (active === 0) return;

    await tx.stockReservation.updateMany({
      where: {
        outboundOrderId: params.outboundOrderId,
        status: ReservationStatus.active,
      },
      data: { status: ReservationStatus.fulfilled },
    });

    await tx.outboundOrder.update({
      where: { id: params.outboundOrderId },
      data: { allocationStatus: OmsAllocationStatus.fulfilled },
    });

    await this.events.record(tx, {
      outboundOrderId: params.outboundOrderId,
      companyId: params.companyId,
      eventType: 'inventory.fulfilled',
      createdBy: params.actorUserId,
      payload: { reservationCount: active },
    });
  }

  async assertAllocatable(
    tx: Tx,
    outboundOrderId: string,
  ): Promise<void> {
    const order = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { status: true, allocationStatus: true },
    });
    if (!order) throw new BadRequestException('Order not found.');
    if (order.allocationStatus === OmsAllocationStatus.allocated) {
      throw new BadRequestException('Order is already allocated.');
    }
    if (
      order.status === OutboundOrderStatus.shipped ||
      order.status === OutboundOrderStatus.delivered ||
      order.status === OutboundOrderStatus.cancelled
    ) {
      throw new BadRequestException(`Cannot allocate order in status ${order.status}.`);
    }
  }
}
