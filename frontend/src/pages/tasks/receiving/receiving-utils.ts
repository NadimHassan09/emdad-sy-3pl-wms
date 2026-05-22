import type { InboundOrder, InboundOrderLine } from '../../../api/inbound';
import type { Product, ProductLot } from '../../../api/products';
import { downloadCsv } from '../../../lib/reports/csv-export';

import type {
  LineReceiveDraft,
  MatchedLine,
  ReceivingLineFilters,
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

export function filterReceivingLines(
  lines: ReceivingLineRow[],
  filters: ReceivingLineFilters,
  lineMap: Map<string, InboundOrderLine>,
  lineDrafts: Record<string, LineReceiveDraft>,
): ReceivingLineRow[] {
  const q = filters.search.trim().toLowerCase();
  return lines.filter((row) => {
    const lid = row.inbound_order_line_id;
    const ol = lineMap.get(lid);
    const d = lineDrafts[lid] ?? {
      receivedQty: '',
      damagedQty: '',
      notes: '',
      expiry: '',
    };
    const status = computeLineStatus(
      parseQty(row.expected_qty),
      parseQty(d.receivedQty),
      parseQty(d.damagedQty),
    );
    if (filters.status && status !== filters.status) return false;
    if (!q) return true;
    const sku = ol?.product?.sku?.toLowerCase() ?? '';
    const name = ol?.product?.name?.toLowerCase() ?? '';
    const bc = ol?.product?.barcode?.toLowerCase() ?? '';
    const lot = ol?.expectedLotNumber?.trim().toLowerCase() ?? '';
    return sku.includes(q) || name.includes(q) || bc.includes(q) || lot.includes(q);
  });
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

export function exportReceivingLinesCsv(
  lines: ReceivingLineRow[],
  lineMap: Map<string, InboundOrderLine>,
  lineDrafts: Record<string, LineReceiveDraft>,
  fileName: string,
): void {
  const headers = [
    'Product',
    'SKU',
    'Barcode',
    'Lot',
    'Expected',
    'Received',
    'Damaged',
    'Missing',
    'Status',
    'Expiry',
    'Notes',
  ];
  const rows = lines.map((l) => {
    const lid = l.inbound_order_line_id;
    const ol = lineMap.get(lid);
    const d = lineDrafts[lid] ?? { receivedQty: '', damagedQty: '', notes: '', expiry: '' };
    const expected = parseQty(l.expected_qty);
    const received = parseQty(d.receivedQty);
    const damaged = parseQty(d.damagedQty);
    const missing = Math.max(0, expected - received - damaged);
    const status = lineStatusLabel(computeLineStatus(expected, received, damaged));
    return [
      ol?.product?.name ?? '',
      ol?.product?.sku ?? '',
      ol?.product?.barcode ?? '',
      receivingExpectedLotDisplay(ol),
      l.expected_qty,
      d.receivedQty,
      d.damagedQty,
      String(missing),
      status,
      ol?.product?.expiryTracking ? d.expiry : '',
      d.notes,
    ];
  });
  downloadCsv(headers, rows, fileName);
}

export function parseDamagedFromDiscrepancyNotes(notes?: string | null): string {
  if (!notes) return '';
  const m = /damaged:([\d.]+)/i.exec(notes);
  return m ? m[1] : '';
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function parseExpiryFromDiscrepancyNotes(notes?: string | null): string {
  if (!notes) return '';
  const m = /expiry:(\d{4}-\d{2}-\d{2})/i.exec(notes);
  return m ? m[1] : '';
}

export function lotExpiryForOrderLine(
  ol: InboundOrderLine | undefined,
  lots: ProductLot[] | undefined,
): string {
  if (!ol?.expectedLotNumber?.trim() || !lots?.length) return '';
  const ln = ol.expectedLotNumber.trim().toLowerCase();
  const lot = lots.find((l) => l.lotNumber.trim().toLowerCase() === ln);
  return formatDateOnly(lot?.expiryDate);
}

export function productRequiresExpiry(
  ol: InboundOrderLine | undefined,
  fullProduct?: Pick<Product, 'expiryTracking' | 'trackingType'> | null,
): boolean {
  const p = fullProduct ?? ol?.product;
  if (!p) return false;
  return p.expiryTracking === true || p.trackingType === 'lot';
}

export function resolveLineExpiryDisplay(
  ol: InboundOrderLine | undefined,
  draft: LineReceiveDraft,
  lots?: ProductLot[],
): string {
  const fromDraft = draft.expiry.trim();
  if (fromDraft) return fromDraft;
  if (!ol) return '';
  const fromNotes = parseExpiryFromDiscrepancyNotes(ol.discrepancyNotes);
  if (fromNotes) return fromNotes;
  const fromExpected = formatDateOnly(ol.expectedExpiryDate);
  if (fromExpected) return fromExpected;
  return lotExpiryForOrderLine(ol, lots);
}

export function parseHumanNotesFromDiscrepancyNotes(notes?: string | null): string {
  if (!notes) return '';
  return notes
    .split(' · ')
    .filter(
      (part) =>
        !/^damaged:/i.test(part) &&
        !/^expiry:/i.test(part) &&
        !/^attr-validated:/i.test(part),
    )
    .join(' · ')
    .trim();
}

/** Rebuild receive-line draft from persisted inbound order line (completed receiving tasks). */
export function lineDraftFromInboundOrderLine(
  ol: InboundOrderLine,
  lots?: ProductLot[],
): LineReceiveDraft {
  const received = parseQty(ol.receivedQuantity);
  const damaged = parseDamagedFromDiscrepancyNotes(ol.discrepancyNotes);
  const empty: LineReceiveDraft = {
    receivedQty: '',
    damagedQty: '',
    notes: '',
    expiry: '',
  };
  return {
    receivedQty: received > 0 ? String(received) : '',
    damagedQty: damaged,
    notes: parseHumanNotesFromDiscrepancyNotes(ol.discrepancyNotes),
    expiry: resolveLineExpiryDisplay(ol, empty, lots),
  };
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
