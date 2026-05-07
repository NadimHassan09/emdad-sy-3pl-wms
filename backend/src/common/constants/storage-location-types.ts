/**
 * Locations that cannot hold physical stock rows — receiving and adjustments must target a storage type.
 */
export const NON_STORAGE_LOCATION_TYPES = [
  'warehouse',
  'view',
  'input',
  'output',
  'scrap',
  'transit',
  'iss',
] as readonly string[];

export function isStorageLocationType(type: string | null | undefined): boolean {
  if (!type) return false;
  /** Deprecated location type — not offered in UI; never treat as stock-capable. */
  if (type === 'qc') return false;
  return !(NON_STORAGE_LOCATION_TYPES as readonly string[]).includes(type);
}

/** Putaway for QC-fail / hold stock (quarantine or scrap bins). */
export function isQuarantineStorageLocationType(type: string | null | undefined): boolean {
  return type === 'quarantine' || type === 'scrap';
}

/** Stock adjustments may target only these location types (UI matches). */
const ADJUSTMENT_STOCK_LOCATION_TYPES = new Set(['internal', 'fridge', 'quarantine', 'scrap']);

export function isAdjustmentStockLocationType(type: string | null | undefined): boolean {
  return !!type && ADJUSTMENT_STOCK_LOCATION_TYPES.has(type);
}
