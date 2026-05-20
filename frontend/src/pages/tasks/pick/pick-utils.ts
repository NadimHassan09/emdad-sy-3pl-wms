import type { OutboundOrderLine } from '../../../api/outbound';
import type { Location } from '../../../api/locations';

import type {
  PickLineDraft,
  PickLineStatus,
  PickReservationRow,
  PickScanStep,
  PickSummary,
} from './pick-types';
import { locationDisplay, matchLocationByScan, parseQty } from '../putaway/putaway-utils';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parsePickReservationsFromExecutionState(raw: unknown): PickReservationRow[] {
  if (!isRecord(raw)) return [];
  const res = raw.reservations;
  if (!Array.isArray(res)) return [];
  const out: PickReservationRow[] = [];
  for (const row of res) {
    if (!isRecord(row)) continue;
    const outboundOrderLineId =
      typeof row.outboundOrderLineId === 'string'
        ? row.outboundOrderLineId
        : typeof row.outbound_order_line_id === 'string'
          ? row.outbound_order_line_id
          : null;
    const locationId =
      typeof row.locationId === 'string'
        ? row.locationId
        : typeof row.location_id === 'string'
          ? row.location_id
          : null;
    const quantity =
      typeof row.quantity === 'string'
        ? row.quantity
        : typeof row.quantity === 'number'
          ? String(row.quantity)
          : null;
    const productId =
      typeof row.productId === 'string'
        ? row.productId
        : typeof row.product_id === 'string'
          ? row.product_id
          : null;
    let lotId: string | null = null;
    if (row.lotId !== undefined && row.lotId !== null && row.lotId !== '') {
      lotId = String(row.lotId);
    } else if (row.lot_id !== undefined && row.lot_id !== null && row.lot_id !== '') {
      lotId = String(row.lot_id);
    }
    if (!outboundOrderLineId || !locationId || !quantity || !productId) continue;
    out.push({ outboundOrderLineId, locationId, lotId, quantity, productId });
  }
  return out;
}

export function buildPickCompletePayload(rows: PickReservationRow[]): {
  task_type: 'pick';
  picks: Array<{
    outbound_order_line_id: string;
    lines: Array<{ location_id: string; lot_id?: string | null; quantity: string }>;
  }>;
} {
  const groups = new Map<string, PickReservationRow[]>();
  for (const r of rows) {
    const g = groups.get(r.outboundOrderLineId) ?? [];
    g.push(r);
    groups.set(r.outboundOrderLineId, g);
  }
  return {
    task_type: 'pick',
    picks: [...groups.entries()].map(([outbound_order_line_id, slice]) => ({
      outbound_order_line_id,
      lines: slice.map((row) => ({
        location_id: row.locationId,
        lot_id: row.lotId,
        quantity: row.quantity,
      })),
    })),
  };
}

export function reservationRowKey(r: PickReservationRow, index: number): string {
  return `${r.outboundOrderLineId}-${r.locationId}-${r.lotId ?? 'nl'}-${index}`;
}

export function initialPickDrafts(
  reservations: PickReservationRow[],
  saved?: PickLineDraft[],
): PickLineDraft[] {
  const byKey = new Map((saved ?? []).map((s) => [s.rowKey, s]));
  return reservations.map((r, i) => {
    const rowKey = reservationRowKey(r, i);
    return (
      byKey.get(rowKey) ?? {
        rowKey,
        outboundOrderLineId: r.outboundOrderLineId,
        locationId: r.locationId,
        lotId: r.lotId,
        productId: r.productId,
        requiredQty: r.quantity,
        pickedQty: r.quantity,
        locationVerified: false,
        productVerified: false,
        notes: '',
        exceptionType: 'none',
      }
    );
  });
}

export function sortDraftsByLocationPath(
  drafts: PickLineDraft[],
  locations: Location[],
): PickLineDraft[] {
  const pathOf = (id: string) =>
    locations.find((l) => l.id === id)?.fullPath ?? id;
  return [...drafts].sort((a, b) => pathOf(a.locationId).localeCompare(pathOf(b.locationId)));
}

export function computePickLineStatus(draft: PickLineDraft): PickLineStatus {
  const required = parseQty(draft.requiredQty);
  const picked = parseQty(draft.pickedQty);
  if (picked > 0 && picked < required - 1e-6) return 'short';
  if (
    draft.locationVerified &&
    draft.productVerified &&
    picked >= required - 1e-6 &&
    draft.exceptionType === 'none'
  ) {
    return 'complete';
  }
  if (draft.locationVerified && draft.productVerified) return 'ready';
  if (draft.locationVerified) return 'scanning';
  return 'pending';
}

export function pickLineStatusLabel(status: PickLineStatus): string {
  const m: Record<PickLineStatus, string> = {
    pending: 'Pending',
    scanning: 'At bin',
    ready: 'Confirm qty',
    complete: 'Complete',
    short: 'Short',
  };
  return m[status];
}

export function pickLineStatusClass(status: PickLineStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-100 text-emerald-800';
    case 'ready':
      return 'bg-sky-100 text-sky-800';
    case 'short':
      return 'bg-rose-100 text-rose-900';
    case 'scanning':
      return 'bg-amber-100 text-amber-900';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function computePickSummary(
  reservations: PickReservationRow[],
  drafts: PickLineDraft[],
): PickSummary {
  const skuIds = new Set(reservations.map((r) => r.productId));
  let totalUnits = 0;
  for (const r of reservations) totalUnits += parseQty(r.quantity);

  const locIds = new Set(reservations.map((r) => r.locationId));
  let completedPicks = 0;
  for (const d of drafts) {
    if (computePickLineStatus(d) === 'complete') completedPicks += 1;
  }
  const remainingPicks = Math.max(0, drafts.length - completedPicks);
  const completionPct =
    drafts.length > 0 ? Math.min(100, Math.round((completedPicks / drafts.length) * 100)) : 0;

  return {
    totalSkus: skuIds.size,
    totalUnits,
    completedPicks,
    remainingPicks,
    uniqueLocations: locIds.size,
    completionPct,
  };
}

export function pickScanStepLabel(step: PickScanStep): string {
  switch (step) {
    case 'location':
      return 'Scan source bin location';
    case 'product':
      return 'Scan product barcode';
    case 'quantity':
      return 'Confirm picked quantity';
  }
}

export function matchReservationLocationScan(
  code: string,
  expectedLocationId: string,
  locations: Location[],
): boolean {
  const hit = matchLocationByScan(code, locations);
  return !!hit && hit.id === expectedLocationId;
}

export function matchReservationProductScan(
  code: string,
  productId: string,
  lineMeta: Map<string, OutboundOrderLine>,
  outboundLineId: string,
): boolean {
  const ol = lineMeta.get(outboundLineId);
  if (!ol?.product || ol.productId !== productId) return false;
  const c = code.trim().toLowerCase();
  const sku = ol.product.sku?.trim().toLowerCase();
  const bc = ol.product.barcode?.trim().toLowerCase();
  return (!!sku && sku === c) || (!!bc && bc === c);
}

// Re-export for pick panel
export { locationDisplay, matchLocationByScan, parseQty };
