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

/**
 * Syrian-pound unit a carrier itself uses (mirrors backend carrier-currency.ts). The carrier
 * is the source of truth; a carrier that is not listed keeps the platform unit.
 */
export type SypUnit = 'new' | 'old';
export const OLD_SYP_PER_NEW_SYP = 100;
const CARRIER_SYP_UNITS: Record<string, SypUnit> = {
  BABEL_EXPRESS: 'new',
  SENA_EXPRESS: 'new', // owner decision 3 Nov 2026, not yet confirmed by Sena
};

export function carrierSypUnit(providerCode?: string | null): SypUnit | null {
  const key = providerCode?.trim().toUpperCase();
  return key ? CARRIER_SYP_UNITS[key] ?? null : null;
}

function sypUnitOfRate(rate: number): SypUnit | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (rate >= 2000) return 'old';
  if (rate <= 500) return 'new';
  return null;
}

/** The platform USD/SYP rate expressed in the carrier's own pound unit. */
export function rateForCarrierUnit(platformRate: number, carrierUnit?: SypUnit | null): number {
  const platformUnit = sypUnitOfRate(platformRate);
  if (!carrierUnit || !platformUnit || carrierUnit === platformUnit) return platformRate;
  return carrierUnit === 'new' ? platformRate / OLD_SYP_PER_NEW_SYP : platformRate * OLD_SYP_PER_NEW_SYP;
}

/** Rate managed by the admin on Shipping Companies; set once it has been fetched. */
let managedFxSnapshot: FxRateSnapshot | null = null;

export function setManagedFxSnapshot(snapshot: FxRateSnapshot | null): void {
  managedFxSnapshot = snapshot;
}

/** Prefer the managed rate, then Vite env; fall back to known default with explicit source. */
export function getClientFxSnapshot(): FxRateSnapshot {
  if (managedFxSnapshot) return managedFxSnapshot;
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
  sypUnit?: SypUnit | null,
): number {
  if (!Number.isFinite(amount)) return Infinity;
  const curr = (currency ?? 'USD').toUpperCase().trim();
  if (curr === 'SYP') {
    const platformRate = snapshot.usdToSypRate > 0 ? snapshot.usdToSypRate : FX_FALLBACK_USD_TO_SYP;
    return amount / rateForCarrierUnit(platformRate, sypUnit);
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
    sypUnit?: SypUnit | null;
  },
  snapshot: FxRateSnapshot = getClientFxSnapshot(),
): number {
  const cost = effectiveComparableCost(input);
  return toComparableUsd(cost.amount, cost.currency, snapshot, input.sypUnit);
}

export type DeliveryFilter = 'mixed' | 'address' | 'hub';

/** Rate-card currency. Does not change the order COD currency. */
export type RateCurrencyFilter = 'all' | 'USD' | 'SYP';

/**
 * COD filter uses verified collection currencies only.
 * A SYP shipping fee does not make USD COD unsupported, and the reverse is also ignored.
 */
export function quoteSupportsCollectionCurrency(
  quote: { supportedCodCurrencies?: string[] | null; currency?: string | null },
  currency: 'USD' | 'SYP',
): boolean {
  const list = (quote.supportedCodCurrencies ?? []).map((item) => item.trim().toUpperCase());
  return list.includes(currency);
}

export function applyQuoteCurrency<
  T extends {
    price: number;
    currency: string;
    prices?: Array<{ price: number; currency: string }>;
    preferredCurrency?: string | null;
  },
>(quotes: T[], filter: RateCurrencyFilter): T[] {
  if (filter === 'all') return quotes;
  const next: T[] = [];
  for (const quote of quotes) {
    const match = quote.prices?.find(
      (price) => price.currency?.toUpperCase() === filter && Number.isFinite(price.price),
    );
    if (match) {
      next.push({
        ...quote,
        price: match.price,
        currency: match.currency.toUpperCase(),
        preferredCurrency: filter,
      });
      continue;
    }
    if ((quote.currency || '').toUpperCase() === filter) {
      next.push({ ...quote, preferredCurrency: filter });
    }
  }
  return next;
}

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
  const isSenaFilter = needle === 'SENA_EXPRESS' || needle.includes('SENA') || needle.includes('سينا');
  if (isSenaFilter) {
    if (
      quote.carrierId?.toUpperCase() === 'SENA_EXPRESS' ||
      (quote.serviceId && quote.serviceId.toUpperCase().startsWith('SENA_EXPRESS:')) ||
      (quote.serviceName && (quote.serviceName.includes('سينا') || quote.serviceName.toUpperCase().includes('SENA')))
    ) {
      return true;
    }
  }
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
    sypUnit?: SypUnit | null;
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
  // A zero price means the carrier returned no real price (e.g. sandbox), not free shipping:
  // it must never win "cheapest" nor be recommended.
  const hasRealPrice = (q: { comparableValueUsd: number }) =>
    Number.isFinite(q.comparableValueUsd) && q.comparableValueUsd > 0;
  const available = enriched.filter((q) => (q.available !== false) && hasRealPrice(q));
  const min = available.length
    ? Math.min(...available.map((q) => q.comparableValueUsd))
    : null;
  return enriched
    .map((q) => {
      const isCheapest =
        min != null &&
        (q.available !== false) &&
        hasRealPrice(q) &&
        Math.abs(q.comparableValueUsd - min) < 1e-6;
      return { ...q, isCheapest, isRecommended: isCheapest };
    })
    .sort((a, b) => {
      const aReal = hasRealPrice(a);
      const bReal = hasRealPrice(b);
      if (aReal !== bReal) return aReal ? -1 : 1;
      return a.comparableValueUsd - b.comparableValueUsd;
    });
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
  SENA_EXPRESS: 2,
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
  hubId?: string;
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
  hubId?: string | null;
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
    hubId: (input.hubId || '').trim(),
    quotedAt: quotedAt.toISOString(),
    expiresAt: new Date(quotedAt.getTime() + ttl).toISOString(),
  };
}

export function isClientHubQuoteStale(input: {
  deliveryType?: string | null;
  selectedHubId?: string | null;
  fingerprintHubId?: string | null;
}): boolean {
  if (input.deliveryType !== 'hub') return false;
  const selected = (input.selectedHubId || '').trim();
  const fp = (input.fingerprintHubId || '').trim();
  return Boolean(selected) && selected !== fp;
}

