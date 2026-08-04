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

/** Matches backend normalizeExecutionMode (omitted → admin). */
export function normalizeExecutionMode(mode: string | null | undefined): OrderExecutionMode {
  return mode === 'workers' ? 'workers' : 'admin';
}

export function isAdminExecutionMode(mode: string | null | undefined): boolean {
  return normalizeExecutionMode(mode) === 'admin';
}

/**
 * @deprecated Unified Order Execution: Admin detail always uses Order Execution View.
 * Kept as `true` so any leftover call sites do not remount the stage workspace.
 */
export function usesAdminOrderExecutionUi(_order?: {
  executionMode?: string | null;
  status?: string | null;
}): boolean {
  return true;
}

/** Mirrors backend assertInboundAdminPlanComplete messages for UI readiness lists. */
export function inboundAdminPlanReadinessIssues(
  plan: InboundExecutionPlan | null | undefined,
  lines: Array<{ id?: string; productId: string; expectedQuantity: string | number }>,
): string[] {
  const issues: string[] = [];
  if (!plan?.warehouseId?.trim()) issues.push('Admin plan requires warehouseId.');
  if (!plan?.receivingDockId?.trim()) issues.push('Admin plan requires receivingDockId.');
  if (lines.length === 0) {
    issues.push('Admin plan requires at least one line.');
    return issues;
  }
  if (!plan) return issues;
  for (const line of lines) {
    const match =
      (line.id ? plan.lines.find((l) => l.orderLineId === line.id) : undefined) ??
      plan.lines.find((l) => l.productId === line.productId);
    if (!match) {
      issues.push(`Admin plan requires putaway locations for product ${line.productId}.`);
      continue;
    }
    const splits = match.putaway ?? [];
    if (splits.length === 0) {
      issues.push(`Admin plan requires putaway locations for product ${line.productId}.`);
      continue;
    }
    const expected = Number(line.expectedQuantity);
    const sum = splits.reduce((a, s) => a + Number(s.qty), 0);
    if (!(expected > 0) || Math.abs(sum - expected) > 1e-6) {
      issues.push(
        `Putaway quantities for product ${line.productId} must sum to ${expected} (got ${sum}).`,
      );
    }
    if (splits.some((s) => !s.locationId?.trim())) {
      issues.push(`Admin plan requires putaway locations for product ${line.productId}.`);
    }
  }
  return issues;
}

export function inboundAdminPlanIsComplete(
  plan: InboundExecutionPlan | null | undefined,
  lines: Array<{ id?: string; productId: string; expectedQuantity: string | number }>,
): boolean {
  return inboundAdminPlanReadinessIssues(plan, lines).length === 0;
}

/** Mirrors backend assertOutboundAdminPlanComplete messages for UI readiness lists. */
export function outboundAdminPlanReadinessIssues(
  plan: OutboundExecutionPlan | null | undefined,
  lines: Array<{ productId: string; requestedQuantity?: string | number }>,
): string[] {
  const issues: string[] = [];
  if (!plan?.warehouseId?.trim()) issues.push('Admin plan requires warehouseId.');
  if (!plan?.dispatchDockId?.trim()) issues.push('Admin plan requires dispatchDockId.');
  if (plan && plan.requiresPacking !== false && !plan.packingLocationId?.trim()) {
    issues.push('Admin plan requires packingLocationId when packing is required.');
  }
  if (lines.length === 0) {
    issues.push('Admin plan requires at least one line.');
    return issues;
  }
  if (!plan) return issues;
  for (const line of lines) {
    const match = plan.lines.find((l) => l.productId === line.productId);
    if (!match || !(match.expectedQty > 0)) {
      issues.push(`Admin plan requires a line plan for product ${line.productId}.`);
    }
  }
  return issues;
}

export function outboundAdminPlanIsComplete(
  plan: OutboundExecutionPlan | null | undefined,
  lines: Array<{ productId: string; requestedQuantity?: string | number }>,
): boolean {
  return outboundAdminPlanReadinessIssues(plan, lines).length === 0;
}
