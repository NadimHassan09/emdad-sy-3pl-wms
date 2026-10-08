/**
 * Currency conversion for shipping rate comparison.
 *
 * Source today: env USD_TO_SYP_RATE (or built-in fallback). This is an explicit
 * abstraction so recommendation never compares raw cross-currency numbers, and so
 * the rate source can later swap (admin config / external feed) without changing
 * call sites. Do not treat the fallback as a silent permanent product FX feed.
 */

export type ComparisonCurrency = 'USD';

export type FxRateSnapshot = {
  /** Units of SYP per 1 USD */
  usdToSypRate: number;
  source: string;
  timestamp: string; // ISO
  expiresAt?: string;
};

export const FX_FALLBACK_USD_TO_SYP = 14500;
export const FX_SOURCE_ENV = 'env:USD_TO_SYP_RATE';
export const FX_SOURCE_FALLBACK = 'fallback:DEFAULT_USD_TO_SYP_RATE';

export function readUsdToSypRateFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { rate: number; source: string } {
  const envVal = env.USD_TO_SYP_RATE;
  if (envVal) {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { rate: parsed, source: FX_SOURCE_ENV };
    }
  }
  return { rate: FX_FALLBACK_USD_TO_SYP, source: FX_SOURCE_FALLBACK };
}

/** Snapshot of the FX rate at comparison/quote time. */
export function getFxRateSnapshot(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): FxRateSnapshot {
  const { rate, source } = readUsdToSypRateFromEnv(env);
  return {
    usdToSypRate: rate,
    source,
    timestamp: now.toISOString(),
  };
}

/**
 * Normalize a money amount to USD for cross-currency comparison.
 * SYP is divided by usdToSypRate; unknown currencies are treated as USD.
 */
export function toComparableUsd(
  amount: number,
  currency: string | undefined,
  snapshot: FxRateSnapshot,
): number {
  if (!Number.isFinite(amount)) return Infinity;
  const curr = (currency ?? 'USD').toUpperCase().trim();
  if (curr === 'SYP') {
    const rate = snapshot.usdToSypRate > 0 ? snapshot.usdToSypRate : FX_FALLBACK_USD_TO_SYP;
    return amount / rate;
  }
  return amount;
}

/**
 * Final payable shipping cost from a quote option.
 * Prefer an explicit total when present; otherwise use price + currency.
 * Never invent VAT/COD/insurance fees absent from the quote payload.
 */
export function effectiveComparableCost(input: {
  price: number;
  currency: string;
  /** Optional multi-currency amounts from the provider. */
  prices?: Array<{ price: number; currency: string }>;
  /** Preferred currency when prices[] has multiple options. */
  preferredCurrency?: string | null;
}): { amount: number; currency: string } {
  const preferred = input.preferredCurrency?.trim().toUpperCase() || null;
  if (input.prices && input.prices.length > 0) {
    if (preferred) {
      const match = input.prices.find(
        (p) => p.currency?.toUpperCase() === preferred && Number.isFinite(p.price),
      );
      if (match) {
        return { amount: match.price, currency: match.currency.toUpperCase() };
      }
    }
    const first = input.prices.find((p) => Number.isFinite(p.price));
    if (first) {
      return { amount: first.price, currency: (first.currency || 'USD').toUpperCase() };
    }
  }
  return {
    amount: input.price,
    currency: (input.currency || 'USD').toUpperCase(),
  };
}

export function comparableValueUsd(
  input: {
    price: number;
    currency: string;
    prices?: Array<{ price: number; currency: string }>;
    preferredCurrency?: string | null;
  },
  snapshot: FxRateSnapshot,
): number {
  const cost = effectiveComparableCost(input);
  return toComparableUsd(cost.amount, cost.currency, snapshot);
}
