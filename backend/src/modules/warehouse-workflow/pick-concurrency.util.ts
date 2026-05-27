import type { ReservationSnapshot } from './task-inventory-effects.service';

/** Canonical sort key for `current_stock` row locks (prevents deadlocks across concurrent picks). */
export function stockTupleLockKey(parts: {
  companyId: string;
  productId: string;
  locationId: string;
  lotId?: string | null;
}): string {
  const lot = parts.lotId ?? '';
  return `${parts.companyId}\0${parts.productId}\0${parts.locationId}\0${lot}`;
}

export function compareStockTupleLockKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function sortReservationSnapshotsForLocking(
  rows: ReservationSnapshot[],
): ReservationSnapshot[] {
  return [...rows].sort((a, b) =>
    compareStockTupleLockKeys(
      stockTupleLockKey({
        companyId: a.companyId,
        productId: a.productId,
        locationId: a.locationId,
        lotId: a.lotId,
      }),
      stockTupleLockKey({
        companyId: b.companyId,
        productId: b.productId,
        locationId: b.locationId,
        lotId: b.lotId,
      }),
    ),
  );
}

/** Stable pick-line ordering before planning FEFO slices (product locks before line id). */
export function sortPickLinesForLocking<
  T extends { outboundOrderLineId: string; productId: string },
>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const byProduct = a.productId.localeCompare(b.productId);
    if (byProduct !== 0) return byProduct;
    return a.outboundOrderLineId.localeCompare(b.outboundOrderLineId);
  });
}
