import type { InboundOrderLine } from '../../../api/inbound';
import type { Location } from '../../../api/locations';
import {
  matchesTaskLineSearch,
  type TaskLineFilters,
} from '../../../lib/task-line-filters';

import type {
  PutawayLineDraft,
  PutawayLineRow,
  PutawayLineStatus,
  PutawaySummary,
  LocationDisplay,
} from './putaway-types';

export function parseQty(v: string | undefined): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function locationDisplay(loc: Location | undefined): LocationDisplay {
  if (!loc) {
    return { fullPath: '—', shortLabel: '—', segments: [] };
  }
  const segments = loc.fullPath
    .split(/[/\-·>]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const shortLabel = segments.length > 0 ? segments[segments.length - 1]! : loc.fullPath;
  return { fullPath: loc.fullPath, shortLabel, segments, location: loc };
}

export function matchLocationByScan(code: string, locations: Location[]): Location | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return locations.find((l) => {
    const bc = (l.barcode ?? '').trim().toLowerCase();
    const fp = l.fullPath.trim().toLowerCase();
    const name = l.name.trim().toLowerCase();
    return bc === c || fp === c || fp.endsWith(c) || name === c;
  });
}

export function matchProductScan(
  code: string,
  ol: InboundOrderLine | undefined,
): boolean {
  if (!ol?.product) return false;
  const c = code.trim().toLowerCase();
  const sku = ol.product.sku?.trim().toLowerCase();
  const bc = ol.product.barcode?.trim().toLowerCase();
  return (!!sku && sku === c) || (!!bc && bc === c);
}

export function putawayLotLabel(
  lotId: string | null | undefined,
  ol: InboundOrderLine | undefined,
  lots: Array<{ id: string; lotNumber: string; expiryDate?: string | null }>,
): string {
  if (!ol || ol.product?.trackingType !== 'lot') return '—';
  if (lotId) {
    const hit = lots.find((x) => x.id === lotId);
    return hit?.lotNumber ?? `${lotId.slice(0, 8)}…`;
  }
  return ol.expectedLotNumber?.trim() || '—';
}

export function computeLineStatus(
  draft: PutawayLineDraft,
  targetQty: number,
): PutawayLineStatus {
  const moved = parseQty(draft.putaway_quantity);
  if (moved <= 0) return 'pending';
  if (draft.sourceVerified && draft.destVerified && draft.destination_location_id) {
    return moved >= targetQty - 1e-6 ? 'complete' : 'ready';
  }
  return 'scanning';
}

export function lineStatusLabel(status: PutawayLineStatus): string {
  const m: Record<PutawayLineStatus, string> = {
    pending: 'Pending',
    scanning: 'In progress',
    ready: 'Ready',
    complete: 'Complete',
  };
  return m[status];
}

export function lineStatusClass(status: PutawayLineStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-100 text-emerald-800';
    case 'ready':
      return 'bg-sky-100 text-sky-800';
    case 'scanning':
      return 'bg-amber-100 text-amber-900';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function putawayLineStatusFilterOptions(): Array<{
  value: PutawayLineStatus | '';
  label: string;
}> {
  return [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: lineStatusLabel('pending') },
    { value: 'scanning', label: lineStatusLabel('scanning') },
    { value: 'ready', label: lineStatusLabel('ready') },
    { value: 'complete', label: lineStatusLabel('complete') },
  ];
}

export function filterPutawayDrafts(
  drafts: PutawayLineDraft[],
  filters: TaskLineFilters,
  lineById: Map<string, InboundOrderLine>,
  targetQty: Record<string, number>,
  lotsByProductId: Map<string, Array<{ id: string; lotNumber: string }>>,
): PutawayLineDraft[] {
  return drafts.filter((d) => {
    const ol = lineById.get(d.inbound_order_line_id);
    const status = computeLineStatus(d, targetQty[d.inbound_order_line_id] ?? 0);
    if (filters.status && status !== filters.status) return false;
    const lots = ol?.productId ? lotsByProductId.get(ol.productId) : undefined;
    return matchesTaskLineSearch(filters.search, {
      sku: ol?.product?.sku,
      name: ol?.product?.name,
      barcode: ol?.product?.barcode,
      lot: putawayLotLabel(d.lot_id, ol, lots ?? []),
    });
  });
}

export function computePutawaySummary(
  rows: PutawayLineRow[],
  drafts: PutawayLineDraft[],
): PutawaySummary {
  const lineIds = new Set(rows.map((r) => r.inbound_order_line_id));
  let totalUnits = 0;
  let completedMoves = 0;
  let remainingMoves = 0;

  for (const lid of lineIds) {
    const target = parseQty(rows.find((r) => r.inbound_order_line_id === lid)?.quantity);
    totalUnits += target;
    const lineDrafts = drafts.filter((d) => d.inbound_order_line_id === lid);
    const moved = lineDrafts.reduce((s, d) => s + parseQty(d.putaway_quantity), 0);
    const done = lineDrafts.some(
      (d) => d.sourceVerified && d.destVerified && d.destination_location_id && parseQty(d.putaway_quantity) > 0,
    );
    if (done && moved >= target - 1e-6) completedMoves += 1;
    else remainingMoves += 1;
  }

  const completionPct =
    lineIds.size > 0 ? Math.min(100, Math.round((completedMoves / lineIds.size) * 100)) : 0;

  return {
    totalSkus: lineIds.size,
    totalUnits,
    completedMoves,
    remainingMoves,
    completionPct,
  };
}

export function scanStepLabel(step: 'source' | 'destination' | 'product'): string {
  switch (step) {
    case 'source':
      return 'Scan source (staging) location';
    case 'destination':
      return 'Scan destination bin';
    case 'product':
      return 'Scan product barcode';
  }
}
