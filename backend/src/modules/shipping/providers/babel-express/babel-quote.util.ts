/**
 * Babel calculatePrice shippability (NOT a blanket "price === 0 ⇒ unavailable").
 *
 * Live evidence (staging, 2026-08-21):
 * - Unshippable neighbourhood (برج الساما / id 2220):
 *   address → { price:0, details:{ pickup:0, dropoff:null, shipping:0 } } then createShipment rejects
 *   hub     → { price:0, details:{ pickup:0, dropoff:0, shipping:0 } } then createShipment rejects
 * - Shippable (المالكي / id 12):
 *   address → price 25000, shipping 10000, dropoff 15000
 *   hub     → price 10000, shipping 10000
 *
 * Rule: treat as unshippable only when Babel's response *shape* indicates no service:
 * 1) address delivery with dropoff === null/undefined, OR
 * 2) details present with shipping === 0 AND price === 0 (zeroed fee breakdown that
 *    Babel still returns as status:success but rejects on createShipment).
 *
 * Do NOT reject solely because price === 0 if shipping > 0 (possible legitimate free/promo).
 * If details are missing, fall back to requiring a finite price (adapter already throws otherwise).
 */
export function isBabelAddressDeliveryAvailable(details: unknown): boolean {
  if (!details || typeof details !== 'object') return true;
  const record = details as Record<string, unknown>;
  const dropoff = record.dropoff ?? record.dropOff;
  return dropoff !== null && dropoff !== undefined;
}

function readFee(details: unknown, key: string): number | null {
  if (!details || typeof details !== 'object') return null;
  const raw = (details as Record<string, unknown>)[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type BabelCalculatePriceRaw = {
  status?: string;
  price?: number | string;
  currency?: string;
  details?: unknown;
};

/**
 * Returns true when calculatePrice indicates Babel can actually ship this option.
 */
export function isBabelCalculatePriceShippable(
  raw: BabelCalculatePriceRaw | null | undefined,
  deliveryType: 'address' | 'hub',
): boolean {
  if (!raw || raw.status === 'error') return false;

  const price =
    typeof raw.price === 'number' ? raw.price : Number(raw.price);
  if (!Number.isFinite(price)) return false;

  if (deliveryType === 'address' && !isBabelAddressDeliveryAvailable(raw.details)) {
    return false;
  }

  const shipping = readFee(raw.details, 'shipping');
  // Zeroed fee breakdown + zero price = no shippable service (see file header evidence).
  // Legitimate free shipping would need a different shape (e.g. price 0 with shipping > 0,
  // or missing zeroed breakdown); we do not invent that case.
  if (shipping === 0 && price === 0) {
    return false;
  }

  return true;
}
