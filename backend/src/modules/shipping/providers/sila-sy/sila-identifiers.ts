/**
 * Sila is an intermediary. A cargo carries several identifiers that must not be swapped:
 *
 * - `id` — Sila cargo UUID. Used for GET /cargos/{id}.
 * - `tracking_token` (legacy `barcode`) — Sila public token. Webhooks and tracking pages use it.
 * - `shipments[0].tracking_number` — Sila's own waybill, shaped like `SL-XXXX`.
 * - `courier.tracking_number` / `courier_barcode` / `shipments[0].remote_barcode` — number
 *   shown in the final carrier's customer portal (e.g. Fatih numeric `5009241`).
 * - `shipments[0].remote_label_code` — Sila-side remote label (`AWB…` for Fatih). Not the
 *   portal tracking number; only a fallback when the portal barcode is missing.
 *   Confirmed on live Tarabut cargos: barcode fields all match. Confirmed wrong for Fatih
 *   when OMS stored `AWB2026…` while the Fatih portal showed the numeric tracking.
 */

const SILA_WAYBILL = /^SL-[A-Z0-9]+(?:-[A-Z0-9]+)?$/i;
const SILA_TOKEN = /^[0-9a-f]{32}$/i;
const SILA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function silaShipmentRow(cargo: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const rows = cargo?.shipments;
  const row = Array.isArray(rows) ? rows[0] : null;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
}

/** True when the value is a Sila platform id, token, or SL- waybill — not a carrier AWB. */
export function isSilaPlatformIdentifier(
  value: string,
  cargo?: Record<string, unknown> | null,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (SILA_WAYBILL.test(trimmed) || SILA_TOKEN.test(trimmed) || SILA_UUID.test(trimmed)) return true;
  if (!cargo) return false;
  const shipment = silaShipmentRow(cargo);
  const own = [
    cargo.id,
    cargo.tracking_token,
    cargo.barcode,
    cargo.label_token,
    cargo.code,
    shipment?.id,
    shipment?.tracking_number,
  ];
  return own.some((item) => text(item) === trimmed);
}

function nestedTrackingNumber(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return text(record.tracking_number) || text(record.trackingNumber) || text(record.barcode);
}

/**
 * Final-carrier AWB from a Sila cargo payload.
 * Prefers the number shown in the carrier portal, then remote_label_code. Never a Sila id.
 */
export function extractSilaCarrierAwb(cargo: Record<string, unknown> | null | undefined): string {
  if (!cargo) return '';
  const shipment = silaShipmentRow(cargo);
  const candidates = [
    nestedTrackingNumber(cargo.courier),
    cargo.courier_barcode,
    shipment?.remote_barcode,
    nestedTrackingNumber(shipment?.courier),
    shipment?.remote_label_code,
  ];
  for (const candidate of candidates) {
    const value = text(candidate);
    if (value && !isSilaPlatformIdentifier(value, cargo)) return value;
  }
  return '';
}

/** Sila cargo id used for API calls. Not the carrier AWB. */
export function extractSilaProviderId(cargo: Record<string, unknown> | null | undefined): string {
  if (!cargo) return '';
  return text(cargo.id) || text(cargo.tracking_token) || text(cargo.barcode);
}

/**
 * Prefer Sila cargo id, then Sila barcode/token, for GET /cargos/{id}.
 * Never returns the courier AWB — that route 404s on courier barcodes.
 */
export function extractSilaApiLookupKeys(
  cargo: Record<string, unknown> | null | undefined,
  fallbackAwb?: string,
): string[] {
  const keys: string[] = [];
  const push = (value: string) => {
    const next = text(value);
    if (next && !keys.includes(next) && isSilaPlatformIdentifier(next, cargo)) {
      keys.push(next);
    }
  };
  if (cargo) {
    push(text(cargo.id));
    push(text(cargo.tracking_token));
    push(text(cargo.barcode));
  }
  if (fallbackAwb && isSilaPlatformIdentifier(fallbackAwb, cargo)) {
    const next = text(fallbackAwb);
    if (next && !keys.includes(next)) keys.push(next);
  }
  return keys;
}

/** Courier UUID from a stored Sila serviceId token (`SILA_SY:{courierId}:{areaId}`). */
export function courierIdFromServiceId(serviceId?: string | null): string {
  const raw = (serviceId || '').trim();
  if (!raw) return '';
  const parts = raw.split(':');
  if (parts[0]?.toUpperCase() === 'SILA_SY' && parts[1]?.trim()) return parts[1].trim();
  return '';
}

/** Values a webhook or poll may send that should still resolve this cargo. */
export function silaMatchKeys(cargo: Record<string, unknown> | null | undefined): string[] {
  if (!cargo) return [];
  const shipment = silaShipmentRow(cargo);
  const keys = [
    cargo.id,
    cargo.tracking_token,
    cargo.barcode,
    shipment?.id,
    shipment?.tracking_number,
    nestedTrackingNumber(cargo.courier),
    cargo.courier_barcode,
    shipment?.remote_barcode,
    shipment?.remote_label_code,
    extractSilaCarrierAwb(cargo),
  ];
  return [...new Set(keys.map((item) => text(item)).filter(Boolean))];
}

function nestedId(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return text(record.id) || text(record.courier_id) || text(record.uuid);
}

function nestedName(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return text(record.name) || text(record.name_ar) || text(record.name_en);
}

/** Confirmed courier on a live Sila cargo. Empty when the payload has no courier identity. */
export function extractSilaCourier(cargo: Record<string, unknown> | null | undefined): {
  courierId: string;
  courierName: string;
} {
  if (!cargo) return { courierId: '', courierName: '' };
  const shipment = silaShipmentRow(cargo);
  const courierId =
    text(cargo.courier_id) ||
    nestedId(cargo.courier) ||
    text(shipment?.courier_id) ||
    nestedId(shipment?.courier) ||
    text(cargo.assigned_courier_id);
  const courierName =
    nestedName(cargo.courier) ||
    text(cargo.courier_name) ||
    nestedName(shipment?.courier) ||
    text(shipment?.courier_name) ||
    text(shipment?.remote_courier_name);
  return { courierId, courierName };
}
