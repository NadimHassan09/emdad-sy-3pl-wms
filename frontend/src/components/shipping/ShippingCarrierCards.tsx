import type { ShippingRateError, ShippingRateQuote } from '../../api/shipping';

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

type Props = {
  quotes: ShippingRateQuote[];
  errors: ShippingRateError[];
  selectedCarrierId: string;
  onSelect: (carrierId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  emptyHint?: string | null;
};

export function ShippingCarrierCards({
  quotes,
  errors,
  selectedCarrierId,
  onSelect,
  loading = false,
  disabled = false,
  emptyHint = null,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        Available shipping companies
      </div>

      {loading ? (
        <div className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-4 text-sm text-text-body">
          <p className="font-medium">Finding available shipping companies…</p>
          <p className="mt-1 text-xs text-text-muted">Calculating shipping rates…</p>
        </div>
      ) : null}

      {!loading && emptyHint ? (
        <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-sm text-text-body">
          {emptyHint}
        </p>
      ) : null}

      {!loading
        ? quotes.map((q) => {
            const selected = selectedCarrierId === q.carrierId;
            const eta = etaLabel(q);
            return (
              <div
                key={q.serviceId}
                className={`rounded-xl border px-4 py-3 ${
                  selected
                    ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30'
                    : 'border-border-subtle bg-surface-card'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-text-strong">{q.carrierName}</div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {[q.serviceName, eta].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-text-strong">
                    {formatMoney(q.price, q.currency)}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.isCheapest ? (
                    <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success-fg">
                      Cheapest
                    </span>
                  ) : null}
                  {q.isFastest ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      Fastest
                    </span>
                  ) : null}
                  {q.isRecommended ? (
                    <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-body">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className={`mt-2 text-xs ${q.restrictions?.length ? 'text-status-warning-fg' : 'text-status-success-fg'}`}>
                  {q.restrictions?.length
                    ? '⚠ Available via hub delivery for this destination'
                    : '✓ Available for this destination'}
                </p>
                {q.restrictions?.length ? (
                  <ul className="mt-1 list-disc ps-4 text-[11px] text-text-muted">
                    {q.restrictions.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => onSelect(q.carrierId)}
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

      {!loading
        ? errors.map((err) => (
            <div
              key={err.carrierId}
              className="rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3"
            >
              <div className="text-sm font-semibold text-text-strong">⚠ {err.carrierName}</div>
              <p className="mt-1 text-xs text-status-warning-fg">{err.message}</p>
            </div>
          ))
        : null}
    </div>
  );
}
