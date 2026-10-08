/**
 * Client-side shipping cost comparison (mirrors backend currency-conversion.ts).
 * Never compare raw cross-currency numbers.
 */

export type FxRateSnapshot = {
  usdToSypRate: number;
  source: string;
  timestamp: string;
};

export const FX_FALLBACK_USD_TO_SYP = 14500;

/** Prefer Vite env; fall back to known default with explicit source. */
export function getClientFxSnapshot(): FxRateSnapshot {
  const raw = (import.meta as { env?: Record<string, string> }).env?.VITE_USD_TO_SYP_RATE;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return {
        usdToSypRate: n,
        source: 'env:VITE_USD_TO_SYP_RATE',
        timestamp: new Date().toISOString(),
      };
    }
  }
  return {
    usdToSypRate: FX_FALLBACK_USD_TO_SYP,
    source: 'fallback:DEFAULT_USD_TO_SYP_RATE',
    timestamp: new Date().toISOString(),
  };
}

export function toComparableUsd(
  amount: number,
  currency: string | undefined,
  snapshot: FxRateSnapshot = getClientFxSnapshot(),
): number {
  if (!Number.isFinite(amount)) return Infinity;
  const curr = (currency ?? 'USD').toUpperCase().trim();
  if (curr === 'SYP') {
    const rate = snapshot.usdToSypRate > 0 ? snapshot.usdToSypRate : FX_FALLBACK_USD_TO_SYP;
    return amount / rate;
  }
  return amount;
}

export function effectiveComparableCost(input: {
  price: number;
  currency: string;
  prices?: Array<{ price: number; currency: string }>;
  preferredCurrency?: string | null;
}): { amount: number; currency: string } {
  const preferred = input.preferredCurrency?.trim().toUpperCase() || null;
  if (input.prices?.length) {
    if (preferred) {
      const match = input.prices.find(
        (p) => p.currency?.toUpperCase() === preferred && Number.isFinite(p.price),
      );
      if (match) return { amount: match.price, currency: match.currency.toUpperCase() };
    }
    const first = input.prices.find((p) => Number.isFinite(p.price));
    if (first) return { amount: first.price, currency: (first.currency || 'USD').toUpperCase() };
  }
  return { amount: input.price, currency: (input.currency || 'USD').toUpperCase() };
}

export function comparableValueUsd(
  input: {
    price: number;
    currency: string;
    prices?: Array<{ price: number; currency: string }>;
    preferredCurrency?: string | null;
  },
  snapshot: FxRateSnapshot = getClientFxSnapshot(),
): number {
  const cost = effectiveComparableCost(input);
  return toComparableUsd(cost.amount, cost.currency, snapshot);
}

export type DeliveryFilter = 'mixed' | 'address' | 'hub';

/** Auto = cheapest among eligible; otherwise force a platform/courier family. */
export type ProviderCompanyFilter = 'auto' | string;

export type AssignmentState =
  | 'UNASSIGNED'
  | 'RECOMMENDED'
  | 'USER_MODIFIED'
  | 'BLOCKED'
  | 'CONFIRMED';

export function normalizeDeliveryType(raw?: string | null): 'address' | 'hub' {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'hub' || v === 'branch' || v === 'pickup_at_branch') return 'hub';
  return 'address';
}

export function filterQuotesByDeliveryType<T extends { deliveryType?: string }>(
  quotes: T[],
  filter: DeliveryFilter,
): T[] {
  if (filter === 'mixed') return quotes;
  return quotes.filter((q) => normalizeDeliveryType(q.deliveryType) === filter);
}

/** Match quote to a company filter (platform code or courier name substring). */
export function quoteMatchesCompanyFilter<
  T extends { carrierId: string; serviceId?: string; serviceName?: string; carrierName?: string },
>(quote: T, companyFilter: ProviderCompanyFilter): boolean {
  if (!companyFilter || companyFilter === 'auto') return true;
  const needle = companyFilter.trim().toUpperCase();
  if (!needle) return true;
  const hay = [
    quote.carrierId,
    quote.serviceId ?? '',
    quote.serviceName ?? '',
    quote.carrierName ?? '',
  ]
    .join(' ')
    .toUpperCase();
  return hay.includes(needle);
}

export function filterQuotesByCompany<
  T extends { carrierId: string; serviceId?: string; serviceName?: string; carrierName?: string },
>(quotes: T[], companyFilter: ProviderCompanyFilter): T[] {
  if (!companyFilter || companyFilter === 'auto') return quotes;
  return quotes.filter((q) => quoteMatchesCompanyFilter(q, companyFilter));
}

