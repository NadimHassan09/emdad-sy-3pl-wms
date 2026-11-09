import type {
  OmsOrder,
  OmsOrderLine,
  OmsOrderStatus,
  OutboundOrder,
  Prisma,
} from '@prisma/client';
import {
  isProviderName,
  resolveShippingCarrierName,
} from '../shipping/shipping-carrier-resolver';
import {
  isAwbPendingReassignment,
  pickActiveCarrierShipment,
} from '../shipping/shipping-lifecycle.util';
import { isCancellationUnconfirmed } from '../shipping/shipping-lookup.util';

export type OmsOrderLineWithProduct = OmsOrderLine & {
  product?: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    status: string;
    trackingType: string;
    uom: string;
  } | null;
};

export type OmsOrderWithRelations = OmsOrder & {
  lines: OmsOrderLineWithProduct[];
  company?: { id: string; name: string } | null;
  outboundOrder?: (Pick<OutboundOrder, 'id' | 'orderNumber' | 'status'> & {
    carrier?: string | null;
    shippingProviderCode?: string | null;
    shippingServiceId?: string | null;
    shippingHubId?: string | null;
    shippingMethod?: any;
    trackingNumber?: string | null;
    carrierShipments?: Array<{
      id?: string;
      status?: string;
      trackingNumber?: string | null;
      externalAwb?: string | null;
      providerCode?: string | null;
      rawResultMeta?: any;
      supersededAt?: Date | string | null;
      events?: Array<{
        eventDescription?: string | null;
        originalCarrierStatus?: string | null;
        normalizedStatus?: string | null;
        eventTimestamp?: Date | string | null;
        locationText?: string | null;
      }> | null;
    }> | null;
  }) | null;
  returns?: Array<{
    id: string;
    returnNumber: string;
    status: string;
    reason: string | null;
    carrierReturnStage: string | null;
    carrierOriginalStatus: string | null;
    carrierAwb: string | null;
    carrierReturnCreatedAt: Date | null;
    carrierReturningAt: Date | null;
    carrierReturnedAt: Date | null;
    warehouseConfirmedAt: Date | null;
    createdAt: Date;
  }>;
  omsReturns?: Array<{
    id: string;
    returnNumber: string;
    status: string;
    reason: string | null;
    carrierReturnStage: string | null;
    carrierOriginalStatus: string | null;
    carrierAwb: string | null;
    carrierReturnCreatedAt: Date | null;
    carrierReturningAt: Date | null;
    carrierReturnedAt: Date | null;
    warehouseConfirmedAt: Date | null;
    createdAt: Date;
  }>;
};

function dec(v: Prisma.Decimal | null | undefined): string | null {
  if (v == null) return null;
  return v.toString();
}

