import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OmsOrderStatus, OutboundOrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  composeDestinationAddress,
  mapOutboundStatusToOms,
  omsEventTypeForStatus,
} from './oms-order.mapper';
import { OmsOrderEventsService } from './oms-order-events.service';
import { OrderAllocationService } from './order-allocation.service';

type Tx = Prisma.TransactionClient;

/** Terminal commercial OMS states — warehouse sync must not overwrite. */
const TERMINAL_OMS: OmsOrderStatus[] = [
  OmsOrderStatus.rejected,
  OmsOrderStatus.cancelled,
  OmsOrderStatus.completed,
  OmsOrderStatus.delivered,
  OmsOrderStatus.failed_delivery,
];

@Injectable()
export class OmsOutboundSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OmsOrderEventsService,
    private readonly allocation: OrderAllocationService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * Sync OMS from linked outbound. Only terminal outbound → Out for Delivery
   * (or cancel). No picking/packing/shipped mirroring onto OMS.
   */
  async syncFromOutbound(
    tx: Tx,
    outboundOrderId: string,
    actorUserId?: string,
  ): Promise<void> {
    const oms = await tx.omsOrder.findFirst({
      where: { outboundOrderId },
      select: {
        id: true,
        companyId: true,
        status: true,
        outboundOrderId: true,
      },
    });
    if (!oms) return;
    if (TERMINAL_OMS.includes(oms.status)) return;

    const outbound = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { id: true, status: true },
    });
    if (!outbound) return;

    const next = mapOutboundStatusToOms(outbound.status);
    if (next == null || next === oms.status) return;

    if (
      oms.status === OmsOrderStatus.pending_approval ||
      oms.status === OmsOrderStatus.rejected ||
      oms.status === OmsOrderStatus.draft
    ) {
      return;
    }

    const extra: Prisma.OmsOrderUpdateInput = {};
    if (next === OmsOrderStatus.out_for_delivery) {
      extra.outForDeliveryAt = new Date();
    }

    await tx.omsOrder.update({
      where: { id: oms.id },
      data: { status: next, ...extra },
    });

    const eventType =
      next === OmsOrderStatus.out_for_delivery
        ? 'oms.out_for_delivery'
        : omsEventTypeForStatus(next);

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId,
      companyId: oms.companyId,
      eventType,
      createdBy: actorUserId,
      payload: { source: 'wms_sync', outboundStatus: outbound.status, omsStatus: next },
    });

    this.realtime?.emitOmsOrderEvent(oms.companyId, {
      orderId: oms.id,
      status: next,
      event: eventType,
    });
  }

  async syncFromOutboundStandalone(
    outboundOrderId: string,
    actorUserId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.syncFromOutbound(tx, outboundOrderId, actorUserId);
    });
  }

  /**
   * Create draft outbound from OMS and set commercial status to Pending.
   * Idempotent when outbound already linked.
   */
  async createOutboundFromOms(
    tx: Tx,
    params: {
      omsOrderId: string;
      actorUserId: string;
    },
  ): Promise<{ outboundOrderId: string; orderNumber: string }> {
    const oms = await tx.omsOrder.findUnique({
      where: { id: params.omsOrderId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!oms) throw new NotFoundException('OMS order not found.');
    if (oms.outboundOrderId) {
      const existing = await tx.outboundOrder.findUnique({
        where: { id: oms.outboundOrderId },
        select: { id: true, orderNumber: true },
      });
      if (existing) {
        if (oms.status !== OmsOrderStatus.pending) {
          await tx.omsOrder.update({
            where: { id: oms.id },
            data: { status: OmsOrderStatus.pending },
          });
        }
        return { outboundOrderId: existing.id, orderNumber: existing.orderNumber };
      }
    }
    if (oms.lines.length === 0) {
      throw new BadRequestException('OMS order has no lines.');
    }

    const destination =
      composeDestinationAddress({
        destinationAddress: oms.destinationAddress,
        addressLine1: oms.addressLine1 ?? undefined,
        addressLine2: oms.addressLine2 ?? undefined,
        district: oms.district ?? undefined,
        city: oms.city ?? undefined,
      }) || oms.destinationAddress || 'OMS order';

    const created = await tx.outboundOrder.create({
      data: {
        companyId: oms.companyId,
        status: OutboundOrderStatus.draft,
        destinationAddress: destination,
        requiredShipDate: oms.requiredShipDate,
        carrier: oms.carrier,
        clientReference: oms.clientReference,
        notes: oms.notes,
        requiresPacking: oms.requiresPacking,
        createdBy: params.actorUserId,
        recipientName: oms.recipientName,
        recipientPhone: oms.recipientPhone,
        city: oms.city,
        district: oms.district,
        addressLine1: oms.addressLine1,
        addressLine2: oms.addressLine2,
        deliveryInstructions: oms.deliveryInstructions,
        paymentMethod: oms.paymentMethod,
        subtotal: oms.subtotal ?? undefined,
        shippingFee: oms.shippingFee ?? undefined,
        codAmount: oms.codAmount ?? undefined,
        currency: oms.currency ?? 'SYP',
        codStatus: oms.codStatus ?? undefined,
        storeChannel: oms.storeChannel,
        externalReference: oms.externalReference,
        lines: {
          create: oms.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: l.requestedQuantity,
            specificLotId: l.specificLotId,
            lineNumber: l.lineNumber,
            unitPrice: l.unitPrice ?? undefined,
            lineTotal: l.lineTotal ?? undefined,
            discountAmount: l.discountAmount ?? undefined,
          })),
        },
      },
      include: { lines: true },
    });

    if (this.allocation.isEnabled()) {
      await this.allocation.allocateOrder(tx, {
        outboundOrderId: created.id,
        companyId: oms.companyId,
        actorUserId: params.actorUserId,
        previousStatus: created.status,
        lines: created.lines.map((line) => ({
          outboundOrderLineId: line.id,
          productId: line.productId,
          requestedQty: line.requestedQuantity,
          specificLotId: line.specificLotId,
        })),
      });
    }

    await tx.omsOrder.update({
      where: { id: oms.id },
      data: {
        outboundOrderId: created.id,
        status: OmsOrderStatus.pending,
        approvedAt: new Date(),
        approvedBy: params.actorUserId,
        confirmedAt: new Date(),
      },
    });

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId: created.id,
      companyId: oms.companyId,
      eventType: 'oms.approved',
      createdBy: params.actorUserId,
      payload: { outboundOrderId: created.id, outboundOrderNumber: created.orderNumber },
    });

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId: created.id,
      companyId: oms.companyId,
      eventType: 'outbound.created',
      createdBy: params.actorUserId,
      payload: { outboundOrderId: created.id, outboundOrderNumber: created.orderNumber },
    });

    this.realtime?.emitOmsOrderEvent(oms.companyId, {
      orderId: oms.id,
      status: OmsOrderStatus.pending,
      event: 'oms.approved',
    });

    return { outboundOrderId: created.id, orderNumber: created.orderNumber };
  }
}