export function isLockedAssignmentState(state: AssignmentState): boolean {
  return state === 'CONFIRMED';
}

export function isSendableAssignmentState(state: AssignmentState): boolean {
  return state === 'RECOMMENDED' || state === 'USER_MODIFIED' || state === 'CONFIRMED';
}

export function annotateQuotesForUi<
  T extends {
    available?: boolean;
    price: number;
    currency: string;
    prices?: Array<{ price: number; currency: string }>;
    preferredCurrency?: string | null;
    estimatedDeliveryMax?: number;
  },
>(
  quotes: T[],
  snapshot: FxRateSnapshot = getClientFxSnapshot(),
): Array<
  T & {
    isCheapest: boolean;
    isRecommended: boolean;
    comparableValueUsd: number;
    effectiveCostAmount: number;
    effectiveCostCurrency: string;
  }
> {
  const enriched = quotes.map((q) => {
    const cost = effectiveComparableCost(q);
    const comparable = comparableValueUsd(q, snapshot);
    return {
      ...q,
      comparableValueUsd: comparable,
      effectiveCostAmount: cost.amount,
      effectiveCostCurrency: cost.currency,
    };
  });
  const available = enriched.filter(
    (q) => (q.available !== false) && Number.isFinite(q.comparableValueUsd),
  );
  const min = available.length
    ? Math.min(...available.map((q) => q.comparableValueUsd))
    : null;
  return enriched
    .map((q) => {
      const isCheapest =
        min != null && (q.available !== false) && Math.abs(q.comparableValueUsd - min) < 1e-6;
      return { ...q, isCheapest, isRecommended: isCheapest };
    })
    .sort((a, b) => a.comparableValueUsd - b.comparableValueUsd);
}

/** Bulk Shipping Details rate-fetch concurrency (per modal open). */
export const BULK_RATES_FETCH_CONCURRENCY = 8;

/** Generic worker pool — failures isolated by the worker. */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** Provider-aware concurrency limits for OMS Send Shipment. */
export const SEND_CONCURRENCY_BY_PROVIDER: Record<string, number> = {
  BABEL_EXPRESS: 2,
  SILA_SY: 3,
};
export const SEND_CONCURRENCY_DEFAULT = 2;

export async function runProviderAwarePool<T extends { providerCode: string }>(
  items: T[],
  worker: (item: T) => Promise<void>,
  limits: Record<string, number> = SEND_CONCURRENCY_BY_PROVIDER,
  defaultLimit = SEND_CONCURRENCY_DEFAULT,
): Promise<void> {
  const byProvider = new Map<string, T[]>();
  for (const item of items) {
    const key = (item.providerCode || 'UNKNOWN').toUpperCase();
    const list = byProvider.get(key) ?? [];
    list.push(item);
    byProvider.set(key, list);
  }

  await Promise.all(
    [...byProvider.entries()].map(async ([code, list]) => {
      const concurrency = Math.max(1, limits[code] ?? defaultLimit);
      let idx = 0;
      const runners = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
        while (idx < list.length) {
          const current = list[idx++];
          await worker(current);
        }
      });
      await Promise.all(runners);
    }),
  );
}

export type ClientQuoteFingerprint = {
  providerCode: string;
  serviceId: string;
  currency: string;
  amount: number;
  deliveryType: string;
  packageType: string;
  weightKg: number;
  destinationKey: string;
  partsKey?: string;
  quotedAt: string;
  expiresAt: string;
};

export function buildClientDestinationKey(input: {
  neighbourhoodId?: number | null;
  governorate?: string | null;
  city?: string | null;
  neighborhood?: string | null;
}): string {
  if (input.neighbourhoodId != null && Number.isFinite(Number(input.neighbourhoodId))) {
    return `hood:${Number(input.neighbourhoodId)}`;
  }
  const gov = (input.governorate ?? '').trim().toLowerCase();
  const city = (input.city ?? '').trim().toLowerCase();
  const hood = (input.neighborhood ?? '').trim().toLowerCase();
  return `addr:${gov}|${city}|${hood}`;
}

export function createClientQuoteFingerprint(input: {
  providerCode: string;
  serviceId: string;
  currency: string;
  amount: number;
  deliveryType: string;
  packageType: string;
  weightKg: number;
  destinationKey: string;
  partsKey?: string;
  ttlMs?: number;
}): ClientQuoteFingerprint {
  const quotedAt = new Date();
  const ttl = input.ttlMs ?? 5 * 60 * 1000;
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
