import {
  comparableValueUsd,
  effectiveComparableCost,
  getFxRateSnapshot,
  type FxRateSnapshot,
} from './currency-conversion';

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
  /** Payable amount used for recommendation (may differ from display if prices[]). */
  effectiveCostAmount?: number;
  effectiveCostCurrency?: string;
  /** Normalized USD comparable value at annotation time. */
  comparableValueUsd?: number;
  fxRate?: number;
  fxSource?: string;
  fxTimestamp?: string;
};

export type ShippingRateError = {
  carrierId: string;
  carrierName: string;
  message: string;
  /** Optional courier/service label when platform is an aggregator (e.g. Masarat under Sila). */
  serviceName?: string;
};

export type AnnotateRateQuotesOptions = {
  snapshot?: FxRateSnapshot;
  /** Preferred currency when quotes expose multiple prices[]. */
  preferredCurrency?: string | null;
};

/** Badge cheapest / fastest / recommended from effectiveComparableCost + FX. Never raw cross-currency. */
export function annotateRateQuotes(
  quotes: ShippingRateQuote[],
  options: AnnotateRateQuotesOptions = {},
): ShippingRateQuote[] {
  const snapshot = options.snapshot ?? getFxRateSnapshot();
  const preferred = options.preferredCurrency ?? null;

  const enriched = quotes.map((q) => {
    const cost = effectiveComparableCost({
      price: q.price,
      currency: q.currency,
      prices: q.prices,
      preferredCurrency: preferred,
    });
    const comparable = comparableValueUsd(
      {
        price: q.price,
        currency: q.currency,
        prices: q.prices,
        preferredCurrency: preferred,
      },
      snapshot,
    );
    return {
      ...q,
      effectiveCostAmount: cost.amount,
      effectiveCostCurrency: cost.currency,
      comparableValueUsd: comparable,
      fxRate: snapshot.usdToSypRate,
      fxSource: snapshot.source,
      fxTimestamp: snapshot.timestamp,
    };
  });

  const priced = enriched.filter((q) => q.available && Number.isFinite(q.comparableValueUsd));
  const minNormPrice = priced.length
    ? Math.min(...priced.map((q) => q.comparableValueUsd as number))
    : null;
  const withEta = enriched.filter(
    (q) =>
      q.available &&
      q.estimatedDeliveryMax != null &&
      Number.isFinite(q.estimatedDeliveryMax),
  );
  const minEta = withEta.length
    ? Math.min(...withEta.map((q) => q.estimatedDeliveryMax as number))
    : null;

  const annotated = enriched.map((q) => {
    const isCheapest =
      minNormPrice != null &&
      q.available &&
      Math.abs((q.comparableValueUsd as number) - minNormPrice) < 1e-6;
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
    const pA = Number.isFinite(a.comparableValueUsd) ? (a.comparableValueUsd as number) : 999999;
    const pB = Number.isFinite(b.comparableValueUsd) ? (b.comparableValueUsd as number) : 999999;
    return pA - pB;
  });
}
