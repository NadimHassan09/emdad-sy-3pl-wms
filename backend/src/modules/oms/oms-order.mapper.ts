import type {
  OmsOrder,
  OmsOrderLine,
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

function computeTotal(order: OmsOrder): string | null {
  const sub = order.subtotal != null ? Number(order.subtotal) : null;
  const ship = order.shippingFee != null ? Number(order.shippingFee) : null;
  if (sub == null && ship == null) return null;
  return String((sub ?? 0) + (ship ?? 0));
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
    storeChannel: order.storeChannel,
    total: computeTotal(order),
    currency: order.currency,
    outboundOrderId: order.outboundOrderId,
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
  return {
    ...order,
    destinationAddress: buildLegacyDestination(order),
    subtotal: dec(order.subtotal),
    shippingFee: dec(order.shippingFee),
    codAmount: dec(order.codAmount),
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

export function mapOutboundStatusToOms(
  status: string,
): 'draft' | 'confirmed' | 'processing' | 'allocated' | 'ready_to_ship' | 'out_for_delivery' | 'shipped' | 'delivered' | 'returned' | 'cancelled' {
  switch (status) {
    case 'confirmed':
      return 'confirmed';
    case 'allocated':
      return 'allocated';
    case 'picking':
    case 'packing':
      return 'processing';
    case 'ready_to_ship':
      return 'ready_to_ship';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'returned':
      return 'returned';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'draft';
  }
}
