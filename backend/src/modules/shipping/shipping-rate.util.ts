export type ShippingRateQuote = {
  carrierId: string;
  carrierName: string;
  serviceId: string;
  serviceName: string;
  available: boolean;
  price: number;
  currency: string;
  /** When the provider returns multiple currencies; UI shows USD then SYP. */
  prices?: Array<{ price: number; currency: string }>;
  estimatedDeliveryMin?: number;
  estimatedDeliveryMax?: number;
  deliveryType?: string;
  restrictions?: string[];
  isCheapest?: boolean;
  isFastest?: boolean;
  isRecommended?: boolean;
  /** Human-readable provider platform name for badge display (e.g. "Sila-SY.com", "Babel Express"). */
  providerName?: string;
  /** Carrier logo URL from provider response. Only set when API returns it. Never invent. */
  logoUrl?: string;
};


export type ShippingRateError = {
  carrierId: string;
  carrierName: string;
  message: string;
};

import { normalizePriceForComparison } from './bulk-shipping.eligibility';

/** Badge cheapest / fastest / recommended from normalized quotes. Does not invent ETAs. */
export function annotateRateQuotes(quotes: ShippingRateQuote[]): ShippingRateQuote[] {
  const priced = quotes.filter((q) => q.available && Number.isFinite(q.price));
  const minNormPrice = priced.length
    ? Math.min(...priced.map((q) => normalizePriceForComparison(q.price, q.currency)))
    : null;
  const withEta = quotes.filter(
    (q) =>
      q.available &&
      q.estimatedDeliveryMax != null &&
      Number.isFinite(q.estimatedDeliveryMax),
  );
  const minEta = withEta.length
    ? Math.min(...withEta.map((q) => q.estimatedDeliveryMax as number))
    : null;

  const annotated = quotes.map((q) => {
    const norm = normalizePriceForComparison(q.price, q.currency);
    const isCheapest = minNormPrice != null && q.available && Math.abs(norm - minNormPrice) < 1e-6;
    const isFastest =
      minEta != null && q.available && q.estimatedDeliveryMax === minEta;
    return {
      ...q,
      isCheapest,
      isFastest,
      isRecommended: isCheapest,
    };
  });

  return [...annotated].sort((a, b) => {
    const pA = Number.isFinite(a.price) ? normalizePriceForComparison(a.price, a.currency) : 999999;
    const pB = Number.isFinite(b.price) ? normalizePriceForComparison(b.price, b.currency) : 999999;
    return pA - pB;
  });
}
