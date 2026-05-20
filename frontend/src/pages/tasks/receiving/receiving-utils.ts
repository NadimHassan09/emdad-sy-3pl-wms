import type { InboundOrder, InboundOrderLine } from '../../../api/inbound';
import type { Product } from '../../../api/products';

import type {
  LineReceiveDraft,
  MatchedLine,
  ReceivingLineRow,
  ReceivingLineStatus,
  ReceivingSummary,
} from './receiving-types';

export function parseQty(v: string | undefined): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function receivingExpectedLotDisplay(ol: InboundOrderLine | undefined): string {
  if (!ol || ol.product?.trackingType !== 'lot') return '—';
  return ol.expectedLotNumber?.trim() || '—';
}

export function computeLineStatus(
  expected: number,
  received: number,
  damaged: number,
): ReceivingLineStatus {
  const accounted = received + damaged;
  if (damaged > 0 && accounted < expected) return 'damaged';
  if (accounted <= 0) return 'pending';
  if (received > expected) return 'overage';
  if (accounted < expected) return 'shortage';
  if (accounted >= expected) return 'complete';
  return 'partial';
}

export function lineStatusLabel(status: ReceivingLineStatus): string {
  const labels: Record<ReceivingLineStatus, string> = {
    pending: 'Pending',
    partial: 'In progress',
    complete: 'Complete',
    shortage: 'Short',
    overage: 'Overage',
    damaged: 'Damage noted',
  };
  return labels[status];
}

export function lineStatusClass(status: ReceivingLineStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-100 text-emerald-800';
    case 'shortage':
    case 'damaged':
      return 'bg-amber-100 text-amber-900';
    case 'overage':
      return 'bg-rose-100 text-rose-800';
    case 'partial':
      return 'bg-sky-100 text-sky-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function computeReceivingSummary(
  rows: ReceivingLineRow[],
  drafts: Record<string, LineReceiveDraft>,
): ReceivingSummary {
  let expectedTotal = 0;
  let receivedTotal = 0;
  let damagedTotal = 0;

  for (const row of rows) {
    const expected = parseQty(row.expected_qty);
    const d = drafts[row.inbound_order_line_id];
    expectedTotal += expected;
    receivedTotal += parseQty(d?.receivedQty);
    damagedTotal += parseQty(d?.damagedQty);
  }

  const remainingTotal = Math.max(0, expectedTotal - receivedTotal - damagedTotal);
  const completionPct =
    expectedTotal > 0 ? Math.min(100, Math.round(((receivedTotal + damagedTotal) / expectedTotal) * 100)) : 0;

  return {
    totalSkus: rows.length,
    expectedTotal,
    receivedTotal,
    damagedTotal,
    remainingTotal,
    completionPct,
  };
}

export function matchScanToLine(
  scan: string,
  rows: ReceivingLineRow[],
  lineMap: Map<string, InboundOrderLine>,
): MatchedLine | null {
  const code = scan.trim().toLowerCase();
  if (!code) return null;

  for (const row of rows) {
    const ol = lineMap.get(row.inbound_order_line_id);
    const sku = ol?.product?.sku?.trim().toLowerCase();
    const bc = ol?.product?.barcode?.trim().toLowerCase();
    if (sku === code || bc === code) {
      return { lineId: row.inbound_order_line_id, row, orderLine: ol };
    }
  }
  return null;
}

/** Heuristic: no lots, no on-hand, no prior completed inbound receipt for this SKU. */
export function isLikelyFirstInbound(
  productId: string,
  product: Product | undefined,
  lotsCount: number,
  inboundOrders: InboundOrder[],
  currentOrderId: string,
): boolean {
  if (lotsCount > 0) return false;
  const onHand = parseQty(String(product?.totalOnHand ?? '0'));
  if (onHand > 0) return false;

  for (const order of inboundOrders) {
    if (order.id === currentOrderId) continue;
    if (order.status !== 'completed' && order.status !== 'partially_received') continue;
    for (const line of order.lines) {
      if (line.productId === productId && parseQty(line.receivedQuantity) > 0) {
        return false;
      }
    }
  }
  return true;
}

export function formatDim(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? String(n) : String(v);
}

export function buildDiscrepancyNotes(draft: LineReceiveDraft): string | undefined {
  const parts: string[] = [];
  const note = draft.notes.trim();
  if (note) parts.push(note);
  const damaged = parseQty(draft.damagedQty);
  if (damaged > 0) parts.push(`damaged:${damaged}`);
  const exp = draft.expiry.trim();
  if (exp) parts.push(`expiry:${exp}`);
  return parts.length ? parts.join(' · ') : undefined;
}
