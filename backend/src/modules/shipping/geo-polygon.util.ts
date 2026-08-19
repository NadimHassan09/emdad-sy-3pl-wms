/** GeoJSON position is [lng, lat]. */

export type GeoJsonPosition = [number, number];

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: GeoJsonPosition[][];
};

export type GeoJsonMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: GeoJsonPosition[][][];
};

export type GeoJsonGeometry =
  | GeoJsonPolygon
  | GeoJsonMultiPolygon
  | { type: string; coordinates: unknown };

export type LatLng = { lat: number; lng: number };

export type GeoBbox = {
  south: number;
  north: number;
  west: number;
  east: number;
};

function ringContains(ring: GeoJsonPosition[], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonContains(coords: GeoJsonPosition[][], lng: number, lat: number): boolean {
  if (!coords.length) return false;
  if (!ringContains(coords[0], lng, lat)) return false;
  for (let h = 1; h < coords.length; h++) {
    if (ringContains(coords[h], lng, lat)) return false;
  }
  return true;
}

/** True if the WGS84 point lies inside a Polygon or MultiPolygon. */
export function pointInGeoJson(geometry: GeoJsonGeometry | null | undefined, point: LatLng): boolean {
  if (!geometry || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  const { lat, lng } = point;
  if (geometry.type === 'Polygon') {
    return polygonContains(geometry.coordinates as GeoJsonPosition[][], lng, lat);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as GeoJsonPosition[][][]).some((poly) =>
      polygonContains(poly, lng, lat),
    );
  }
  if (geometry.type === 'GeometryCollection' && Array.isArray((geometry as { geometries?: unknown }).geometries)) {
    const geometries = (geometry as unknown as { geometries: GeoJsonGeometry[] }).geometries;
    return geometries.some((g) => pointInGeoJson(g, point));
  }
  return false;
}

/** Nominatim boundingbox is [south, north, west, east] (strings or numbers). */
export function bboxToPolygon(bbox: GeoBbox): GeoJsonPolygon {
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

export function parseNominatimBoundingBox(
  raw: unknown,
): GeoBbox | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;
  const south = Number(raw[0]);
  const north = Number(raw[1]);
  const west = Number(raw[2]);
  const east = Number(raw[3]);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  return { south, north, west, east };
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Initial bearing from `from` toward `to` (radians). */
function bearingRad(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x);
}

function destinationAlongBearing(center: LatLng, bearing: number, distanceKm: number): LatLng {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const φ1 = toRad(center.lat);
  const λ1 = toRad(center.lng);
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(bearing));
  const λ2 =
    λ1 + Math.atan2(Math.sin(bearing) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

/** Haversine distance in kilometers between two WGS84 points. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the point lies within `radiusKm` of `center`. */
export function pointInCircle(
  center: LatLng,
  point: LatLng,
  radiusKm: number,
): boolean {
  if (
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0
  ) {
    return false;
  }
  return haversineDistanceKm(center, point) <= radiusKm + 1e-9;
}

/**
 * If `point` is inside the circle, return it.
 * Otherwise move it onto the circle toward `center` (never outside).
 */
export function clampPointToCircle(
  center: LatLng,
  point: LatLng,
  radiusKm: number,
): LatLng {
  if (pointInCircle(center, point, radiusKm)) return point;
  const dist = haversineDistanceKm(center, point);
  if (!Number.isFinite(dist) || dist <= 0) return center;
  return destinationAlongBearing(center, bearingRad(center, point), radiusKm * 0.999);
}

/** Approximate a circle as a 64-point GeoJSON polygon for map display. */
export function circleToPolygon(
  center: LatLng,
  radiusKm: number,
  points = 64,
): GeoJsonPolygon {
  const coords: GeoJsonPosition[] = [];
  const latRad = (center.lat * Math.PI) / 180;
  const degLat = radiusKm / 110.574;
  const degLng = radiusKm / (111.32 * Math.cos(latRad) || 1);
  for (let i = 0; i <= points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const lat = center.lat + degLat * Math.sin(angle);
    const lng = center.lng + degLng * Math.cos(angle);
    coords.push([lng, lat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

export function geometryBbox(geometry: GeoJsonGeometry): GeoBbox | null {
  const pts: GeoJsonPosition[] = [];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c) || c.length === 0) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      pts.push([c[0], c[1]]);
      return;
    }
    for (const n of c) walk(n);
  };
  walk((geometry as { coordinates: unknown }).coordinates);
  if (!pts.length) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const [lng, lat] of pts) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, north, west, east };
}

export function bboxCentroid(bbox: GeoBbox): LatLng {
  return {
    lat: (bbox.south + bbox.north) / 2,
    lng: (bbox.west + bbox.east) / 2,
  };
}