function buildLegacyDestination(order: OmsOrder): string {
  const parts = [
    order.addressLine1,
    order.district,
    order.city,
    order.addressLine2,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return order.destinationAddress;
}

function linesSum(order: OmsOrderWithRelations): number {
  return (order.lines ?? []).reduce((sum, line) => {
    if (line.lineTotal != null) return sum + Number(line.lineTotal);
    if (line.unitPrice != null) {
      return sum + Number(line.unitPrice) * Number(line.requestedQuantity);
    }
    return sum;
  }, 0);
}

/** Subtotal = shipping fee + sum of each line total (price × qty). */
function computeSubtotal(order: OmsOrderWithRelations): string | null {
  const ship = order.shippingFee != null ? Number(order.shippingFee) : 0;
  if ((order.lines?.length ?? 0) > 0) {
    return String(linesSum(order) + ship);
  }
  if (order.subtotal != null) return order.subtotal.toString();
  if (order.shippingFee != null) return String(ship);
  return null;
}

function computeTotal(order: OmsOrderWithRelations): string | null {
  // Total equals calculated subtotal (already includes shipping).
  return computeSubtotal(order);
}

export function serializeOmsOrderLine(line: OmsOrderLineWithProduct) {
  return {
    ...line,
    requestedQuantity: line.requestedQuantity.toString(),
    unitPrice: dec(line.unitPrice),
    lineTotal: dec(line.lineTotal),
    discountAmount: dec(line.discountAmount),
  };
}

function liveShipmentTracking(order: OmsOrderWithRelations): string | null {
  const active = pickActiveCarrierShipment(order.outboundOrder?.carrierShipments ?? []);
  if (active && isAwbPendingReassignment(active.rawResultMeta)) return null;
  if (active) {
    return active.trackingNumber?.trim() || null;
  }
  return (
    order.trackingNumber?.trim() ||
    order.outboundOrder?.trackingNumber?.trim() ||
    null
  );
}

function liveAwbPending(order: OmsOrderWithRelations): boolean {
  const active = pickActiveCarrierShipment(order.outboundOrder?.carrierShipments ?? []);
  if (!active) return false;
  if (isAwbPendingReassignment(active.rawResultMeta)) return true;
  return !active.trackingNumber?.trim();
}

export function serializeOmsOrderListItem(order: OmsOrderWithRelations) {
  const carrierName = resolveShippingCarrierName(order);
  const explicitMethod = order.shippingMethod ?? order.outboundOrder?.shippingMethod ?? null;
  const resolvedMethod = explicitMethod ?? (carrierName ? 'carrier' : null);
  const isManual = resolvedMethod === 'manual';
  const activeShipment = pickActiveCarrierShipment(order.outboundOrder?.carrierShipments ?? []);
  const liveTracking = liveShipmentTracking(order);
  const awbPending = liveAwbPending(order);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    carrier: carrierName,
    shippingCarrierName: carrierName,
    awbPending,
    cancellationUnconfirmed: isCancellationUnconfirmed(activeShipment?.rawResultMeta),
    shippingHubId: order.outboundOrder?.shippingHubId ?? null,
    shippingMethod: resolvedMethod,
    isManualShipping: isManual,
    companyId: order.companyId,
    company: order.company ?? null,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    city: order.city,
    storeChannel: order.storeChannel,
    total: computeTotal(order),
    currency: order.currency,
    shippingFee: dec(order.shippingFee),
    outboundOrderId: order.outboundOrderId,
    trackingNumber: liveTracking,
    needsInformation: order.needsInformation,
    importBatchId: order.importBatchId ?? null,
    externalReference: order.externalReference ?? null,
    clientReference: order.clientReference ?? null,
    /** Short summary of what is in the order, for the quick contents column. */
    contents: (order.lines ?? []).map((l) => ({
      sku: l.product?.sku ?? null,
      name: l.product?.name ?? null,
      quantity: dec(l.requestedQuantity),
    })),
    /** The last event the carrier reported (admin list only; stripped for clients). */
    lastCarrierEvent: (() => {
      const ev = activeShipment?.events?.[0];
      if (!ev) return null;
      return {
        text: ev.eventDescription || ev.originalCarrierStatus || ev.normalizedStatus || null,
        at: ev.eventTimestamp ?? null,
        location: ev.locationText ?? null,
      };
    })(),
    linkedOutboundOrder: order.outboundOrder
      ? {
          id: order.outboundOrder.id,
          orderNumber: order.outboundOrder.orderNumber,
          status: order.outboundOrder.status,
          trackingNumber: liveTracking,
          hasCarrierShipment: Boolean(activeShipment),
          shippingMethod: (order.outboundOrder as any).shippingMethod ?? null,
          shippingProviderCode: (order.outboundOrder as any).shippingProviderCode ?? null,
          shippingServiceId: (order.outboundOrder as any).shippingServiceId ?? null,
          shippingHubId: (order.outboundOrder as any).shippingHubId ?? null,
          shippingQuotedPrice: dec((order.outboundOrder as any).shippingQuotedPrice),
          shippingQuotedCurrency: (order.outboundOrder as any).shippingQuotedCurrency ?? null,
          shippingCost: dec(
            (order.outboundOrder as any).carrierShipments?.find(
              (s: { status?: string }) => s.status === 'created',
            )?.shippingCost,
          ),
          shippingCostCurrency:
            (order.outboundOrder as any).carrierShipments?.find(
              (s: { status?: string }) => s.status === 'created',
            )?.currency ?? null,
        }
      : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function serializeOmsOrder(order: OmsOrderWithRelations) {
  const subtotal = computeSubtotal(order);
  const carrierName = resolveShippingCarrierName(order);
  const activeShipment = pickActiveCarrierShipment(order.outboundOrder?.carrierShipments ?? []);
  const liveTracking = liveShipmentTracking(order);
  const returnsList = order.omsReturns ?? order.returns ?? [];
  const activeReturn = returnsList.find(
    (r: any) => r.status === 'requested' || r.status === 'approved',
  );
  return {
    ...order,
    deliveryFailedAt: (order as any).deliveryFailedAt ?? null,
    activeReturn: activeReturn
      ? {
          id: activeReturn.id,
          returnNumber: activeReturn.returnNumber,
          status: activeReturn.status,
          reason: activeReturn.reason,
          carrierReturnStage: activeReturn.carrierReturnStage,
          carrierOriginalStatus: activeReturn.carrierOriginalStatus,
          carrierAwb: activeReturn.carrierAwb,
          carrierReturnCreatedAt: activeReturn.carrierReturnCreatedAt,
          carrierReturningAt: activeReturn.carrierReturningAt,
          carrierReturnedAt: activeReturn.carrierReturnedAt,
          warehouseConfirmedAt: activeReturn.warehouseConfirmedAt,
          createdAt: activeReturn.createdAt,
        }
      : null,
    carrier: carrierName ?? (isProviderName(order.carrier) ? null : order.carrier),
    shippingCarrierName: carrierName,
    awbPending: liveAwbPending(order),
    cancellationUnconfirmed: isCancellationUnconfirmed(activeShipment?.rawResultMeta),
    shippingHubId: order.outboundOrder?.shippingHubId ?? null,
    trackingNumber: liveTracking,
    destinationAddress: buildLegacyDestination(order),
    subtotal,
    shippingFee: dec(order.shippingFee),
    /** Admin-only: manual USD override of what EMDAD pays the carrier (from shipment meta). */
    carrierCostUsd: (() => {
      const meta = activeShipment?.rawResultMeta;
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
      const raw = (meta as Record<string, unknown>).carrierCostUsd;
      if (raw == null || raw === '') return null;
      return String(raw);
    })(),
    clientShippingRateAppliedAt: (order as { clientShippingRateAppliedAt?: Date | null }).clientShippingRateAppliedAt ?? null,
    clientShippingRateWeightKg: dec(
      (order as { clientShippingRateWeightKg?: Prisma.Decimal | null }).clientShippingRateWeightKg,
    ),
    clientShippingRateBreakdown: (order as { clientShippingRateBreakdown?: unknown }).clientShippingRateBreakdown ?? null,
    codAmount: dec(order.codAmount),
    shippingReceiverLat: dec(order.shippingReceiverLat),
    shippingReceiverLng: dec(order.shippingReceiverLng),
    babelNeighbourhoodId: order.babelNeighbourhoodId ?? null,
    shippingWeightKg: dec(order.shippingWeightKg),
    total: computeTotal(order),
    linkedOutboundOrder: order.outboundOrder
      ? {
          id: order.outboundOrder.id,
          orderNumber: order.outboundOrder.orderNumber,
          status: order.outboundOrder.status,
          trackingNumber: liveTracking,
          hasCarrierShipment: Boolean(activeShipment),
          shippingMethod: (order.outboundOrder as any).shippingMethod ?? null,
          shippingProviderCode: (order.outboundOrder as any).shippingProviderCode ?? null,
          shippingServiceId: (order.outboundOrder as any).shippingServiceId ?? null,
          shippingHubId: (order.outboundOrder as any).shippingHubId ?? null,
          shippingQuotedPrice: dec((order.outboundOrder as any).shippingQuotedPrice),
          shippingQuotedCurrency: (order.outboundOrder as any).shippingQuotedCurrency ?? null,
          shippingCost: dec(
            (order.outboundOrder as any).carrierShipments?.find(
              (s: { status?: string }) => s.status === 'created',
            )?.shippingCost,
          ),
          shippingCostCurrency:
            (order.outboundOrder as any).carrierShipments?.find(
              (s: { status?: string }) => s.status === 'created',
            )?.currency ?? null,
        }
      : null,
    warehouseStatus: order.outboundOrder?.status ?? null,
    lines: order.lines.map(serializeOmsOrderLine),
  };
}

export function composeDestinationAddress(input: {
  destinationAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  city?: string;
}): string {
  const parts = [input.addressLine1, input.district, input.city, input.addressLine2].filter(
    (p) => p?.trim(),
  );
  if (parts.length > 0) {
    const joined = parts.join(', ');
    if (input.destinationAddress?.trim()) {
      const dest = input.destinationAddress.trim();
      if (dest.length > 10 && dest.toLowerCase() !== input.city?.trim().toLowerCase()) {
        return dest;
      }
    }
    return joined;
  }
  if (input.destinationAddress?.trim()) return input.destinationAddress.trim();
  return '';
}

export function deriveCodStatus(
  paymentMethod: string | null | undefined,
  codAmount: Prisma.Decimal | null | undefined,
): 'pending' | null {
  if (paymentMethod === 'COD' && codAmount && !codAmount.isZero()) {
    return 'pending';
  }
  return null;
}

/** Map warehouse outbound status → OMS commercial status.
 * Returns null when OMS status must not change.
 * Delivered is admin-only — never set from warehouse sync (even if outbound is delivered).
 *
 * Hard boundary (Shipping Details workflow):
 * - picking / packing / waiting_for_shipping_details → processing
 * - ready_to_ship → ready_to_ship (Waiting for Dispatch only — after Mark Shipping Details Complete)
 * - shipped → shipped (ONLY after dispatch complete)
 *
 * Carrier Send does NOT map to OMS ready_to_ship; that happens only at Waiting for Dispatch.
 */
export function mapOutboundStatusToOms(status: string): OmsOrderStatus | null {
  switch (status) {
    case 'draft':
    case 'pending_approval':
    case 'pending_stock':
    case 'confirmed':
    case 'allocated':
    case 'picking':
    case 'packing':
      return 'processing';
    case 'waiting_for_shipping_method':
    case 'waiting_for_shipping_details':
    case 'ready_to_ship':
      return 'ready_to_ship';
    case 'shipped':
    case 'out_for_delivery':
      return 'shipped';
    case 'delivered':
      // Commercial delivered is controlled — do not auto-set from WMS.
      return null;
    case 'externally_fulfilled':
      // Commercial OMS owns shipped/delivered; warehouse-skip must not sync to processing.
      return null;
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

export function omsEventTypeForStatus(status: OmsOrderStatus): string {
  return `order.${status}`;
}
