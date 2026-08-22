import type { LedgerRow } from '../api/inventory';

export const fmtLedgerQty = (s: string | null | undefined): string => {
  if (s == null || s === '') return '—';
  const n = Number(s);
  if (Number.isNaN(n)) return String(s);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

function parseQty(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Prefer API `quantityChange` (already signed). Do not re-sign from movement type. */
export function ledgerSignedChange(row: LedgerRow): number {
  const n = parseQty(row.quantityChange);
  return n ?? 0;
}

export function fmtSignedDelta(n: number): string {
  const absFmt = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (n > 0) return `+${absFmt}`;
  if (n < 0) return `-${absFmt}`;
  return '0';
}

export type LedgerMovementCategory =
  | 'inbound'
  | 'outbound'
  | 'return'
  | 'adjustment'
  | 'transfer'
  | 'scrap'
  | 'qc';

const MOVEMENT_INBOUND = new Set(['inbound', 'inbound_receive', 'transit_in']);
const MOVEMENT_OUTBOUND = new Set(['outbound', 'outbound_pick', 'transit_out']);
const MOVEMENT_RETURN = new Set(['return', 'return_receive']);
const MOVEMENT_TRANSFER = new Set(['transfer', 'internal_transfer']);
const MOVEMENT_SCRAP = new Set(['scrap']);
const MOVEMENT_QC = new Set(['qc', 'qc_quarantine', 'qc_release']);

export function ledgerMovementCategory(raw: string): LedgerMovementCategory {
  const k = raw.trim();
  if (MOVEMENT_INBOUND.has(k)) return 'inbound';
  if (MOVEMENT_OUTBOUND.has(k)) return 'outbound';
  if (MOVEMENT_RETURN.has(k)) return 'return';
  if (MOVEMENT_TRANSFER.has(k)) return 'transfer';
  if (MOVEMENT_SCRAP.has(k)) return 'scrap';
  if (MOVEMENT_QC.has(k)) return 'qc';
  return 'adjustment';
}

export function ledgerMovementLabel(cat: LedgerMovementCategory): string {
  switch (cat) {
    case 'inbound':
      return 'Inbound';
    case 'outbound':
      return 'Outbound';
    case 'return':
      return 'Return';
    case 'transfer':
      return 'Transfer';
    case 'scrap':
      return 'Scrap';
    case 'qc':
      return 'QC';
    case 'adjustment':
      return 'Adjustment';
    default:
      return cat;
  }
}

/** @deprecated Prefer ledgerSignedChange — kept for any leftover call sites during migration. */
export function ledgerQuantityDisplay(row: LedgerRow): {
  before: string | null;
  after: string | null;
  delta: number;
} {
  return { before: null, after: null, delta: ledgerSignedChange(row) };
}

/** Dedupe key: same lot + same from/to endpoints (one stock bucket movement). */
export function ledgerLotLocationBucketKey(r: LedgerRow): string {
  const lot = r.lotId ?? r.lot?.id ?? '';
  return `${r.productId}:${lot}:${r.fromLocationId ?? ''}:${r.toLocationId ?? ''}`;
}

export type MergedLotLocationLine = {
  key: string;
  lotNumber: string;
  locationDescription: string;
  delta: number;
};

/** One table row per distinct (lot, from location, to location); merges duplicate API lines. */
export function mergeLedgerLinesByLotAndLocation(lines: LedgerRow[]): MergedLotLocationLine[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const r of lines) {
    const k = ledgerLotLocationBucketKey(r);
    const cur = groups.get(k) ?? [];
    cur.push(r);
    groups.set(k, cur);
  }
  const out: MergedLotLocationLine[] = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const first = group[0]!;
    const delta = group.reduce((s, r) => s + ledgerSignedChange(r), 0);
    out.push({
      key,
      lotNumber: first.lot?.lotNumber ?? '—',
      locationDescription: describeLedgerLocations(first),
      delta,
    });
  }
  return out;
}

export function describeLedgerLocations(r: LedgerRow): string {
  if (r.locationLabel) return r.locationLabel;
  if (r.fromLocationId && r.toLocationId && r.fromLocationId !== r.toLocationId) {
    return `${r.toLocationId.slice(0, 8)}…`;
  }
  if (r.fromLocationId && !r.toLocationId) return `From ${r.fromLocationId.slice(0, 8)}…`;
  if (r.toLocationId && !r.fromLocationId) return `To ${r.toLocationId.slice(0, 8)}…`;
  return '—';
}

export function ledgerGroupRefLabel(refType: string, refId: string): string {
  return `${refType} · ${refId.slice(0, 8)}…`;
}

export function ledgerEntryDetailPath(ledgerId: string, createdAt: string, companyId?: string): string {
  const base = `/inventory/ledger/line/${encodeURIComponent(ledgerId)}/${encodeURIComponent(createdAt)}`;
  return companyId ? `${base}?companyId=${encodeURIComponent(companyId)}` : base;
}

/** Admin UI path for the ledger row's source document (order or adjustment). */
export function ledgerReferenceAdminPath(referenceType: string, referenceId: string): string | null {
  switch (referenceType) {
    case 'inbound_order':
      return `/orders/inbound/${referenceId}`;
    case 'outbound_order':
      return `/orders/outbound/${referenceId}`;
    case 'adjustment':
      return `/inventory/adjustments/${encodeURIComponent(referenceId)}`;
    default:
      return null;
  }
}
