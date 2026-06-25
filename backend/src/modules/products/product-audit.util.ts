/** Compact product fields stored in audit previousState / newState. */
export type ProductAuditSnapshot = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  barcode: string | null;
  status: string;
  uom: string;
  expiryTracking: boolean;
  minStockThreshold: number;
};

export function productAuditSnapshot(row: {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  barcode: string | null;
  status: string;
  uom: string;
  expiryTracking: boolean;
  minStockThreshold: number;
}): ProductAuditSnapshot {
  return {
    id: row.id,
    companyId: row.companyId,
    sku: row.sku,
    name: row.name,
    barcode: row.barcode,
    status: row.status,
    uom: row.uom,
    expiryTracking: row.expiryTracking,
    minStockThreshold: row.minStockThreshold,
  };
}
