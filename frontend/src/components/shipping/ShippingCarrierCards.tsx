import { useMemo } from 'react';
import type {
  ShippingProviderAdminView,
  ShippingRateError,
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `$${Number(price).toFixed(2)}`;
  }
}

function etaLabel(quote: ShippingRateQuote): string {
  const min = quote.estimatedDeliveryMin;
  const max = quote.estimatedDeliveryMax;
  if (min != null && max != null && min !== max) {
    return `${min} - ${max} days`;
  }
  const n = max ?? min ?? 3;
  return `${Math.max(1, n - 1)} - ${n + 1} days`;
}

type Props = {
  providers: ShippingProviderAdminView[];
  quotes: ShippingRateQuote[];
  errors: ShippingRateError[];
  selectedCarrierId: string;
  selectedServiceId?: string;
  onSelect: (carrierId: string, serviceId?: string) => void;
  loading?: boolean;
  disabled?: boolean;
  emptyHint?: string | null;
  providersLoading?: boolean;
  preferredCurrency?: ShippingCurrency;
  getSupportedCurrencies?: (providerCode: string) => ShippingCurrency[];
};

export function ShippingCarrierCards({
  providers,
  quotes,
  errors,
  selectedCarrierId,
  selectedServiceId,
  onSelect,
  loading = false,
  disabled = false,
  emptyHint = null,
  providersLoading = false,
}: Props) {
  // Sort all quotes across all providers by price ascending (lowest first)
  const sortedQuotes = useMemo(() => {
    if (loading) return [];
    const valid = quotes.filter((q) => q.available && Number.isFinite(q.price));
    return [...valid].sort((a, b) => a.price - b.price);
  }, [quotes, loading]);

  const minPrice = sortedQuotes.length > 0 ? sortedQuotes[0].price : null;

  return (
    <div className="space-y-4">
      {/* Header with Title and Subtitle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/70 pb-2.5">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Shipping Companies
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Available shipping options for your shipment (sorted by price - lowest first).
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
          <i className="fa-solid fa-circle-info text-sky-500" aria-hidden="true" />
          <span>Showing options from all connected providers</span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          <i className="fa-solid fa-spinner fa-spin text-lg text-sky-600 shrink-0" />
          <span>Updating carrier availability and prices from connected providers…</span>
        </div>
      ) : null}

      {/* Empty / Incomplete address hint */}
      {emptyHint && !loading ? (
        <p className="rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3 text-sm text-text-body">
          {emptyHint}
        </p>
      ) : null}

      {/* Providers Loading */}
      {providersLoading ? (
        <div className="rounded-xl border border-border-subtle bg-surface-sunken px-4 py-4 text-sm text-text-body">
          <p className="font-medium">Loading shipping companies…</p>
        </div>
      ) : null}

      {/* No Connected Providers */}
      {!providersLoading && providers.length === 0 ? (
        <p className="rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3 text-sm text-text-body">
          No connected shipping companies. Connect one under Shipping Companies.
        </p>
      ) : null}

      {/* 3-Column Grid of Carrier Quotes */}
      {!loading && sortedQuotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedQuotes.map((quote) => {
            const isSelected = selectedServiceId
              ? selectedServiceId === quote.serviceId
              : Boolean(
                  selectedCarrierId &&
                    selectedCarrierId === quote.carrierId &&
                    sortedQuotes.filter((q) => q.carrierId === selectedCarrierId).length === 1,
                );
            const isCheapest = minPrice != null && quote.price === minPrice;
            const eta = etaLabel(quote);
            const isBranch = quote.deliveryType === 'hub';

            return (
              <div
                key={quote.serviceId}
                onClick={() => !disabled && onSelect(quote.carrierId, quote.serviceId)}
                className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-150 cursor-pointer select-none ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/20 shadow-sm ring-1 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-950/20'
                    : 'border-border-subtle bg-surface-card hover:border-border hover:shadow-sm'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div>
                  {/* Top Row: Logo + Carrier Name + Provider Badge | Price + Best Price */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {quote.logoUrl ? (
                        <img
                          src={quote.logoUrl}
                          alt={quote.serviceName}
                          className="h-11 w-11 shrink-0 rounded-xl border border-border-subtle bg-white object-contain p-1 shadow-2xs"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-sunken text-emerald-600 dark:text-emerald-400">
                          <i className="fa-solid fa-truck-fast text-lg" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-bold text-text-strong truncate"
                          title={quote.serviceName}
                        >
                          {quote.serviceName}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-text-muted">Provider:</span>
                          <span className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                            {quote.providerName || quote.carrierName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      {isCheapest ? (
                        <span className="mb-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide shadow-2xs">
                          Best Price
                        </span>
                      ) : null}
                      <div className="text-base sm:text-lg font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                        {formatMoney(quote.price, quote.currency)}
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Delivery Time & Service Features */}
                  <div className="mt-3.5 space-y-2 border-t border-border-subtle/60 pt-3">
                    <div className="text-xs text-text-muted">
                      <span>Est. delivery: {eta}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <i
                          className={`fa-solid ${isBranch ? 'fa-building' : 'fa-truck'} text-[10px] text-text-faint`}
                          aria-hidden="true"
                        />
                        <span>{isBranch ? 'استلام من الفرع' : 'توصيل منزلي'}</span>
                      </span>
                      <span className="text-border-subtle">•</span>
                      <span className="inline-flex items-center gap-1">
                        <i className="fa-solid fa-shield-halved text-[10px] text-text-faint" aria-hidden="true" />
                        <span>تتبع الشحنة</span>
                      </span>
                      <span className="text-border-subtle">•</span>
                      <span className="inline-flex items-center gap-1">
                        <i className="fa-solid fa-headset text-[10px] text-text-faint" aria-hidden="true" />
                        <span>دعم العملاء</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Selection Button / Indicator */}
                <div className="mt-4 pt-1">
                  <div
                    className={`flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-surface-sunken text-text-body hover:bg-surface-hover hover:text-text-strong border border-border-subtle/50'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <i className="fa-solid fa-circle-check text-sm text-white" aria-hidden="true" />
                        <span>Selected</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-regular fa-circle text-sm text-text-muted" aria-hidden="true" />
                        <span>Select</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* When no quotes are returned but errors occurred from providers */}
      {!loading && sortedQuotes.length === 0 && !emptyHint && errors.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="font-semibold mb-1">Carrier Availability:</div>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((err) => (
              <li key={err.carrierId}>
                <strong>{err.carrierName}:</strong> {err.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Bottom Info Banner */}
      <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300">
        <i className="fa-solid fa-circle-info text-sm text-sky-600 shrink-0" aria-hidden="true" />
        <span>
          Prices are sorted from lowest to highest. Shipping options are retrieved from all connected providers
          (Babel Express, Sila-SY.com, etc.).
        </span>
      </div>
    </div>
  );
}
