import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { outboundIdsVisibleForWarehouse } from '../../common/utils/warehouse-order-scope';
import {
  InsufficientStockException,
  InvalidStateException,
  StockShortage,
} from '../../common/errors/domain-exceptions';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockHelpers } from '../inventory/stock.helpers';
import {
  outboundConfirmDefersDeduction,
  taskOnlyFlows,
} from '../warehouse-workflow/feature-flags';
import { RealtimeService } from '../realtime/realtime.service';
import { WorkflowBootstrapService } from '../warehouse-workflow/workflow-bootstrap.service';
import { CreateOutboundOrderDto } from './dto/create-outbound.dto';
import { ConfirmOutboundBodyDto } from './dto/confirm-outbound-body.dto';
import { ListOutboundQueryDto } from './dto/list-outbound-query.dto';

interface StockRow {
  id: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  lotId: string | null;
  quantityAvailable: Prisma.Decimal;
  expiryDate: Date | null;
  createdAt: Date;
}

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
        },
      },
    },
  },
} satisfies Prisma.OutboundOrderInclude;

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OutboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockHelpers,
    private readonly config: ConfigService,
    private readonly workflowBootstrap: WorkflowBootstrapService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Hard-validates per-product stock availability across the company before
   * the order is persisted. If any product's *summed* line quantity exceeds
   * the aggregate `current_stock.quantity_available`, the request is rejected
   * with `INSUFFICIENT_STOCK` and a structured `details[]` payload.
   *
   * Note: there is still a small race between this check and confirm-time
   * deduction; `confirmAndDeduct` retains its atomic decrement guards as a
   * safety net.
   */
  async create(user: AuthPrincipal, dto: CreateOutboundOrderDto) {
    const companyId = dto.companyId ?? user.companyId;
    if (!companyId) {
      throw new BadRequestException(
        'companyId is required (no default company on current user).',
      );
    }

    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, sku: true, name: true, status: true },
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

    const requestedByProduct = new Map<string, Prisma.Decimal>();
    for (const l of dto.lines) {
      const cur = requestedByProduct.get(l.productId) ?? new Prisma.Decimal(0);
      requestedByProduct.set(
        l.productId,
        cur.plus(new Prisma.Decimal(l.requestedQuantity)),
      );
    }

    const availability = await this.prisma.currentStock.groupBy({
      by: ['productId'],
      where: {
        companyId,
        productId: { in: productIds },
        status: 'available',
      },
      _sum: { quantityAvailable: true },
    });
    const availMap = new Map<string, Prisma.Decimal>(
      availability.map((a) => [
        a.productId,
        a._sum.quantityAvailable ?? new Prisma.Decimal(0),
      ]),
    );

    const shortages: StockShortage[] = [];
    for (const [productId, requested] of requestedByProduct.entries()) {
      const available = availMap.get(productId) ?? new Prisma.Decimal(0);
      if (requested.greaterThan(available)) {
        shortages.push({
          productId,
          requested: requested.toString(),
          available: available.toString(),
        });
      }
    }
    if (shortages.length > 0) {
      const productById = new Map(products.map((p) => [p.id, p]));
      const summary = shortages
        .map((s) => {
          const p = productById.get(s.productId);
          const sku = p?.sku ?? s.productId;
          return `${sku}: ${s.available}`;
        })
        .join('; ');
      throw new InsufficientStockException(
        `Insufficient stock. Available: ${summary}`,
        shortages,
      );
    }

    const created = await this.prisma.outboundOrder.create({
      data: {
        companyId,
        destinationAddress: dto.destinationAddress,
        requiredShipDate: new Date(dto.requiredShipDate),
        carrier: dto.carrier,
        clientReference: dto.clientReference,
        notes: dto.notes,
        createdBy: user.id,
        lines: {
          create: dto.lines.map((l, idx) => ({
            productId: l.productId,
            requestedQuantity: new Prisma.Decimal(l.requestedQuantity),
            specificLotId: l.specificLotId,
            lineNumber: idx + 1,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });
    this.realtime.emitOutboundOrderCreated(created.companyId, {
      orderId: created.id,
      status: created.status,
    });
    return created;
  }

  async list(user: AuthPrincipal, query: ListOutboundQueryDto) {
    const baseAnd: Prisma.OutboundOrderWhereInput[] = [];
    const where: Prisma.OutboundOrderWhereInput = {};

    const companyId = query.companyId ?? user.companyId ?? undefined;
    if (companyId) where.companyId = companyId;
    if (query.status) where.status = query.status;

    if (query.orderSearch?.trim()) {
      const t = query.orderSearch.trim();
      const orParts: Prisma.OutboundOrderWhereInput[] = [
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
      const scope = await outboundIdsVisibleForWarehouse(this.prisma, query.warehouseId, {
        ...(companyId ? { companyId } : {}),
      });
      baseAnd.push(scope);
    }

    if (baseAnd.length > 0) where.AND = baseAnd;

    return this.prisma.$transaction([
      this.prisma.outboundOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.outboundOrder.count({ where }),
    ]).then(([items, total]) => ({ items, total, limit: query.limit, offset: query.offset }));
  }

  async findById(id: string) {
    const order = await this.prisma.outboundOrder.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Outbound order not found.');
    return order;
  }

  async cancel(id: string, user: AuthPrincipal) {
    const order = await this.findById(id);
    if (order.status !== 'draft') {
      throw new InvalidStateException(
        `Outbound orders can only be cancelled while in draft (current: ${order.status}).`,
      );
    }
    const cancelled = await this.prisma.outboundOrder.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id },
      include: ORDER_INCLUDE,
    });
    this.realtime.emitOutboundOrderUpdated(cancelled.companyId, {
      orderId: cancelled.id,
      status: cancelled.status,
      reason: 'cancel',
    });
    return cancelled;
  }

  /**
   * Phase 1 simplified outbound flow: draft → (confirm) → shipped.
   * Stock validation already happened at create time; the FEFO walk and
   * per-row decrement guards still run as defence-in-depth in case stock
   * was drained between create and confirm.
   */
  /** Confirms a draft outbound order without stock deduction (workflow dispatch completes shipping). */
  async confirmWithoutDeduction(user: AuthPrincipal, orderId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.outboundOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: { product: { select: { status: true } } },
          },
        },
      });
      if (!order) throw new NotFoundException('Outbound order not found.');
      if (order.status !== 'draft') {
        throw new InvalidStateException(
          `Only draft orders can be confirmed (current: ${order.status}).`,
        );
      }
      if (order.lines.length === 0) {
        throw new BadRequestException('Cannot confirm an order with no lines.');
      }
      for (const line of order.lines) {
        assertProductOrderableForOrders(line.product.status);
      }
      return tx.outboundOrder.update({
        where: { id: orderId },
        data: {
          status: 'picking',
          confirmedAt: new Date(),
          pickingStartedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
    });
    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      reason: 'confirm_without_deduction',
    });
    return updated;
  }

  async confirmAndDeduct(user: AuthPrincipal, orderId: string, body?: ConfirmOutboundBodyDto) {
    if (taskOnlyFlows(this.config)) {
      if (!body?.warehouseId) {
        throw new BadRequestException(
          'When TASK_ONLY_FLOWS=true, confirm body must include warehouseId for workflow bootstrap.',
        );
      }
      await this.prisma.$transaction(async (tx) => {
        const wh = body.warehouseId!;
        const order = await tx.outboundOrder.findUnique({
          where: { id: orderId },
          include: {
            lines: {
              orderBy: { lineNumber: 'asc' },
              include: { product: { select: { status: true } } },
            },
          },
        });
        if (!order) throw new NotFoundException('Outbound order not found.');
        if (user.companyId && order.companyId !== user.companyId) {
          throw new NotFoundException('Outbound order not found.');
        }
        if (order.status !== 'draft') {
          throw new InvalidStateException(
            `Only draft orders can be confirmed (current status: ${order.status}).`,
          );
        }
        if (order.lines.length === 0) {
          throw new BadRequestException('Cannot confirm an order with no lines.');
        }
        for (const line of order.lines) {
          assertProductOrderableForOrders(line.product.status);
        }
        await tx.outboundOrder.update({
          where: { id: orderId },
          data: {
            status: 'picking',
            confirmedAt: new Date(),
            pickingStartedAt: new Date(),
          },
        });
        await this.workflowBootstrap.startOutboundWorkflowTx(tx, user, orderId, wh);
      });
      const wfConfirmed = await this.findById(orderId);
      this.realtime.emitOutboundOrderUpdated(wfConfirmed.companyId, {
        orderId: wfConfirmed.id,
        status: wfConfirmed.status,
        reason: 'confirm_task_flow',
      });
      return wfConfirmed;
    }
    if (outboundConfirmDefersDeduction(this.config)) {
      return this.confirmWithoutDeduction(user, orderId);
    }
    const shipped = await this.prisma.$transaction(async (tx) => {
      const order = await tx.outboundOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
            include: { product: { select: { status: true } } },
          },
        },
      });
      if (!order) throw new NotFoundException('Outbound order not found.');
      if (order.status !== 'draft') {
        throw new InvalidStateException(
          `Only draft orders can be confirmed (current: ${order.status}).`,
        );
      }
      if (order.lines.length === 0) {
        throw new BadRequestException('Cannot confirm an order with no lines.');
      }
      for (const line of order.lines) {
        assertProductOrderableForOrders(line.product.status);
      }

      for (const line of order.lines) {
        const requested = line.requestedQuantity;
        let remaining = new Prisma.Decimal(requested.toString());

        const candidates = await this.findStockCandidates(
          tx,
          order.companyId,
          line.productId,
          line.specificLotId,
        );

        for (const row of candidates) {
          if (remaining.lessThanOrEqualTo(0)) break;

          const take = Prisma.Decimal.min(remaining, row.quantityAvailable);
          if (take.lessThanOrEqualTo(0)) continue;

          const meta = await this.stock.decrementWithMeta(tx, {
            companyId: order.companyId,
            productId: line.productId,
            locationId: row.locationId,
            lotId: row.lotId,
            quantity: take.toString(),
          });

          await tx.inventoryLedger.create({
            data: {
              companyId: order.companyId,
              productId: line.productId,
              lotId: row.lotId,
              fromLocationId: row.locationId,
              movementType: 'outbound_pick',
              quantity: take,
              quantityBefore: meta.before,
              quantityAfter: meta.after,
              referenceType: 'outbound_order',
              referenceId: orderId,
              operatorId: user.id,
              idempotencyKey: `bm:outbound:${orderId}:${line.productId}:line:${line.id}:loc:${row.locationId}:lot:${row.lotId ?? 'null'}:${take.toString()}`,
            },
          });

          remaining = remaining.minus(take);
        }

        if (remaining.greaterThan(0)) {
          const agg = await tx.currentStock.aggregate({
            where: {
              companyId: order.companyId,
              productId: line.productId,
              status: 'available',
            },
            _sum: { quantityAvailable: true },
          });
          const available =
            agg._sum.quantityAvailable?.toString() ?? '0';
          throw new InsufficientStockException(
            `Insufficient stock. Available: ${available}`,
            [
              {
                productId: line.productId,
                requested: requested.toString(),
                available,
              },
            ],
          );
        }

        await tx.outboundOrderLine.update({
          where: { id: line.id },
          data: {
            pickedQuantity: requested,
            status: 'done',
          },
        });
      }

      return tx.outboundOrder.update({
        where: { id: orderId },
        data: {
          status: 'shipped',
          confirmedAt: new Date(),
          shippedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
    });
    this.realtime.emitOutboundOrderUpdated(shipped.companyId, {
      orderId: shipped.id,
      status: shipped.status,
      reason: 'confirm_and_deduct',
    });
    this.realtime.emitInventoryChanged(shipped.companyId, {
      source: 'outbound_ship',
      orderId: shipped.id,
    });
    return shipped;
  }

  private async findStockCandidates(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    specificLotId?: string | null,
  ): Promise<StockRow[]> {
    const lotFilter = specificLotId
      ? Prisma.sql`AND cs.lot_id = ${specificLotId}::uuid`
      : Prisma.empty;

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        product_id: string;
        location_id: string;
        warehouse_id: string;
        lot_id: string | null;
        quantity_available: string;
        expiry_date: Date | null;
        created_at: Date;
      }>
    >(Prisma.sql`
      SELECT cs.id,
             cs.product_id,
             cs.location_id,
             cs.warehouse_id,
             cs.lot_id,
             cs.quantity_available::text AS quantity_available,
             l.expiry_date,
             cs.last_movement_at AS created_at
        FROM current_stock cs
   LEFT JOIN lots l ON l.id = cs.lot_id
       WHERE cs.company_id = ${companyId}::uuid
         AND cs.product_id = ${productId}::uuid
         AND cs.status = 'available'
         AND cs.quantity_available > 0
         ${lotFilter}
    ORDER BY (l.expiry_date IS NULL),
             l.expiry_date ASC,
             cs.last_movement_at ASC NULLS LAST,
             cs.id ASC
    `);

    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      locationId: r.location_id,
      warehouseId: r.warehouse_id,
      lotId: r.lot_id,
      quantityAvailable: new Prisma.Decimal(r.quantity_available),
      expiryDate: r.expiry_date,
      createdAt: r.created_at,
    }));
  }
}
