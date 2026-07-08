import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OmsCodStatus, OutboundOrderStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { RealtimeService } from '../realtime/realtime.service';
import { adminOutboundListItem } from '../realtime/realtime-client.payload';
import { OutboundService } from '../outbound/outbound.service';
import { CreateOutboundOrderDto } from '../outbound/dto/create-outbound.dto';
import { AllocateOmsOrderDto, CreateOmsOrderDto, UpdateOmsOrderDto } from './dto/oms-order.dto';
import { OmsOrderEventsService } from './oms-order-events.service';
import { composeDestinationAddress, serializeOmsOrder } from './oms-order.mapper';
import type { OmsOrderCreateExtras } from './oms-order.types';
import { OrderAllocationService } from './order-allocation.service';

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

@Injectable()
export class OmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
    private readonly companyAccess: CompanyAccessService,
    private readonly allocation: OrderAllocationService,
    private readonly events: OmsOrderEventsService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditLogService,
  ) {}

  async create(user: AuthPrincipal, dto: CreateOmsOrderDto) {
    const destination = composeDestinationAddress(dto);
    if (!destination) {
      throw new BadRequestException('Destination address or structured address is required.');
    }

    const wmsDto: CreateOutboundOrderDto = {
      companyId: dto.companyId,
      destinationAddress: destination,
      requiredShipDate: dto.requiredShipDate,
      carrier: dto.carrier,
      clientReference: dto.clientReference,
      notes: dto.notes,
      requiresPacking: dto.requiresPacking,
      lines: dto.lines.map((l) => ({
        productId: l.productId,
        requestedQuantity: l.requestedQuantity,
        specificLotId: l.specificLotId,
      })),
    };

    const oms: OmsOrderCreateExtras = {
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      city: dto.city,
      district: dto.district,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      deliveryInstructions: dto.deliveryInstructions,
      paymentMethod: dto.paymentMethod,
      subtotal: dto.subtotal,
      shippingFee: dto.shippingFee,
      codAmount: dto.codAmount,
      currency: dto.currency,
      warehouseId: dto.warehouseId,
      lineExtras: dto.lines.map((l) => ({
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        discountAmount: l.discountAmount,
      })),
      recordOmsEvent: true,
      allocateAfterCreate: true,
    };

    const order = await this.outbound.create(user, wmsDto, { oms });
    this.emitOms('order.created', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async findById(id: string, user: AuthPrincipal) {
    const order = await this.outbound.findById(id, user);
    const timeline = await this.events.listForOrder(id);
    const reservations = await this.prisma.stockReservation.findMany({
      where: { outboundOrderId: id },
      orderBy: { createdAt: 'asc' },
    });
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
    const existing = await this.outbound.findById(id, user);
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

    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.outboundOrder.update({
        where: { id },
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
          notes: dto.notes,
          paymentMethod: dto.paymentMethod,
          subtotal:
            dto.subtotal != null ? new Prisma.Decimal(dto.subtotal) : undefined,
          shippingFee:
            dto.shippingFee != null ? new Prisma.Decimal(dto.shippingFee) : undefined,
          codAmount:
            dto.codAmount != null ? new Prisma.Decimal(dto.codAmount) : undefined,
          currency: dto.currency,
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        outboundOrderId: id,
        companyId: row.companyId,
        eventType: 'order.updated',
        createdBy: user.id,
      });
      return row;
    });

    this.emitOms('order.updated', updated.companyId, updated.id, updated.status);
    return serializeOmsOrder(updated);
  }

  async cancel(id: string, user: AuthPrincipal) {
    const order = await this.outbound.cancel(id, user);
    this.emitOms('order.cancelled', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async allocate(id: string, user: AuthPrincipal, dto: AllocateOmsOrderDto) {
    const order = await withTenantRls(this.prisma, user, async (tx) => {
      await this.allocation.assertAllocatable(tx, id);
      const full = await tx.outboundOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!full) throw new NotFoundException('Order not found.');
      this.companyAccess.validateResourceOwnership(user, full);

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

      return tx.outboundOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
    });

    if (!order) throw new NotFoundException('Order not found.');
    this.emitOms('order.allocated', order.companyId, order.id, order.status);
    this.emitOms('inventory.allocated', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async releaseAllocation(id: string, user: AuthPrincipal) {
    const order = await withTenantRls(this.prisma, user, async (tx) => {
      const full = await tx.outboundOrder.findUnique({ where: { id } });
      if (!full) throw new NotFoundException('Order not found.');
      this.companyAccess.validateResourceOwnership(user, full);
      await this.allocation.releaseAllocation(tx, {
        outboundOrderId: id,
        companyId: full.companyId,
        actorUserId: user.id,
      });
      return tx.outboundOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
    });
    if (!order) throw new NotFoundException('Order not found.');
    this.emitOms('inventory.released', order.companyId, order.id, order.status);
    return serializeOmsOrder(order);
  }

  async markOutForDelivery(id: string, user: AuthPrincipal) {
    return this.transition(id, user, {
      allowed: [
        OutboundOrderStatus.ready_to_ship,
        OutboundOrderStatus.shipped,
        OutboundOrderStatus.allocated,
        OutboundOrderStatus.packing,
      ],
      next: OutboundOrderStatus.out_for_delivery,
      event: 'order.out_for_delivery',
      extra: { outForDeliveryAt: new Date() },
    });
  }

  async markDelivered(id: string, user: AuthPrincipal) {
    return this.transition(id, user, {
      allowed: [
        OutboundOrderStatus.out_for_delivery,
        OutboundOrderStatus.shipped,
        OutboundOrderStatus.ready_to_ship,
      ],
      next: OutboundOrderStatus.delivered,
      event: 'order.delivered',
      extra: { deliveredAt: new Date() },
    });
  }

  async markReturned(id: string, user: AuthPrincipal) {
    return this.transition(id, user, {
      allowed: [
        OutboundOrderStatus.delivered,
        OutboundOrderStatus.out_for_delivery,
        OutboundOrderStatus.shipped,
      ],
      next: OutboundOrderStatus.returned,
      event: 'order.returned',
      extra: { returnedAt: new Date() },
    });
  }

  async collectCod(id: string, user: AuthPrincipal) {
    const order = await this.outbound.findById(id, user);
    if (order.paymentMethod !== 'COD') {
      throw new BadRequestException('Order is not COD.');
    }
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.outboundOrder.update({
        where: { id },
        data: {
          codStatus: OmsCodStatus.collected,
          codCollectedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        outboundOrderId: id,
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
    const order = await this.outbound.findById(id, user);
    if (order.paymentMethod !== 'COD') {
      throw new BadRequestException('Order is not COD.');
    }
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const row = await tx.outboundOrder.update({
        where: { id },
        data: {
          codStatus: OmsCodStatus.settled,
          codRemittedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        outboundOrderId: id,
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
    await this.outbound.findById(id, user);
    return this.events.listForOrder(id);
  }

  private async transition(
    id: string,
    user: AuthPrincipal,
    opts: {
      allowed: OutboundOrderStatus[];
      next: OutboundOrderStatus;
      event: string;
      extra: Prisma.OutboundOrderUpdateInput;
    },
  ) {
    const updated = await withTenantRls(this.prisma, user, async (tx) => {
      const cur = await tx.outboundOrder.findUnique({ where: { id } });
      if (!cur) throw new NotFoundException('Order not found.');
      this.companyAccess.validateResourceOwnership(user, cur);
      if (!opts.allowed.includes(cur.status)) {
        throw new InvalidStateException(
          `Cannot transition from ${cur.status} to ${opts.next}.`,
        );
      }
      const row = await tx.outboundOrder.update({
        where: { id },
        data: { status: opts.next, ...opts.extra },
        include: ORDER_INCLUDE,
      });
      await this.events.record(tx, {
        outboundOrderId: id,
        companyId: row.companyId,
        eventType: opts.event,
        createdBy: user.id,
      });
      return row;
    });

    this.emitOms(opts.event, updated.companyId, updated.id, updated.status);
    this.realtime.emitOutboundOrderUpdated(updated.companyId, {
      orderId: updated.id,
      status: updated.status,
      listItem: adminOutboundListItem(updated),
      reason: opts.event,
    });
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
