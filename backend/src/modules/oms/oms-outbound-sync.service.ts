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

type Tx = Prisma.TransactionClient;

const TERMINAL_OMS: OmsOrderStatus[] = [
  OmsOrderStatus.rejected,
  OmsOrderStatus.cancelled,
  OmsOrderStatus.completed,
  OmsOrderStatus.failed_delivery,
];

@Injectable()
export class OmsOutboundSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OmsOrderEventsService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * Sync OMS status from a linked outbound order status change.
   * Safe no-op when no OMS order is linked or status is unchanged.
   */
  async syncFromOutbound(
    tx: Tx,
    outboundOrderId: string,
    actorUserId?: string,
  ): Promise<void> {
    const oms = await tx.omsOrder.findFirst({
      where: { outboundOrderId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        status: true,
        outboundOrderId: true,
      },
    });
    if (!oms) return;
    if (TERMINAL_OMS.includes(oms.status) && oms.status !== OmsOrderStatus.delivered) {
      return;
    }

    const outbound = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { id: true, status: true },
    });
    if (!outbound) return;

    const next = mapOutboundStatusToOms(outbound.status);
    if (next === oms.status) return;

    // Do not overwrite approval/rejection with draft-like mappings if still pending.
    if (
      oms.status === OmsOrderStatus.pending_approval ||
      oms.status === OmsOrderStatus.rejected
    ) {
      return;
    }

    const extra: Prisma.OmsOrderUpdateInput = {};
    if (next === OmsOrderStatus.out_for_delivery) {
      extra.outForDeliveryAt = new Date();
    }
    if (next === OmsOrderStatus.delivered) {
      extra.deliveredAt = new Date();
    }
    if (next === OmsOrderStatus.returned) {
      extra.returnedAt = new Date();
    }
    if (next === OmsOrderStatus.allocated) {
      extra.allocationStatus = 'allocated';
      extra.allocatedAt = new Date();
    }

    await tx.omsOrder.update({
      where: { id: oms.id },
      data: { status: next, ...extra },
    });

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId,
      companyId: oms.companyId,
      eventType: omsEventTypeForStatus(next),
      createdBy: actorUserId,
      payload: { source: 'wms_sync', outboundStatus: outbound.status },
    });

    this.realtime?.emitOmsOrderEvent(oms.companyId, {
      orderId: oms.id,
      status: next,
      event: omsEventTypeForStatus(next),
    });
  }

  /** Convenience when caller is outside a tenant transaction. */
  async syncFromOutboundStandalone(
    outboundOrderId: string,
    actorUserId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.syncFromOutbound(tx, outboundOrderId, actorUserId);
    });
  }

  /**
   * Create a draft outbound order from an approved OMS order (1:1).
   * Caller must already hold a transaction and have validated stock.
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
      throw new BadRequestException('OMS order is already linked to an outbound order.');
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
      select: { id: true, orderNumber: true },
    });

    await tx.omsOrder.update({
      where: { id: oms.id },
      data: {
        outboundOrderId: created.id,
        status: OmsOrderStatus.approved,
        approvedAt: new Date(),
        approvedBy: params.actorUserId,
        confirmedAt: new Date(),
      },
    });

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId: created.id,
      companyId: oms.companyId,
      eventType: 'order.approved',
      createdBy: params.actorUserId,
      payload: { outboundOrderId: created.id, outboundOrderNumber: created.orderNumber },
    });

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId: created.id,
      companyId: oms.companyId,
      eventType: 'outbound.generated',
      createdBy: params.actorUserId,
      payload: { outboundOrderId: created.id, outboundOrderNumber: created.orderNumber },
    });

    this.realtime?.emitOmsOrderEvent(oms.companyId, {
      orderId: oms.id,
      status: OmsOrderStatus.approved,
      event: 'order.approved',
    });

    return { outboundOrderId: created.id, orderNumber: created.orderNumber };
  }
}
