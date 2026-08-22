"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSyriaAddress = resolveSyriaAddress;
const syria_address_hierarchy_json_1 = __importDefault(require("./syria-address-hierarchy.json"));
const HIERARCHY = syria_address_hierarchy_json_1.default;
function norm(value) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
function findKey(keys, raw) {
    const n = norm(raw);
    if (!n)
        return null;
    return keys.find((k) => norm(k) === n) ?? null;
}
function resolveSyriaAddress(input) {
    const governorateRaw = input.governorate?.trim() ?? '';
    const cityRaw = input.city?.trim() ?? '';
    const neighborhoodRaw = input.neighborhood?.trim() || '';
    const street = input.street?.trim() || null;
    const fields = {};
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
    let neighborhood = null;
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
//# sourceMappingURL=syria-address.js.map