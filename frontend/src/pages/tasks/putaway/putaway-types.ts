import type { Location } from '../../../api/locations';

export interface PutawayLineRow {
  inbound_order_line_id: string;
  quantity: string;
  lot_id?: string | null;
  product_id?: string;
  source_staging_location_id?: string;
}

export type PutawayScanStep = 'source' | 'destination' | 'product';

export type PutawayLineStatus = 'pending' | 'scanning' | 'ready' | 'complete';

export type PutawayLineDraft = {
  rowKey: string;
  inbound_order_line_id: string;
  putaway_quantity: string;
  destination_location_id: string;
  lot_id?: string | null;
  sourceVerified: boolean;
  destVerified: boolean;
  productVerified: boolean;
  notes: string;
};

export type PutawayExecutionDraft = {
  lines: PutawayLineDraft[];
  activeLineIndex?: number;
  collapsedRowKeys?: string[];
};

export type PutawaySummary = {
  totalSkus: number;
  totalUnits: number;
  completedMoves: number;
  remainingMoves: number;
  completionPct: number;
};

export type LocationDisplay = {
  fullPath: string;
  shortLabel: string;
  segments: string[];
  location?: Location;
};
