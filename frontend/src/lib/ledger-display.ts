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

/**
 * Stock bucket semantics: Δ = after − before when both snapshots exist (authoritative).
 * Otherwise infer missing ends from signed `quantityChange` when possible.
 */
export function ledgerQuantityDisplay(row: LedgerRow): {
  before: string | null;
  after: string | null;
  delta: number;
} {
  let beforeN = parseQty(row.quantityBefore);
  let afterN = parseQty(row.quantityAfter);
  const signedChange = parseQty(row.quantityChange);

  if (beforeN !== null && afterN !== null) {
    const delta = afterN - beforeN;
    return {
      before: beforeN.toString(),
      after: afterN.toString(),
      delta,
    };
  }

  if (signedChange !== null) {
    if (afterN !== null && beforeN === null) {
      beforeN = afterN - signedChange;
    } else if (beforeN !== null && afterN === null) {
      afterN = beforeN + signedChange;
    } else if (beforeN === null && afterN === null) {
      return { before: null, after: null, delta: signedChange };
    }
    return {
      before: beforeN !== null ? beforeN.toString() : null,
      after: afterN !== null ? afterN.toString() : null,
      delta: signedChange,
    };
  }

  return {
    before: beforeN !== null ? beforeN.toString() : null,
    after: afterN !== null ? afterN.toString() : null,
    delta:
      beforeN !== null && afterN !== null ? afterN - beforeN : 0,
  };
}

export function fmtSignedDelta(n: number): string {
  const absFmt = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (n > 0) return `+${absFmt}`;
  if (n < 0) return `-${absFmt}`;
  return '0';
}

export type LedgerMovementCategory = 'inbound' | 'outbound' | 'adjustment';

const MOVEMENT_INBOUND = new Set([
  'inbound_receive',
  'return_receive',
  'transit_in',
]);

const MOVEMENT_OUTBOUND = new Set(['outbound_pick', 'transit_out']);

const MOVEMENT_ADJUSTMENT = new Set([
  'putaway',
  'qc_quarantine',
  'qc_release',
  'adjustment_positive',
  'adjustment_negative',
  'scrap',
  'internal_transfer',
]);

export function ledgerMovementCategory(raw: string): LedgerMovementCategory {
  const k = raw.trim();
  if (MOVEMENT_INBOUND.has(k)) return 'inbound';
  if (MOVEMENT_OUTBOUND.has(k)) return 'outbound';
  if (MOVEMENT_ADJUSTMENT.has(k)) return 'adjustment';
  return 'adjustment';
}

export function ledgerMovementLabel(cat: LedgerMovementCategory): string {
  switch (cat) {
    case 'inbound':
      return 'Inbound';
    case 'outbound':
      return 'Outbound';
    case 'adjustment':
      return 'Adjustment';
    default:
      return cat;
  }
}

/** Dedupe key: same lot + same from/to endpoints (one stock bucket movement). */
export function ledgerLotLocationBucketKey(r: LedgerRow): string {
  const lot = r.lotId ?? r.lot?.id ?? '';
  return `${lot}:${r.fromLocationId ?? ''}:${r.toLocationId ?? ''}`;
}

export type MergedLotLocationLine = {
  key: string;
  lotNumber: string;
  locationDescription: string;
  before: string | null;
  after: string | null;
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
    const last = group[group.length - 1]!;
    const open = ledgerQuantityDisplay(first);
    const close = ledgerQuantityDisplay(last);
    const delta = group.reduce((s, r) => s + ledgerQuantityDisplay(r).delta, 0);
    out.push({
      key,
      lotNumber: first.lot?.lotNumber ?? '—',
      locationDescription: describeLedgerLocations(first),
      before: open.before,
      after: close.after,
      delta,
    });
  }
  return out;
}

export function describeLedgerLocations(r: LedgerRow): string {
  if (r.fromLocationId && r.toLocationId && r.fromLocationId !== r.toLocationId) {
    return `${r.fromLocationId.slice(0, 8)}… → ${r.toLocationId.slice(0, 8)}…`;
  }
  if (r.locationLabel) return r.locationLabel;
  if (r.fromLocationId && !r.toLocationId) return `From ${r.fromLocationId.slice(0, 8)}…`;
  if (r.toLocationId && !r.fromLocationId) return `To ${r.toLocationId.slice(0, 8)}…`;
  return '—';
}

export function ledgerGroupRefLabel(refType: string, refId: string): string {
  return `${refType} · ${refId.slice(0, 8)}…`;
}

export function ledgerEntryDetailPath(ledgerId: string, createdAt: string): string {
  return `/inventory/ledger/line/${encodeURIComponent(ledgerId)}/${encodeURIComponent(createdAt)}`;
}

/** @deprecated Use ledgerEntryDetailPath; kept for deep links to order-wide ledger views. */
export function ledgerReferenceDetailPath(referenceType: string, referenceId: string): string {
  return `/inventory/ledger/${encodeURIComponent(referenceType)}/${encodeURIComponent(referenceId)}`;
}
