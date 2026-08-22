import { Injectable } from '@nestjs/common';

import locationIndex from '../../data/syria-locations/syria-location-index.json';
import { haversineDistanceKm } from './geo-polygon.util';

const SEP = '\u001f';
const MAX_DISTANCE_KM = 1;

type IndexedPoint = {
  governorate: string;
  cityRegion: string;
  townNeighborhood: string;
  lat: number;
  lng: number;
};

export type ResolveAddressFromPinResult =
  | {
      found: true;
      governorate: string;
      cityRegion: string;
      townNeighborhood: string;
      lat: number;
      lng: number;
      distanceMeters: number;
    }
  | {
      found: false;
      message: string;
      nearestLabel?: string;
      distanceMeters?: number;
    };

type LocationIndexFile = {
  neighborhoods?: Record<string, { lat?: number | null; lng?: number | null }>;
};

/**
 * Local pin → address lookup against the bundled Syria location index.
 * Does not call Babel. Used to auto-fill OMS address cascade fields.
 */
@Injectable()
export class AddressResolveService {
  private readonly points: IndexedPoint[];

  constructor() {
    const raw = locationIndex as LocationIndexFile;
    const points: IndexedPoint[] = [];
    for (const [key, value] of Object.entries(raw.neighborhoods ?? {})) {
      const parts = key.split(SEP);
      if (parts.length < 3) continue;
      const lat = Number(value?.lat);
      const lng = Number(value?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      points.push({
        governorate: parts[0],
        cityRegion: parts[1],
        townNeighborhood: parts.slice(2).join(SEP),
        lat,
        lng,
      });
    }
    this.points = points;
  }

  resolveFromPin(lat: number, lng: number): ResolveAddressFromPinResult {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { found: false, message: 'Invalid map coordinates.' };
    }

    let best: IndexedPoint | null = null;
    let bestKm = Number.POSITIVE_INFINITY;

    for (const p of this.points) {
      const d = haversineDistanceKm({ lat, lng }, { lat: p.lat, lng: p.lng });
      if (d < bestKm) {
        bestKm = d;
        best = p;
      }
    }

    if (!best || bestKm > MAX_DISTANCE_KM) {
      const label = best
        ? `${best.townNeighborhood} - ${best.cityRegion}`
        : undefined;
      return {
        found: false,
        message: label
          ? `No service available in ${label}.`
          : 'No supported address found near this location (within 1 km).',
        nearestLabel: label,
        distanceMeters: Number.isFinite(bestKm)
          ? Math.round(bestKm * 1000)
          : undefined,
      };
    }

    return {
      found: true,
      governorate: best.governorate,
      cityRegion: best.cityRegion,
      townNeighborhood: best.townNeighborhood,
      lat,
      lng,
      distanceMeters: Math.round(bestKm * 1000),
    };
  }
}
