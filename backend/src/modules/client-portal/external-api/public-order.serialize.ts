/**
 * Public External API serializers — Client Portal parity only.
 * Fields the client cannot see in the portal must not appear here.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim());
}

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
  carrier?: string | null;
  trackingNumber?: string | null;
  warehouseStatus?: string | null;
  needsInformation?: boolean | null;
  rejectionReason?: string | null;
  subtotal?: unknown;
  shippingFee?: unknown;
  total?: unknown;
  codStatus?: string | null;
  createdAt?: unknown;
  confirmedAt?: unknown;
  submittedAt?: unknown;
  approvedAt?: unknown;
  outForDeliveryAt?: unknown;
  deliveredAt?: unknown;
  completedAt?: unknown;
  shippedAt?: unknown;
  _count?: { lines?: number };
  lines?: Array<Record<string, unknown>>;
  timeline?: Array<Record<string, unknown>>;
};

function lineProduct(line: Record<string, unknown>): {
  sku: string | null;
  name: string | null;
  imageUrl: string | null;
} {
  const product = line.product as
    | { sku?: string; name?: string; imageUrl?: string | null; imagePath?: string | null }
    | undefined;
  const imageUrl =
    product?.imageUrl ??
    (product?.imagePath ? `/media/${String(product.imagePath).replace(/^\/+/, '')}` : null);
  return {
    sku: product?.sku ?? (typeof line.sku === 'string' ? line.sku : null),
    name: product?.name ?? null,
    imageUrl: imageUrl ?? null,
  };
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length ? s : null;
}

function externalOrderIdOf(order: AnyOrder): string | null {
  return str(order.externalReference) ?? str(order.clientReference);
}

/** List row — Online orders table columns. */
export function publicOmsOrderListItem(order: AnyOrder) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    recipientName: order.recipientName ?? null,
    city: order.city ?? null,
    total: str(order.total),
    currency: order.currency ?? null,
    createdAt: order.createdAt ?? null,
    incomplete: Boolean(order.needsInformation),
    externalOrderId: externalOrderIdOf(order),
  };
}

/**
 * Detail — Ecommerce order details page (recipient, lines, pricing, tracking inputs).
 * No admin-only / internal warehouse planning fields.
 */
export function publicOmsOrder(order: AnyOrder) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    externalOrderId: externalOrderIdOf(order),
    recipientName: order.recipientName ?? null,
    recipientPhone: order.recipientPhone ?? null,
    address: order.addressLine1 ?? order.destinationAddress ?? null,
    city: order.city ?? null,
    district: order.district ?? null,
    carrier: order.carrier ?? null,
    trackingNumber: order.trackingNumber ?? null,
    requiredShipDate: order.requiredShipDate ?? null,
    createdAt: order.createdAt ?? null,
    warehouseStatus: order.warehouseStatus ?? null,
    notes: order.notes ?? null,
    paymentMethod: order.paymentMethod ?? null,
    shippingFee: str(order.shippingFee),
    subtotal: str(order.subtotal),
    currency: order.currency ?? null,
    codStatus: order.codStatus ?? null,
    incomplete: Boolean(order.needsInformation),
    rejectionReason: order.rejectionReason ?? null,
    submittedAt: order.submittedAt ?? null,
    confirmedAt: order.confirmedAt ?? null,
    approvedAt: order.approvedAt ?? null,
    outForDeliveryAt: order.outForDeliveryAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    lines: (order.lines ?? []).map((line) => {
      const p = lineProduct(line);
      return {
        lineNumber: num(line.lineNumber),
        sku: p.sku,
        productName: p.name,
        quantity: num(line.requestedQuantity ?? line.quantity) ?? 0,
        unitPrice: num(line.unitPrice),
        lineTotal: num(line.lineTotal),
      };
    }),
    timeline: (order.timeline ?? []).map((ev) => ({
      eventType: str(ev.eventType),
      createdAt: ev.createdAt ?? null,
    })),
  };
}

/** List row — Inbound orders table. */
export function publicInboundOrderListItem(order: AnyOrder) {
  const lineCount =
    order._count?.lines ??
    (Array.isArray(order.lines) ? order.lines.length : null);
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    expectedArrivalDate: order.expectedArrivalDate ?? null,
    lines: lineCount,
    createdAt: order.createdAt ?? null,
    externalOrderId: externalOrderIdOf(order),
  };
}

/** Detail — Inbound order details page. */
export function publicInboundOrder(order: AnyOrder) {
  const lines = order.lines ?? [];
  const skuCount = new Set(
    lines.map((l) => lineProduct(l).sku || str(l.productId) || '').filter(Boolean),
  ).size;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    externalOrderId: externalOrderIdOf(order),
    expectedArrivalDate: order.expectedArrivalDate ?? null,
    createdAt: order.createdAt ?? null,
    confirmedAt: order.confirmedAt ?? null,
    completedAt: order.completedAt ?? null,
    notes: order.notes ?? null,
    skuCount,
    lines: lines.map((line) => {
      const p = lineProduct(line);
      return {
        lineNumber: num(line.lineNumber),
        productName: p.name,
        sku: p.sku,
        imageUrl: p.imageUrl,
        expectedQuantity: num(line.expectedQuantity ?? line.quantity) ?? 0,
        receivedQuantity: num(line.receivedQuantity) ?? 0,
      };
    }),
  };
}

/** List row — Outbound orders table. */
export function publicOutboundOrderListItem(order: AnyOrder) {
  const lineCount =
    order._count?.lines ??
    (Array.isArray(order.lines) ? order.lines.length : null);
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    recipientName: order.recipientName ?? null,
    requiredShipDate: order.requiredShipDate ?? null,
    lines: lineCount,
    createdAt: order.createdAt ?? null,
    externalOrderId: externalOrderIdOf(order),
  };
}

/** Detail — Outbound order details page. */
export function publicOutboundOrder(order: AnyOrder) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    externalOrderId: externalOrderIdOf(order),
    destination: order.destinationAddress ?? null,
    requiredShipDate: order.requiredShipDate ?? null,
    carrier: order.carrier ?? null,
    trackingNumber: order.trackingNumber ?? null,
    createdAt: order.createdAt ?? null,
    confirmedAt: order.confirmedAt ?? null,
    shippedAt: order.shippedAt ?? null,
    notes: order.notes ?? null,
    lines: (order.lines ?? []).map((line) => {
      const p = lineProduct(line);
      return {
        lineNumber: num(line.lineNumber),
        productName: p.name,
        sku: p.sku,
        imageUrl: p.imageUrl,
        requestedQuantity: num(line.requestedQuantity ?? line.quantity) ?? 0,
        pickedQuantity: num(line.pickedQuantity) ?? 0,
      };
    }),
  };
}
