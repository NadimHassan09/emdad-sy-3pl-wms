/** Mirrors backend `ReservationSnapshot` on `execution_state.reservations`. */
export interface PickReservationRow {
  outboundOrderLineId: string;
  locationId: string;
  lotId: string | null;
  quantity: string;
  productId: string;
}

export type PickScanStep = 'location' | 'product' | 'quantity';

export type PickLineStatus = 'pending' | 'scanning' | 'ready' | 'complete' | 'short';

export type PickLineDraft = {
  rowKey: string;
  outboundOrderLineId: string;
  locationId: string;
  lotId: string | null;
  productId: string;
  requiredQty: string;
  pickedQty: string;
  locationVerified: boolean;
  productVerified: boolean;
  notes: string;
  exceptionType: 'none' | 'short' | 'damaged';
};

export type PickExecutionDraft = {
  lines: PickLineDraft[];
  activeLineIndex?: number;
  collapsedRowKeys?: string[];
  packingDestinationId?: string;
};

export type PickSummary = {
  totalSkus: number;
  totalUnits: number;
  completedPicks: number;
  remainingPicks: number;
  uniqueLocations: number;
  completionPct: number;
};
