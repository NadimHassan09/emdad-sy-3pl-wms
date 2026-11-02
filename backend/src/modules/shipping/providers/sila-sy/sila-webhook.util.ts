import * as crypto from 'crypto';

import type { NormalizedTrackingEvent } from '../../shipping-provider.interface';
import { SILA_SY_CODE } from '../../shipping.constants';

const SOURCE_NOTES = new Set(['courier', 'system', 'admin']);

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  return typeof raw === 'string' ? raw.trim() : '';
}

export function verifySilaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret?.trim() || !signatureHeader?.trim()) return false;
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = crypto.createHmac('sha256', secret.trim()).update(body).digest('hex');
  try {
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isSilaWebhookTest(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): boolean {
  const eventName = silaWebhookEventName(headers, body);
  return eventName === 'webhook.test' || eventName === 'test';
}

export function silaWebhookEventName(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): string {
  const fromHeader = headerValue(headers, 'x-sila-event') || headerValue(headers, 'X-Sila-Event');
  if (fromHeader) return fromHeader.toLowerCase();
  const record = asRecord(body);
  const nested = asRecord(record?.data);
  const name =
    (typeof record?.event === 'string' && record.event) ||
    (typeof record?.type === 'string' && record.type) ||
    (typeof nested?.event === 'string' && nested.event) ||
    '';
  return name.trim().toLowerCase();
}

export function parseSilaWebhookBody(body: unknown): Record<string, unknown> {
  const record = asRecord(body) ?? {};
  const data = asRecord(record.data);
  return { ...record, ...(data ?? {}) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function silaStatusEventId(silaId: string, newStatus: string, occurredAt: string): string {
  return `sila:${silaId}:${newStatus}:${occurredAt}`;
}

export function buildSilaNormalizedEvent(params: {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  mapStatus: (raw: string) => {
    normalized: NormalizedTrackingEvent['normalizedStatus'];
    carrierReturnStage?: NormalizedTrackingEvent['carrierReturnStage'];
  };
}): NormalizedTrackingEvent | null {
  const eventName = silaWebhookEventName(params.headers, params.body);
  if (!eventName || eventName === 'webhook.test' || eventName === 'test') return null;

  const payload = parseSilaWebhookBody(params.body);
  const silaId = text(payload.id) || text(payload.cargo_id) || text(payload.tracking_token);
  const barcode = text(payload.barcode);
  const courierBarcode = text(payload.courier_barcode);
  const reference = text(payload.reference);
  const newStatus =
    text(payload.new_status) ||
    text(payload.status) ||
    statusFromEventName(eventName);
  const occurredAt =
    text(payload.occurred_at) ||
    text(payload.updated_at) ||
    new Date().toISOString();
  const awb = silaId || barcode || courierBarcode;
  if (!awb && !reference && !newStatus) return null;

  const mapped = params.mapStatus(newStatus);
  const notes = realNote(payload.note) || text(payload.remote_failure_notes) || undefined;
  const returnReason = mapped.carrierReturnStage
    ? text(payload.return_reason) || text(payload.rejection_reason) || notes
    : undefined;
  const deliveryId =
    headerValue(params.headers, 'x-sila-delivery') ||
    headerValue(params.headers, 'X-Sila-Delivery');

  return {
    providerCode: SILA_SY_CODE,
    externalEventId: silaStatusEventId(silaId || awb || reference, newStatus || eventName, occurredAt),
    deliveryId: deliveryId || undefined,
    reference: reference || undefined,
    awb: awb || reference,
    eventType: eventName,
    normalizedStatus:
      eventName === 'cargo.courier_barcode_assigned' ? 'unknown' : mapped.normalized,
    timestamp: new Date(occurredAt),
    notes,
    returnReason: returnReason || undefined,
    originalCarrierStatus: newStatus || eventName,
    eventDescription: (mapped as any).labelAr || newStatus || eventName,
    sourceType: 'webhook',
    isCarrierEvent: true,
    carrierReturnStage: mapped.carrierReturnStage,
    rawPayload: {
      ...payload,
      silaEvent: eventName,
      silaDeliveryId: deliveryId || null,
    },
  };
}

function statusFromEventName(eventName: string): string {
  switch (eventName) {
    case 'cargo.delivered':
      return 'delivered';
    case 'cargo.returned':
      return 'returned';
    case 'cargo.cancelled':
      return 'cancelled';
    case 'cargo.created':
      return 'created';
    case 'cargo.courier_barcode_assigned':
      return '';
    default:
      return '';
  }
}

function realNote(value: unknown): string | undefined {
  const note = text(value);
  if (!note || SOURCE_NOTES.has(note.toLowerCase())) return undefined;
  return note;
}
