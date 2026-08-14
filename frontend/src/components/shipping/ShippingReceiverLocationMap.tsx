import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GeoJSON as GeoJsonLayer,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import { pointInGeoJson, type GeoJsonGeometry } from '../../lib/geo-polygon';

/** Damascus center — matches historical placeholders. */
export const DEFAULT_RECEIVER_MAP_CENTER: [number, number] = [33.5138, 36.2765];

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

const BOUNDARY_STYLE: L.PathOptions = {
  color: '#0f766e',
  weight: 2,
  fillColor: '#14b8a6',
  fillOpacity: 0.18,
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

function MapClickHandler({
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

function FitBoundary({ geometry }: { geometry: GeoJsonGeometry | null }) {
  const map = useMap();
  const signature = geometry ? JSON.stringify(geometry) : '';
  useEffect(() => {
    if (!geometry) return;
    const layer = L.geoJSON(geometry as GeoJsonObject);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: true });
    }
    map.invalidateSize();
  }, [signature, map, geometry]);
  return null;
}

/** Leaflet needs invalidateSize after CSS size changes (e.g. fullscreen). */
function InvalidateOnLayout({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 50);
    return () => window.clearTimeout(id);
  }, [active, map]);
  return null;
}

type Props = {
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
  disabled?: boolean;
  className?: string;
  /** Administrative polygon from the backend geocoder. */
  boundaryGeometry?: GeoJsonGeometry | null;
  areaLabel?: string;
  boundaryLoading?: boolean;
  boundaryMissing?: boolean;
  selectionEnabled?: boolean;
  onOutsideArea?: (message: string) => void;
};

/**
 * Click (or drag marker) to set receiver lat/lng. Clicks outside the allowed
 * administrative polygon are rejected — the map never uses a radius circle as the rule.
 */
export function ShippingReceiverLocationMap({
  lat,
  lng,
  onChange,
  disabled = false,
  className,
  boundaryGeometry = null,
  areaLabel = '',
  boundaryLoading = false,
  boundaryMissing = false,
  selectionEnabled = true,
  onOutsideArea,
}: Props) {
  const latN = parseCoord(lat);
  const lngN = parseCoord(lng);
  const hasPin = latN != null && lngN != null;
  const [outsideMessage, setOutsideMessage] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const lastValidRef = useRef<{ lat: number; lng: number } | null>(
    hasPin ? { lat: latN, lng: lngN } : null,
  );

  useEffect(() => {
    if (hasPin) lastValidRef.current = { lat: latN, lng: lngN };
  }, [hasPin, latN, lngN]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  const center = useMemo<[number, number]>(
    () => (hasPin ? [latN, lngN] : DEFAULT_RECEIVER_MAP_CENTER),
    [hasPin, latN, lngN],
  );

  const clicksBlocked = disabled || !selectionEnabled || boundaryLoading || !boundaryGeometry;

  const rejectOutside = () => {
    const msg = areaLabel
      ? `This location is outside the selected delivery area.\n\nPlease select a location inside ${areaLabel}.`
      : 'This location is outside the selected delivery area.';
    setOutsideMessage(msg);
    onOutsideArea?.(msg);
  };

  const pick = (nextLat: number, nextLng: number) => {
    if (disabled || !selectionEnabled) return;
    if (!boundaryGeometry) return;
    if (!pointInGeoJson(boundaryGeometry, { lat: nextLat, lng: nextLng })) {
      rejectOutside();
      return;
    }
    setOutsideMessage(null);
    lastValidRef.current = { lat: nextLat, lng: nextLng };
    onChange({ lat: formatCoord(nextLat), lng: formatCoord(nextLng) });
  };

  const hint = disabled
    ? 'Read-only'
    : !selectionEnabled
      ? 'Select governorate, city/region, and town/neighborhood first'
      : boundaryLoading
        ? 'Loading the allowed delivery area…'
        : boundaryMissing
          ? 'Could not load the administrative boundary for this area'
          : hasPin
            ? 'Drag the pin or click inside the highlighted area'
            : 'Click inside the highlighted area to place the receiver pin';

  return (
    <div className={className}>
      {!fullscreen ? (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-medium text-text-muted">Receiver location on map</label>
          <span className="text-[11px] text-text-faint">{hint}</span>
        </div>
      ) : null}

      {/* Keep MapContainer mounted; only restyle for fullscreen. */}
      <div
        className={
          fullscreen
            ? 'fixed inset-0 z-[2000] flex flex-col bg-surface-card'
            : `relative overflow-hidden rounded-lg border border-border ${
                disabled ? 'pointer-events-none opacity-80' : ''
              }`
        }
      >
        {fullscreen ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-strong">Receiver location on map</div>
              <div className="truncate text-[11px] text-text-faint">{hint}</div>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-card px-2.5 py-1.5 text-xs font-semibold text-text-body hover:bg-surface-sunken"
              aria-label="Exit fullscreen map"
            >
              <i className="fa-solid fa-compress" aria-hidden="true" />
              Exit
              <kbd className="ms-1 rounded border border-border-subtle px-1 text-[10px] text-text-faint">
                Esc
              </kbd>
            </button>
          </div>
        ) : null}

        <div className={fullscreen ? 'relative min-h-0 flex-1' : 'relative'}>
          <MapContainer
            center={center}
            zoom={hasPin ? 14 : 8}
            scrollWheelZoom={!disabled}
            className={fullscreen ? 'h-full w-full z-0' : 'h-72 w-full z-0'}
            style={fullscreen ? { height: '100%', width: '100%' } : { minHeight: 288 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {boundaryGeometry ? (
              <GeoJsonLayer
                key={JSON.stringify(boundaryGeometry)}
                data={boundaryGeometry as GeoJsonObject}
                style={() => BOUNDARY_STYLE}
              />
            ) : null}
            <FitBoundary geometry={boundaryGeometry} />
            <InvalidateOnLayout active={fullscreen} />
            <MapClickHandler disabled={clicksBlocked} onPick={pick} />
            {hasPin ? (
              <Marker
                position={[latN, lngN]}
                draggable={!disabled && selectionEnabled && !!boundaryGeometry}
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target as L.Marker;
                    const pos = m.getLatLng();
                    if (
                      boundaryGeometry &&
                      !pointInGeoJson(boundaryGeometry, { lat: pos.lat, lng: pos.lng })
                    ) {
                      rejectOutside();
                      const prev = lastValidRef.current;
                      if (prev) m.setLatLng([prev.lat, prev.lng]);
                      return;
                    }
                    pick(pos.lat, pos.lng);
                  },
                }}
              />
            ) : null}
          </MapContainer>

          {!fullscreen ? (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="absolute end-2 top-2 z-[500] inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-surface-card/95 text-text-body shadow-sm backdrop-blur hover:bg-surface-sunken"
              aria-label="Open map fullscreen"
              title="Fullscreen"
            >
              <i className="fa-solid fa-expand" aria-hidden="true" />
            </button>
          ) : null}

          {boundaryLoading ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-card/60 text-xs font-medium text-text-body">
              Loading the allowed delivery area…
            </div>
          ) : null}
        </div>

        {fullscreen && outsideMessage ? (
          <div className="shrink-0 border-t border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg whitespace-pre-line">
            {outsideMessage}
          </div>
        ) : null}
      </div>

      {!fullscreen && outsideMessage ? (
        <p className="mt-2 whitespace-pre-line rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg">
          {outsideMessage}
        </p>
      ) : null}
    </div>
  );
}
