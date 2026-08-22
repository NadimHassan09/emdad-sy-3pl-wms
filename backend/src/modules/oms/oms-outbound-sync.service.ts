import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OmsAllocationStatus, OmsOrderStatus, OutboundOrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  composeDestinationAddress,
  mapOutboundStatusToOms,
  omsEventTypeForStatus,
} from './oms-order.mapper';
import { OmsOrderEventsService } from './oms-order-events.service';
import { OMS_PRE_FULFILLMENT, OMS_TERMINAL_STATUSES } from './oms-order-transitions';
import { OrderAllocationService } from './order-allocation.service';
import { copyShippingFieldsFromOms } from '../shipping/shipping-config.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OmsOutboundSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OmsOrderEventsService,
    private readonly allocation: OrderAllocationService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  /**
   * Sync OMS commercial status from linked outbound + packing-optional prep state.
   * Never auto-sets OMS delivered from outbound delivered.
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
    if (OMS_TERMINAL_STATUSES.has(oms.status)) return;
    if (OMS_PRE_FULFILLMENT.has(oms.status)) return;

    const outbound = await tx.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { id: true, status: true, requiresPacking: true },
    });
    if (!outbound) return;

    const next = mapOutboundStatusToOms(outbound.status);
    if (next == null || next === oms.status) return;

    // Do not regress commercial lifecycle (e.g. shipped → processing).
    const rank: Partial<Record<OmsOrderStatus, number>> = {
      [OmsOrderStatus.processing]: 1,
      [OmsOrderStatus.pending]: 1,
      [OmsOrderStatus.allocated]: 1,
      [OmsOrderStatus.picking]: 1,
      [OmsOrderStatus.packing]: 1,
      [OmsOrderStatus.ready_to_ship]: 2,
      [OmsOrderStatus.shipped]: 3,
      [OmsOrderStatus.out_for_delivery]: 3,
    };
    const fromRank = rank[oms.status] ?? 0;
    const toRank = rank[next] ?? 0;
    if (toRank < fromRank) return;

    const extra: Prisma.OmsOrderUpdateInput = {};
    if (next === OmsOrderStatus.shipped) {
      extra.outForDeliveryAt = new Date();
    }

    await tx.omsOrder.update({
      where: { id: oms.id },
      data: { status: next, ...extra },
    });

    const eventType =
      next === OmsOrderStatus.shipped
        ? 'oms.shipped'
        : next === OmsOrderStatus.ready_to_ship
          ? 'oms.ready_to_ship'
          : next === OmsOrderStatus.processing
            ? 'oms.processing'
            : omsEventTypeForStatus(next);

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId,
      companyId: oms.companyId,
      eventType,
      createdBy: actorUserId,
      payload: {
        source: 'wms_sync',
        outboundStatus: outbound.status,
        omsStatus: next,
        requiresPacking: outbound.requiresPacking,
      },
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
   * Create draft outbound from OMS and set commercial status to processing.
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
        if (oms.status !== OmsOrderStatus.processing) {
          await tx.omsOrder.update({
            where: { id: oms.id },
            data: {
              status: OmsOrderStatus.processing,
              approvedAt: oms.approvedAt ?? new Date(),
              approvedBy: oms.approvedBy ?? params.actorUserId,
              confirmedAt: oms.confirmedAt ?? new Date(),
            },
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
      }) ||
      oms.destinationAddress ||
      'OMS order';

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
        currency: oms.currency ?? 'USD',
        codStatus: oms.codStatus ?? undefined,
        storeChannel: oms.storeChannel,
        externalReference: oms.externalReference,
        ...copyShippingFieldsFromOms(oms),
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
        status: OmsOrderStatus.processing,
        approvedAt: new Date(),
        approvedBy: params.actorUserId,
        confirmedAt: new Date(),
        ...(this.allocation.isEnabled()
          ? {
              allocationStatus: OmsAllocationStatus.allocated,
              allocatedAt: new Date(),
            }
          : {}),
      },
    });

    await this.events.record(tx, {
      omsOrderId: oms.id,
      outboundOrderId: created.id,
      companyId: oms.companyId,
      eventType: 'oms.approved',
      createdBy: params.actorUserId,
      payload: {
        outboundOrderId: created.id,
        outboundOrderNumber: created.orderNumber,
        omsStatus: OmsOrderStatus.processing,
      },
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
      status: OmsOrderStatus.processing,
      event: 'oms.approved',
    });

    return { outboundOrderId: created.id, orderNumber: created.orderNumber };
  }
}
