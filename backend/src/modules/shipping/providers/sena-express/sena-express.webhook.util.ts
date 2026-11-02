import * as crypto from 'crypto';
import type {
  NormalizedTrackingEvent,
  NormalizedTrackingStatus,
} from '../../shipping-provider.interface';
import { SENA_EXPRESS_CODE } from '../../shipping.constants';
import { mapSenaStatusToNormalized } from './sena-express.mapper';
import type { SenaWebhookPayload } from './sena-express.types';

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

export function isSenaWebhookTest(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): boolean {
  const eventFromHeader = headerValue(headers, 'x-sena-event');
  const eventFromBody = (body as SenaWebhookPayload | undefined)?.event;
  return eventFromHeader === 'webhook.test' || eventFromBody === 'webhook.test';
}

export function verifySenaSignature(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string | Buffer,
  secret?: string,
): boolean {
  if (!secret?.trim()) return false;
  const receivedSig = headerValue(headers, 'x-sena-signature')?.trim();
  if (!receivedSig) return false;

  const rawString = typeof rawBody === 'string' ? rawBody : rawBody ? rawBody.toString('utf8') : '';
  const timestamp = headerValue(headers, 'x-sena-timestamp')?.trim();

  // SENA signs using `${timestamp}.${rawBody}` HMAC-SHA256. Also support rawBody as fallback.
  const candidates: string[] = [];
  if (timestamp) {
    candidates.push(
      crypto
        .createHmac('sha256', secret.trim())
        .update(`${timestamp}.${rawString}`)
        .digest('hex'),
    );
  }
  candidates.push(
    crypto
      .createHmac('sha256', secret.trim())
      .update(rawString)
      .digest('hex'),
  );

  const normalizedReceived = receivedSig.startsWith('sha256=')
    ? receivedSig
    : `sha256=${receivedSig}`;

  for (const hmac of candidates) {
    const expectedWithPrefix = `sha256=${hmac}`;
    if (expectedWithPrefix.length === normalizedReceived.length) {
      try {
        if (
          crypto.timingSafeEqual(
            Buffer.from(expectedWithPrefix, 'utf8'),
            Buffer.from(normalizedReceived, 'utf8'),
          )
        ) {
          return true;
        }
      } catch {
        // continue
      }
    }
  }

  return false;
}

export function buildSenaNormalizedEvent(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): NormalizedTrackingEvent | null {
  if (isSenaWebhookTest(headers, body)) {
    return null;
  }

  const payload = (body && typeof body === 'object' ? body : {}) as SenaWebhookPayload;
  const shipment = payload.shipment;

  const awb = String(
    payload.shipment_number ||
      shipment?.shipment_number ||
      shipment?.id ||
      '',
  ).trim();

  if (!awb) {
    return null;
  }

  const eventName =
    payload.event?.trim() ||
    headerValue(headers, 'x-sena-event')?.trim() ||
    'shipment.status.updated';

  const rawStatus = payload.status || shipment?.status || undefined;
  const notes = payload.public_status || shipment?.public_status || undefined;

  let normalizedStatus: NormalizedTrackingStatus;
  switch (eventName) {
    case 'shipment.out_for_delivery':
      normalizedStatus = 'out_for_delivery';
      break;
    case 'shipment.delivered':
      normalizedStatus = 'delivered';
      break;
    case 'shipment.delivery_failed':
      normalizedStatus = 'delivery_failed';
      break;
    case 'shipment.in_return':
      normalizedStatus = 'returning_to_sender';
      break;
    case 'shipment.returned_to_sender':
      normalizedStatus = 'returned_to_sender';
      break;
    case 'shipment.cancelled':
      normalizedStatus = 'cancelled';
      break;
    case 'shipment.created':
      normalizedStatus = 'in_transit';
      break;
    case 'shipment.status.updated':
    default:
      normalizedStatus = mapSenaStatusToNormalized(rawStatus);
      break;
  }

  let carrierReturnStage: 'return_created' | 'returning_to_sender' | 'returned_to_sender' | undefined;
  if (eventName === 'shipment.returned_to_sender' || rawStatus === 'returned_to_sender') {
    carrierReturnStage = 'returned_to_sender';
  } else if (eventName === 'shipment.in_return' || rawStatus === 'in_return') {
    carrierReturnStage = 'returning_to_sender';
  }

  const deliveryId = headerValue(headers, 'x-sena-delivery')?.trim() || undefined;
  const occurredAt = payload.occurred_at ? new Date(payload.occurred_at) : new Date();
  const timestamp = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
  const reference = (payload.reference || shipment?.reference || shipment?.merchant_reference)?.trim() || undefined;

  const externalEventId =
    deliveryId ||
    (payload.occurred_at ? `${awb}:${eventName}:${payload.occurred_at}` : undefined);

  const eventDesc = payload.public_status || shipment?.public_status || rawStatus || eventName;

  return {
    providerCode: SENA_EXPRESS_CODE,
    externalEventId,
    deliveryId,
    awb,
    eventType: eventName,
    normalizedStatus,
    timestamp,
    notes,
    originalCarrierStatus: rawStatus || eventName,
    eventDescription: eventDesc,
    sourceType: 'webhook',
    isCarrierEvent: true,
    carrierReturnStage,
    reference,
    rawPayload: body,
  };
}
