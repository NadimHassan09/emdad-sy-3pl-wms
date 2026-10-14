export type ShippingPayerValue = 'sender' | 'receiver' | 'reseller';

export type AvailabilityDecision = {
  available: boolean;
  reason?: string;
};

/**
 * Payer eligibility is the provider's decision. This does not hide a service
 * the quote returned. Sila's missing reseller enum is enforced only inside
 * the Sila adapter when the create body is built.
 */
export function payerAvailability(
  _providerCode: string,
  _payer: string | null | undefined,
  _codAmount: number,
): AvailabilityDecision {
  return { available: true };
}

/**
 * Quote currency and COD currency are independent. A local whitelist must not
 * hide a service the provider quote returned.
 */
export function collectionCurrencyAvailability(_input?: {
  providerCode?: string;
  serviceName?: string | null;
  serviceId?: string | null;
  deliveryType?: string | null;
  collectionCurrency?: string | null;
  orderCurrency?: string | null;
  mode?: 'all' | 'explicit';
  codAmount?: number;
  usdToSypRate?: number | null;
}): AvailabilityDecision {
  return { available: true };
}

export function combineAvailability(
  ...decisions: AvailabilityDecision[]
): AvailabilityDecision {
  const blocked = decisions.find((decision) => !decision.available);
  return blocked ?? { available: true };
}
