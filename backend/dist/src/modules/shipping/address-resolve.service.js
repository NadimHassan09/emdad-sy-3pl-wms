"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressResolveService = void 0;
const common_1 = require("@nestjs/common");
const syria_address_hierarchy_json_1 = __importDefault(require("../../data/syria-locations/syria-address-hierarchy.json"));
const syria_location_index_json_1 = __importDefault(require("../../data/syria-locations/syria-location-index.json"));
const geo_polygon_util_1 = require("./geo-polygon.util");
const SEP = '\u001f';
const MAX_DISTANCE_KM = 1;
const BABEL_CITY_PRIMARY_DISTRICT = {
    [`حلب${SEP}مدينة حلب`]: 'مركز جبل سمعان',
    [`إدلب${SEP}مدينة إدلب`]: 'مركز إدلب',
    [`حمص${SEP}مدينة حمص`]: 'مركز حمص',
    [`حماة${SEP}مدينة حماة`]: 'مركز حماة',
    [`دمشق${SEP}محافظة دمشق`]: 'دمشق',
    [`ريف دمشق${SEP}مركز ريف دمشق`]: 'مركز ريف دمشق',
};
function readCoords(value) {
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return null;
    return { lat, lng };
}
function averageCoords(points) {
    if (points.length === 0)
        return null;
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
let AddressResolveService = class AddressResolveService {
    raw;
    points;
    cityCentroids;
    hierarchyTownCoords;
    hierarchyCityCoords;
    constructor() {
        this.raw = syria_location_index_json_1.default;
        const points = [];
        const cityBuckets = new Map();
        for (const [key, value] of Object.entries(this.raw.neighborhoods ?? {})) {
            const parts = key.split(SEP);
            if (parts.length < 3)
                continue;
            const lat = Number(value?.lat);
            const lng = Number(value?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng))
                continue;
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
            if (avg)
                this.cityCentroids.set(cityKey, avg);
        }
        const hierarchyCoords = this.buildHierarchyCoordinateIndex();
        this.hierarchyTownCoords = hierarchyCoords.towns;
        this.hierarchyCityCoords = hierarchyCoords.cities;
    }
    buildHierarchyCoordinateIndex() {
        const towns = new Map();
        const cityBuckets = new Map();
        const hierarchy = syria_address_hierarchy_json_1.default;
        for (const [governorate, cities] of Object.entries(hierarchy)) {
            for (const [cityRegion, townNames] of Object.entries(cities)) {
                const cityKey = [governorate, cityRegion].join(SEP);
                for (const townName of townNames) {
                    const coords = this.resolveTownAcrossDistricts(governorate, cityRegion, townName);
                    if (!coords)
                        continue;
                    towns.set([governorate, cityRegion, townName].join(SEP), coords);
                    const bucket = cityBuckets.get(cityKey) ?? [];
                    bucket.push(coords);
                    cityBuckets.set(cityKey, bucket);
                }
            }
        }
        const cities = new Map();
        for (const [cityKey, bucket] of cityBuckets.entries()) {
            const avg = averageCoords(bucket);
            if (avg)
                cities.set(cityKey, avg);
        }
        return { towns, cities };
    }
    pickPreferredDistrict(governorate, babelCity, matches) {
        if (matches.length === 0)
            return null;
        const primary = BABEL_CITY_PRIMARY_DISTRICT[[governorate, babelCity].join(SEP)];
        if (primary) {
            const hit = matches.find((m) => m.cityRegion === primary);
            if (hit)
                return hit;
        }
        const byCityHint = matches.find((m) => m.townNeighborhood.includes(babelCity) ||
            m.townNeighborhood.includes(` - ${m.cityRegion}`));
        return byCityHint ?? matches[0];
    }
    resolveTownAcrossDistricts(governorate, babelCity, townNeighborhood) {
        const exact = this.lookupNeighborhood(governorate, babelCity, townNeighborhood);
        if (exact)
            return exact;
        const matches = this.points.filter((p) => p.governorate === governorate && p.townNeighborhood === townNeighborhood);
        if (matches.length === 1) {
            return { lat: matches[0].lat, lng: matches[0].lng };
        }
        if (matches.length > 1) {
            const preferred = this.pickPreferredDistrict(governorate, babelCity, matches);
            if (preferred)
                return { lat: preferred.lat, lng: preferred.lng };
        }
        return null;
    }
    lookupNeighborhood(governorate, cityRegion, townNeighborhood) {
        const key = [governorate, cityRegion, townNeighborhood].join(SEP);
        const indexed = readCoords(this.raw.neighborhoods?.[key]);
        if (indexed)
            return indexed;
        const point = this.points.find((p) => p.governorate === governorate &&
            p.cityRegion === cityRegion &&
            p.townNeighborhood === townNeighborhood);
        return point ? { lat: point.lat, lng: point.lng } : null;
    }
    lookupCity(governorate, cityRegion) {
        const hierarchyKey = [governorate, cityRegion].join(SEP);
        const fromHierarchy = this.hierarchyCityCoords.get(hierarchyKey);
        if (fromHierarchy)
            return fromHierarchy;
        const key = [governorate, cityRegion].join(SEP);
        const indexedCity = readCoords(this.raw.cities?.[key]);
        if (indexedCity)
            return indexedCity;
        return this.cityCentroids.get(key) ?? null;
    }
    lookupGovernorate(governorate) {
        return readCoords(this.raw.governorates?.[governorate]);
    }
    resolveFromAddress(input) {
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
            const neighborhood = this.resolveTownAcrossDistricts(governorate, cityRegion, townNeighborhood);
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
    resolveFromPin(lat, lng) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return { found: false, message: 'Invalid map coordinates.' };
        }
        let best = null;
        let bestKm = Number.POSITIVE_INFINITY;
        for (const p of this.points) {
            const d = (0, geo_polygon_util_1.haversineDistanceKm)({ lat, lng }, { lat: p.lat, lng: p.lng });
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
};
exports.AddressResolveService = AddressResolveService;
exports.AddressResolveService = AddressResolveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AddressResolveService);
//# sourceMappingURL=address-resolve.service.js.map