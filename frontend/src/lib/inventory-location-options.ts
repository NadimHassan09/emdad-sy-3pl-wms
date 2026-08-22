import type { StockRow } from '../api/inventory';
import type { Location } from '../api/locations';
import { isAdjustmentStockLocationType, locationTypeLabel } from './location-types';

export type StockSourceLocationOption = { id: string; label: string; hint: string };

/** Matches backend decrement: on-hand minus reserved. */
export function transferableQtyAtRow(row: StockRow): number {
  const avail = Number(row.quantityAvailable);
  if (Number.isFinite(avail)) return Math.max(0, avail);
  const onHand = Number(row.quantityOnHand);
  const reserved = Number(row.quantityReserved);
  if (Number.isFinite(onHand) && Number.isFinite(reserved)) {
    return Math.max(0, onHand - reserved);
  }
  if (Number.isFinite(onHand)) return Math.max(0, onHand);
  return 0;
}

export function uniqueStockLocationIds(items: StockRow[]): string[] {
  return [...new Set(items.map((r) => r.locationId).filter(Boolean))];
}

/** Source bins with on-hand stock for transfers / adjustments (no full-warehouse list). */
export function buildStockSourceLocationOptions(params: {
  stockItems: StockRow[];
  locationById: Map<string, Location>;
  productId: string;
  lotId?: string;
  lotTracked: boolean;
  sourceTypeFilter?: string;
  minQty?: (row: StockRow) => number;
  /** Localized location type label (defaults to English `locationTypeLabel`). */
  typeLabel?: (type: string) => string;
  availWord?: string;
}): StockSourceLocationOption[] {
  const {
    stockItems,
    locationById,
    productId,
    lotId,
    lotTracked,
    sourceTypeFilter,
    minQty = transferableQtyAtRow,
    typeLabel = locationTypeLabel,
    availWord = 'avail',
  } = params;

  if (!productId) return [];

  const availByLoc = new Map<string, number>();

  for (const row of stockItems) {
    if (row.productId !== productId) continue;
    const loc = locationById.get(row.locationId);
    if (!loc || !isAdjustmentStockLocationType(loc.type)) continue;
    if (sourceTypeFilter && loc.type !== sourceTypeFilter) continue;

    const rowLot = row.lotId ?? row.lot?.id ?? null;
    if (lotTracked) {
      if (!lotId || rowLot !== lotId) continue;
    } else if (rowLot) {
      continue;
    }

    const qty = minQty(row);
    if (qty <= 0) continue;
    availByLoc.set(loc.id, (availByLoc.get(loc.id) ?? 0) + qty);
  }

  return [...availByLoc.entries()]
    .map(([id, avail]) => {
      const loc = locationById.get(id)!;
      return {
        id,
        label: loc.fullPath,
        hint: `${typeLabel(loc.type)} · ${availWord} ${avail.toLocaleString()}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Adjustment line locations: product on-hand at eligible bins only. */
export function buildAdjustmentStockLocationOptions(params: {
  stockItems: StockRow[];
  locationById: Map<string, Location>;
  typeLabel?: (type: string) => string;
}): StockSourceLocationOption[] {
  const { stockItems, locationById, typeLabel = locationTypeLabel } = params;
  const byLoc = new Map<string, StockSourceLocationOption>();

  for (const row of stockItems) {
    const onHand = Number(row.quantityOnHand);
    if (!Number.isFinite(onHand) || onHand <= 0) continue;
    const loc = locationById.get(row.locationId);
    if (!loc || !isAdjustmentStockLocationType(loc.type)) continue;
    if (!byLoc.has(loc.id)) {
      byLoc.set(loc.id, {
        id: loc.id,
        label: loc.fullPath,
        hint: `${typeLabel(loc.type)} · ${loc.barcode}`,
      });
    }
  }

  return [...byLoc.values()].sort((a, b) => a.label.localeCompare(b.label));
}
