import type {
  ShippingProviderAdminView,
  ShippingRateError,
  ShippingRatePrice,
  ShippingRateQuote,
} from '../../api/shipping';
import type { ShippingCurrency } from './carrier-shipping-form';

function formatMoney(price: number, currency: string): string {
  const cur = (currency.trim() || 'USD').toUpperCase();
  if (cur === 'SYP') {
    try {
      return `${new Intl.NumberFormat('ar-SY', { maximumFractionDigits: 0 }).format(price)} ل.س`;
    } catch {
      return `${price} ل.س`;
    }
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `$${price}`;
  }
}

/** Prefer API `prices[]`; fall back to single price/currency. USD above SYP. */
function quotePriceLines(quote: ShippingRateQuote): string[] {
  const raw: ShippingRatePrice[] =
    quote.prices && quote.prices.length > 0
      ? quote.prices.filter((p) => Number.isFinite(p.price) && p.currency?.trim())
      : [{ price: quote.price, currency: quote.currency || 'USD' }];

  const rank = (c: string) => {
    const u = c.trim().toUpperCase();
    if (u === 'USD') return 0;
    if (u === 'SYP') return 1;
    return 2;
  };
  const sorted = [...raw].sort((a, b) => rank(a.currency) - rank(b.currency));
  // Dedupe by currency (keep first / preferred amount).
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const p of sorted) {
    const cur = p.currency.trim().toUpperCase();
    if (seen.has(cur)) continue;
    seen.add(cur);
    lines.push(formatMoney(p.price, cur));
  }
  return lines;
}

function etaLabel(quote: ShippingRateQuote): string | null {
  if (quote.estimatedDeliveryMin == null && quote.estimatedDeliveryMax == null) return null;
  const min = quote.estimatedDeliveryMin;
  const max = quote.estimatedDeliveryMax;
  if (min != null && max != null && min !== max) return `${min}–${max} business days`;
  const n = max ?? min;
  if (n === 1) return '1 business day';
  return `${n} business days`;
}

export type CarrierCardState = 'loading' | 'available' | 'not_available' | 'quote_error' | 'selected';

type Props = {
  providers: ShippingProviderAdminView[];
  quotes: ShippingRateQuote[];
  errors: ShippingRateError[];
  selectedCarrierId: string;
  onSelect: (carrierId: string) => void;
  /** Global refresh — hide stale quotes and show spinner on every connected card. */
  loading?: boolean;
  disabled?: boolean;
  emptyHint?: string | null;
  providersLoading?: boolean;
  preferredCurrency?: ShippingCurrency;
  getSupportedCurrencies?: (providerCode: string) => ShippingCurrency[];
};

/**
 * Always render known carriers. Quote loading/unavailable/error are card states —
 * never remove the carrier list or present a missing quote as free shipping (0).
 * While `loading`, never show previous quote/availability as current.
 */
