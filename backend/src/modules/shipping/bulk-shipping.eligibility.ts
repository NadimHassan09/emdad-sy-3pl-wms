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

/**
 * Recommend cheapest provider among valid quotes only.
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
  return valid.reduce((best, cur) => (cur.price < best.price ? cur : best));
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
