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

import { ShippingApi, type ShippingAreaBoundary } from '../api/shipping';
import type { GeoJsonGeometry } from '../lib/geo-polygon';

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

export type ResolvedMapAddress = {
  governorate: string;
  cityRegion: string;
  townNeighborhood: string;
  lat: string;
  lng: string;
  distanceMeters: number;
};

export type DeliveryLocationMapProps = {
  lat: string;
  lng: string;
  /** Persist confirmed pin coords (optional — address fill is the primary use). */
  onChange: (next: { lat: string; lng: string }) => void;
  /** Called after Confirm when a supported address is found within 1 km. */
  onAddressResolved?: (address: ResolvedMapAddress) => void;
  /** Called after Confirm when no supported address is within 1 km. */
  onAddressUnavailable?: (message: string) => void;
  disabled?: boolean;
  governorate?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  onRemovePin?: () => void;
  className?: string;
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

function computeCentroid(geometry: GeoJsonGeometry): { lat: number; lng: number } | null {
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

  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
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

/**
 * Map is an address search tool: pin → Confirm → fill Governorate/City/Town
 * from the nearest local hierarchy point within 1 km (or show unavailable).
 */
export function DeliveryLocationMap({
  lat,
  lng,
  onChange,
  onAddressResolved,
  onAddressUnavailable,
  disabled = false,
  governorate,
  city,
  neighborhood,
  street: _street,
  onRemovePin,
  className,
}: DeliveryLocationMapProps) {
  const confirmedLat = parseCoord(lat);
  const confirmedLng = parseCoord(lng);
  const hasConfirmedPin = confirmedLat != null && confirmedLng != null;

  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(
    hasConfirmedPin ? { lat: confirmedLat!, lng: confirmedLng! } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [circleCenter, setCircleCenter] = useState<{ lat: number; lng: number }>({
    lat: SYRIA_CENTER[0],
    lng: SYRIA_CENTER[1],
  });
  const [loadingArea, setLoadingArea] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (hasConfirmedPin) {
      setDraft({ lat: confirmedLat!, lng: confirmedLng! });
    }
  }, [hasConfirmedPin, confirmedLat, confirmedLng]);

  useEffect(() => {
    if (!governorate) {
      setCircleCenter({ lat: SYRIA_CENTER[0], lng: SYRIA_CENTER[1] });
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingArea(true);

    ShippingApi.getAreaBoundary({
      governorate,
      city: city || undefined,
      neighborhood: neighborhood || undefined,
    })
      .then((result: ShippingAreaBoundary) => {
        if (ctrl.signal.aborted) return;
        if (result.geometry) {
          const c = computeCentroid(result.geometry as GeoJsonGeometry);
          if (c) {
            setCircleCenter(c);
            return;
          }
        }
        if (result.bbox) {
          setCircleCenter({
            lat: (result.bbox.south + result.bbox.north) / 2,
            lng: (result.bbox.west + result.bbox.east) / 2,
          });
        }
      })
      .catch(() => {
        /* keep center */
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingArea(false);
      });

    return () => ctrl.abort();
  }, [governorate, city, neighborhood]);

  const mapCenter = useMemo<[number, number]>(
    () => [circleCenter.lat, circleCenter.lng],
    [circleCenter.lat, circleCenter.lng],
  );

  const pin = draft;
  const hasDraft = pin != null;
  const dirty =
    hasDraft &&
    (!hasConfirmedPin ||
      Math.abs(pin!.lat - confirmedLat!) > 1e-7 ||
      Math.abs(pin!.lng - confirmedLng!) > 1e-7);

  const handlePick = useCallback((pickLat: number, pickLng: number) => {
    setError(null);
    setDraft({ lat: pickLat, lng: pickLng });
  }, []);

  const handleDragEnd = useCallback((e: L.DragEndEvent) => {
    const marker = e.target as L.Marker;
    const pos = marker.getLatLng();
    setError(null);
    setDraft({ lat: pos.lat, lng: pos.lng });
  }, []);

  const handleCancel = () => {
    setError(null);
    if (hasConfirmedPin) {
      setDraft({ lat: confirmedLat!, lng: confirmedLng! });
    } else {
      setDraft(null);
    }
  };

  const handleRemove = () => {
    setError(null);
    setDraft(null);
    onChange({ lat: '', lng: '' });
    onRemovePin?.();
  };

  const handleConfirm = async () => {
    if (!pin || disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ShippingApi.resolveAddressFromPin(pin.lat, pin.lng);
      if (!result.found) {
        const msg =
          result.message ||
          'No supported address found near this location (within 1 km).';
        setError(msg);
        onAddressUnavailable?.(msg);
        return;
      }
      const next = {
        governorate: result.governorate,
        cityRegion: result.cityRegion,
        townNeighborhood: result.townNeighborhood,
        lat: formatCoord(result.lat),
        lng: formatCoord(result.lng),
        distanceMeters: result.distanceMeters,
      };
      onChange({ lat: next.lat, lng: next.lng });
      onAddressResolved?.(next);
      setDraft({ lat: result.lat, lng: result.lng });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not resolve address from map pin.';
      setError(msg);
      onAddressUnavailable?.(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="relative rounded-lg border border-border-subtle overflow-hidden">
        {(loadingArea || busy) && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/50">
            <span className="text-xs text-text-muted">
              {busy ? 'Finding nearest address…' : 'Loading area…'}
            </span>
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
          <ClickHandler disabled={disabled || busy} onPick={handlePick} />
          {hasDraft && (
            <Marker
              position={[pin!.lat, pin!.lng]}
              draggable={!disabled && !busy}
              eventHandlers={{ dragend: handleDragEnd }}
            />
          )}
        </MapContainer>

        <div className="absolute bottom-2 left-2 right-2 z-[1000] flex flex-wrap items-center justify-between gap-2">
          <p className="rounded bg-white/95 px-2 py-1 text-[11px] text-text-muted shadow">
            {hasDraft
              ? 'Pin placed — press Confirm to fill address fields.'
              : 'Click the map to place a pin, then Confirm.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {hasDraft && !disabled && (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="rounded bg-white px-2.5 py-1 text-xs font-medium text-text-muted shadow hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={busy || (!dirty && hasConfirmedPin)}
                  className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                >
                  Confirm
                </button>
                {hasConfirmedPin && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={busy}
                    className="rounded bg-white px-2.5 py-1 text-xs font-medium text-red-600 shadow hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove Pin
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <span aria-hidden="true">⚠</span>
          <div>
            <p className="font-semibold">Address not available</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <p className="mt-1 text-xs text-text-muted">
        Use the map to auto-fill Governorate, City/Region, and Town/Neighborhood from the nearest
        supported address within 1 km. Dropdowns stay available for manual entry.
      </p>
    </div>
  );
}
