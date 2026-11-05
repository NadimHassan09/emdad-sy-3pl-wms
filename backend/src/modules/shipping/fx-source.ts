/**
 * Automatic USD→SYP source.
 * Google has no supported FX API for this, and Google Search/Finance is not scraped.
 * open.er-api.com lists SYP at the official rate (~122), which is not a collection rate.
 * The fawazahmed0 currency-api (Cloudflare pages) lists a market SYP rate and is the
 * configured automatic source. A failed fetch never invents 0 or 14500.
 */
export const FX_AUTO_SOURCE = 'fawazahmed0-currency-api';
export const FX_AUTO_URL = 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json';
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
  try {
    const res = await fetchImpl(FX_AUTO_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { ok: false, source: FX_AUTO_SOURCE, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { usd?: { syp?: unknown } };
    const rate = Number(body?.usd?.syp);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, source: FX_AUTO_SOURCE, error: 'Response did not include a positive SYP rate' };
    }
    return { ok: true, rate, source: FX_AUTO_SOURCE, fetchedAt: now.toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FX source unreachable';
    return { ok: false, source: FX_AUTO_SOURCE, error: message };
  }
}
