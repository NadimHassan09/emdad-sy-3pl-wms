import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { inboundIdsVisibleForWarehouse } from '../../common/utils/warehouse-order-scope';
import { isStorageLocationType } from '../../common/constants/storage-location-types';
import {
  InvalidLocationTypeException,
  InvalidStateException,
  LotLockedException,
  LotRequiredException,
} from '../../common/errors/domain-exceptions';
import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { generateLotCandidate } from '../../common/generators/identifiers';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockHelpers } from '../inventory/stock.helpers';
import { inboundReceiveDefersPutaway, taskOnlyFlows } from '../warehouse-workflow/feature-flags';
import { RealtimeService } from '../realtime/realtime.service';
import { WorkflowBootstrapService } from '../warehouse-workflow/workflow-bootstrap.service';
import { ConfirmInboundBodyDto } from './dto/confirm-inbound-body.dto';
import { CreateInboundOrderDto } from './dto/create-inbound.dto';
import { ListInboundQueryDto } from './dto/list-inbound-query.dto';
import { ReceiveLineDto } from './dto/receive-line.dto';

const ORDER_INCLUDE = {
  company: { select: { id: true, name: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          barcode: true,
          status: true,
          trackingType: true,
          uom: true,
          expiryTracking: true,
        },
      },
    },
  },
} satisfies Prisma.InboundOrderInclude;

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class InboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockHelpers,
    private readonly config: ConfigService,
    private readonly workflowBootstrap: WorkflowBootstrapService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(user: AuthPrincipal, dto: CreateInboundOrderDto) {
    const companyId = dto.companyId ?? user.companyId;
    if (!companyId) {
      throw new BadRequestException(
        'companyId is required (no default company on current user).',
      );
    }

    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, status: true, trackingType: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }
    const wrongCompany = products.find((p) => p.companyId !== companyId);
    if (wrongCompany) {
      throw new BadRequestException(
        'All line products must belong to the same company as the order.',
      );
    }
    for (const p of products) {
      assertProductOrderableForOrders(p.status);
    }

    const productById = new Map(products.map((p) => [p.id, p]));
    const lineCreates: Prisma.InboundOrderLineCreateWithoutOrderInput[] = [];
    for (let idx = 0; idx < dto.lines.length; idx++) {
      const l = dto.lines[idx];
      const p = productById.get(l.productId)!;
      let expectedLotNumber = l.expectedLotNumber?.trim() ?? null;
      if (p.trackingType === 'lot') {
        if (!expectedLotNumber) {
          expectedLotNumber = await this.allocateInboundExpectedLotNumber(l.productId);
        }
      } else {
        expectedLotNumber = null;
      }
      lineCreates.push({
        product: { connect: { id: l.productId } },
        expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
        expectedLotNumber,
        expectedExpiryDate: l.expectedExpiryDate ? new Date(l.expectedExpiryDate) : null,
        lineNumber: idx + 1,
      });
    }

    const order = await this.prisma.inboundOrder.create({
      data: {
        companyId,
        expectedArrivalDate: new Date(dto.expectedArrivalDate),
        clientReference: dto.clientReference,
        notes: dto.notes,
        createdBy: user.id,
        lines: {
          create: lineCreates,
        },
      },
      include: ORDER_INCLUDE,
    });
    this.realtime.emitInboundOrderCreated(order.companyId, {
      orderId: order.id,
      status: order.status,
    });
    return order;
  }

  async list(user: AuthPrincipal, query: ListInboundQueryDto) {
    const baseAnd: Prisma.InboundOrderWhereInput[] = [];
    const where: Prisma.InboundOrderWhereInput = {};

    const companyId = query.companyId ?? user.companyId ?? undefined;
    if (companyId) where.companyId = companyId;
    if (query.status) where.status = query.status;

    if (query.orderSearch?.trim()) {
      const t = query.orderSearch.trim();
      const orParts: Prisma.InboundOrderWhereInput[] = [
        { orderNumber: { contains: t, mode: 'insensitive' } },
      ];
      if (FULL_UUID.test(t)) orParts.push({ id: t });
      baseAnd.push({ OR: orParts });
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (query.warehouseId) {
      const scope = await inboundIdsVisibleForWarehouse(this.prisma, query.warehouseId, {
        ...(companyId ? { companyId } : {}),
      });
      baseAnd.push(scope);
    }

    if (baseAnd.length > 0) where.AND = baseAnd;

    return this.prisma.$transaction([
      this.prisma.inboundOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
          lines: {
            select: { id: true, productId: true, expectedQuantity: true, receivedQuantity: true, lineNumber: true },
          },
        },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.inboundOrder.count({ where }),
    ]).then(([items, total]) => ({ items, total, limit: query.limit, offset: query.offset }));
  }

  async findById(id: string) {
    const order = await this.prisma.inboundOrder.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Inbound order not found.');
    return order;
  }

  async confirm(user: AuthPrincipal, id: string, body?: ConfirmInboundBodyDto) {
    const order = await this.findById(id);
    for (const line of order.lines) {
      assertProductOrderableForOrders(line.product.status);
    }
    if (order.status !== 'draft') {
      throw new InvalidStateException(
        `Only draft orders can be confirmed (current status: ${order.status}).`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Add at least one line before confirming this order.');
    }
    if (taskOnlyFlows(this.config)) {
      if (!body?.warehouseId || !body.stagingByLineId) {
        throw new BadRequestException(
          'When TASK_ONLY_FLOWS=true, confirm body must include warehouseId and stagingByLineId (per line).',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        const wh = body.warehouseId!;
        const cur = await tx.inboundOrder.findUnique({ where: { id } });
        if (!cur) throw new NotFoundException('Inbound order not found.');
        if (user.companyId && cur.companyId !== user.companyId) {
          throw new NotFoundException('Inbound order not found.');
        }
        if (cur.status !== 'draft') {
          throw new InvalidStateException(
            `Only draft orders can be confirmed (current status: ${cur.status}).`,
          );
        }
        await tx.inboundOrder.update({
          where: { id },
          data: { status: 'in_progress', confirmedAt: new Date() },
        });
        await this.workflowBootstrap.startInboundWorkflowTx(tx, user, id, wh, body.stagingByLineId);
      });
      const updated = await this.findById(id);
      this.realtime.emitInboundOrderUpdated(updated.companyId, {
        orderId: updated.id,
        status: updated.status,
        reason: 'confirm',
      });
      return updated;
    }

    await this.prisma.inboundOrder.update({
      where: { id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    const confirmed = await this.findById(id);
    this.realtime.emitInboundOrderUpdated(confirmed.companyId, {
      orderId: confirmed.id,
      status: confirmed.status,
      reason: 'confirm',
    });
    return confirmed;
  }

  async cancel(id: string, user: AuthPrincipal) {
    const order = await this.findById(id);
    if (!['draft', 'confirmed'].includes(order.status)) {
      throw new InvalidStateException(
        `Inbound orders can only be cancelled while in draft/confirmed (current: ${order.status}).`,
      );
    }
    const cancelled = await this.prisma.inboundOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: user.id,
      },
      include: ORDER_INCLUDE,
    });
    this.realtime.emitInboundOrderUpdated(cancelled.companyId, {
      orderId: cancelled.id,
      status: cancelled.status,
      reason: 'cancel',
    });
    return cancelled;
  }

  /**
   * Receive items against a single line. Atomic transaction:
   *   1. Validate destination location is `internal`.
   *   2. Resolve effective lot number (lock or override).
   *   3. UPSERT lot if lot-tracked.
   *   4. UPSERT current_stock (positive movement helper; returns before/after).
   *   5. INSERT inventory_ledger row (movement_type=inbound_receive, before/after).
   *   6. UPDATE inbound_order_line.received_quantity (DB trigger guards 110%).
   *   7. Re-evaluate order status (in_progress / partially_received / completed).
   */
  async receiveLine(
    user: AuthPrincipal,
    orderId: string,
    lineId: string,
    dto: ReceiveLineDto,
  ) {
    if (taskOnlyFlows(this.config)) {
      throw new GoneException(
        'Use warehouse RECEIVING task completion when TASK_ONLY_FLOWS=true; line receive API is disabled.',
      );
    }
    const received = await this.prisma.$transaction(async (tx) => {
      const order = await tx.inboundOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Inbound order not found.');
      if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
        throw new InvalidStateException(
          `Receive is only allowed when order status is confirmed/in_progress (current: ${order.status}).`,
        );
      }

      const line = await tx.inboundOrderLine.findUnique({
        where: { id: lineId },
        include: {
          product: { select: { id: true, status: true, trackingType: true, expiryTracking: true } },
        },
      });
      if (!line || line.inboundOrderId !== orderId) {
        throw new NotFoundException('Inbound line not found on this order.');
      }
      assertProductOrderableForOrders(line.product.status);

      const location = await tx.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true, warehouseId: true, type: true, status: true },
      });
      if (!location) throw new NotFoundException('Destination location not found.');
      assertLocationUsableForInventoryMove(location.status);
      if (inboundReceiveDefersPutaway(this.config)) {
        if (!this.isDockStagingLocationType(location.type)) {
          throw new InvalidLocationTypeException(
            'Deferred putaway mode: receive only to a receiving dock location (`input`). Inventory posts on putaway task.',
          );
        }
        const delta = new Prisma.Decimal(dto.quantity);
        await tx.inboundOrderLine.update({
          where: { id: lineId },
          data: { receivedQuantity: { increment: delta } },
        });
        await this.refreshInboundOrderHeadStatus(tx, orderId);
        return tx.inboundOrder.findUnique({
          where: { id: orderId },
          include: ORDER_INCLUDE,
        });
      }

      if (!isStorageLocationType(location.type)) {
        throw new InvalidLocationTypeException(
          'Destination must be a storage-capable location (e.g. internal, packing, quarantine). Aisles/sections and dock nodes cannot receive stock.',
        );
      }

      // Resolve effective lot — honour the lock unless overrideLot=true.
      const expected = line.expectedLotNumber?.trim() || null;
      let effectiveLotNumber: string | undefined;
      if (line.product.trackingType === 'lot') {
        if (expected && !dto.overrideLot) {
          if (dto.lotNumber && dto.lotNumber !== expected) {
            throw new LotLockedException();
          }
          effectiveLotNumber = expected;
        } else {
          if (!dto.lotNumber) throw new LotRequiredException();
          effectiveLotNumber = dto.lotNumber;
        }
      }


      let expiryForLot: Date | null = null;
      if (line.product.trackingType === 'lot' && line.product.expiryTracking) {
        if (dto.expiryDate && dto.expiryDate.trim() !== '') {
          expiryForLot = new Date(dto.expiryDate);
        } else if (expected && !dto.overrideLot && line.expectedExpiryDate) {
          expiryForLot = new Date(line.expectedExpiryDate);
        }
        if (!expiryForLot) {
          throw new BadRequestException(
            'expiryDate is required for expiry-tracked products (send on line or use expected expiry).',
          );
        }
      }

      let lotId: string | null = null;
      if (effectiveLotNumber) {
        const existing = await tx.lot.findUnique({
          where: {
            productId_lotNumber: {
              productId: line.productId,
              lotNumber: effectiveLotNumber,
            },
          },
        });
        if (existing) {
          lotId = existing.id;
        } else {
          const created = await tx.lot.create({
            data: {
              productId: line.productId,
              lotNumber: effectiveLotNumber,
              expiryDate: expiryForLot,
            },
          });
          lotId = created.id;
        }
      }

      const stockMeta = await this.stock.upsertPositiveWithMeta(tx, {
        companyId: order.companyId,
        productId: line.productId,
        locationId: dto.locationId,
        warehouseId: location.warehouseId,
        lotId,
        quantity: dto.quantity,
      });

      await tx.inventoryLedger.create({
        data: {
          companyId: order.companyId,
          productId: line.productId,
          lotId,
          toLocationId: dto.locationId,
          movementType: 'inbound_receive',
          quantity: new Prisma.Decimal(dto.quantity),
          quantityBefore: stockMeta.before,
          quantityAfter: stockMeta.after,
          referenceType: 'inbound_order',
          referenceId: orderId,
          operatorId: user.id,
          idempotencyKey: `bm:inbound:${orderId}:${line.productId}:line:${line.id}:loc:${dto.locationId}:lot:${lotId ?? 'null'}`,
        },
      });

      const newReceived = line.receivedQuantity.plus(new Prisma.Decimal(dto.quantity));
      await tx.inboundOrderLine.update({
        where: { id: lineId },
        data: { receivedQuantity: newReceived },
      });

      await this.refreshInboundOrderHeadStatus(tx, orderId);

      return tx.inboundOrder.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
    });
    if (received) {
      this.realtime.emitInboundOrderUpdated(received.companyId, {
        orderId: received.id,
        status: received.status,
        reason: 'receive_line',
      });
      this.realtime.emitInventoryChanged(received.companyId, {
        source: 'inbound_receive_line',
        orderId: received.id,
      });
    }
    return received;
  }

  private async refreshInboundOrderHeadStatus(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) return;
    const allLines = await tx.inboundOrderLine.findMany({
      where: { inboundOrderId: orderId },
      select: { receivedQuantity: true, expectedQuantity: true },
    });
    const allComplete = allLines.every((l) =>
      l.receivedQuantity.greaterThanOrEqualTo(l.expectedQuantity),
    );
    const anyReceived = allLines.some((l) => l.receivedQuantity.greaterThan(0));

    if (!anyReceived) return;
    if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
      return;
    }

    const next = allComplete ? 'in_progress' : 'partially_received';
    if (next !== order.status) {
      await tx.inboundOrder.update({ where: { id: orderId }, data: { status: next } });
    }
  }

  private isDockStagingLocationType(locationType: string): boolean {
    return locationType === 'input';
  }

  /** Lot-tracked inbound lines get a unique expected lot number when the client omits one. */
  private async allocateInboundExpectedLotNumber(productId: string): Promise<string> {
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = generateLotCandidate();
      const clash = await this.prisma.lot.findUnique({
        where: { productId_lotNumber: { productId, lotNumber: candidate } },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new InternalServerErrorException('Could not allocate a unique inbound lot number.');
  }
}
