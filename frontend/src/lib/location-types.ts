import type { LocationType } from '../api/locations';

/**
 * API `location_type` values the /locations UI allows for create (maps to business names).
 * Legacy DB values (warehouse, view, input, transit) stay valid on existing rows only. `qc` is deprecated.
 */
export const MANAGED_LOCATION_API_TYPES = [
  'iss',
  'internal',
  'fridge',
  'packing',
  'output',
  'quarantine',
  'scrap',
] as const satisfies readonly LocationType[];

export type ManagedLocationApiType = (typeof MANAGED_LOCATION_API_TYPES)[number];

/** Non-storage: cannot post normal sellable inventory / adjustments here. */
export const NON_STORAGE_LOCATION_TYPES = [
  'warehouse',
  'view',
  'input',
  'output',
  'scrap',
  'transit',
  'iss',
] as const;

export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string; hint: string }[] = [
  {
    value: 'iss',
    label: 'Aisle',
    hint: 'Structure / hierarchy only — not used in operations or tasks.',
  },
  {
    value: 'internal',
    label: 'Storage',
    hint: 'Used in putaway tasks.',
  },
  {
    value: 'fridge',
    label: 'Fridge',
    hint: 'Cold storage — used in putaway tasks.',
  },
  {
    value: 'packing',
    label: 'Packing',
    hint: 'Used in packing tasks.',
  },
  {
    value: 'output',
    label: 'Shipping dock',
    hint: 'Used in delivery tasks.',
  },
  {
    value: 'quarantine',
    label: 'Quarantine',
    hint: 'Used in putaway tasks (hold / quality issues).',
  },
  {
    value: 'scrap',
    label: 'Scrap',
    hint: 'Used in putaway tasks.',
  },
];

const LABEL_BY_TYPE = Object.fromEntries(LOCATION_TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<
  string,
  string
>;

/** Types that may show optional max weight / max volume (CBM) in forms. */
export function locationTypeSupportsCapacityFields(type: string | null | undefined): boolean {
  return type === 'internal' || type === 'fridge' || type === 'quarantine' || type === 'scrap';
}

export function isManagedLocationApiType(type: string): type is ManagedLocationApiType {
  return (MANAGED_LOCATION_API_TYPES as readonly string[]).includes(type);
}

export function managedTypeOptionsForEdit(locationType: string | null | undefined) {
  const base = LOCATION_TYPE_OPTIONS;
  if (locationType && !isManagedLocationApiType(locationType)) {
    if (locationType === 'qc') {
      return base;
    }
    return [
      ...base,
      {
        value: locationType as LocationType,
        label: `${locationType} (legacy)`,
        hint: 'Existing location type — migrate to a standard type when possible.',
      },
    ];
  }
  return base;
}

/** Types where /locations shows on-hand lines when the type badge is clicked. */
export function locationTypeShowsStockContents(type: string | null | undefined): boolean {
  return type === 'internal' || type === 'fridge' || type === 'quarantine' || type === 'scrap';
}

export function locationTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return LABEL_BY_TYPE[type] ?? type;
}

/** Tailwind classes for a compact type pill (WCAG-friendly contrast on white). */
export function locationTypePillClass(type: string | null | undefined): string {
  switch (type) {
    case 'iss':
      return 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200';
    case 'internal':
      return 'bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200';
    case 'fridge':
      return 'bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200';
    case 'packing':
      return 'bg-violet-50 text-violet-900 ring-1 ring-inset ring-violet-200';
    case 'output':
      return 'bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-200';
    case 'quarantine':
      return 'bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200';
    case 'scrap':
      return 'bg-rose-50 text-rose-900 ring-1 ring-inset ring-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200';
  }
}

export function isStorageLocationType(type: string | null | undefined): boolean {
  if (!type) return false;
  if (type === 'qc') return false;
  return !(NON_STORAGE_LOCATION_TYPES as readonly string[]).includes(type);
}

const ADJUSTMENT_STOCK_LOCATION_TYPES = new Set<LocationType>([
  'internal',
  'fridge',
  'quarantine',
  'scrap',
]);

/** Stock adjustments: only storage, fridge, quarantine, and scrap bins. */
export function isAdjustmentStockLocationType(type: string | null | undefined): boolean {
  return !!type && ADJUSTMENT_STOCK_LOCATION_TYPES.has(type as LocationType);
}

/** Sellable putaway task: destination bins (storage = `internal`, fridge, quarantine, scrap). */
export function isPutawayDestinationLocationType(type: string | null | undefined): boolean {
  return isAdjustmentStockLocationType(type);
}

/**
 * Inbound staging dock: Prisma `input` (receiving / dock node). Other dock-like types are excluded.
 */
export function isReceivingDockLocationType(type: string | null | undefined): boolean {
  return type === 'input';
}
