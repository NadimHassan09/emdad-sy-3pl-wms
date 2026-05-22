import type { InboundOrderLine } from '../../../api/inbound';

export interface ReceivingLineRow {
  inbound_order_line_id: string;
  expected_qty: string;
  staging_location_id: string;
}

export type ReceivingLineStatus =
  | 'pending'
  | 'partial'
  | 'complete'
  | 'shortage'
  | 'overage'
  | 'damaged';

export type ReceivingLineFilters = {
  search: string;
  status: ReceivingLineStatus | '';
};

export const DEFAULT_RECEIVING_LINE_FILTERS: ReceivingLineFilters = {
  search: '',
  status: '',
};

export type LineReceiveDraft = {
  receivedQty: string;
  damagedQty: string;
  notes: string;
  expiry: string;
};

export type ProductAttributeDraft = {
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  confirmedMatch: boolean;
  notes: string;
  completed: boolean;
};

export type ReceivingExecutionDraft = {
  lines: Record<string, LineReceiveDraft>;
  attributes: Record<string, ProductAttributeDraft>;
  lastScan?: string;
  lastScanAt?: string;
};

export type ReceivingSummary = {
  totalSkus: number;
  expectedTotal: number;
  receivedTotal: number;
  damagedTotal: number;
  remainingTotal: number;
  completionPct: number;
};

export type MatchedLine = {
  lineId: string;
  row: ReceivingLineRow;
  orderLine?: InboundOrderLine;
};
