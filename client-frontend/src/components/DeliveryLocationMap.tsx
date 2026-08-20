import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import { apiClient } from '../services/apiClient';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const SYRIA_CENTER: [number, number] = [35.0, 38.0];
const CIRCLE_RADIUS = 3000;

export type DeliveryLocationMapProps = {
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
  disabled?: boolean;
  governorate?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  onRemovePin?: () => void;
  className?: string;
};

type AreaBoundaryResult = {
  found?: boolean;
  geometry: { type: string; coordinates: unknown } | null;
  bbox?: { south: number; north: number; west: number; east: number } | null;
};

function parseCoord(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatCoord(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

function computeCentroid(geometry: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  const coords: [number, number][] = [];
  function extract(c: unknown) {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      coords.push(c as [number, number]);
    } else {
      for (const sub of c) extract(sub);
    }
  }
  extract(geometry.coordinates);
  if (coords.length === 0) return null;
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of coords) { sumLng += lng; sumLat += lat; }
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
}

function isInsideCircle(
  center: { lat: number; lng: number },
  radius: number,
  point: { lat: number; lng: number },
): boolean {
  return L.latLng(center.lat, center.lng).distanceTo(L.latLng(point.lat, point.lng)) <= radius;
}

function constrainToCircle(
  center: { lat: number; lng: number },
  radius: number,
  point: { lat: number; lng: number },
): { lat: number; lng: number } {
  if (isInsideCircle(center, radius, point)) return point;
  const d = L.latLng(center.lat, center.lng).distanceTo(L.latLng(point.lat, point.lng));
  const ratio = radius / d;
  return {
    lat: center.lat + (point.lat - center.lat) * ratio,
    lng: center.lng + (point.lng - center.lng) * ratio,
  };
}

function FitCircle({ center, radius }: { center: [number, number]; radius: number }) {
  const map = useMap();
  const key = `${center[0]},${center[1]}`;
  useEffect(() => {
    const bounds = L.latLng(center[0], center[1]).toBounds(radius * 2);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14, animate: true });
  }, [key, radius, map]);
  return null;
}

function ClickHandler({
  disabled,
  circleCenter,
  radius,
  onPick,
}: {
  disabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function DeliveryLocationMap({
  lat,
  lng,
  onChange,
  disabled = false,
  governorate,
  city,
  neighborhood,
  street: _street,
  onRemovePin,
  className,
}: DeliveryLocationMapProps) {
  const latN = parseCoord(lat);
  const lngN = parseCoord(lng);
  const hasPin = latN != null && lngN != null;

  const [circleCenter, setCircleCenter] = useState<{ lat: number; lng: number }>({
    lat: SYRIA_CENTER[0],
    lng: SYRIA_CENTER[1],
  });
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prevAddressRef = useRef({ governorate, city });

  // Clear stale pin when governorate or city changes materially
  useEffect(() => {
    const prev = prevAddressRef.current;
    if (hasPin && (prev.governorate !== governorate || prev.city !== city)) {
      onChange({ lat: '', lng: '' });
    }
    prevAddressRef.current = { governorate, city };
  }, [governorate, city]);

  useEffect(() => {
    if (!governorate) {
      setCircleCenter({ lat: SYRIA_CENTER[0], lng: SYRIA_CENTER[1] });
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    const qs = new URLSearchParams();
    qs.set('governorate', governorate);
    if (city) qs.set('city', city);
    if (neighborhood) qs.set('neighborhood', neighborhood);

    apiClient
      .get<AreaBoundaryResult>(`/shipping/geo/boundary?${qs.toString()}`, { signal: ctrl.signal })
      .then(({ data }) => {
        if (ctrl.signal.aborted) return;
        if (data.geometry) {
          const c = computeCentroid(data.geometry);
          if (c) { setCircleCenter(c); return; }
        }
        if (data.bbox) {
          setCircleCenter({
            lat: (data.bbox.south + data.bbox.north) / 2,
            lng: (data.bbox.west + data.bbox.east) / 2,
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [governorate, city, neighborhood]);

  const mapCenter = useMemo<[number, number]>(
    () => [circleCenter.lat, circleCenter.lng],
    [circleCenter.lat, circleCenter.lng],
  );

  const handlePick = useCallback(
    (pickLat: number, pickLng: number) => {
      onChange({ lat: formatCoord(pickLat), lng: formatCoord(pickLng) });
    },
    [onChange],
  );

  const handleDragEnd = useCallback(
    (e: L.DragEndEvent) => {
      const marker = e.target as L.Marker;
      const pos = marker.getLatLng();
      onChange({ lat: formatCoord(pos.lat), lng: formatCoord(pos.lng) });
    },
    [onChange],
  );

  const handleRemove = () => {
    onChange({ lat: '', lng: '' });
    onRemovePin?.();
  };

  return (
    <div className={className}>
      <div className="relative rounded-lg border border-border-subtle overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/50">
            <span className="text-xs text-text-muted">Loading area…</span>
          </div>
        )}
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom
          style={{ height: 320, width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitCircle center={mapCenter} radius={CIRCLE_RADIUS} />
          <Circle
            center={mapCenter}
            radius={CIRCLE_RADIUS}
            pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.12 }}
          />
          <ClickHandler
            disabled={disabled}
            onPick={handlePick}
          />
          {hasPin && (
            <Marker
              position={[latN, lngN]}
              draggable={!disabled}
              eventHandlers={{ dragend: handleDragEnd }}
            />
          )}
        </MapContainer>
        {hasPin && !disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute bottom-2 right-2 z-[1000] rounded bg-white px-2 py-1 text-xs font-medium text-red-600 shadow hover:bg-red-50"
          >
            Remove Pin
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {hasPin
          ? 'Delivery pin selected. Drag to adjust or click elsewhere to move it.'
          : 'Click on the map to place the delivery pin. The blue circle is an approximate area guide.'}
      </p>
    </div>
  );
}
