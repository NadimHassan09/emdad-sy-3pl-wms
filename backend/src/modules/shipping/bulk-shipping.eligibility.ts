import { CarrierShipmentStatus, OutboundOrderStatus } from '@prisma/client';

import { MANUAL_SHIPPING_CODE } from './shipping.constants';

/** Order shape used for bulk shipping eligibility checks (pure / unit-testable). */
export type BulkShippingEligibilityInput = {
  status: string;
  trackingNumber?: string | null;
  carrierShipments?: Array<{ status: string }>;
};

/**
 * Eligible for Bulk Shipping Processing:
 * - status = ready_to_ship (Waiting for Dispatch)
 * - no successful external carrier shipment yet
 *
 * Does NOT include picking/packing/waiting_for_shipping_details/shipped.
 */
export function isEligibleForBulkShipping(order: BulkShippingEligibilityInput): boolean {
  if (order.status !== OutboundOrderStatus.ready_to_ship && order.status !== 'ready_to_ship') {
    return false;
  }
  if (order.trackingNumber?.trim()) {
    return false;
  }
  const hasCreated = (order.carrierShipments ?? []).some(
    (s) => s.status === CarrierShipmentStatus.created || s.status === 'created',
  );
  return !hasCreated;
}

export type ProviderQuoteCandidate = {
  providerCode: string;
  price: number;
  currency: string;
};

export const DEFAULT_USD_TO_SYP_RATE = 14500;

export function getUsdToSypRate(): number {
  const envVal = process.env.USD_TO_SYP_RATE;
  if (envVal) {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_USD_TO_SYP_RATE;
}

export function normalizePriceForComparison(price: number, currency?: string): number {
  if (!Number.isFinite(price)) return Infinity;
  const curr = (currency ?? 'USD').toUpperCase().trim();
  const rate = getUsdToSypRate();
  if (curr === 'SYP') {
    return price / rate;
  }
  return price;
}

/**
 * Recommend cheapest provider among valid quotes only.
 * Normalizes currencies (e.g. USD vs SYP) so 200 SYP is not treated as more expensive than 2 USD.
 * Returns null when no reliable quote is available (do not invent prices).
 */
export function recommendCheapestProvider(
  quotes: ProviderQuoteCandidate[],
): ProviderQuoteCandidate | null {
  const valid = quotes.filter(
    (q) =>
      q.providerCode &&
      q.providerCode !== MANUAL_SHIPPING_CODE &&
      Number.isFinite(q.price) &&
      q.price >= 0,
  );
  if (valid.length === 0) return null;
  return valid.reduce((best, cur) => {
    const bestNorm = normalizePriceForComparison(best.price, best.currency);
    const curNorm = normalizePriceForComparison(cur.price, cur.currency);
    return curNorm < bestNorm ? cur : best;
  });
}

export function resolveBulkProviderSelection(params: {
  recommendedCode: string | null;
  currentMethod: string | null | undefined;
  currentProviderCode: string | null | undefined;
  overrideCode?: string | null;
}): string {
  if (params.overrideCode?.trim()) {
    return params.overrideCode.trim().toUpperCase();
  }
  if (params.recommendedCode?.trim()) {
    return params.recommendedCode.trim().toUpperCase();
  }
  if (params.currentMethod === 'carrier' && params.currentProviderCode?.trim()) {
    return params.currentProviderCode.trim().toUpperCase();
  }
  return MANUAL_SHIPPING_CODE;
}
