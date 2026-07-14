import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OmsCodStatus,
  OmsOrderStatus,
  OutboundOrderStatus,
  Prisma,
} from '@prisma/client';

import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { assertDiscreteUomPositiveIntegerQuantity } from '../../common/utils/discrete-uom-quantity';
import { assertCalendarDateNotBeforeToday } from '../../common/utils/order-planning-date';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import { RealtimeService } from '../realtime/realtime.service';
import { adminOutboundListItem } from '../realtime/realtime-client.payload';
import { OutboundService } from '../outbound/outbound.service';
import { AllocateOmsOrderDto, CreateOmsOrderDto, UpdateOmsOrderDto } from './dto/oms-order.dto';
import { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';
import { OmsOrderEventsService } from './oms-order-events.service';
import {
  composeDestinationAddress,
  deriveCodStatus,
  mapOutboundStatusToOms,
  serializeOmsOrder,
  serializeOmsOrderListItem,
} from './oms-order.mapper';
import { OrderAllocationService } from './order-allocation.service';

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ORDER_INCLUDE = {
  company: { select: { id: true, name: true } },
  outboundOrder: { select: { id: true, orderNumber: true, status: true } },
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
} satisfies Prisma.OmsOrderInclude;

@Injectable()
export class OmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
    private readonly companyAccess: CompanyAccessService,
    private readonly allocation: OrderAllocationService,
    private readonly events: OmsOrderEventsService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(user: AuthPrincipal, query: ListOmsOrdersQueryDto) {
    const where: Prisma.OmsOrderWhereInput = {};
    const andParts: Prisma.OmsOrderWhereInput[] = [];

    const companyId = readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);
    if (companyId) where.companyId = companyId;
    if (query.status) where.status = query.status;
    if (query.storeChannel?.trim()) {
      where.storeChannel = { contains: query.storeChannel.trim(), mode: 'insensitive' };
    }
    if (query.linkStatus === 'linked') where.outboundOrderId = { not: null };
    if (query.linkStatus === 'unlinked') where.outboundOrderId = null;

    if (query.orderSearch?.trim()) {
      const t = query.orderSearch.trim();
      const orParts: Prisma.OmsOrderWhereInput[] = [
        { orderNumber: { contains: t, mode: 'insensitive' } },
        { recipientName: { contains: t, mode: 'insensitive' } },
        { clientReference: { contains: t, mode: 'insensitive' } },
      ];
      if (FULL_UUID.test(t)) orParts.push({ id: t });
      andParts.push({ OR: orParts });
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    if (andParts.length > 0) where.AND = andParts;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total] = await Promise.all([
        tx.omsOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: ORDER_INCLUDE,
          take: query.limit,
          skip: query.offset,
        }),
        tx.omsOrder.count({ where }),
      ]);
      return {
        items: items.map(serializeOmsOrderListItem),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async create(user: AuthPrincipal, dto: CreateOmsOrderDto) {
    if (!dto.outboundOrderId) {
      throw new BadRequestException('Outbound order link is required.');
    }

    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');

    await this.assertOutboundLinkable(user, dto.outboundOrderId, companyId);

    let destination = composeDestinationAddress(dto);
    if (!destination) {
      const linked = await this.outbound.findById(dto.outboundOrderId, user);
      destination = linked.destinationAddress?.trim() || 'Linked outbound order';
    }

    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, companyId: true, status: true, uom: true },
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
    for (const p of products) assertProductOrderableForOrders(p.status);
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const l of dto.lines) {
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.requestedQuantity, 'Requested quantity');
    }

    const linesWithTotals = dto.lines.map((l) => {
      const qty = new Prisma.Decimal(l.requestedQuantity);
      const unitPrice =
        l.unitPrice != null ? new Prisma.Decimal(l.unitPrice) : null;
      const lineTotal =
        l.lineTotal != null
          ? new Prisma.Decimal(l.lineTotal)
          : unitPrice != null
            ? unitPrice.mul(qty)
            : null;
      return { ...l, qty, unitPrice, lineTotal };
    });

    const linesSum = linesWithTotals.reduce(
      (sum, l) => (l.lineTotal != null ? sum.add(l.lineTotal) : sum),
      new Prisma.Decimal(0),
    );
    const shippingFee =
      dto.shippingFee != null ? new Prisma.Decimal(dto.shippingFee) : new Prisma.Decimal(0);
    // Subtotal = shipping fee + sum of each line total (price × qty).
    const subtotal = linesSum.add(shippingFee);
    const derivedCod =
      dto.codAmount != null
        ? new Prisma.Decimal(dto.codAmount)
        : dto.paymentMethod === 'COD'
          ? subtotal
          : null;

    const codStatus = deriveCodStatus(dto.paymentMethod, derivedCod);

    const order = await withTenantRls(this.prisma, user, async (tx) => {
      const created = await tx.omsOrder.create({
        data: {
          companyId,
          outboundOrderId: dto.outboundOrderId,
          destinationAddress: destination,
          requiredShipDate: new Date(dto.requiredShipDate),
          carrier: dto.carrier,
          clientReference: dto.clientReference,
          notes: dto.notes,
          requiresPacking: dto.requiresPacking !== false,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          city: dto.city,
          district: dto.district,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          deliveryInstructions: dto.deliveryInstructions,
          paymentMethod: dto.paymentMethod,
          subtotal,
          shippingFee: dto.shippingFee != null ? shippingFee : undefined,
          codAmount: derivedCod ?? undefined,
          currency: dto.currency ?? 'SYP',
          codStatus: codStatus ?? undefined,
          storeChannel: dto.storeChannel,
          externalReference: dto.externalReference,
          createdBy: user.id,
          lines: {
            create: linesWithTotals.map((l, idx) => ({
              productId: l.productId,
              requestedQuantity: l.qty,
              specificLotId: l.specificLotId,
              lineNumber: idx + 1,
              unitPrice: l.unitPrice ?? undefined,
              lineTotal: l.lineTotal ?? undefined,
              discountAmount:
                l.discountAmount != null ? new Prisma.Decimal(l.discountAmount) : undefined,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      await this.events.record(tx, {
        omsOrderId: created.id,
        outboundOrderId: created.outboundOrderId ?? undefined,
        companyId: created.companyId,
        eventType: 'order.created',
        createdBy: user.id,
        payload: { linkedOutbound: !!created.outboundOrderId },
      });

      if (
        created.outboundOrderId &&
        this.allocation.isEnabled() &&
        dto.warehouseId
      ) {
        await this.allocateLinkedOutbound(tx, user, created.id, created.outboundOrderId, {
          warehouseId: dto.warehouseId,
        });
        return tx.omsOrder.findUnique({ where: { id: created.id }, include: ORDER_INCLUDE });
      }

      return created;
    });

    if (!order) throw new NotFoundException('Order not found.');
    this.emitOms('order.created', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async findById(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    const timeline = await this.events.listForOrder(order.id);
    const reservations = order.outboundOrderId
      ? await this.prisma.stockReservation.findMany({
          where: { outboundOrderId: order.outboundOrderId },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    return {
      ...serializeOmsOrder(order),
      timeline,
      reservations: reservations.map((r) => ({
        ...r,
        quantity: r.quantity.toString(),
      })),
    };
  }

  async update(id: string, user: AuthPrincipal, dto: UpdateOmsOrderDto) {
    const existing = await this.resolveOrder(id, user);
    const destination =
      dto.destinationAddress !== undefined
        ? composeDestinationAddress({
            destinationAddress: dto.destinationAddress,
            addressLine1: dto.addressLine1 ?? existing.addressLine1 ?? undefined,
            addressLine2: dto.addressLine2 ?? existing.addressLine2 ?? undefined,
            district: dto.district ?? existing.district ?? undefined,
            city: dto.city ?? existing.city ?? undefined,
          })
        : undefined;

    if (dto.outboundOrderId) {
      await this.assertOutboundLinkable(user, dto.outboundOrderId, existing.companyId, existing.id);
    }

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const nextPayment = dto.paymentMethod ?? existing.paymentMethod;
      const nextShipping =
        dto.shippingFee != null
          ? new Prisma.Decimal(dto.shippingFee)
          : (existing.shippingFee ?? new Prisma.Decimal(0));

      const linesSum = existing.lines.reduce((sum, l) => {
        if (l.lineTotal != null) return sum.add(l.lineTotal);
        if (l.unitPrice != null) {
          return sum.add(l.unitPrice.mul(l.requestedQuantity));
        }
        return sum;
      }, new Prisma.Decimal(0));

      // Subtotal = shipping fee + sum of line totals (always recalculated).
      const nextSubtotal =
        dto.subtotal != null
          ? new Prisma.Decimal(dto.subtotal)
          : linesSum.add(nextShipping);

      const nextCod =
        dto.codAmount != null
          ? new Prisma.Decimal(dto.codAmount)
          : nextPayment === 'COD' &&
              (dto.paymentMethod !== undefined ||
                dto.subtotal !== undefined ||
                dto.shippingFee !== undefined)
            ? nextSubtotal
            : undefined;

      const row = await tx.omsOrder.update({
        where: { id: existing.id },
        data: {
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          city: dto.city,
          district: dto.district,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          deliveryInstructions: dto.deliveryInstructions,
          ...(destination ? { destinationAddress: destination } : {}),
          requiredShipDate: dto.requiredShipDate
            ? new Date(dto.requiredShipDate)
            : undefined,
          carrier: dto.carrier,
          trackingNumber: dto.trackingNumber,
          clientReference: dto.clientReference,
          notes: dto.notes,
          paymentMethod: dto.paymentMethod,
          subtotal: nextSubtotal,
          shippingFee:
            dto.shippingFee != null ? new Prisma.Decimal(dto.shippingFee) : undefined,
          ...(nextCod !== undefined ? { codAmount: nextCod } : {}),
          ...(dto.paymentMethod !== undefined
            ? {
                codStatus:
                  deriveCodStatus(nextPayment, nextCod ?? existing.codAmount) ??
                  (nextPayment === 'COD' ? existing.codStatus : null),
              }
            : {}),
          currency: dto.currency,
          storeChannel: dto.storeChannel,
          externalReference: dto.externalReference,
          ...(dto.outboundOrderId !== undefined
            ? { outboundOrderId: dto.outboundOrderId }
            : {}),
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: row.id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: dto.outboundOrderId === null ? 'warehouse.unlinked' : 'order.updated',
        createdBy: user.id,
        payload:
          dto.outboundOrderId !== undefined
            ? { outboundOrderId: dto.outboundOrderId }
            : undefined,
      });
      return row;
    });

    this.emitOms('order.updated', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async delete(id: string, user: AuthPrincipal) {
    const existing = await this.resolveOrder(id, user);
    await withTenantRls(this.prisma, user, async (tx) => {
      await tx.omsOrder.delete({ where: { id: existing.id } });
    });
    this.emitOms('order.deleted', existing.companyId, existing.id, existing.status);
    return { ok: true };
  }

  async cancel(id: string, user: AuthPrincipal) {
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const cur = await tx.omsOrder.findUnique({ where: { id } });
      if (!cur) throw new NotFoundException('Order not found.');
      this.companyAccess.validateResourceOwnership(user, cur);
      if (cur.status === OmsOrderStatus.cancelled) {
        throw new InvalidStateException('Order is already cancelled.');
      }
      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          status: OmsOrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelledBy: user.id,
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: 'order.cancelled',
        createdBy: user.id,
      });
      return row;
    });
    this.emitOms('order.cancelled', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async allocate(id: string, user: AuthPrincipal, dto: AllocateOmsOrderDto) {
    const order = await this.resolveOrder(id, user);
    if (!order.outboundOrderId) {
      throw new BadRequestException('Link an outbound order before allocating inventory.');
    }
    await withTenantRls(this.prisma, user, async (tx) => {
      await this.allocateLinkedOutbound(tx, user, order.id, order.outboundOrderId!, dto);
    });
    const fresh = await this.resolveOrder(id, user);
    this.emitOms('order.allocated', fresh.companyId, fresh.id, fresh.status);
    this.emitOms('inventory.allocated', fresh.companyId, fresh.id, fresh.status);
    return serializeOmsOrder(fresh);
  }

  async releaseAllocation(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    if (!order.outboundOrderId) {
      throw new BadRequestException('No linked outbound order.');
    }
    await withTenantRls(this.prisma, user, async (tx) => {
      const full = await tx.outboundOrder.findUnique({ where: { id: order.outboundOrderId! } });
      if (!full) throw new NotFoundException('Linked outbound order not found.');
      await this.allocation.releaseAllocation(tx, {
        outboundOrderId: order.outboundOrderId!,
        companyId: full.companyId,
        actorUserId: user.id,
      });
      await tx.omsOrder.update({
        where: { id: order.id },
        data: { allocationStatus: 'released' },
      });
      await this.events.record(tx, {
        omsOrderId: order.id,
        outboundOrderId: order.outboundOrderId!,
        companyId: order.companyId,
        eventType: 'inventory.released',
        createdBy: user.id,
      });
    });
    const fresh = await this.resolveOrder(id, user);
    this.emitOms('inventory.released', fresh.companyId, fresh.id, fresh.status);
    return serializeOmsOrder(fresh);
  }

  async markOutForDelivery(id: string, user: AuthPrincipal) {
    return this.transition(id, user, {
      allowed: [
        OmsOrderStatus.ready_to_ship,
        OmsOrderStatus.shipped,
        OmsOrderStatus.allocated,
        OmsOrderStatus.processing,
      ],
      next: OmsOrderStatus.out_for_delivery,
      event: 'order.out_for_delivery',
      extra: { outForDeliveryAt: new Date() },
      outboundAllowed: [
        OutboundOrderStatus.ready_to_ship,
        OutboundOrderStatus.shipped,
        OutboundOrderStatus.allocated,
        OutboundOrderStatus.packing,
      ],
      outboundNext: OutboundOrderStatus.out_for_delivery,
    });
  }

  async markDelivered(id: string, user: AuthPrincipal) {
    return this.transition(id, user, {
      allowed: [
        OmsOrderStatus.out_for_delivery,
        OmsOrderStatus.shipped,
        OmsOrderStatus.ready_to_ship,
      ],
      next: OmsOrderStatus.delivered,
      event: 'order.delivered',
      extra: { deliveredAt: new Date() },
      outboundAllowed: [
        OutboundOrderStatus.out_for_delivery,
        OutboundOrderStatus.shipped,
        OutboundOrderStatus.ready_to_ship,
      ],
      outboundNext: OutboundOrderStatus.delivered,
    });
  }

  async markReturned(id: string, user: AuthPrincipal) {
    return this.transition(id, user, {
      allowed: [
        OmsOrderStatus.delivered,
        OmsOrderStatus.out_for_delivery,
        OmsOrderStatus.shipped,
      ],
      next: OmsOrderStatus.returned,
      event: 'order.returned',
      extra: { returnedAt: new Date() },
      outboundAllowed: [
        OutboundOrderStatus.delivered,
        OutboundOrderStatus.out_for_delivery,
        OutboundOrderStatus.shipped,
      ],
      outboundNext: OutboundOrderStatus.returned,
    });
  }

  async collectCod(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    if (order.paymentMethod !== 'COD') {
      throw new BadRequestException('Order is not COD.');
    }
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          codStatus: OmsCodStatus.collected,
          codCollectedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: 'cod.collected',
        createdBy: user.id,
      });
      return row;
    });
    this.emitOms('cod.collected', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async settleCod(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    if (order.paymentMethod !== 'COD') {
      throw new BadRequestException('Order is not COD.');
    }
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.omsOrder.update({
        where: { id },
        data: {
          codStatus: OmsCodStatus.settled,
          codRemittedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: 'cod.remitted',
        createdBy: user.id,
        payload: { settled: true },
      });
      return row;
    });
    this.emitOms('cod.remitted', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async timeline(id: string, user: AuthPrincipal) {
    const order = await this.resolveOrder(id, user);
    return this.events.listForOrder(order.id);
  }

  /** Called from outbound.create when OMS extras are supplied — keeps legacy path working. */
  async mirrorFromOutbound(
    tx: Prisma.TransactionClient,
    params: {
      outbound: {
        id: string;
        companyId: string;
        createdBy: string;
        destinationAddress: string;
        requiredShipDate: Date;
        carrier: string | null;
        clientReference: string | null;
        notes: string | null;
        requiresPacking: boolean;
        recipientName: string | null;
        recipientPhone: string | null;
        city: string | null;
        district: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        deliveryInstructions: string | null;
        paymentMethod: string | null;
        subtotal: Prisma.Decimal | null;
        shippingFee: Prisma.Decimal | null;
        codAmount: Prisma.Decimal | null;
        currency: string | null;
        codStatus: string | null;
        allocationStatus: string;
        storeChannel: string | null;
        externalReference: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      };
      lines: Array<{
        productId: string;
        requestedQuantity: Prisma.Decimal;
        specificLotId: string | null;
        lineNumber: number;
        unitPrice: Prisma.Decimal | null;
        lineTotal: Prisma.Decimal | null;
        discountAmount: Prisma.Decimal | null;
      }>;
      actorUserId: string;
      recordEvent?: boolean;
    },
  ) {
    const o = params.outbound;
    const created = await tx.omsOrder.create({
      data: {
        companyId: o.companyId,
        outboundOrderId: o.id,
        destinationAddress: o.destinationAddress,
        requiredShipDate: o.requiredShipDate,
        carrier: o.carrier,
        clientReference: o.clientReference,
        notes: o.notes,
        requiresPacking: o.requiresPacking,
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        city: o.city,
        district: o.district,
        addressLine1: o.addressLine1,
        addressLine2: o.addressLine2,
        deliveryInstructions: o.deliveryInstructions,
        paymentMethod: o.paymentMethod as never,
        subtotal: o.subtotal ?? undefined,
        shippingFee: o.shippingFee ?? undefined,
        codAmount: o.codAmount ?? undefined,
        currency: o.currency ?? 'SYP',
        codStatus: o.codStatus as never,
        allocationStatus: o.allocationStatus as never,
        storeChannel: o.storeChannel,
        externalReference: o.externalReference,
        status: mapOutboundStatusToOms(o.status),
        createdBy: o.createdBy,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        lines: {
          create: params.lines.map((line) => ({
            productId: line.productId,
            requestedQuantity: line.requestedQuantity,
            specificLotId: line.specificLotId,
            lineNumber: line.lineNumber,
            unitPrice: line.unitPrice ?? undefined,
            lineTotal: line.lineTotal ?? undefined,
            discountAmount: line.discountAmount ?? undefined,
          })),
        },
      },
    });

    if (params.recordEvent !== false) {
      await this.events.record(tx, {
        omsOrderId: created.id,
        outboundOrderId: o.id,
        companyId: o.companyId,
        eventType: 'order.created',
        createdBy: params.actorUserId,
        payload: { source: 'wms-outbound' },
      });
    }

    return created;
  }

  private async resolveOrder(id: string, user: AuthPrincipal) {
    return withTenantRls(this.prisma, user, async (tx) => {
      let order = await tx.omsOrder.findUnique({
        where: { id },
        include: ORDER_INCLUDE,
      });
      if (!order) {
        order = await tx.omsOrder.findFirst({
          where: { outboundOrderId: id },
          include: ORDER_INCLUDE,
        });
      }
      if (!order) throw new NotFoundException('OMS order not found.');
      this.companyAccess.validateResourceOwnership(user, order);
      return order;
    });
  }

  private async assertOutboundLinkable(
    user: AuthPrincipal,
    outboundOrderId: string,
    companyId: string,
    excludeOmsOrderId?: string,
  ) {
    const outbound = await this.outbound.findById(outboundOrderId, user);
    if (outbound.companyId !== companyId) {
      throw new BadRequestException('Outbound order must belong to the same company.');
    }
    const existing = await this.prisma.omsOrder.findFirst({
      where: {
        outboundOrderId,
        ...(excludeOmsOrderId ? { NOT: { id: excludeOmsOrderId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Outbound order is already linked to another OMS order.');
    }
  }

  private async allocateLinkedOutbound(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    omsOrderId: string,
    outboundOrderId: string,
    dto: AllocateOmsOrderDto,
  ) {
    await this.allocation.assertAllocatable(tx, outboundOrderId);
    const full = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      include: { lines: true },
    });
    if (!full) throw new NotFoundException('Linked outbound order not found.');

    await this.allocation.allocateOrder(tx, {
      outboundOrderId: full.id,
      companyId: full.companyId,
      warehouseId: dto.warehouseId,
      actorUserId: user.id,
      previousStatus: full.status,
      lines: full.lines.map((line) => ({
        outboundOrderLineId: line.id,
        productId: line.productId,
        requestedQty: line.requestedQuantity,
        specificLotId: line.specificLotId,
      })),
    });

    await tx.omsOrder.update({
      where: { id: omsOrderId },
      data: {
        allocationStatus: 'allocated',
        allocatedAt: new Date(),
        status: OmsOrderStatus.allocated,
      },
    });
    await this.events.record(tx, {
      omsOrderId,
      outboundOrderId,
      companyId: full.companyId,
      eventType: 'order.allocated',
      createdBy: user.id,
    });
  }

  private async transition(
    id: string,
    user: AuthPrincipal,
    opts: {
      allowed: OmsOrderStatus[];
      next: OmsOrderStatus;
      event: string;
      extra: Prisma.OmsOrderUpdateInput;
      outboundAllowed?: OutboundOrderStatus[];
      outboundNext?: OutboundOrderStatus;
    },
  ) {
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const cur = await tx.omsOrder.findUnique({ where: { id } });
      if (!cur) throw new NotFoundException('Order not found.');
      this.companyAccess.validateResourceOwnership(user, cur);
      if (!opts.allowed.includes(cur.status)) {
        throw new InvalidStateException(
          `Cannot transition from ${cur.status} to ${opts.next}.`,
        );
      }

      if (
        cur.outboundOrderId &&
        opts.outboundAllowed &&
        opts.outboundNext
      ) {
        const outbound = await tx.outboundOrder.findUnique({
          where: { id: cur.outboundOrderId },
        });
        if (outbound && opts.outboundAllowed.includes(outbound.status)) {
          await tx.outboundOrder.update({
            where: { id: cur.outboundOrderId },
            data: { status: opts.outboundNext },
          });
          this.realtime.emitOutboundOrderUpdated(outbound.companyId, {
            orderId: outbound.id,
            status: opts.outboundNext,
            listItem: adminOutboundListItem({ ...outbound, status: opts.outboundNext }),
            reason: opts.event,
          });
        }
      }

      const row = await tx.omsOrder.update({
        where: { id },
        data: { status: opts.next, ...opts.extra },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        omsOrderId: id,
        outboundOrderId: row.outboundOrderId ?? undefined,
        companyId: row.companyId,
        eventType: opts.event,
        createdBy: user.id,
      });
      return row;
    });

    this.emitOms(opts.event, updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  private emitOms(
    event: string,
    companyId: string,
    orderId: string,
    status: string,
  ): void {
    this.realtime.emitOmsOrderEvent(companyId, { orderId, status, event });
  }
}
