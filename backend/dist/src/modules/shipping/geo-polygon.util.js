"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pointInGeoJson = pointInGeoJson;
exports.bboxToPolygon = bboxToPolygon;
exports.parseNominatimBoundingBox = parseNominatimBoundingBox;
exports.geometryBbox = geometryBbox;
function ringContains(ring, lng, lat) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function polygonContains(coords, lng, lat) {
    if (!coords.length)
        return false;
    if (!ringContains(coords[0], lng, lat))
        return false;
    for (let h = 1; h < coords.length; h++) {
        if (ringContains(coords[h], lng, lat))
            return false;
    }
    return true;
}
function pointInGeoJson(geometry, point) {
    if (!geometry || !Number.isFinite(point.lat) || !Number.isFinite(point.lng))
        return false;
    const { lat, lng } = point;
    if (geometry.type === 'Polygon') {
        return polygonContains(geometry.coordinates, lng, lat);
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some((poly) => polygonContains(poly, lng, lat));
    }
    if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
        const geometries = geometry.geometries;
        return geometries.some((g) => pointInGeoJson(g, point));
    }
    return false;
}
function bboxToPolygon(bbox) {
    const { south, north, west, east } = bbox;
    return {
        type: 'Polygon',
        coordinates: [
            [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ],
        ],
    };
}
function parseNominatimBoundingBox(raw) {
    if (!Array.isArray(raw) || raw.length < 4)
        return null;
    const south = Number(raw[0]);
    const north = Number(raw[1]);
    const west = Number(raw[2]);
    const east = Number(raw[3]);
    if (![south, north, west, east].every(Number.isFinite))
        return null;
    return { south, north, west, east };
}
function geometryBbox(geometry) {
    const pts = [];
    const walk = (c) => {
        if (!Array.isArray(c) || c.length === 0)
            return;
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
            pts.push([c[0], c[1]]);
            return;
        }
        for (const n of c)
            walk(n);
    };
    walk(geometry.coordinates);
    if (!pts.length)
        return null;
    let south = Infinity;
    let north = -Infinity;
    let west = Infinity;
    let east = -Infinity;
    for (const [lng, lat] of pts) {
        if (lat < south)
            south = lat;
        if (lat > north)
            north = lat;
        if (lng < west)
            west = lng;
        if (lng > east)
            east = lng;
    }
    return { south, north, west, east };
}
//# sourceMappingURL=geo-polygon.util.js.map