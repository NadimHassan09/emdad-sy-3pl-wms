import type { Logger } from '@nestjs/common';

/**
 * Fields taken only from the object about to be posted. A database coordinate
 * that is absent from this object is reported as null.
 */
export type SanitizedProviderRequest = {
  providerCode: string;
  latitude: number | null;
  longitude: number | null;
  areaId: string | number | null;
  city: string | null;
  deliveryType: string | null;
  payer: string | null;
  codAmount: number | null;
  codCurrency: string | null;
  serviceId: string | null;
  quoteCurrency: string | null;
};

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function neighbourhoodProof(neighbourhood: unknown): {
  latitude: number | null;
  longitude: number | null;
  areaId: string | number | null;
} {
  if (!neighbourhood || typeof neighbourhood !== 'object') {
    return { latitude: null, longitude: null, areaId: null };
  }
  const row = neighbourhood as { id?: unknown; coordinates?: { lat?: unknown; lng?: unknown } };
  if (row.id != null && (typeof row.id === 'number' || typeof row.id === 'string')) {
    return { latitude: null, longitude: null, areaId: row.id };
  }
  return {
    latitude: num(row.coordinates?.lat),
    longitude: num(row.coordinates?.lng),
    areaId: null,
  };
}

export function sanitizeBabelCreatePayload(
  payload: { shipment?: Record<string, unknown> },
  quoteCurrency?: string | null,
): SanitizedProviderRequest {
  const shipment = payload.shipment ?? {};
  const receiver = (shipment.receiver ?? {}) as { neighbourhood?: unknown; address?: unknown };
  const cod = (shipment.cod ?? {}) as { amount?: unknown; currency?: unknown };
  const proof = neighbourhoodProof(receiver.neighbourhood);
  return {
    providerCode: 'BABEL_EXPRESS',
    latitude: proof.latitude,
    longitude: proof.longitude,
    areaId: proof.areaId,
    city: typeof receiver.address === 'string' ? receiver.address : null,
    deliveryType: typeof shipment.deliveryType === 'string' ? shipment.deliveryType : null,
    payer: typeof shipment.payer === 'string' ? shipment.payer : null,
    codAmount: num(cod.amount),
    codCurrency: typeof cod.currency === 'string' ? cod.currency : null,
    serviceId: null,
    quoteCurrency: quoteCurrency ?? null,
  };
}

export function sanitizeSilaCargoBody(
  body: Record<string, unknown>,
  meta?: { serviceId?: string | null; quoteCurrency?: string | null },
): SanitizedProviderRequest {
  const recipient = (body.recipient ?? {}) as Record<string, unknown>;
  const pod = (body.pay_on_delivery ?? {}) as Record<string, unknown>;
  const area = recipient.area_id;
  return {
    providerCode: 'SILA_SY',
    latitude: num(recipient.latitude ?? recipient.lat),
    longitude: num(recipient.longitude ?? recipient.lng),
    areaId: typeof area === 'string' || typeof area === 'number' ? area : null,
    city: typeof recipient.district === 'string' ? recipient.district : null,
    deliveryType: typeof body.service_type === 'string' ? body.service_type : null,
    payer: typeof body.shipping_paid_by === 'string' ? body.shipping_paid_by : null,
    codAmount: num(pod.amount),
    codCurrency: typeof pod.currency === 'string' ? pod.currency : null,
    serviceId: meta?.serviceId ?? (typeof body.courier_id === 'string' ? body.courier_id : null),
    quoteCurrency: meta?.quoteCurrency ?? null,
  };
}

export function logSanitizedProviderRequest(logger: Logger, payload: SanitizedProviderRequest): void {
  logger.log(JSON.stringify({ msg: 'provider_request_sanitized', ...payload }));
}
