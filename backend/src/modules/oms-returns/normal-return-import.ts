/**
 * Pure helpers for Normal Return CSV import (aggregate-then-validate).
 * Express Return must not depend on or be changed by this module.
 */

export type NormalReturnImportRow = {
  orderReference: string;
  productReference: string;
  quantity: number;
  /** Stable index into the original CSV/request for error fan-out. */
  rowIndex: number;
};

export type AggregatedReturnLine = {
  omsOrderId: string;
  productId: string;
  quantity: number;
  /** Original rows that contributed to this aggregate. */
  sourceRows: NormalReturnImportRow[];
};

/** Sum quantities by (omsOrderId, productId); preserve contributing original rows. */
export function aggregateNormalReturnRows(
  rows: Array<{
    omsOrderId: string;
    productId: string;
    quantity: number;
    source: NormalReturnImportRow;
  }>,
): AggregatedReturnLine[] {
  const map = new Map<string, AggregatedReturnLine>();
  for (const row of rows) {
    const key = `${row.omsOrderId}|${row.productId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        omsOrderId: row.omsOrderId,
        productId: row.productId,
        quantity: row.quantity,
        sourceRows: [row.source],
      });
      continue;
    }
    existing.quantity += row.quantity;
    existing.sourceRows.push(row.source);
  }
  return [...map.values()];
}

export function looksLikeProductUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

/** Resolve product on order lines by product UUID or SKU (case-insensitive). */
export function resolveProductOnOrderLines<
  T extends { productId: string; product?: { sku?: string | null } | null },
>(
  lines: T[],
  productReference: string,
): T | null {
  const ref = productReference.trim();
  if (!ref) return null;

  if (looksLikeProductUuid(ref)) {
    return lines.find((l) => l.productId.toLowerCase() === ref.toLowerCase()) ?? null;
  }

  const skuLower = ref.toLowerCase();
  const matches = lines.filter(
    (l) => (l.product?.sku ?? '').trim().toLowerCase() === skuLower,
  );
  if (matches.length === 1) return matches[0];
  return null;
}
