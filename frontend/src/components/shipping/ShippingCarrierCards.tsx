import type {
  ShippingProviderAdminView,
  ShippingRateError,
  ShippingRateQuote,
} from '../../api/shipping';

function formatMoney(price: number, currency: string): string {
  const cur = currency.trim() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${cur}`;
  }
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
  /** Configured providers that should always remain visible. */
  providers: ShippingProviderAdminView[];
  quotes: ShippingRateQuote[];
  errors: ShippingRateError[];
  selectedCarrierId: string;
  onSelect: (carrierId: string) => void;
  /** True while a quote request for the current inputs is in flight. */
  loading?: boolean;
  disabled?: boolean;
  /** Shown above cards when quote inputs are incomplete. */
  emptyHint?: string | null;
  /** Providers list still loading. */
  providersLoading?: boolean;
};

/**
 * Always render known carriers. Quote loading/unavailable/error are card states —
 * never remove the carrier list or present a missing quote as free shipping (0).
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
}: Props) {
  const quotesById = new Map(quotes.map((q) => [q.carrierId, q]));
  const errorsById = new Map(errors.map((e) => [e.carrierId, e]));

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        Available shipping companies
      </div>

      {emptyHint ? (
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
            const quote = quotesById.get(provider.code);
            const err = errorsById.get(provider.code);
            const selected = selectedCarrierId === provider.code;
            const connected = provider.connected && provider.enabled;

            let state: CarrierCardState = 'not_available';
            if (!connected) state = 'not_available';
            else if (loading) state = 'loading';
            else if (err) state = 'quote_error';
            else if (quote) state = selected ? 'selected' : 'available';
            else state = 'not_available';

            const eta = quote ? etaLabel(quote) : null;
            const canSelect = connected && !loading && !disabled && !!quote;

            return (
              <div
                key={provider.code}
                className={`rounded-xl border px-4 py-3 ${
                  selected
                    ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30'
                    : 'border-border-subtle bg-surface-card'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-text-strong">{provider.name}</div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {[quote?.serviceName, eta].filter(Boolean).join(' • ') ||
                        (connected ? 'Connected carrier' : 'Not connected')}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-text-strong">
                    {state === 'loading' ? (
                      <span className="text-text-faint">Loading…</span>
                    ) : quote ? (
                      formatMoney(quote.price, quote.currency)
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {state === 'loading' ? (
                    <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-body">
                      Recalculating
                    </span>
                  ) : null}
                  {quote?.isCheapest ? (
                    <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success-fg">
                      Cheapest
                    </span>
                  ) : null}
                  {quote?.isFastest ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      Fastest
                    </span>
                  ) : null}
                  {quote?.isRecommended ? (
                    <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-body">
                      Recommended
                    </span>
                  ) : null}
                  {selected ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      Selected
                    </span>
                  ) : null}
                </div>

                <p
                  className={`mt-2 text-xs ${
                    state === 'available' || state === 'selected'
                      ? quote?.restrictions?.length
                        ? 'text-status-warning-fg'
                        : 'text-status-success-fg'
                      : state === 'loading'
                        ? 'text-text-muted'
                        : 'text-status-warning-fg'
                  }`}
                >
                  {state === 'loading'
                    ? 'Shipping information is being recalculated…'
                    : !connected
                      ? provider.lastErrorSafe
                        ? `Unavailable — ${provider.lastErrorSafe}`
                        : 'Not available — carrier not connected'
                      : err
                        ? `Quote unavailable — ${err.message}`
                        : quote
                          ? quote.restrictions?.length
                            ? '⚠ Available via hub delivery for this destination'
                            : '✓ Available for this destination'
                          : 'Not available for this destination / shipment'}
                </p>

                {quote?.restrictions?.length ? (
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
