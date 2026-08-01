export type OrderExecutionMode = 'admin' | 'workers';

export type InboundPutawaySplit = {
  locationId: string;
  qty: number;
};

export type InboundExecutionPlan = {
  warehouseId: string;
  receivingDockId: string;
  lines: Array<{
    productId: string;
    orderLineId?: string;
    expectedQty: number;
    putaway?: InboundPutawaySplit[];
  }>;
  planUpdatedAt: string;
};

export type OutboundSuggestedPick = {
  outboundOrderLineId?: string;
  productId: string;
  locationId: string;
  locationPath?: string;
  qty: number;
  lotId?: string | null;
};

export type OutboundExecutionPlan = {
  warehouseId: string;
  packingLocationId?: string;
  dispatchDockId?: string;
  requiresPacking: boolean;
  lines: Array<{
    productId: string;
    orderLineId?: string;
    expectedQty: number;
  }>;
  suggestedPicks?: OutboundSuggestedPick[];
  planUpdatedAt: string;
};

export function isAdminExecutionMode(mode: string | null | undefined): boolean {
  return mode === 'admin';
}

/**
 * Admin plan → print → confirm UI.
 * Workers mode keeps the task/stage workspace — except client-portal
 * `pending_approval` orders, which admin must finish planning first.
 */
export function usesAdminOrderExecutionUi(order: {
  executionMode?: string | null;
  status?: string | null;
}): boolean {
  if (order.status === 'pending_approval') return true;
  return order.executionMode !== 'workers';
}

export function inboundAdminPlanIsComplete(
  plan: InboundExecutionPlan | null | undefined,
  lineProductIds: string[],
): boolean {
  if (!plan?.warehouseId?.trim() || !plan.receivingDockId?.trim()) return false;
  if (lineProductIds.length === 0) return false;
  for (const productId of lineProductIds) {
    const match = plan.lines.find((l) => l.productId === productId);
    if (!match) return false;
    const splits = match.putaway ?? [];
    if (splits.length === 0) return false;
    const sum = splits.reduce((a, s) => a + Number(s.qty), 0);
    if (!(match.expectedQty > 0) || Math.abs(sum - match.expectedQty) > 1e-6) return false;
  }
  return true;
}
