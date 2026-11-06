/**
 * Automatic USD→SYP market rate source.
 *
 * The Syrian Central Bank publishes only the administrative rate (~122 SYP/USD),
 * which is not the collection rate used by carriers. Standard exchange-rate APIs
 * (open.er-api.com, exchangerate-api.com) all source from central banks and therefore
 * also return ~122. The fawazahmed0 currency-api aggregates market data and returns
 * the actual collection rate (~13,000+ SYP/USD).
 *
 * Two equivalent mirrors are tried in order so a single CDN outage is handled silently:
 *   1. Cloudflare Pages  (fawazahmed0's own host)
 *   2. jsDelivr CDN      (npm package mirror of the same dataset)
 *
 * A failed fetch never invents 0 or any placeholder rate.
 */
export const FX_AUTO_SOURCE = 'fawazahmed0-currency-api';
export const FX_AUTO_URLS = [
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
];
/** @deprecated use FX_AUTO_URLS[0] */
export const FX_AUTO_URL = FX_AUTO_URLS[0];
export const FX_FRESH_MS = 6 * 60 * 60 * 1000;
export const FX_STALE_MS = 24 * 60 * 60 * 1000;
export const FX_MIN_CHANGE_PERCENT = 0.5;
const HOUR_MS = 60 * 60 * 1000;

export const hoursToMs = (hours: number | null | undefined, fallbackMs: number): number =>
  hours != null && Number.isFinite(hours) && hours > 0 ? hours * HOUR_MS : fallbackMs;

/** True when the fetched rate moved enough from the active one to replace it. */
export function rateMovedEnough(active: number | null, fetched: number, minPercent: number): boolean {
  if (active == null || !Number.isFinite(active) || active <= 0) return true;
  return (Math.abs(fetched - active) / active) * 100 >= minPercent;
}

export type FxFetchResult =
  | { ok: true; rate: number; source: string; fetchedAt: string }
  | { ok: false; source: string; error: string };

export async function fetchUsdToSypRate(
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<FxFetchResult> {
  let lastError = 'FX source unreachable';
  for (const url of FX_AUTO_URLS) {
    try {
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        lastError = `HTTP ${res.status} from ${url}`;
        continue;
      }
      const body = (await res.json()) as { usd?: { syp?: unknown } };
      const rate = Number(body?.usd?.syp);
      if (!Number.isFinite(rate) || rate <= 0) {
        lastError = `No positive SYP rate from ${url}`;
        continue;
      }
      return { ok: true, rate, source: FX_AUTO_SOURCE, fetchedAt: now.toISOString() };
    } catch (err) {
      lastError = err instanceof Error ? err.message : `FX source unreachable (${url})`;
    }
  }
  return { ok: false, source: FX_AUTO_SOURCE, error: lastError };
}
