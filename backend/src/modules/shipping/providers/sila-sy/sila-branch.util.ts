import locationIndex from '../../../../data/syria-locations/syria-location-index.json';
import { haversineDistanceKm, type LatLng } from '../../geo-polygon.util';

const SEP = '\u001f';

type CoordRecord = { lat?: number | null; lng?: number | null };

type LocationIndexFile = {
  cities?: Record<string, CoordRecord>;
  neighborhoods?: Record<string, CoordRecord>;
};

export type SilaBranchOption = {
  id: string;
  name: string;
};

function readPoint(value: CoordRecord | undefined | null): LatLng | null {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** "مسارات - الدبلان" → "الدبلان" */
export function silaBranchPlaceName(name: string): string {
  const normalized = name.replace(/[–—]/g, '-');
  const parts = normalized.split('-').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : normalized.trim();
}

function samePlace(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const strip = (value: string) => value.replace(/^ال/, '');
  return strip(left) === strip(right);
}

function pointForPlace(
  index: LocationIndexFile,
  governorate: string,
  place: string,
): LatLng | null {
  const neighborhoods = index.neighborhoods ?? {};
  const hits: Array<{ city: string; point: LatLng | null }> = [];
  for (const [key, value] of Object.entries(neighborhoods)) {
    const parts = key.split(SEP);
    if (parts.length < 3 || parts[0] !== governorate) continue;
    if (!samePlace(parts[2], place)) continue;
    hits.push({ city: parts[1], point: readPoint(value) });
  }
  const withPoint = hits.find((hit) => hit.point);
  if (withPoint?.point) return withPoint.point;
  const cityName = hits[0]?.city;
  if (cityName) {
    const cityPoint = readPoint(index.cities?.[`${governorate}${SEP}${cityName}`]);
    if (cityPoint) return cityPoint;
  }
  return readPoint(index.cities?.[`${governorate}${SEP}${place}`]);
}

/**
 * Pick the courier branch closest to the delivery address.
 * Branch lists from Sila have names only, so coordinates come from the Syria location index.
 */
export function pickNearestSilaBranch(
  branches: SilaBranchOption[],
  destination: {
    governorate?: string | null;
    neighborhood?: string | null;
    lat?: number | null;
    lng?: number | null;
  },
  index: LocationIndexFile = locationIndex as LocationIndexFile,
): SilaBranchOption | null {
  const usable = branches.filter((branch) => branch.id?.trim() && branch.name?.trim());
  if (usable.length === 0) return null;
  if (usable.length === 1) return usable[0];

  const governorate = destination.governorate?.trim() || '';
  const neighborhood = destination.neighborhood?.trim() || '';
  const explicit = readPoint({ lat: destination.lat, lng: destination.lng });
  const receiver =
    explicit ??
    (governorate && neighborhood ? pointForPlace(index, governorate, neighborhood) : null);
  if (!receiver || !governorate) return usable[0];

  let best: { branch: SilaBranchOption; distance: number } | null = null;
  for (const branch of usable) {
    const place = silaBranchPlaceName(branch.name);
    const point = pointForPlace(index, governorate, place);
    if (!point) continue;
    const distance = haversineDistanceKm(receiver, point);
    if (!best || distance < best.distance) best = { branch, distance };
  }
  return best?.branch ?? usable[0];
}
