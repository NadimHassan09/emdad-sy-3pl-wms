import type { LocationType } from '@/api/locations'

export const MANAGED_LOCATION_API_TYPES = [
  'iss',
  'internal',
  'fridge',
  'packing',
  'input',
  'output',
  'quarantine',
  'scrap',
] as const satisfies readonly LocationType[]

export type ManagedLocationApiType = (typeof MANAGED_LOCATION_API_TYPES)[number]

export function locationTypeSupportsCapacityFields(type: string | null | undefined): boolean {
  return type === 'internal' || type === 'fridge' || type === 'quarantine' || type === 'scrap'
}

const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  iss: { en: 'Aisle', ar: 'ممر' },
  internal: { en: 'Storage', ar: 'تخزين' },
  fridge: { en: 'Cold storage', ar: 'تبريد' },
  packing: { en: 'Packing', ar: 'تعبئة' },
  input: { en: 'Receiving dock', ar: 'استلام' },
  output: { en: 'Shipping dock', ar: 'شحن' },
  quarantine: { en: 'Quarantine', ar: 'حجر' },
  scrap: { en: 'Scrap', ar: 'إتلاف' },
  warehouse: { en: 'Warehouse', ar: 'مستودع' },
  view: { en: 'View', ar: 'عرض' },
  transit: { en: 'Transit', ar: 'عبور' },
}

export function locationTypeLabel(type: string | null | undefined, isArabic = false): string {
  if (!type) return '—'
  const row = TYPE_LABELS[type]
  return row ? (isArabic ? row.ar : row.en) : type
}

export function managedLocationTypeOptions(isArabic: boolean): { value: LocationType; label: string }[] {
  return MANAGED_LOCATION_API_TYPES.map((value) => ({
    value,
    label: locationTypeLabel(value, isArabic),
  }))
}

const PUTAWAY_DESTINATION_TYPES: LocationType[] = ['internal', 'fridge', 'quarantine', 'scrap']
const PUTAWAY_QUARANTINE_DESTINATION_TYPES: LocationType[] = ['quarantine', 'scrap']

export function putawayDestinationTypes(taskType: 'putaway' | 'putaway_quarantine'): LocationType[] {
  return taskType === 'putaway_quarantine' ? PUTAWAY_QUARANTINE_DESTINATION_TYPES : PUTAWAY_DESTINATION_TYPES
}

export function isAllowedPutawayDestination(
  type: string | null | undefined,
  taskType: 'putaway' | 'putaway_quarantine',
): boolean {
  if (!type) return false
  return putawayDestinationTypes(taskType).includes(type as LocationType)
}

const ADJUSTMENT_STOCK_LOCATION_TYPES = new Set<LocationType>(['internal', 'fridge', 'quarantine', 'scrap'])

/** Stock adjustments / internal transfers: storage, fridge, quarantine, scrap bins only. */
export function isAdjustmentStockLocationType(type: string | null | undefined): boolean {
  return !!type && ADJUSTMENT_STOCK_LOCATION_TYPES.has(type as LocationType)
}