export function ShippingCarrierCards({
  providers,
  quotes,
  errors,
  selectedCarrierId,
  onSelect,
  loading = false,
  disabled = false,
  emptyHint = null,
  providersLoading = false,
  preferredCurrency = 'USD',
  getSupportedCurrencies,
}: Props) {
  const quotesById = new Map(quotes.map((q) => [q.carrierId, q]));
  const errorsById = new Map(errors.map((e) => [e.carrierId, e]));

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        Shipping companies
      </div>

      {loading ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          Updating carrier availability for the current shipping details…
        </p>
      ) : null}

      {emptyHint && !loading ? (
        <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-sm text-text-body">
          {emptyHint}
        </p>
      ) : null}

      {providersLoading ? (
        <div className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-4 text-sm text-text-body">
          <p className="font-medium">Loading shipping companies…</p>
        </div>
      ) : null}

      {!providersLoading && providers.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-sm text-text-body">
          No connected shipping companies. Connect one under Shipping Companies.
        </p>
      ) : null}

      {!providersLoading
        ? providers.map((provider) => {
            const quote = loading ? undefined : quotesById.get(provider.code);
            const err = loading ? undefined : errorsById.get(provider.code);
            const selected = selectedCarrierId === provider.code;
            const connected = provider.connected && provider.enabled;
            const supported = getSupportedCurrencies?.(provider.code) ?? ['USD', 'SYP'];

            let state: CarrierCardState = 'not_available';
            if (!connected) state = 'not_available';
            else if (loading) state = 'loading';
            else if (err) state = 'quote_error';
            else if (quote) state = selected ? 'selected' : 'available';
            else state = 'not_available';

            const eta = quote ? etaLabel(quote) : null;
            const canSelect = connected && !loading && !disabled && !!quote;
            const available = state === 'available' || state === 'selected';
            const priceLines = quote ? quotePriceLines(quote) : [];

            return (
              <div
                key={provider.code}
                className={`rounded-xl border px-4 py-3 ${
                  selected
                    ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30'
                    : 'border-border-subtle bg-surface-card'
                } ${loading && connected ? 'opacity-90' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-strong">{provider.name}</div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {loading
                        ? 'Checking availability…'
                        : [quote?.serviceName, eta].filter(Boolean).join(' • ') ||
                          (connected ? 'Connected carrier' : 'Not connected')}
                    </div>
                    {!loading ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {supported.includes('USD') ? (
                          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-semibold text-text-body">
                            USD
                          </span>
                        ) : null}
                        {supported.includes('SYP') ? (
                          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-semibold text-text-body">
                            ل.س
                          </span>
                        ) : null}
                        {preferredCurrency ? (
                          <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                            Form: {preferredCurrency === 'SYP' ? 'ل.س' : 'USD'}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex min-w-[4.5rem] flex-col items-end justify-start gap-0.5 text-end text-sm font-semibold tabular-nums">
                    {state === 'loading' ? (
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center text-sky-600 dark:text-sky-400"
                        aria-label="Updating"
                        title="Updating availability"
                      >
                        <i className="fa-solid fa-spinner fa-spin text-lg" aria-hidden="true" />
                      </span>
                    ) : available && priceLines.length > 0 ? (
                      priceLines.map((line) => (
                        <span key={line} className="text-sky-600 dark:text-sky-400 leading-tight">
                          {line}
                        </span>
                      ))
                    ) : (
                      <span className="text-orange-600 dark:text-orange-400">غير متاح</span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {state === 'loading' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-200">
                      <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                      Updating…
                    </span>
                  ) : null}
                  {!loading && quote?.isCheapest ? (
                    <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success-fg">
                      Cheapest
                    </span>
                  ) : null}
                  {!loading && quote?.isFastest ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      Fastest
                    </span>
                  ) : null}
                  {!loading && quote?.isRecommended ? (
                    <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-body">
                      Recommended
                    </span>
                  ) : null}
                  {!loading && selected ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      Selected
                    </span>
                  ) : null}
                </div>

                <p
                  className={`mt-2 text-xs ${
                    state === 'loading'
                      ? 'text-sky-700 dark:text-sky-300'
                      : available
                        ? quote?.restrictions?.length
                          ? 'text-status-warning-fg'
                          : 'text-status-success-fg'
                        : 'text-status-warning-fg'
                  }`}
                >
                  {state === 'loading'
                    ? 'Updating availability…'
                    : !connected
                      ? provider.lastErrorSafe
                        ? `غير متاح — ${provider.lastErrorSafe}`
                        : 'غير متاح — الشركة غير متصلة'
                      : err
                        ? `غير متاح — ${err.message}`
                        : quote
                          ? quote.restrictions?.length
                            ? 'Available via hub for this destination'
                            : 'Available for this destination'
                          : 'غير متاح لهذا العنوان / إعداد الشحنة'}
                </p>

                {!loading && quote?.restrictions?.length ? (
                  <ul className="mt-1 list-disc ps-4 text-[11px] text-text-muted">
                    {quote.restrictions.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3">
                  <button
                    type="button"
                    disabled={!canSelect}
                    onClick={() => onSelect(provider.code)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      selected
                        ? 'bg-brand-600 text-white'
                        : 'border border-border-strong text-text-body hover:bg-surface-sunken'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {selected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })
        : null}
    </div>
  );
}
