/** Strict quote reuse fingerprint — skip re-quote only when all fields match and not expired. */

export const DEFAULT_QUOTE_TTL_MS = 5 * 60 * 1000;

export type QuoteFingerprint = {
  providerCode: string;
  serviceId: string;
  currency: string;
  amount: number;
  deliveryType: string;
  packageType: string;
  weightKg: number;
  /** Neighbourhood id and/or address path */
  destinationKey: string;
  partsKey: string;
  quotedAt: string; // ISO
  expiresAt: string; // ISO
};

export function buildDestinationKey(input: {
  neighbourhoodId?: number | null;
  governorate?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  if (input.neighbourhoodId != null && Number.isFinite(Number(input.neighbourhoodId))) {
    return `hood:${Number(input.neighbourhoodId)}`;
  }
  const gov = (input.governorate ?? '').trim().toLowerCase();
  const city = (input.city ?? '').trim().toLowerCase();
  const hood = (input.neighborhood ?? '').trim().toLowerCase();
  if (gov || city || hood) return `addr:${gov}|${city}|${hood}`;
  if (
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  ) {
    return `geo:${Math.round(input.lat * 1e5) / 1e5},${Math.round(input.lng * 1e5) / 1e5}`;
  }
  return 'unknown';
}

export function buildPartsKey(parts?: Array<{ weight: number }> | null): string {
  if (!parts?.length) return '';
  return parts.map((p) => String(Math.max(0.1, Number(p.weight) || 0.1))).join(',');
}

export function createQuoteFingerprint(input: {
  providerCode: string;
  serviceId: string;
  currency: string;
  amount: number;
  deliveryType: string;
  packageType: string;
  weightKg: number;
  destinationKey: string;
  partsKey?: string;
  quotedAt?: Date;
  ttlMs?: number;
}): QuoteFingerprint {
  const quotedAt = input.quotedAt ?? new Date();
  const ttl = input.ttlMs ?? DEFAULT_QUOTE_TTL_MS;
  return {
    providerCode: input.providerCode.trim().toUpperCase(),
    serviceId: input.serviceId.trim(),
    currency: (input.currency || 'USD').toUpperCase(),
    amount: Number(input.amount),
    deliveryType: input.deliveryType,
    packageType: input.packageType,
    weightKg: Number(input.weightKg),
    destinationKey: input.destinationKey,
    partsKey: input.partsKey ?? '',
    quotedAt: quotedAt.toISOString(),
    expiresAt: new Date(quotedAt.getTime() + ttl).toISOString(),
  };
}

export function isQuoteFingerprintFresh(
  stored: QuoteFingerprint | null | undefined,
  expected: {
    providerCode: string;
    serviceId: string;
    currency: string;
    amount: number;
    deliveryType: string;
    packageType: string;
    weightKg: number;
    destinationKey: string;
    partsKey?: string;
  },
  now: Date = new Date(),
): boolean {
  if (!stored) return false;
  if (new Date(stored.expiresAt).getTime() <= now.getTime()) return false;

  const norm = (s: string) => s.trim().toUpperCase();
  if (norm(stored.providerCode) !== norm(expected.providerCode)) return false;
  if (stored.serviceId.trim() !== expected.serviceId.trim()) return false;
  if (norm(stored.currency) !== norm(expected.currency)) return false;
  if (!Number.isFinite(stored.amount) || Math.abs(stored.amount - Number(expected.amount)) > 1e-6) {
    return false;
  }
  if (stored.deliveryType !== expected.deliveryType) return false;
  if (stored.packageType !== expected.packageType) return false;
  if (Math.abs(Number(stored.weightKg) - Number(expected.weightKg)) > 1e-6) return false;
  if (stored.destinationKey !== expected.destinationKey) return false;
  if ((stored.partsKey || '') !== (expected.partsKey || '')) return false;
  return true;
}
