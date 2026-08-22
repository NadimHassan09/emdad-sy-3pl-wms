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

import { isClientArabic } from '../lib/client-ui-language';
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
  onChange: (next: { lat: string; lng: string }) => void;
  onAddressResolved?: (address: ResolvedMapAddress) => void;
  onAddressUnavailable?: (message: string) => void;
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

type ResolvePinResult =
  | {
      found: true;
      governorate: string;
      cityRegion: string;
      townNeighborhood: string;
      lat: number;
      lng: number;
      distanceMeters: number;
    }
  | {
      found: false;
      message: string;
      nearestLabel?: string;
      distanceMeters?: number;
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
  const key = `${center[0]},${center[1]},${radius}`;
  useEffect(() => {
    const bounds = L.latLng(center[0], center[1]).toBounds(radius * 2);
    if (!bounds.isValid()) return;
    const apply = () => {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14, animate: true });
      map.invalidateSize({ animate: false });
    };
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) {
      const id = window.setTimeout(apply, 50);
      return () => window.clearTimeout(id);
    }
    apply();
  }, [key, center, radius, map]);
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
  const isArabic = isClientArabic();
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

  const t = (en: string, ar: string) => (isArabic ? ar : en);

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

    const qs = new URLSearchParams();
    qs.set('governorate', governorate);
    if (city) qs.set('city', city);
    if (neighborhood) qs.set('neighborhood', neighborhood);

    apiClient
      .get<AreaBoundaryResult>(`/shipping/geo/boundary?${qs.toString()}`, { signal: ctrl.signal })
      .then(({ data }) => {
        if (ctrl.signal.aborted) return;
        if (!data || data.found === false) return;
        if (data.geometry) {
          const c = computeCentroid(data.geometry);
          if (c) {
            setCircleCenter(c);
            return;
          }
        }
        if (data.bbox) {
          setCircleCenter({
            lat: (data.bbox.south + data.bbox.north) / 2,
            lng: (data.bbox.west + data.bbox.east) / 2,
          });
        }
      })
      .catch(() => {
        /* keep previous center */
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
      const { data: result } = await apiClient.post<ResolvePinResult>(
        '/shipping/address/resolve-from-pin',
        { lat: pin.lat, lng: pin.lng },
      );
      if (!result.found) {
        const msg =
          result.message ||
          t(
            'No supported address found near this location (within 1 km).',
            'لا يوجد عنوان مدعوم قرب هذا الموقع (ضمن 1 كم).',
          );
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
        err instanceof Error
          ? err.message
          : t('Could not resolve address from map pin.', 'تعذر استخراج العنوان من الخريطة.');
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
              {busy
                ? t('Finding nearest address…', 'جاري البحث عن أقرب عنوان…')
                : t('Loading area…', 'جاري تحميل المنطقة…')}
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
              ? t(
                  'Pin placed — press Confirm to fill address fields.',
                  'تم وضع الدبوس — اضغط موافق لملء حقول العنوان.',
                )
              : t(
                  'Click the map to place a pin, then Confirm.',
                  'اضغط على الخريطة لتحديد المكان ثم موافق.',
                )}
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
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={busy || (!dirty && hasConfirmedPin)}
                  className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t('Confirm', 'موافق')}
                </button>
                {hasConfirmedPin && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={busy}
                    className="rounded bg-white px-2.5 py-1 text-xs font-medium text-red-600 shadow hover:bg-red-50 disabled:opacity-50"
                  >
                    {t('Remove Pin', 'إزالة الدبوس')}
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
            <p className="font-semibold">
              {t('Address not available', 'العنوان غير متاح')}
            </p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <p className="mt-1 text-xs text-text-muted">
        {t(
          'Use the map to auto-fill address fields from the nearest supported location within 1 km.',
          'استخدم الخريطة لملء حقول العنوان تلقائيًا من أقرب موقع مدعوم ضمن 1 كم.',
        )}
      </p>
    </div>
  );
}
