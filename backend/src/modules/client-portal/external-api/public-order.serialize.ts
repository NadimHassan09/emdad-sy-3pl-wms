type AnyOrder = Record<string, unknown> & {
  id: string;
  orderNumber?: string;
  status?: string;
  externalReference?: string | null;
  clientReference?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  city?: string | null;
  district?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  destinationAddress?: string | null;
  requiredShipDate?: unknown;
  expectedArrivalDate?: unknown;
  paymentMethod?: string | null;
  currency?: string | null;
  notes?: string | null;
  storeChannel?: string | null;
  shippingReceiverLat?: unknown;
  shippingReceiverLng?: unknown;
  createdAt?: unknown;
  lines?: Array<Record<string, unknown>>;
};

function lineSku(line: Record<string, unknown>): string | null {
  const product = line.product as { sku?: string } | undefined;
  return product?.sku ?? (typeof line.sku === 'string' ? line.sku : null);
}

export function publicOmsOrder(order: AnyOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    externalOrderId: order.externalReference ?? null,
    recipientName: order.recipientName ?? null,
    recipientPhone: order.recipientPhone ?? null,
    address: {
      governorate: order.city ?? null,
      city: order.district ?? null,
      neighborhood: order.addressLine1 ?? null,
      street: order.addressLine2 ?? null,
    },
    requiredShipDate: order.requiredShipDate ?? null,
    paymentMethod: order.paymentMethod ?? null,
    currency: order.currency ?? null,
    notes: order.notes ?? null,
    storeChannel: order.storeChannel ?? null,
    coordinates:
      order.shippingReceiverLat != null && order.shippingReceiverLng != null
        ? { lat: Number(order.shippingReceiverLat), lng: Number(order.shippingReceiverLng) }
        : null,
    createdAt: order.createdAt ?? null,
    lines: (order.lines ?? []).map((line) => ({
      sku: lineSku(line),
      quantity: Number(line.requestedQuantity ?? line.quantity ?? 0),
      unitPrice: line.unitPrice != null ? Number(line.unitPrice) : null,
    })),
  };
}

export function publicInboundOrder(order: AnyOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    externalOrderId: order.externalReference ?? null,
    clientReference: order.clientReference ?? null,
    expectedArrivalDate: order.expectedArrivalDate ?? null,
    notes: order.notes ?? null,
    createdAt: order.createdAt ?? null,
    lines: (order.lines ?? []).map((line) => ({
      sku: lineSku(line),
      quantity: Number(line.expectedQuantity ?? line.quantity ?? 0),
    })),
  };
}

export function publicOutboundOrder(order: AnyOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    externalOrderId: order.externalReference ?? null,
    clientReference: order.clientReference ?? null,
    destinationAddress: order.destinationAddress ?? null,
    requiredShipDate: order.requiredShipDate ?? null,
    notes: order.notes ?? null,
    createdAt: order.createdAt ?? null,
    lines: (order.lines ?? []).map((line) => ({
      sku: lineSku(line),
      quantity: Number(line.requestedQuantity ?? line.quantity ?? 0),
    })),
  };
}
