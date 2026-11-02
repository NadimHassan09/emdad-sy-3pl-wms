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

function findMatchingKey(keys: string[], target: string): string | undefined {
  const normTarget = target.trim().toLowerCase();
  return keys.find((k) => k.trim().toLowerCase() === normTarget);
}

export function listDistricts(
  city: string,
  data: SyriaAddressHierarchy = syriaAddressHierarchy,
): string[] {
  if (!city) return [];
  const exactOrMatched = data[city] ? city : findMatchingKey(Object.keys(data), city);
  if (!exactOrMatched) return [];
  const districts = data[exactOrMatched];
  if (!districts) return [];
  return Object.keys(districts).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function listNeighborhoods(
  city: string,
  district: string,
  data: SyriaAddressHierarchy = syriaAddressHierarchy,
): string[] {
  if (!city || !district) return [];
  const matchedCity = data[city] ? city : findMatchingKey(Object.keys(data), city);
  if (!matchedCity) return [];
  const districts = data[matchedCity];
  if (!districts) return [];
  const matchedDistrict = districts[district] ? district : findMatchingKey(Object.keys(districts), district);
  if (!matchedDistrict) return [];
  const neighborhoods = districts[matchedDistrict];
  if (!neighborhoods) return [];
  return [...neighborhoods].sort((a, b) => a.localeCompare(b, 'ar'));
}

export function toComboboxOptions(
  values: string[],
): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: value }));
}

export function validateSyrianAddressHierarchy(
  address: { city?: string | null; district?: string | null; addressLine1?: string | null },
  data: SyriaAddressHierarchy = syriaAddressHierarchy,
): { valid: boolean; error?: string } {
  const city = address.city?.trim() ?? '';
  const district = address.district?.trim() ?? '';
  const neighborhood = address.addressLine1?.trim() ?? '';

  if (!city) {
    return { valid: false, error: 'Governorate is required.' };
  }
  const cities = listCities(data);
  if (!cities.includes(city)) {
    return { valid: false, error: `Invalid governorate "${city}". Select a valid Syrian governorate.` };
  }

  if (!district) {
    return { valid: false, error: 'City/Region is required.' };
  }
  const districts = listDistricts(city, data);
  if (!districts.includes(district)) {
    return { valid: false, error: `City/Region "${district}" does not belong to governorate "${city}".` };
  }

  if (!neighborhood) {
    return { valid: false, error: 'Town/Neighborhood is required.' };
  }
  const neighborhoods = listNeighborhoods(city, district, data);
  if (!neighborhoods.includes(neighborhood)) {
    return { valid: false, error: `Town/Neighborhood "${neighborhood}" does not belong to ${district}, ${city}.` };
  }

  return { valid: true };
}
