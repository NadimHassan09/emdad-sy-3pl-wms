import { Injectable, Logger } from '@nestjs/common';

import {
  bboxToPolygon,
  geometryBbox,
  parseNominatimBoundingBox,
  pointInGeoJson,
  type GeoBbox,
  type GeoJsonGeometry,
} from './geo-polygon.util';

export type AreaBoundary = {
  query: string;
  displayName: string;
  geometry: GeoJsonGeometry;
  bbox: GeoBbox;
  source: 'nominatim';
};

type CacheEntry = { at: number; value: AreaBoundary | null };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;

@Injectable()
export class ShippingGeoService {
  private readonly logger = new Logger(ShippingGeoService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private lastCallAt = 0;
  private chain: Promise<unknown> = Promise.resolve();

  async lookupBoundary(params: {
    governorate?: string | null;
    city?: string | null;
    neighborhood?: string | null;
  }): Promise<AreaBoundary | null> {
    const governorate = params.governorate?.trim() || '';
    const city = params.city?.trim() || '';
    const neighborhood = params.neighborhood?.trim() || '';
    if (!governorate && !city && !neighborhood) return null;

    const attempts = [
      [neighborhood, city, governorate].filter(Boolean).join(', '),
      [city, governorate].filter(Boolean).join(', '),
      governorate,
    ].filter((q, i, arr) => q && arr.indexOf(q) === i);

    for (const query of attempts) {
      const found = await this.searchNominatim(`${query}, Syria`);
      if (found) return found;
    }
    return null;
  }

  containsPoint(
    boundary: AreaBoundary | null | undefined,
    point: { lat: number; lng: number },
  ): boolean {
    if (!boundary) return false;
    return pointInGeoJson(boundary.geometry, point);
  }

  private async searchNominatim(query: string): Promise<AreaBoundary | null> {
    const key = query.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.value;
    }

    const result = await this.enqueue(() => this.fetchNominatim(query));
    this.cache.set(key, { at: Date.now(), value: result });
    if (this.cache.size > 200) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    return result;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.lastCallAt);
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      this.lastCallAt = Date.now();
      return fn();
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async fetchNominatim(query: string): Promise<AreaBoundary | null> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('polygon_geojson', '1');
    url.searchParams.set('polygon_threshold', '0.002');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('countrycodes', 'sy');

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EMDAD-WMS/1.0 (staging-admin.emdadsy.com)',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim ${res.status} for "${query}"`);
        return null;
      }
      const rows = (await res.json()) as Array<{
        display_name?: string;
        geojson?: GeoJsonGeometry;
        boundingbox?: unknown;
      }>;
      const row = rows[0];
      if (!row) return null;

      let geometry = row.geojson;
      const bbox = parseNominatimBoundingBox(row.boundingbox);
      const usable =
        geometry &&
        (geometry.type === 'Polygon' ||
          geometry.type === 'MultiPolygon' ||
          geometry.type === 'GeometryCollection');
      if (!usable && bbox) {
        geometry = bboxToPolygon(bbox);
      }
      if (!geometry) return null;
      const resolvedBbox = bbox ?? geometryBbox(geometry);
      if (!resolvedBbox) return null;

      return {
        query,
        displayName: row.display_name?.trim() || query,
        geometry,
        bbox: resolvedBbox,
        source: 'nominatim',
      };
    } catch (err) {
      this.logger.warn(
        `Nominatim lookup failed for "${query}": ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}
