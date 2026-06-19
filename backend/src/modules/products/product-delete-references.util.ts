import { Prisma } from '@prisma/client';

/** Inbound orders that represent committed warehouse activity. */
export const INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = [
  'confirmed',
  'in_progress',
  'partially_received',
  'completed',
] as const;

/** Outbound orders that represent committed warehouse activity. */
export const OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = [
  'pending_stock',
  'confirmed',
  'picking',
  'packing',
  'ready_to_ship',
  'shipped',
] as const;

/** Draft/cancelled orders may be cleaned up when hard-deleting an unused product. */
export const INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = [
  'draft',
  'pending_approval',
  'cancelled',
] as const;

export const OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = [
  'draft',
  'pending_approval',
  'cancelled',
] as const;

function productIdFilter(productIds: string | string[]): Prisma.StringFilter | string {
  return Array.isArray(productIds)
    ? productIds.length === 1
      ? productIds[0]
      : { in: productIds }
    : productIds;
}

export function inboundLinesBlockingProductDeleteWhere(
  productIds: string | string[],
): Prisma.InboundOrderLineWhereInput {
  return {
    productId: productIdFilter(productIds),
    order: { status: { in: [...INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE] } },
  };
}

export function outboundLinesBlockingProductDeleteWhere(
  productIds: string | string[],
): Prisma.OutboundOrderLineWhereInput {
  return {
    productId: productIdFilter(productIds),
    order: { status: { in: [...OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE] } },
  };
}

export async function purgeRemovableOrderLinesForProduct(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  await tx.inboundOrderLine.deleteMany({
    where: {
      productId,
      order: { status: { in: [...INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES] } },
    },
  });
  await tx.outboundOrderLine.deleteMany({
    where: {
      productId,
      order: { status: { in: [...OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES] } },
    },
  });
}
