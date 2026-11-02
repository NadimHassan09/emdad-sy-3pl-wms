import hierarchyRaw from '../../data/syria-locations/syria-address-hierarchy.json';

export const LOCATION_SEP = '\u001f';

export type SyriaHierarchy = Record<string, Record<string, string[]>>;

export type ShippingFeeLocationLevel = 'governorate' | 'city_region' | 'town';

export type ShippingFeeLocationRef = {
  level: ShippingFeeLocationLevel;
  governorate: string;
  cityRegion?: string | null;
  townNeighborhood?: string | null;
};

const hierarchy = hierarchyRaw as SyriaHierarchy;

export function getSyriaHierarchy(): SyriaHierarchy {
  return hierarchy;
}

export function locationKey(ref: ShippingFeeLocationRef): string {
  const governorate = ref.governorate.trim();
  const cityRegion = (ref.cityRegion ?? '').trim();
  const town = (ref.townNeighborhood ?? '').trim();
  if (ref.level === 'town') {
    return [governorate, cityRegion, town].join(LOCATION_SEP);
  }
  if (ref.level === 'city_region') {
    return [governorate, cityRegion].join(LOCATION_SEP);
  }
  return governorate;
}

export function assertKnownLocation(ref: ShippingFeeLocationRef): ShippingFeeLocationRef {
  const governorate = ref.governorate.trim();
  const cityRegion = (ref.cityRegion ?? '').trim();
  const town = (ref.townNeighborhood ?? '').trim();
  const regions = hierarchy[governorate];
  if (!regions) {
    throw new Error(`Unknown governorate: ${governorate}. Choose a governorate from the system hierarchy.`);
  }

  if (ref.level === 'governorate') {
    return { level: 'governorate', governorate, cityRegion: null, townNeighborhood: null };
  }

  if (!cityRegion || !Object.prototype.hasOwnProperty.call(regions, cityRegion)) {
    throw new Error(`Unknown location: ${governorate} / ${cityRegion}. Choose a location from the system hierarchy.`);
  }

  if (ref.level === 'town') {
    if (!town || !regions[cityRegion].includes(town)) {
      throw new Error(`Unknown town: ${governorate} / ${cityRegion} / ${town}.`);
    }
    return { level: 'town', governorate, cityRegion, townNeighborhood: town };
  }
  return { level: 'city_region', governorate, cityRegion, townNeighborhood: null };
}

/**
 * Most specific exact key wins: town, then city/region, then governorate.
 * Returned in descending order of geographic specificity:
 * 1. Town/Neighborhood (most specific)
 * 2. City/Region
 * 3. Governorate (broadest fallback)
 */
export function candidateLocationKeys(input: {
  governorate?: string | null;
  cityRegion?: string | null;
  townNeighborhood?: string | null;
}): string[] {
  const governorate = (input.governorate ?? '').trim();
  const cityRegion = (input.cityRegion ?? '').trim();
  const town = (input.townNeighborhood ?? '').trim();
  if (!governorate) return [];

  const keys: string[] = [];
  if (cityRegion && town) {
    keys.push(locationKey({ level: 'town', governorate, cityRegion, townNeighborhood: town }));
  }
  if (cityRegion) {
    keys.push(locationKey({ level: 'city_region', governorate, cityRegion }));
  }
  keys.push(locationKey({ level: 'governorate', governorate }));
  return keys;
}

export function listGovernorates(): string[] {
  return Object.keys(hierarchy).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function listCityRegions(governorate: string): string[] {
  const regions = hierarchy[governorate.trim()];
  if (!regions) return [];
  return Object.keys(regions).sort((a, b) => a.localeCompare(b, 'ar'));
}

export function listTowns(governorate: string, cityRegion: string): string[] {
  const towns = hierarchy[governorate.trim()]?.[cityRegion.trim()];
  return towns ? [...towns].sort((a, b) => a.localeCompare(b, 'ar')) : [];
}
