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
