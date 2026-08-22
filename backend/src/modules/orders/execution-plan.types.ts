/** Shared Admin / Worker execution plan stored on inbound & outbound orders. */

export type OrderExecutionMode = 'admin' | 'workers';

export type InboundPutawaySplit = {
  locationId: string;
  qty: number;
};

export type InboundExecutionPlanLine = {
  productId: string;
  /** Set after create when lines exist. */
  orderLineId?: string;
  expectedQty: number;
  putaway?: InboundPutawaySplit[];
};

export type InboundExecutionPlan = {
  warehouseId: string;
  receivingDockId: string;
  lines: InboundExecutionPlanLine[];
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
