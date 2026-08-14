"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ShippingGeoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingGeoService = void 0;
const common_1 = require("@nestjs/common");
const geo_polygon_util_1 = require("./geo-polygon.util");
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;
let ShippingGeoService = ShippingGeoService_1 = class ShippingGeoService {
    logger = new common_1.Logger(ShippingGeoService_1.name);
    cache = new Map();
    lastCallAt = 0;
    chain = Promise.resolve();
    async lookupBoundary(params) {
        const governorate = params.governorate?.trim() || '';
        const city = params.city?.trim() || '';
        const neighborhood = params.neighborhood?.trim() || '';
        if (!governorate && !city && !neighborhood)
            return null;
        const attempts = [
            [neighborhood, city, governorate].filter(Boolean).join(', '),
            [city, governorate].filter(Boolean).join(', '),
            governorate,
        ].filter((q, i, arr) => q && arr.indexOf(q) === i);
        for (const query of attempts) {
            const found = await this.searchNominatim(`${query}, Syria`);
            if (found)
                return found;
        }
        return null;
    }
    containsPoint(boundary, point) {
        if (!boundary)
            return false;
        return (0, geo_polygon_util_1.pointInGeoJson)(boundary.geometry, point);
    }
    async searchNominatim(query) {
        const key = query.toLowerCase();
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
            return cached.value;
        }
        const result = await this.enqueue(() => this.fetchNominatim(query));
        this.cache.set(key, { at: Date.now(), value: result });
        if (this.cache.size > 200) {
            const first = this.cache.keys().next().value;
            if (first)
                this.cache.delete(first);
        }
        return result;
    }
    enqueue(fn) {
        const run = this.chain.then(async () => {
            const wait = MIN_INTERVAL_MS - (Date.now() - this.lastCallAt);
            if (wait > 0) {
                await new Promise((r) => setTimeout(r, wait));
            }
            this.lastCallAt = Date.now();
            return fn();
        });
        this.chain = run.then(() => undefined, () => undefined);
        return run;
    }
    async fetchNominatim(query) {
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
            const rows = (await res.json());
            const row = rows[0];
            if (!row)
                return null;
            let geometry = row.geojson;
            const bbox = (0, geo_polygon_util_1.parseNominatimBoundingBox)(row.boundingbox);
            const usable = geometry &&
                (geometry.type === 'Polygon' ||
                    geometry.type === 'MultiPolygon' ||
                    geometry.type === 'GeometryCollection');
            if (!usable && bbox) {
                geometry = (0, geo_polygon_util_1.bboxToPolygon)(bbox);
            }
            if (!geometry)
                return null;
            const resolvedBbox = bbox ?? (0, geo_polygon_util_1.geometryBbox)(geometry);
            if (!resolvedBbox)
                return null;
            return {
                query,
                displayName: row.display_name?.trim() || query,
                geometry,
                bbox: resolvedBbox,
                source: 'nominatim',
            };
        }
        catch (err) {
            this.logger.warn(`Nominatim lookup failed for "${query}": ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }
};
exports.ShippingGeoService = ShippingGeoService;
exports.ShippingGeoService = ShippingGeoService = ShippingGeoService_1 = __decorate([
    (0, common_1.Injectable)()
], ShippingGeoService);
//# sourceMappingURL=shipping-geo.service.js.map