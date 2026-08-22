import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { ShippingApi } from '../../api/shipping';
import { QK } from '../../constants/query-keys';
import { useDebounced } from '../../lib/useDebounced';
import { CascadingAddressSelector } from '../CascadingAddressSelector';
import { TextField } from '../TextField';
import {
  currencyAfterCarrierSelect,
  providerSupportedCurrencies,
  totalParts,
  totalVolumeCbm,
  totalWeightKg,
  type CarrierShippingFormValue,
  type PackageGroupValue,
  type ShippingCurrency,
} from './carrier-shipping-form';
import { ShippingCarrierCards } from './ShippingCarrierCards';

type Props = {
  value: CarrierShippingFormValue;
  onChange: (next: CarrierShippingFormValue) => void;
  locked?: boolean;
  disabled?: boolean;
  /** Hide carrier selection (already chosen / locked). */
  hideCarrierSelect?: boolean;
  codAmount?: number | null;
  showTitle?: boolean;
  /**
   * Fires whenever carrier quote refresh state changes.
   * Parents must disable Continue / Save while true.
   */
  onQuotesRefreshingChange?: (refreshing: boolean) => void;
  /** Selected carrier is still available for the latest settled quotes. */
  onSelectedCarrierAvailableChange?: (available: boolean) => void;
};

function stableRateKey(params: Record<string, unknown>): string {
  return JSON.stringify(params);
}

function patch(
  value: CarrierShippingFormValue,
  partial: Partial<CarrierShippingFormValue>,
): CarrierShippingFormValue {
  return { ...value, ...partial };
}

