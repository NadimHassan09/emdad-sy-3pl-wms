import { NotFoundException } from '@nestjs/common';
import { OutboundOrderStatus, Prisma } from '@prisma/client';

/** Statuses that may transition to confirmed/picking/shipped via confirm. */
export const OUTBOUND_CONFIRMABLE: OutboundOrderStatus[] = [
  OutboundOrderStatus.draft,
  OutboundOrderStatus.pending_approval,
];

/** Statuses indicating confirm already ran (safe idempotent replay). */
export const OUTBOUND_POST_CONFIRM: OutboundOrderStatus[] = [
  OutboundOrderStatus.confirmed,
  OutboundOrderStatus.picking,
  OutboundOrderStatus.packing,
  OutboundOrderStatus.ready_to_ship,
  OutboundOrderStatus.shipped,
];

export function isOutboundConfirmable(status: OutboundOrderStatus): boolean {
  return OUTBOUND_CONFIRMABLE.includes(status);
}

export function isOutboundPostConfirm(status: OutboundOrderStatus): boolean {
  return OUTBOUND_POST_CONFIRM.includes(status);
}

/** Serialize confirm attempts per outbound order (PostgreSQL row lock). */
export async function lockOutboundOrderRow(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM outbound_orders WHERE id = ${orderId}::uuid FOR UPDATE`,
  );
  if (rows.length === 0) {
    throw new NotFoundException('Outbound order not found.');
  }
}

/**
 * Compare-and-set: transition only from confirmable statuses.
 * Returns true when this transaction claimed the confirm.
 */
export async function claimOutboundConfirmableOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  data: Prisma.OutboundOrderUncheckedUpdateInput,
): Promise<boolean> {
  const result = await tx.outboundOrder.updateMany({
    where: { id: orderId, status: { in: OUTBOUND_CONFIRMABLE } },
    data,
  });
  return result.count === 1;
}

/** Second-phase CAS for atomic confirm → shipped after inventory deduction. */
export async function finalizeOutboundShipped(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  const result = await tx.outboundOrder.updateMany({
    where: { id: orderId, status: OutboundOrderStatus.picking },
    data: {
      status: OutboundOrderStatus.shipped,
      shippedAt: new Date(),
    },
  });
  return result.count === 1;
}
