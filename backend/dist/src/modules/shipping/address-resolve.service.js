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
const syria_location_index_json_1 = __importDefault(require("../../data/syria-locations/syria-location-index.json"));
const geo_polygon_util_1 = require("./geo-polygon.util");
const SEP = '\u001f';
const MAX_DISTANCE_KM = 1;
let AddressResolveService = class AddressResolveService {
    points;
    constructor() {
        const raw = syria_location_index_json_1.default;
        const points = [];
        for (const [key, value] of Object.entries(raw.neighborhoods ?? {})) {
            const parts = key.split(SEP);
            if (parts.length < 3)
                continue;
            const lat = Number(value?.lat);
            const lng = Number(value?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng))
                continue;
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