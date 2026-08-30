import { OmsOrderStatus } from '@prisma/client';

/** Loose UUID check used only to choose lookup path. */
export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

/** Guard Prisma UUID columns — never pass raw user identifiers here. */
export function assertOmsOrderUuid(omsOrderId: string): void {
  if (!looksLikeUuid(omsOrderId)) {
    throw new Error(
      `omsOrderId must be a resolved UUID before OMS-return queries (got "${omsOrderId}").`,
    );
  }
}

export type ExpressReturnMatchedBy = 'id' | 'orderNumber' | 'clientReference';

export type ExpressReturnResolveFail = {
  ok: false;
  error: string;
};

export type ExpressReturnResolveOk<TOrder> = {
  ok: true;
  order: TOrder;
  matchedBy: ExpressReturnMatchedBy;
};

export type ExpressReturnResolveResult<TOrder> =
  | ExpressReturnResolveOk<TOrder>
  | ExpressReturnResolveFail;

/**
 * Sole entry for Express Return identifiers.
 * Never use the raw input as omsOrderId in Prisma UUID filters after this.
 * Callers pass Prisma `include` for lines/company fields as needed.
 */
export async function resolveExpressReturnOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { omsOrder: { findUnique: (...args: any[]) => any; findMany: (...args: any[]) => any } },
  rawInput: string,
  include?: Record<string, unknown>,
): Promise<ExpressReturnResolveResult<any>> {
  const input = rawInput.trim();
  if (!input) {
    return { ok: false, error: 'Order not found.' };
  }

  if (looksLikeUuid(input)) {
    const order = await prisma.omsOrder.findUnique({
      where: { id: input },
      ...(include ? { include } : {}),
    });
    if (!order) return { ok: false, error: 'Order not found.' };
    return { ok: true, order, matchedBy: 'id' };
  }

  const byNumber = await prisma.omsOrder.findMany({
    where: { orderNumber: { equals: input, mode: 'insensitive' } },
    ...(include ? { include } : {}),
    take: 2,
  });
  if (byNumber.length === 1) {
    return { ok: true, order: byNumber[0], matchedBy: 'orderNumber' };
  }
  if (byNumber.length > 1) {
    return {
      ok: false,
      error: 'Ambiguous order number; multiple OMS orders match.',
    };
  }

  const byClientRef = await prisma.omsOrder.findMany({
    where: { clientReference: { equals: input, mode: 'insensitive' } },
    ...(include ? { include } : {}),
    take: 2,
  });
  if (byClientRef.length === 1) {
    return { ok: true, order: byClientRef[0], matchedBy: 'clientReference' };
  }
  if (byClientRef.length > 1) {
    return {
      ok: false,
      error: 'Ambiguous client reference; multiple OMS orders match.',
    };
  }

  return { ok: false, error: 'Order not found.' };
}

const IN_PROGRESS_STATUSES = new Set<OmsOrderStatus>([
  OmsOrderStatus.processing,
  OmsOrderStatus.pending,
  OmsOrderStatus.pending_approval,
  OmsOrderStatus.waiting_for_confirmation,
  OmsOrderStatus.confirmed_waiting_for_admin_approval,
  OmsOrderStatus.approved,
  OmsOrderStatus.confirmed,
  OmsOrderStatus.allocated,
  OmsOrderStatus.picking,
  OmsOrderStatus.packing,
  OmsOrderStatus.ready_to_ship,
  OmsOrderStatus.draft,
]);

/** Human-readable reason when status is not return-eligible. */
export function expressReturnStatusRejectReason(status: OmsOrderStatus): string {
  if (status === OmsOrderStatus.cancelled || status === OmsOrderStatus.rejected) {
    return 'Order is cancelled';
  }
  if (status === OmsOrderStatus.returned) {
    return 'Order is already fully returned';
  }
  if (IN_PROGRESS_STATUSES.has(status)) {
    return 'Order is still in progress';
  }
  return `Order status is ${status}, expected delivered, shipped, or out_for_delivery.`;
}

/** Case-insensitive input dedupe preserving first occurrence order. */
export function dedupeExpressReturnInputs(inputs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of inputs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
