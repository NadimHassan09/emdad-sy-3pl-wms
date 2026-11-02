import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OutboundService } from '../outbound/outbound.service';
import {
  isActiveCarrierShipment,
  normalizeWaybillScanCode,
  shipmentScanValues,
  waybillScanAttempts,
} from '../shipping/shipping-lifecycle.util';
import type { OmsShippingScanAction } from './dto/scan-shipping-transition.dto';

export type OmsShippingScanResult = {
  ok: true;
  alreadyApplied: boolean;
  action: OmsShippingScanAction;
  orderId: string;
  orderNumber: string;
  omsStatus: string;
  outboundStatus: string;
};

@Injectable()
export class OmsShippingScanService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OutboundService))
    private readonly outbound: OutboundService,
  ) {}

  async apply(
    user: AuthPrincipal,
    rawCode: string,
    action: OmsShippingScanAction,
  ): Promise<OmsShippingScanResult> {
    const code = normalizeWaybillScanCode(rawCode);
    if (!code) {
      throw new BadRequestException('The scanned code is empty.');
    }

    const scannedShipment = await this.findShipmentByScan(user, code);
    if (scannedShipment && !isActiveCarrierShipment(scannedShipment)) {
      throw new BadRequestException(
        'This waybill belongs to a cancelled or superseded shipment and cannot change the active order.',
      );
    }

    const order = await this.findOrderForScan(user, code, scannedShipment?.outboundOrderId ?? null);
    if (!order) {
      throw new NotFoundException(`No order found for ${code}.`);
    }

    const outbound = order.outboundOrder;
    if (!outbound) {
      throw new BadRequestException(`${order.orderNumber} has no warehouse order.`);
    }

    const activeShipment = (outbound.carrierShipments ?? []).find((shipment) =>
      isActiveCarrierShipment(shipment),
    );
    if (!activeShipment) {
      throw new BadRequestException(
        `${order.orderNumber} has no active shipment for this scan.`,
      );
    }

    if (scannedShipment && scannedShipment.id !== activeShipment.id) {
      throw new BadRequestException(
        'This waybill belongs to a cancelled or superseded shipment and cannot change the active order.',
      );
    }

    if (!this.scanMatchesOrderOrActiveShipment(code, order.orderNumber, activeShipment)) {
      throw new BadRequestException(
        'Scanned code does not match the active shipment on this order.',
      );
    }

    if (action === 'ready_to_ship') {
      return this.confirmReadyToShip(user, order, outbound, activeShipment);
    }
    return this.confirmHandover(user, order, outbound, activeShipment);
  }

  private async confirmReadyToShip(
    user: AuthPrincipal,
    order: { id: string; orderNumber: string; status: string; companyId: string },
    outbound: { id: string; status: string; shippingProviderCode?: string | null },
    activeShipment: { providerCode?: string | null },
  ): Promise<OmsShippingScanResult> {
    if (
      order.status === OmsOrderStatus.ready_to_ship &&
      outbound.status === OutboundOrderStatus.ready_to_ship
    ) {
      return this.ok(order, outbound, 'ready_to_ship', true);
    }

    const waiting =
      order.status === OmsOrderStatus.processing &&
      (outbound.status === OutboundOrderStatus.waiting_for_shipping_details ||
        outbound.status === OutboundOrderStatus.waiting_for_shipping_method);
    if (!waiting) {
      throw new BadRequestException(
        `${order.orderNumber} is not waiting for shipping confirmation.`,
      );
    }

    this.assertProviderAssociation(outbound, activeShipment);
    const updated = await this.outbound.completeShippingDetailsAdmin(user, outbound.id);
    return this.ok(order, { id: outbound.id, status: updated.status }, 'ready_to_ship', false);
  }

  private async confirmHandover(
    user: AuthPrincipal,
    order: { id: string; orderNumber: string; status: string; companyId: string },
    outbound: { id: string; status: string; shippingProviderCode?: string | null },
    activeShipment: { providerCode?: string | null },
  ): Promise<OmsShippingScanResult> {
    if (
      order.status === OmsOrderStatus.shipped ||
      order.status === OmsOrderStatus.out_for_delivery ||
      outbound.status === OutboundOrderStatus.shipped ||
      outbound.status === OutboundOrderStatus.out_for_delivery
    ) {
      return this.ok(order, outbound, 'handover', true);
    }

    if (
      order.status !== OmsOrderStatus.ready_to_ship ||
      outbound.status !== OutboundOrderStatus.ready_to_ship
    ) {
      throw new BadRequestException(`${order.orderNumber} is not ready to ship.`);
    }

    this.assertProviderAssociation(outbound, activeShipment);
    const updated = await this.outbound.completeDispatchAdmin(user, outbound.id);
    return this.ok(order, { id: outbound.id, status: updated.status }, 'handover', false);
  }

  private assertProviderAssociation(
    outbound: { shippingProviderCode?: string | null },
    activeShipment: { providerCode?: string | null },
  ): void {
    const orderProvider = (outbound.shippingProviderCode || '').trim();
    const shipmentProvider = (activeShipment.providerCode || '').trim();
    if (orderProvider && shipmentProvider && orderProvider !== shipmentProvider) {
      throw new BadRequestException(
        'Scanned shipment provider does not match the active order shipment.',
      );
    }
  }

  private async findShipmentByScan(user: AuthPrincipal, code: string) {
    const attempts = waybillScanAttempts(code);
    return this.prisma.carrierShipment.findFirst({
      where: {
        OR: attempts.flatMap((attempt) => [
          { trackingNumber: { equals: attempt, mode: 'insensitive' as const } },
          { externalAwb: { equals: attempt, mode: 'insensitive' as const } },
        ]),
        ...(user.companyId
          ? { outboundOrder: { is: { companyId: user.companyId } } }
          : {}),
      },
      select: {
        id: true,
        status: true,
        supersededAt: true,
        trackingNumber: true,
        externalAwb: true,
        providerCode: true,
        outboundOrderId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOrderForScan(
    user: AuthPrincipal,
    code: string,
    outboundOrderId: string | null,
  ) {
    const attempts = waybillScanAttempts(code);
    const order = await this.prisma.omsOrder.findFirst({
      where: {
        ...(user.companyId ? { companyId: user.companyId } : {}),
        OR: [
          ...(outboundOrderId ? [{ outboundOrderId }] : []),
          ...attempts.flatMap((attempt) => [
            { orderNumber: { equals: attempt, mode: 'insensitive' as const } },
            { trackingNumber: { equals: attempt, mode: 'insensitive' as const } },
            {
              outboundOrder: {
                is: {
                  OR: [
                    { orderNumber: { equals: attempt, mode: 'insensitive' as const } },
                    { trackingNumber: { equals: attempt, mode: 'insensitive' as const } },
                  ],
                },
              },
            },
          ]),
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        companyId: true,
        outboundOrder: {
          select: {
            id: true,
            status: true,
            shippingProviderCode: true,
            carrierShipments: {
              select: {
                id: true,
                status: true,
                supersededAt: true,
                trackingNumber: true,
                externalAwb: true,
                providerCode: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 8,
            },
          },
        },
      },
    });
    return order;
  }

  private scanMatchesOrderOrActiveShipment(
    code: string,
    orderNumber: string,
    activeShipment: { trackingNumber?: string | null; externalAwb?: string | null },
  ): boolean {
    const needles = waybillScanAttempts(code).map((value) => value.toLowerCase());
    const allowed = new Set([
      orderNumber.trim().toLowerCase(),
      `emd-${orderNumber.trim().toLowerCase()}`,
      ...shipmentScanValues(activeShipment),
    ]);
    return needles.some((needle) => allowed.has(needle));
  }

  private ok(
    order: { id: string; orderNumber: string; status: string },
    outbound: { id: string; status: string },
    action: OmsShippingScanAction,
    alreadyApplied: boolean,
  ): OmsShippingScanResult {
    return {
      ok: true,
      alreadyApplied,
      action,
      orderId: order.id,
      orderNumber: order.orderNumber,
      omsStatus: alreadyApplied ? order.status : action === 'ready_to_ship' ? 'ready_to_ship' : outbound.status,
      outboundStatus: outbound.status,
    };
  }
}
