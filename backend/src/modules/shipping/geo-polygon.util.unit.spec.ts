import {
  bboxToPolygon,
  pointInGeoJson,
  type GeoBbox,
  type GeoJsonGeometry,
  type LatLng,
} from './geo-polygon.util';

describe('geo-polygon.util', () => {
  const square: GeoJsonGeometry = bboxToPolygon({
    south: 33,
    north: 34,
    west: 36,
    east: 37,
  });

  it('contains a point inside the polygon', () => {
    expect(pointInGeoJson(square, { lat: 33.5, lng: 36.5 })).toBe(true);
  });

  it('rejects a point outside the polygon', () => {
    expect(pointInGeoJson(square, { lat: 35, lng: 36.5 })).toBe(false);
  });

  it('rejects invalid coordinates', () => {
    expect(pointInGeoJson(square, { lat: Number.NaN, lng: 36 })).toBe(false);
  });
});
