import { BadRequestException, Injectable } from '@nestjs/common';
import { InboundQcStatus, MovementType, Prisma, ProductTrackingType } from '@prisma/client';

import { isQuarantineStorageLocationType } from '../../common/constants/storage-location-types';
import {
  InvalidLocationTypeException,
  LotRequiredException,
} from '../../common/errors/domain-exceptions';
import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { LedgerIdempotencyService } from '../inventory/ledger-idempotency.service';
import { StockHelpers } from '../inventory/stock.helpers';
import { TaskCompleteBody } from './task-payload.schema';
import { findWarehouseStockFefo } from './task-allocation.helper';

export interface ReservationSnapshot {
  outboundOrderLineId: string;
  companyId: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  lotId: string | null;
  quantity: string;
}

@Injectable()
export class TaskInventoryEffectsService {
  constructor(
    private readonly stock: StockHelpers,
    private readonly ledgerDedup: LedgerIdempotencyService,
  ) {}

  async buildPickReservations(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    lines: Array<{
      outboundOrderLineId: string;
      productId: string;
      requestedQty: Prisma.Decimal;
      specificLotId: string | null;
    }>,
  ): Promise<ReservationSnapshot[]> {
    const reservations: ReservationSnapshot[] = [];
    for (const line of lines) {
      let remaining = new Prisma.Decimal(line.requestedQty.toString());
      const candidates = await findWarehouseStockFefo(
        tx,
        companyId,
        warehouseId,
        line.productId,
        line.specificLotId,
      );
      for (const row of candidates) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const take = Prisma.Decimal.min(remaining, row.quantityAvailable);
        if (take.lessThanOrEqualTo(0)) continue;
        await this.stock.incrementReservedWithMeta(tx, {
          companyId,
          productId: line.productId,
          locationId: row.locationId,
          lotId: row.lotId,
          quantity: take.toString(),
        });
        reservations.push({
          outboundOrderLineId: line.outboundOrderLineId,
          companyId,
          productId: line.productId,
          locationId: row.locationId,
          warehouseId: row.warehouseId,
          lotId: row.lotId,
          quantity: take.toString(),
        });
        remaining = remaining.minus(take);
      }
      if (remaining.greaterThan(0)) {
        throw new BadRequestException(
          `Insufficient stock to reserve pick for line ${line.outboundOrderLineId}.`,
        );
      }
    }
    return reservations;
  }

  async releaseReservations(tx: Prisma.TransactionClient, rows: ReservationSnapshot[]): Promise<void> {
    for (const r of rows) {
      await this.stock.releaseReservedWithMeta(tx, {
        companyId: r.companyId,
        productId: r.productId,
        locationId: r.locationId,
        lotId: r.lotId,
        quantity: r.quantity,
      });
    }
  }

  async applyReceivingStaging(
    tx: Prisma.TransactionClient,
    operatorId: string,
    taskId: string,
    inboundOrderId: string,
    companyId: string,
    body: Extract<TaskCompleteBody, { task_type: 'receiving' }>,
    stagingByLineId: Map<string, string>,
  ): Promise<void> {
    const order = await tx.inboundOrder.findUnique({
      where: { id: inboundOrderId },
      include: { lines: { include: { product: true } } },
    });
    if (!order) throw new BadRequestException('Inbound order not found.');
    if (order.companyId !== companyId) {
      throw new BadRequestException('Order company mismatch.');
    }

    for (const l of body.lines) {
      const line = order.lines.find((x) => x.id === l.inbound_order_line_id);
      if (!line) throw new BadRequestException(`Unknown inbound line ${l.inbound_order_line_id}`);

      const stagingLocationId = stagingByLineId.get(l.inbound_order_line_id);
      if (!stagingLocationId) {
        throw new BadRequestException(
          `Missing staging location for line ${l.inbound_order_line_id} in task payload.`,
        );
      }

      const location = await tx.location.findUnique({
        where: { id: stagingLocationId },
        select: { id: true, warehouseId: true, status: true },
      });
      if (!location) throw new BadRequestException('Staging location not found.');
      assertLocationUsableForInventoryMove(location.status);

      const qty = new Prisma.Decimal(l.received_qty);
      const expected = line.expectedQuantity;
      if (qty.greaterThan(expected) && !body.allow_short_close) {
        throw new BadRequestException(
          `Received qty exceeds expected for line ${line.id} (${qty.toString()} > ${expected.toString()}).`,
        );
      }

      let lotId: string | null = l.lot_id ?? null;
      if (line.product.trackingType === 'lot') {
        let ln = (l.capture_lot_number ?? '').trim();
        if (!lotId && !ln && line.expectedLotNumber?.trim()) {
          ln = line.expectedLotNumber.trim();
        }
        if (!lotId && !ln) throw new LotRequiredException();
        if (!lotId && ln) {
          const found = await tx.lot.findUnique({
            where: { productId_lotNumber: { productId: line.productId, lotNumber: ln } },
          });
          lotId =
            found?.id ??
            (
              await tx.lot.create({
                data: { productId: line.productId, lotNumber: ln },
              })
            ).id;
        }
      }

      const stockMeta = await this.stock.upsertPositiveWithMeta(tx, {
        companyId,
        productId: line.productId,
        locationId: stagingLocationId,
        warehouseId: location.warehouseId,
        lotId,
        quantity: qty.toString(),
      });

      const idemKey = `bm:inbound:${inboundOrderId}:${line.productId}:task:${taskId}:line:${line.id}`;
      await this.ledgerDedup.appendIfAbsent(tx, idemKey, {
        companyId,
        productId: line.productId,
        lotId,
        fromLocationId: null,
        toLocationId: stagingLocationId,
        movementType: MovementType.inbound_receive,
        quantity: qty,
        quantityBefore: stockMeta.before,
        quantityAfter: stockMeta.after,
        referenceType: 'inbound_order',
        referenceId: inboundOrderId,
        operatorId,
      });

      await tx.inboundOrderLine.update({
        where: { id: line.id },
        data: {
          receivedQuantity: { increment: qty },
          ...(qty.lessThan(expected)
            ? {
                discrepancyType: 'short' as const,
                discrepancyNotes: l.discrepancy_notes ?? undefined,
              }
            : {}),
        },
      });
    }

    await this.refreshInboundOrderStatus(tx, inboundOrderId);
  }

  async applyPutaway(
    tx: Prisma.TransactionClient,
    _operatorId: string,
    _taskId: string,
    inboundOrderId: string,
    companyId: string,
    body:
      | Extract<TaskCompleteBody, { task_type: 'putaway' }>
      | Extract<TaskCompleteBody, { task_type: 'putaway_quarantine' }>,
    sourceByLineId: Map<string, { locationId: string; productId: string; lotId: string | null }>,
    opts?: {
      quarantineBinsOnly?: boolean;
    },
  ): Promise<void> {
    const quarantineBinsOnly = opts?.quarantineBinsOnly ?? false;
    const order = await tx.inboundOrder.findUnique({
      where: { id: inboundOrderId },
      include: { lines: { include: { product: true } } },
    });
    if (!order || order.companyId !== companyId) {
      throw new BadRequestException('Inbound order invalid for putaway.');
    }

    for (const l of body.lines) {
      const src = sourceByLineId.get(l.inbound_order_line_id);
      if (!src) {
        throw new BadRequestException(`Missing putaway source for line ${l.inbound_order_line_id}.`);
      }
      const inboundLine = order.lines.find((row) => row.id === l.inbound_order_line_id);
      if (!inboundLine) {
        throw new BadRequestException(`Unknown inbound line ${l.inbound_order_line_id} for putaway.`);
      }
      const qty = new Prisma.Decimal(l.putaway_quantity);
      const dest = await tx.location.findUnique({
        where: { id: l.destination_location_id },
        select: { warehouseId: true, type: true, status: true },
      });
      if (!dest) throw new BadRequestException('Destination location not found.');
      assertLocationUsableForInventoryMove(dest.status);

      const srcLoc = await tx.location.findUnique({
        where: { id: src.locationId },
        select: { status: true },
      });
      if (!srcLoc) throw new BadRequestException('Putaway source location not found.');
      assertLocationUsableForInventoryMove(srcLoc.status);

      if (quarantineBinsOnly) {
        if (!isQuarantineStorageLocationType(dest.type)) {
          throw new InvalidLocationTypeException('Quarantine putaway requires a quarantine or scrap bin.');
        }
      } else {
        const allowedSellablePutaway = new Set(['internal', 'fridge', 'quarantine', 'scrap']);
        if (!allowedSellablePutaway.has(String(dest.type))) {
          throw new InvalidLocationTypeException(
            'Putaway destination must be storage (internal), fridge, quarantine, or scrap.',
          );
        }
      }

      let lotId: string | null = l.lot_id ?? src.lotId ?? null;
      if (inboundLine.product.trackingType === ProductTrackingType.lot && !lotId) {
        const resolved = await this.resolvePutawayLotFromStaging(
          tx,
          companyId,
          src.productId,
          src.locationId,
          qty,
        );
        if (!resolved) {
          throw new BadRequestException(
            'Putaway could not resolve a staged lot for this line (legacy tasks omitted lot_id). Ensure inventory exists at the staging bin for this product/lot or recreate the putaway task.',
          );
        }
        lotId = resolved;
      }

      await this.stock.decrementWithMeta(tx, {
        companyId,
        productId: src.productId,
        locationId: src.locationId,
        lotId,
        quantity: qty.toString(),
      });

      await this.stock.upsertPositiveWithMeta(tx, {
        companyId,
        productId: src.productId,
        locationId: l.destination_location_id,
        warehouseId: dest.warehouseId,
        lotId,
        quantity: qty.toString(),
      });
    }
  }

  async applyPickRecord(
    tx: Prisma.TransactionClient,
    orderId: string,
    reservations: ReservationSnapshot[],
    body: Extract<TaskCompleteBody, { task_type: 'pick' }>,
  ): Promise<void> {
    this.assertPickCompletionMatchesReservations(reservations, body);

    const byLineId = new Map<string, ReservationSnapshot[]>();
    for (const r of reservations) {
      const cur = byLineId.get(r.outboundOrderLineId) ?? [];
      cur.push(r);
      byLineId.set(r.outboundOrderLineId, cur);
    }

    for (const grp of body.picks) {
      const pickedTotal = grp.lines.reduce(
        (acc, p) => acc.plus(new Prisma.Decimal(String(p.quantity))),
        new Prisma.Decimal(0),
      );
      await tx.outboundOrderLine.update({
        where: { id: grp.outbound_order_line_id },
        data: {
          pickedQuantity: pickedTotal,
          status: 'done',
        },
      });
    }

    await tx.outboundOrder.update({
      where: { id: orderId },
      data: {
        status: 'packing',
      },
    });
  }

  async applyDispatchShip(
    tx: Prisma.TransactionClient,
    operatorId: string,
    taskId: string,
    outboundOrderId: string,
    companyId: string,
    reservations: ReservationSnapshot[],
    body: Extract<TaskCompleteBody, { task_type: 'dispatch' }>,
  ): Promise<void> {
    const order = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      include: { lines: true },
    });
    if (!order || order.companyId !== companyId) throw new BadRequestException('Outbound order invalid.');

    const uniqueLocIds = [...new Set(reservations.map((r) => r.locationId))];
    const locRows = await tx.location.findMany({
      where: { id: { in: uniqueLocIds } },
      select: { id: true, status: true },
    });
    for (const lr of locRows) {
      assertLocationUsableForInventoryMove(lr.status);
    }

    for (const l of body.lines) {
      const line = order.lines.find((x) => x.id === l.outbound_order_line_id);
      if (!line) throw new BadRequestException(`Unknown outbound line ${l.outbound_order_line_id}`);
      const ship = new Prisma.Decimal(l.ship_qty);
      if (!ship.equals(line.pickedQuantity)) {
        throw new BadRequestException(`Ship qty must match picked qty for line ${line.id}.`);
      }
    }

    for (const r of reservations) {
      const meta = await this.stock.decrementShippedWithMeta(tx, {
        companyId: r.companyId,
        productId: r.productId,
        locationId: r.locationId,
        lotId: r.lotId,
        quantity: r.quantity,
      });
      const idemKey = `bm:outbound:${outboundOrderId}:${r.productId}:task:${taskId}:line:${r.outboundOrderLineId}:loc:${r.locationId}:lot:${r.lotId ?? 'null'}:${r.quantity}`;
      await this.ledgerDedup.appendIfAbsent(tx, idemKey, {
        companyId: r.companyId,
        productId: r.productId,
        lotId: r.lotId,
        fromLocationId: r.locationId,
        toLocationId: null,
        movementType: MovementType.outbound_pick,
        quantity: new Prisma.Decimal(r.quantity),
        quantityBefore: meta.before,
        quantityAfter: meta.after,
        referenceType: 'outbound_order',
        referenceId: outboundOrderId,
        operatorId,
      });
    }

    await tx.outboundOrder.update({
      where: { id: outboundOrderId },
      data: {
        status: 'shipped',
        shippedAt: new Date(),
        carrier: body.carrier ?? order.carrier,
        trackingNumber: body.tracking ?? order.trackingNumber,
      },
    });
  }

  async applyQcLines(
    tx: Prisma.TransactionClient,
    inboundOrderId: string,
    body: Extract<TaskCompleteBody, { task_type: 'qc' }>,
  ): Promise<void> {
    for (const row of body.lines) {
      const line = await tx.inboundOrderLine.findFirst({
        where: { id: row.inbound_order_line_id, inboundOrderId },
      });
      if (!line) throw new BadRequestException(`QC line not found: ${row.inbound_order_line_id}.`);
      const failed = new Prisma.Decimal(String(row.failed_qty));
      const status: InboundQcStatus =
        failed.greaterThan(0) ? InboundQcStatus.failed : InboundQcStatus.passed;
      await tx.inboundOrderLine.update({
        where: { id: line.id },
        data: { qcStatus: status },
      });
    }
  }

  async applyPackRecord(
    tx: Prisma.TransactionClient,
    outboundOrderId: string,
    body: Extract<TaskCompleteBody, { task_type: 'pack' }>,
  ): Promise<void> {
    for (const l of body.lines) {
      const line = await tx.outboundOrderLine.findFirst({
        where: { id: l.outbound_order_line_id, outboundOrderId },
      });
      if (!line) throw new BadRequestException(`Unknown line ${l.outbound_order_line_id}`);
      const packed = new Prisma.Decimal(l.packed_qty);
      if (packed.greaterThan(line.pickedQuantity)) {
        throw new BadRequestException('Packed qty cannot exceed picked qty.');
      }
    }
    await tx.outboundOrder.update({
      where: { id: outboundOrderId },
      data: { status: 'ready_to_ship' },
    });
  }

  /**
   * Reservations are allocated FEFO/FIFO when pick starts. Completion must echo those slices exactly
   * so workers cannot pick arbitrary bins/lots ahead of system allocation order.
   */
  private assertPickCompletionMatchesReservations(
    reservations: ReservationSnapshot[],
    body: Extract<TaskCompleteBody, { task_type: 'pick' }>,
  ): void {
    const normLot = (v: string | null | undefined) =>
      v === undefined || v === null || v === '' ? null : v;

    const qtyEq = (a: string, b: string) => new Prisma.Decimal(a).equals(new Prisma.Decimal(b));

    const byLineId = new Map<string, ReservationSnapshot[]>();
    for (const r of reservations) {
      const cur = byLineId.get(r.outboundOrderLineId) ?? [];
      cur.push(r);
      byLineId.set(r.outboundOrderLineId, cur);
    }

    const expectedLineIds = new Set(byLineId.keys());
    const seenLineIds = new Set<string>();

    for (const grp of body.picks) {
      seenLineIds.add(grp.outbound_order_line_id);
      const reserved = byLineId.get(grp.outbound_order_line_id);
      if (!reserved?.length) {
        throw new BadRequestException(
          `Pick completion references unknown outbound line ${grp.outbound_order_line_id}.`,
        );
      }
      const remaining = [...reserved];
      for (const pl of grp.lines) {
        const idx = remaining.findIndex(
          (r) =>
            r.locationId === pl.location_id &&
            normLot(r.lotId) === normLot(pl.lot_id) &&
            qtyEq(r.quantity, String(pl.quantity)),
        );
        if (idx < 0) {
          throw new BadRequestException(
            `Pick completion must match reserved allocations (FEFO/FIFO). Offending outbound line ${grp.outbound_order_line_id}: each slice must match reservation location, lot, and quantity.`,
          );
        }
        remaining.splice(idx, 1);
      }
      if (remaining.length > 0) {
        throw new BadRequestException(
          `Incomplete pick for outbound line ${grp.outbound_order_line_id}: submit every reserved slice.`,
        );
      }
    }

    for (const lid of expectedLineIds) {
      if (!seenLineIds.has(lid)) {
        throw new BadRequestException(`Missing pick group for outbound line ${lid}.`);
      }
    }
  }

  /**
   * Older putaway tasks stored lot_id=null while receiving wrote stock under a concrete lot row.
   * Resolve the staged bucket by scanning current_stock so complete() matches receiving.
   */
  private async resolvePutawayLotFromStaging(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    stagingLocationId: string,
    qty: Prisma.Decimal,
  ): Promise<string | null> {
    const rows = await tx.currentStock.findMany({
      where: {
        companyId,
        productId,
        locationId: stagingLocationId,
        packageId: null,
        lotId: { not: null },
        quantityAvailable: { gt: 0 },
      },
      select: { lotId: true, quantityAvailable: true },
      orderBy: { quantityAvailable: 'desc' },
    });

    const covering = rows.find((r) =>
      new Prisma.Decimal(r.quantityAvailable.toString()).greaterThanOrEqualTo(qty),
    );
    return covering?.lotId ?? null;
  }

  private async refreshInboundOrderStatus(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) return;
    const anyReceived = order.lines.some((l) => l.receivedQuantity.greaterThan(0));
    if (!anyReceived) return;

    const allFullyReceived = order.lines.every((l) =>
      l.receivedQuantity.greaterThanOrEqualTo(l.expectedQuantity),
    );

    if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
      return;
    }

    const next = allFullyReceived ? 'in_progress' : 'partially_received';

    if (next !== order.status) {
      await tx.inboundOrder.update({ where: { id: orderId }, data: { status: next } });
    }
  }
}
