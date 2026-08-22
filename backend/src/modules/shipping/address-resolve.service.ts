import { Injectable } from '@nestjs/common';

import hierarchyRaw from '../../data/syria-locations/syria-address-hierarchy.json';
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

type SyriaAddressHierarchy = Record<string, Record<string, string[]>>;

/** Babel/UI city label → primary OCHA district in the coordinate index. */
const BABEL_CITY_PRIMARY_DISTRICT: Record<string, string> = {
  [`حلب${SEP}مدينة حلب`]: 'مركز جبل سمعان',
  [`إدلب${SEP}مدينة إدلب`]: 'مركز إدلب',
  [`حمص${SEP}مدينة حمص`]: 'مركز حمص',
  [`حماة${SEP}مدينة حماة`]: 'مركز حماة',
  [`دمشق${SEP}محافظة دمشق`]: 'دمشق',
  [`ريف دمشق${SEP}مركز ريف دمشق`]: 'مركز ريف دمشق',
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

type LocationCoords = { lat?: number | null; lng?: number | null };

type LocationIndexFile = {
  governorates?: Record<string, LocationCoords>;
  cities?: Record<string, LocationCoords>;
  neighborhoods?: Record<string, LocationCoords>;
};

export type ResolveAddressFromNamesResult =
  | {
      found: true;
      lat: number;
      lng: number;
      source: 'neighborhood' | 'city' | 'governorate';
      resolvedLabel: string;
    }
  | {
      found: false;
      message: string;
    };

function readCoords(value: LocationCoords | undefined | null): { lat: number; lng: number } | null {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function averageCoords(points: Array<{ lat: number; lng: number }>): { lat: number; lng: number } | null {
  if (points.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  for (const p of points) {
    latSum += p.lat;
    lngSum += p.lng;
  }
  return {
    lat: Math.round((latSum / points.length) * 1_000_000) / 1_000_000,
    lng: Math.round((lngSum / points.length) * 1_000_000) / 1_000_000,
  };
}

/**
 * Local pin → address lookup against the bundled Syria location index.
 * Does not call Babel. Used to auto-fill OMS address cascade fields.
 */
@Injectable()
export class AddressResolveService {
  private readonly raw: LocationIndexFile;
  private readonly points: IndexedPoint[];
  /** Governorate → city/region → centroid from indexed neighborhoods. */
  private readonly cityCentroids: Map<string, { lat: number; lng: number }>;
  /** UI/Babel hierarchy → pre-resolved town and city coordinates. */
  private readonly hierarchyTownCoords: Map<string, { lat: number; lng: number }>;
  private readonly hierarchyCityCoords: Map<string, { lat: number; lng: number }>;

  constructor() {
    this.raw = locationIndex as LocationIndexFile;
    const points: IndexedPoint[] = [];
    const cityBuckets = new Map<string, Array<{ lat: number; lng: number }>>();

    for (const [key, value] of Object.entries(this.raw.neighborhoods ?? {})) {
      const parts = key.split(SEP);
      if (parts.length < 3) continue;
      const lat = Number(value?.lat);
      const lng = Number(value?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const governorate = parts[0];
      const cityRegion = parts[1];
      points.push({
        governorate,
        cityRegion,
        townNeighborhood: parts.slice(2).join(SEP),
        lat,
        lng,
      });
      const cityKey = [governorate, cityRegion].join(SEP);
      const bucket = cityBuckets.get(cityKey) ?? [];
      bucket.push({ lat, lng });
      cityBuckets.set(cityKey, bucket);
    }
    this.points = points;

    this.cityCentroids = new Map();
    for (const [cityKey, bucket] of cityBuckets.entries()) {
      const avg = averageCoords(bucket);
      if (avg) this.cityCentroids.set(cityKey, avg);
    }

    const hierarchyCoords = this.buildHierarchyCoordinateIndex();
    this.hierarchyTownCoords = hierarchyCoords.towns;
    this.hierarchyCityCoords = hierarchyCoords.cities;
  }

  private buildHierarchyCoordinateIndex(): {
    towns: Map<string, { lat: number; lng: number }>;
    cities: Map<string, { lat: number; lng: number }>;
  } {
    const towns = new Map<string, { lat: number; lng: number }>();
    const cityBuckets = new Map<string, Array<{ lat: number; lng: number }>>();
    const hierarchy = hierarchyRaw as SyriaAddressHierarchy;

    for (const [governorate, cities] of Object.entries(hierarchy)) {
      for (const [cityRegion, townNames] of Object.entries(cities)) {
        const cityKey = [governorate, cityRegion].join(SEP);
        for (const townName of townNames) {
          const coords = this.resolveTownAcrossDistricts(governorate, cityRegion, townName);
          if (!coords) continue;
          towns.set([governorate, cityRegion, townName].join(SEP), coords);
          const bucket = cityBuckets.get(cityKey) ?? [];
          bucket.push(coords);
          cityBuckets.set(cityKey, bucket);
        }
      }
    }

    const cities = new Map<string, { lat: number; lng: number }>();
    for (const [cityKey, bucket] of cityBuckets.entries()) {
      const avg = averageCoords(bucket);
      if (avg) cities.set(cityKey, avg);
    }
    return { towns, cities };
  }

  private pickPreferredDistrict(
    governorate: string,
    babelCity: string,
    matches: IndexedPoint[],
  ): IndexedPoint | null {
    if (matches.length === 0) return null;
    const primary = BABEL_CITY_PRIMARY_DISTRICT[[governorate, babelCity].join(SEP)];
    if (primary) {
      const hit = matches.find((m) => m.cityRegion === primary);
      if (hit) return hit;
    }
    const byCityHint = matches.find(
      (m) =>
        m.townNeighborhood.includes(babelCity) ||
        m.townNeighborhood.includes(` - ${m.cityRegion}`),
    );
    return byCityHint ?? matches[0];
  }

  /** Match UI/Babel town names against OCHA district rows in the coordinate index. */
  private resolveTownAcrossDistricts(
    governorate: string,
    babelCity: string,
    townNeighborhood: string,
  ): { lat: number; lng: number } | null {
    const exact = this.lookupNeighborhood(governorate, babelCity, townNeighborhood);
    if (exact) return exact;

    const matches = this.points.filter(
      (p) => p.governorate === governorate && p.townNeighborhood === townNeighborhood,
    );
    if (matches.length === 1) {
      return { lat: matches[0].lat, lng: matches[0].lng };
    }
    if (matches.length > 1) {
      const preferred = this.pickPreferredDistrict(governorate, babelCity, matches);
      if (preferred) return { lat: preferred.lat, lng: preferred.lng };
    }
    return null;
  }

  private lookupNeighborhood(
    governorate: string,
    cityRegion: string,
    townNeighborhood: string,
  ): { lat: number; lng: number } | null {
    const key = [governorate, cityRegion, townNeighborhood].join(SEP);
    const indexed = readCoords(this.raw.neighborhoods?.[key]);
    if (indexed) return indexed;

    const point = this.points.find(
      (p) =>
        p.governorate === governorate &&
        p.cityRegion === cityRegion &&
        p.townNeighborhood === townNeighborhood,
    );
    return point ? { lat: point.lat, lng: point.lng } : null;
  }

  private lookupCity(governorate: string, cityRegion: string): { lat: number; lng: number } | null {
    const hierarchyKey = [governorate, cityRegion].join(SEP);
    const fromHierarchy = this.hierarchyCityCoords.get(hierarchyKey);
    if (fromHierarchy) return fromHierarchy;

    const key = [governorate, cityRegion].join(SEP);
    const indexedCity = readCoords(this.raw.cities?.[key]);
    if (indexedCity) return indexedCity;
    return this.cityCentroids.get(key) ?? null;
  }

  private lookupGovernorate(governorate: string): { lat: number; lng: number } | null {
    return readCoords(this.raw.governorates?.[governorate]);
  }

  /**
   * Internal geography → stored coordinates (no external geocoding).
   * Priority: Town/Neighborhood → City/Region → Governorate.
   */
  resolveFromAddress(input: {
    governorate?: string | null;
    cityRegion?: string | null;
    townNeighborhood?: string | null;
  }): ResolveAddressFromNamesResult {
    const governorate = input.governorate?.trim();
    const cityRegion = input.cityRegion?.trim();
    const townNeighborhood = input.townNeighborhood?.trim();

    if (!governorate) {
      return { found: false, message: 'Governorate is required to resolve delivery coordinates.' };
    }

    if (cityRegion && townNeighborhood) {
      const hierarchyTownKey = [governorate, cityRegion, townNeighborhood].join(SEP);
      const fromHierarchy = this.hierarchyTownCoords.get(hierarchyTownKey);
      if (fromHierarchy) {
        return {
          found: true,
          lat: fromHierarchy.lat,
          lng: fromHierarchy.lng,
          source: 'neighborhood',
          resolvedLabel: townNeighborhood,
        };
      }

      const neighborhood = this.resolveTownAcrossDistricts(
        governorate,
        cityRegion,
        townNeighborhood,
      );
      if (neighborhood) {
        return {
          found: true,
          lat: neighborhood.lat,
          lng: neighborhood.lng,
          source: 'neighborhood',
          resolvedLabel: townNeighborhood,
        };
      }
    }

    if (cityRegion) {
      const city = this.lookupCity(governorate, cityRegion);
      if (city) {
        return {
          found: true,
          lat: city.lat,
          lng: city.lng,
          source: 'city',
          resolvedLabel: cityRegion,
        };
      }
    }

    const gov = this.lookupGovernorate(governorate);
    if (gov) {
      return {
        found: true,
        lat: gov.lat,
        lng: gov.lng,
        source: 'governorate',
        resolvedLabel: governorate,
      };
    }

    const parts = [townNeighborhood, cityRegion, governorate].filter(Boolean);
    return {
      found: false,
      message: `No stored coordinates for ${parts.join(' — ')}.`,
    };
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
