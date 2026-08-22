import rawHierarchy from './syria-address-hierarchy.json';

/** City → District → neighborhoods / areas. */
export type SyriaAddressHierarchy = Record<string, Record<string, string[]>>;

export type CascadingAddressValue = {
  city: string;
  district: string;
  addressLine1: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDistrictMap(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isStringArray);
}

/** Validate and normalize hierarchy JSON; returns empty object on invalid input. */
export function normalizeSyriaAddressHierarchy(raw: unknown): SyriaAddressHierarchy {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SyriaAddressHierarchy = {};
  for (const [city, districts] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof city !== 'string' || !city.trim()) continue;
    if (!isDistrictMap(districts)) continue;
    out[city] = districts;
  }
  return out;
}

export const syriaAddressHierarchy: SyriaAddressHierarchy =
  normalizeSyriaAddressHierarchy(rawHierarchy);

export function listCities(data: SyriaAddressHierarchy = syriaAddressHierarchy): string[] {
  return Object.keys(data).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function listDistricts(
  city: string,
  data: SyriaAddressHierarchy = syriaAddressHierarchy,
): string[] {
  if (!city) return [];
  const districts = data[city];
  if (!districts) return [];
  return Object.keys(districts).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function listNeighborhoods(
  city: string,
  district: string,
  data: SyriaAddressHierarchy = syriaAddressHierarchy,
): string[] {
  if (!city || !district) return [];
  const neighborhoods = data[city]?.[district];
  if (!neighborhoods) return [];
  return [...neighborhoods].sort((a, b) => a.localeCompare(b, 'ar'));
}

export function toComboboxOptions(
  values: string[],
  selected?: string,
): Array<{ value: string; label: string }> {
  const options = values.map((value) => ({ value, label: value }));
  if (selected && !values.includes(selected)) {
    return [{ value: selected, label: selected }, ...options];
  }
  return options;
}