function patchGroup(
  groups: PackageGroupValue[],
  productId: string,
  partial: Partial<PackageGroupValue>,
): PackageGroupValue[] {
  return groups.map((g) => (g.productId === productId ? { ...g, ...partial } : g));
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-200'
                : 'border-border-subtle bg-surface-card text-text-body hover:bg-surface-sunken',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            {opt.icon ? <i className={opt.icon} aria-hidden="true" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shipping Details for carrier flow: address + package groups + currency + delivery,
 * then shipping company cards. Prefill lives in state (defaults always set).
 */
export function CarrierShippingDetailsForm({
  value,
  onChange,
  locked = false,
  disabled = false,
  hideCarrierSelect = false,
  codAmount = null,
  showTitle = true,
  onQuotesRefreshingChange,
  onSelectedCarrierAvailableChange,
}: Props) {
  const readOnly = locked || disabled;
  /** Ignore late responses from superseded quote requests. */
  const quoteRequestIdRef = useRef(0);

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    staleTime: 60_000,
  });
  const listedProviders = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);
  const connectedProviders = useMemo(
    () => listedProviders.filter((p) => p.connected && p.enabled),
    [listedProviders],
  );

  const partsCount = totalParts(value.groups);
  const weightKg = totalWeightKg(value.groups);
  const volumeCbm = totalVolumeCbm(value.groups);

  const destKey = {
    governorate: value.city.trim(),
    city: value.district.trim(),
    neighborhood: value.addressLine1.trim(),
  };
  const inputsHaveDestination = Boolean(
    destKey.governorate && destKey.city && destKey.neighborhood,
  );

  const quoteWeight =
    value.packageType === 'envelope' ? Math.max(weightKg, 1) : Math.max(weightKg, 0.001);
  const inputsReady =
    inputsHaveDestination &&
    Number.isFinite(quoteWeight) &&
    quoteWeight > 0 &&
    Boolean(value.packageType) &&
    Boolean(value.deliveryType);

  const rateParams = {
    packageType: value.packageType,
    weightKg: quoteWeight,
    volumeCbm,
    deliveryType: value.deliveryType,
    pickupType: 'hub' as const,
    governorate: destKey.governorate,
    city: destKey.city,
    neighborhood: destKey.neighborhood,
    codAmount,
    currency: value.currency,
  };
  const debouncedRates = useDebounced(rateParams, 600);
  const rateParamsKey = stableRateKey(rateParams);
  const debouncedRatesKey = stableRateKey(debouncedRates);
  const paramsPending = rateParamsKey !== debouncedRatesKey;

  const debouncedReady =
    Boolean(
      debouncedRates.governorate && debouncedRates.city && debouncedRates.neighborhood,
    ) &&
    Number.isFinite(debouncedRates.weightKg) &&
    debouncedRates.weightKg > 0 &&
    Boolean(debouncedRates.packageType) &&
    Boolean(debouncedRates.deliveryType);

  const ratesQuery = useQuery({
    queryKey: QK.shipping.rates(debouncedRates as unknown as Record<string, unknown>),
    queryFn: async ({ signal }) => {
      const requestId = quoteRequestIdRef.current;
      const result = await ShippingApi.quoteRates({
        packageType: debouncedRates.packageType,
        weightKg: debouncedRates.weightKg,
        deliveryType: debouncedRates.deliveryType,
        pickupType: 'hub',
        volumeCbm: debouncedRates.volumeCbm,
        governorate: debouncedRates.governorate,
        city: debouncedRates.city,
        neighborhood: debouncedRates.neighborhood,
        ...(debouncedRates.codAmount != null && Number.isFinite(debouncedRates.codAmount)
          ? { codAmount: debouncedRates.codAmount }
          : {}),
      });
      if (signal.aborted || requestId !== quoteRequestIdRef.current) {
        throw new DOMException('Quote request superseded', 'AbortError');
      }
      return result;
    },
    enabled: debouncedReady && !paramsPending,
    staleTime: 0,
    gcTime: 30_000,
    placeholderData: undefined,
    retry: (failureCount, error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      return failureCount < 1;
    },
  });

  // Invalidate in-flight quote results as soon as live form inputs change.
  useEffect(() => {
    quoteRequestIdRef.current += 1;
  }, [rateParamsKey]);

  const isRefreshingCarrierQuotes =
    !hideCarrierSelect &&
    inputsReady &&
    (paramsPending || ratesQuery.isFetching || ratesQuery.isPending);

  const quotes =
    isRefreshingCarrierQuotes || !ratesQuery.isSuccess ? [] : (ratesQuery.data?.quotes ?? []);
  const rateErrors =
    isRefreshingCarrierQuotes || !ratesQuery.isSuccess ? [] : (ratesQuery.data?.errors ?? []);

  const selectedAvailable = Boolean(
    value.shippingProviderCode &&
      quotes.some((q) => q.carrierId === value.shippingProviderCode),
  );

  useEffect(() => {
    onQuotesRefreshingChange?.(isRefreshingCarrierQuotes);
  }, [isRefreshingCarrierQuotes, onQuotesRefreshingChange]);

  useEffect(() => {
    onSelectedCarrierAvailableChange?.(selectedAvailable);
  }, [selectedAvailable, onSelectedCarrierAvailableChange]);

  useEffect(() => {
    if (readOnly || hideCarrierSelect) return;
    if (!value.shippingProviderCode) return;
    const stillConnected = connectedProviders.some((p) => p.code === value.shippingProviderCode);
    if (!stillConnected) {
      onChange(patch(value, { shippingProviderCode: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedProviders, value.shippingProviderCode, readOnly, hideCarrierSelect]);

  const handleSelectCarrier = (carrierId: string) => {
    if (isRefreshingCarrierQuotes) return;
    const nextCurrency = currencyAfterCarrierSelect(carrierId);
    onChange(
      patch(value, {
        shippingProviderCode: carrierId,
        currency: nextCurrency,
      }),
    );
  };

  let emptyHint: string | null = null;
  if (!isRefreshingCarrierQuotes) {
    if (!inputsHaveDestination) {
      emptyHint =
        'Complete Governorate, City/Region, and Town/Neighborhood to calculate carrier rates.';
    } else if (!(weightKg > 0) && value.packageType !== 'envelope') {
      emptyHint = 'Enter weight per part so rates can be calculated.';
    }
  }

  return (
    <div className="space-y-5">
      {showTitle ? (
        <div>
          <div className="text-sm font-semibold text-text-strong">Shipping Details</div>
          <p className="mt-1 text-xs text-text-muted">
            Prefilled from the OMS / outbound order. Edit before choosing a shipping company.
          </p>
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
          Shipping address
        </div>
        <CascadingAddressSelector
          value={{
            city: value.city,
            district: value.district,
            addressLine1: value.addressLine1,
          }}
          onChange={(next) =>
            onChange(
              patch(value, {
                city: next.city,
                district: next.district,
                addressLine1: next.addressLine1,
              }),
            )
          }
          disabled={readOnly}
          cityRequired
          districtRequired
          addressLine1Required
        />
        <TextField
          label="Street / Detailed Address"
          value={value.addressLine2}
          onChange={(e) => onChange(patch(value, { addressLine2: e.target.value }))}
          disabled={readOnly}
          placeholder="Street, building, floor…"
        />
      </section>

      <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
          Shipment information
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Shipment type</div>
          <PillToggle
            disabled={readOnly}
            value={value.packageType}
            onChange={(packageType) => onChange(patch(value, { packageType }))}
            options={[
              { value: 'box', label: 'Parcel (طرد)' },
              { value: 'envelope', label: 'Envelope (ظرف)' },
            ]}
          />
        </div>

        <div>
          <div className="text-xs font-medium text-text-muted">Total parts</div>
          <div className="mt-1 text-sm font-semibold tabular-nums text-text-strong">{partsCount}</div>
          <p className="mt-0.5 text-[11px] text-text-faint">
            Sum of line quantities (identical products share weight &amp; dimensions).
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
            Package details
          </div>
          {value.groups.length === 0 ? (
            <p className="text-sm text-text-muted">No line items on this order.</p>
          ) : (
            value.groups.map((g) => (
              <div
                key={g.productId}
                className="space-y-2 rounded-lg border border-border-subtle bg-surface-sunken/40 p-3"
              >
                <div className="text-sm font-semibold text-text-strong">
                  {g.productName}{' '}
                  <span className="font-normal text-text-muted">— {g.parts} parts</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <TextField
                    label="Weight / part (kg)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={g.weightKgPerPart}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange(
                        patch(value, {
                          groups: patchGroup(value.groups, g.productId, {
                            weightKgPerPart: e.target.value,
                          }),
                        }),
                      )
                    }
                  />
                  <TextField
                    label="Length (cm)"
                    type="number"
                    min={0}
                    step="0.1"
                    value={g.lengthCm}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange(
                        patch(value, {
                          groups: patchGroup(value.groups, g.productId, {
                            lengthCm: e.target.value,
                          }),
                        }),
                      )
                    }
                  />
                  <TextField
                    label="Width (cm)"
                    type="number"
                    min={0}
                    step="0.1"
                    value={g.widthCm}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange(
                        patch(value, {
                          groups: patchGroup(value.groups, g.productId, {
                            widthCm: e.target.value,
                          }),
                        }),
                      )
                    }
                  />
                  <TextField
                    label="Height (cm)"
                    type="number"
                    min={0}
                    step="0.1"
                    value={g.heightCm}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange(
                        patch(value, {
                          groups: patchGroup(value.groups, g.productId, {
                            heightCm: e.target.value,
                          }),
                        }),
                      )
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Currency</div>
          <PillToggle<ShippingCurrency>
            disabled={readOnly}
            value={value.currency}
            onChange={(currency) => onChange(patch(value, { currency }))}
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'SYP', label: 'ل.س' },
            ]}
          />
          <p className="mt-1 text-[11px] text-text-faint">
            Default USD. Selecting a SYP-only carrier switches currency automatically.
          </p>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Delivery type</div>
          <PillToggle
            disabled={readOnly}
            value={value.deliveryType}
            onChange={(deliveryType) => onChange(patch(value, { deliveryType }))}
            options={[
              {
                value: 'address',
                label: 'Home delivery',
                icon: 'fa-solid fa-house text-[10px]',
              },
              {
                value: 'hub',
                label: 'Branch delivery',
                icon: 'fa-solid fa-building text-[10px]',
              },
            ]}
          />
        </div>
      </section>

      {!hideCarrierSelect ? (
        <ShippingCarrierCards
          providers={listedProviders}
          quotes={quotes}
          errors={rateErrors}
          selectedCarrierId={value.shippingProviderCode}
          onSelect={handleSelectCarrier}
          loading={isRefreshingCarrierQuotes}
          disabled={readOnly || isRefreshingCarrierQuotes}
          emptyHint={emptyHint}
          providersLoading={providersQuery.isLoading}
          preferredCurrency={value.currency}
          getSupportedCurrencies={providerSupportedCurrencies}
        />
      ) : null}
    </div>
  );
}
