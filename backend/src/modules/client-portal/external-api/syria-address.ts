import hierarchyJson from './syria-address-hierarchy.json';

export type SyriaAddressHierarchy = Record<string, Record<string, string[]>>;

const HIERARCHY = hierarchyJson as SyriaAddressHierarchy;

function norm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function findKey(keys: string[], raw: string): string | null {
  const n = norm(raw);
  if (!n) return null;
  return keys.find((k) => norm(k) === n) ?? null;
}

export type ResolvedSyriaAddress = {
  governorate: string;
  city: string;
  neighborhood: string | null;
  street: string | null;
};

export function resolveSyriaAddress(input: {
  governorate?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
}): { ok: true; value: ResolvedSyriaAddress } | { ok: false; fields: Record<string, string> } {
  const governorateRaw = input.governorate?.trim() ?? '';
  const cityRaw = input.city?.trim() ?? '';
  const neighborhoodRaw = input.neighborhood?.trim() || '';
  const street = input.street?.trim() || null;
  const fields: Record<string, string> = {};

  if (!governorateRaw) {
    fields.governorate = 'Governorate is required.';
  }
  if (!cityRaw) {
    fields.city = 'City / area is required.';
  }
  if (Object.keys(fields).length) {
    return { ok: false, fields };
  }

  const governorate = findKey(Object.keys(HIERARCHY), governorateRaw);
  if (!governorate) {
    return {
      ok: false,
      fields: { governorate: `Unknown governorate "${governorateRaw}". Use a Syria governorate name as in the Client Portal.` },
    };
  }

  const districts = Object.keys(HIERARCHY[governorate] ?? {});
  const city = findKey(districts, cityRaw);
  if (!city) {
    return {
      ok: false,
      fields: { city: `Unknown city/area "${cityRaw}" for ${governorate}.` },
    };
  }

  let neighborhood: string | null = null;
  if (neighborhoodRaw) {
    const neighborhoods = HIERARCHY[governorate]?.[city] ?? [];
    neighborhood = findKey(neighborhoods, neighborhoodRaw);
    if (!neighborhood) {
      return {
        ok: false,
        fields: { neighborhood: `Unknown neighborhood "${neighborhoodRaw}" for ${city}, ${governorate}.` },
      };
    }
  }

  return { ok: true, value: { governorate, city, neighborhood, street } };
}
