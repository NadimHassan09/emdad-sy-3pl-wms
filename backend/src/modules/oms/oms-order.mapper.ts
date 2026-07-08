import type { OutboundOrder, OutboundOrderLine, Prisma } from '@prisma/client';

type OrderWithLines = OutboundOrder & {
  lines: OutboundOrderLine[];
  company?: { id: string; name: string } | null;
};

function dec(v: Prisma.Decimal | null | undefined): string | null {
  if (v == null) return null;
  return v.toString();
}

function buildLegacyDestination(order: OutboundOrder): string {
  const parts = [
    order.addressLine1,
    order.district,
    order.city,
    order.addressLine2,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return order.destinationAddress;
}

export function serializeOmsOrder(order: OrderWithLines) {
  return {
    ...order,
    destinationAddress: buildLegacyDestination(order),
    subtotal: dec(order.subtotal),
    shippingFee: dec(order.shippingFee),
    codAmount: dec(order.codAmount),
    lines: order.lines.map((l) => ({
      ...l,
      requestedQuantity: l.requestedQuantity.toString(),
      pickedQuantity: l.pickedQuantity.toString(),
      unitPrice: dec(l.unitPrice),
      lineTotal: dec(l.lineTotal),
      discountAmount: dec(l.discountAmount),
    })),
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
