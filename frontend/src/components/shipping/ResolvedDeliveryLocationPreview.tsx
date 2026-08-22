import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import { DEFAULT_RECEIVER_MAP_CENTER } from './ShippingReceiverLocationMap';

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

type ResolveSource = 'neighborhood' | 'city' | 'governorate';

type Props = {
  lat: number | null;
  lng: number | null;
  loading?: boolean;
  error?: string | null;
  resolveSource?: ResolveSource | null;
  resolvedLabel?: string;
  className?: string;
};

function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

function resolveHint(source: ResolveSource | null | undefined, label: string): string {
  if (!source || !label) {
    return 'Location automatically resolved from the shipping address';
  }
  if (source === 'neighborhood') {
    return `Pin placed at ${label} (town/neighborhood)`;
  }
  if (source === 'city') {
    return `Town not indexed — pin placed at ${label} (city/region)`;
  }
  return `Pin placed at ${label} (governorate)`;
}

/** Read-only map preview — pin is derived from internal address hierarchy, not user input. */
export function ResolvedDeliveryLocationPreview({
  lat,
  lng,
  loading = false,
  error = null,
  resolveSource = null,
  resolvedLabel = '',
  className,
}: Props) {
  const hasPoint = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const center = useMemo<[number, number]>(
    () => (hasPoint ? [lat!, lng!] : DEFAULT_RECEIVER_MAP_CENTER),
    [hasPoint, lat, lng],
  );
  const zoom = hasPoint ? (resolveSource === 'governorate' ? 10 : resolveSource === 'city' ? 12 : 14) : 8;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border border-border">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          dragging={!loading}
          doubleClickZoom={false}
          className="h-56 w-full z-0"
          style={{ minHeight: 224 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasPoint ? (
            <>
              <MapRecenter lat={lat!} lng={lng!} zoom={zoom} />
              <Marker position={[lat!, lng!]} />
            </>
          ) : null}
        </MapContainer>
        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-card/70 text-xs font-medium text-text-body">
            Resolving delivery location…
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg">
          {error}
        </p>
      ) : hasPoint ? (
        <p className="mt-2 text-xs text-status-success-fg">
          ✓ {resolveHint(resolveSource, resolvedLabel)}
        </p>
      ) : !loading ? (
        <p className="mt-2 text-xs text-text-muted">
          Enter Governorate and City/Region to place the delivery pin automatically.
        </p>
      ) : null}
    </div>
  );
}
