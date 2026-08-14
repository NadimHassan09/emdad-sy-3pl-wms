/** GeoJSON position is [lng, lat]. */

export type GeoJsonPosition = [number, number];

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type LatLng = { lat: number; lng: number };

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
