import * as crypto from 'crypto';
import type {
  NormalizedTrackingEvent,
  NormalizedTrackingStatus,
} from '../../shipping-provider.interface';
import { FATIH_CARGO_CODE } from './fatih-cargo.constants';
import { mapFatihStatusToNormalized } from './fatih-cargo.mapper';
import type { FatihWebhookPayload } from './fatih-cargo.types';

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v[0];
      return v;
    }
  }
  return undefined;
}

export function isFatihWebhookTest(body: unknown): boolean {
  const type = (body as FatihWebhookPayload | undefined)?.type;
  return type === 'webhook.test';
}

/**
 * Standard Webhooks: HMAC-SHA256 of `{id}.{timestamp}.{rawBody}` with key =
 * base64decode(secret after `whsec_`), signature header `v1,<base64>`.
 */
export function verifyFatihSignature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string | Buffer,
  secret?: string,
): boolean {
  if (!secret?.trim()) return false;
  const id = headerValue(headers, 'webhook-id')?.trim();
  const timestamp = headerValue(headers, 'webhook-timestamp')?.trim();
  const signatureHeader = headerValue(headers, 'webhook-signature')?.trim();
  if (!id || !timestamp || !signatureHeader) return false;

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(Number(timestamp)) || ageSec > 5 * 60) return false;

  const rawSecret = secret.trim();
  const key = rawSecret.startsWith('whsec_')
    ? Buffer.from(rawSecret.slice('whsec_'.length), 'base64')
    : Buffer.from(rawSecret, 'utf8');

  const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const signed = `${id}.${timestamp}.${rawString}`;
  const digest = crypto.createHmac('sha256', key).update(signed).digest('base64');
  const expected = `v1,${digest}`;

  const candidates = signatureHeader.split(' ').flatMap((part) => part.split(',').map((s) => s.trim()));
  const withPrefix = candidates.map((c) => (c.startsWith('v1,') ? c : c.includes(',') ? c : `v1,${c}`));

  for (const got of [signatureHeader, ...withPrefix, ...candidates.map((c) => (c.startsWith('v1,') ? c : `v1,${c}`))]) {
    if (got.length === expected.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(got, 'utf8'), Buffer.from(expected, 'utf8'))) {
          return true;
        }
      } catch {
        // continue
      }
    }
  }
  return false;
}

export function buildFatihNormalizedEvent(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): NormalizedTrackingEvent | null {
  if (isFatihWebhookTest(body)) return null;

  const payload = (body && typeof body === 'object' ? body : {}) as FatihWebhookPayload;
  if (payload.type && payload.type !== 'shipment.status_changed') return null;

  const shipment = payload.data?.shipment;
  const tracking = (shipment?.tracking_number || '').trim();
  const id = shipment?.id != null ? String(shipment.id) : '';
  const awb = tracking || id;
  if (!awb) return null;

  const status = (shipment?.status || '').trim();
  const normalizedStatus: NormalizedTrackingStatus = mapFatihStatusToNormalized(status);
  const ts = shipment?.status_changed_at || payload.created_at;

  return {
    providerCode: FATIH_CARGO_CODE,
    externalEventId: payload.id || headerValue(headers, 'webhook-id'),
    awb,
    eventType: payload.type || 'shipment.status_changed',
    normalizedStatus,
    timestamp: ts ? new Date(ts) : undefined,
    notes: shipment?.status_label || undefined,
    originalCarrierStatus: status || undefined,
    eventDescription: shipment?.status_label || undefined,
    reference: shipment?.reference || undefined,
    costSource: 'webhook',
    sourceType: 'webhook',
    isCarrierEvent: true,
    rawPayload: body,
  };
}
