import type {
  OmsOrder,
  OmsOrderLine,
  OmsOrderStatus,
  OutboundOrder,
  Prisma,
} from '@prisma/client';

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
  outboundOrder?: Pick<OutboundOrder, 'id' | 'orderNumber' | 'status'> | null;
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

export function serializeOmsOrderListItem(order: OmsOrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    companyId: order.companyId,
    company: order.company ?? null,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    city: order.city,
    storeChannel: order.storeChannel,
    total: computeTotal(order),
    currency: order.currency,
    outboundOrderId: order.outboundOrderId,
    needsInformation: order.needsInformation,
    importBatchId: order.importBatchId ?? null,
    linkedOutboundOrder: order.outboundOrder
      ? {
          id: order.outboundOrder.id,
          orderNumber: order.outboundOrder.orderNumber,
          status: order.outboundOrder.status,
        }
      : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function serializeOmsOrder(order: OmsOrderWithRelations) {
  const subtotal = computeSubtotal(order);
  return {
    ...order,
    destinationAddress: buildLegacyDestination(order),
    subtotal,
    shippingFee: dec(order.shippingFee),
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
  if (input.destinationAddress?.trim()) return input.destinationAddress.trim();
  const parts = [input.addressLine1, input.district, input.city, input.addressLine2].filter(
    (p) => p?.trim(),
  );
  if (parts.length === 0) return '';
  return parts.join(', ');
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
    case 'waiting_for_shipping_method':
    case 'waiting_for_shipping_details':
      return 'processing';
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
