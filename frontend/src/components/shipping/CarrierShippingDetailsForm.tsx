import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { ShippingApi } from '../../api/shipping';
import { QK } from '../../constants/query-keys';
import { useDebounced } from '../../lib/useDebounced';
import { CascadingAddressSelector } from '../CascadingAddressSelector';
import { TextField } from '../TextField';
import {
  currencyAfterCarrierSelect,
  hasOverPacking,
  packingSummary,
  providerSupportedCurrencies,
  resizeCartons,
  toBabelPartsFromCartons,
  totalCartonsVolumeCbm,
  totalCartonsWeightKg,
  type CarrierShippingFormValue,
  type ShippingCurrency,
} from './carrier-shipping-form';
import { PackingSummaryPanel, ShippingCartonEditor } from './ShippingCartonEditor';
import { ShippingCarrierCards } from './ShippingCarrierCards';
import { ResolvedDeliveryLocationPreview } from './ResolvedDeliveryLocationPreview';

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

/** Wait for form edits to settle before address resolve + carrier quotes. */
const SHIPPING_QUOTE_DEBOUNCE_MS = 650;

type ShippingQuoteSnapshot = {
  governorate: string;
  city: string;
  neighborhood: string;
  packageType: CarrierShippingFormValue['packageType'];
  weightKg: number;
  volumeCbm: number;
  deliveryType: CarrierShippingFormValue['deliveryType'];
  pickupType: 'hub';
  currency: ShippingCurrency;
  codAmount: number | null;
  parts: Array<{ weight: number }>;
  packingInvalid: boolean;
};

type SettledQuoteRequest = ShippingQuoteSnapshot & {
  receiverLat: number;
  receiverLng: number;
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
 * Shipping Details for carrier flow: address + cartons + currency + delivery,
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
  const queryClient = useQueryClient();
  /** Monotonic id — late responses must not overwrite newer quote state. */
  const quoteGenerationRef = useRef(0);

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

  const partsCount = value.cartons.length;
  const weightKg =
    value.packageType === 'envelope' ? 1 : totalCartonsWeightKg(value.cartons, value.catalog);
  const volumeCbm =
    value.packageType === 'envelope' ? 0 : totalCartonsVolumeCbm(value.cartons);
  const packingRows = packingSummary(value.cartons, value.catalog);
  const packingInvalid = hasOverPacking(packingRows);
  const babelParts = toBabelPartsFromCartons(
    value.cartons,
    value.catalog,
    value.packageType,
  );
  const quoteWeight =
    value.packageType === 'envelope' ? Math.max(weightKg, 1) : Math.max(weightKg, 0.001);

  const liveSnapshot = useMemo<ShippingQuoteSnapshot>(
    () => ({
      governorate: value.city.trim(),
      city: value.district.trim(),
      neighborhood: value.addressLine1.trim(),
      packageType: value.packageType,
      weightKg: quoteWeight,
      volumeCbm,
      deliveryType: value.deliveryType,
      pickupType: 'hub',
      currency: value.currency,
      codAmount,
      parts: babelParts,
      packingInvalid,
    }),
    [
      value.city,
      value.district,
      value.addressLine1,
      value.packageType,
      value.deliveryType,
      value.currency,
      quoteWeight,
      volumeCbm,
      codAmount,
      babelParts,
      packingInvalid,
    ],
  );

  const debouncedSnapshot = useDebounced(liveSnapshot, SHIPPING_QUOTE_DEBOUNCE_MS);
  const liveSnapshotKey = stableRateKey(liveSnapshot as unknown as Record<string, unknown>);
  const debouncedSnapshotKey = stableRateKey(debouncedSnapshot as unknown as Record<string, unknown>);
  const snapshotPending = liveSnapshotKey !== debouncedSnapshotKey;

  const inputsHaveAddress = Boolean(liveSnapshot.governorate && liveSnapshot.city);

  const addressResolveQuery = useQuery({
    queryKey: QK.shipping.resolveAddress({
      governorate: debouncedSnapshot.governorate,
      city: debouncedSnapshot.city,
      neighborhood: debouncedSnapshot.neighborhood,
    }),
    queryFn: ({ signal }) =>
      ShippingApi.resolveAddressFromNames(
        {
          governorate: debouncedSnapshot.governorate,
          cityRegion: debouncedSnapshot.city,
          townNeighborhood: debouncedSnapshot.neighborhood,
        },
        signal,
      ),
    enabled:
      Boolean(debouncedSnapshot.governorate && debouncedSnapshot.city) && !snapshotPending,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const resolvedLocation = useMemo(() => {
    if (snapshotPending || addressResolveQuery.isFetching) return null;
    if (addressResolveQuery.data?.found !== true) return null;
    return addressResolveQuery.data;
  }, [snapshotPending, addressResolveQuery.isFetching, addressResolveQuery.data]);

  const isResolvingLocation =
    inputsHaveAddress && (snapshotPending || addressResolveQuery.isFetching);

  const locationResolveError =
    inputsHaveAddress &&
    !isResolvingLocation &&
    addressResolveQuery.isSuccess &&
    addressResolveQuery.data?.found === false
      ? addressResolveQuery.data.message
      : null;

  const settledQuoteRequest = useMemo<SettledQuoteRequest | null>(() => {
    if (snapshotPending || !resolvedLocation || debouncedSnapshot.packingInvalid) return null;
    if (
      !debouncedSnapshot.governorate ||
      !debouncedSnapshot.city ||
      !debouncedSnapshot.packageType ||
      !debouncedSnapshot.deliveryType ||
      !Number.isFinite(debouncedSnapshot.weightKg) ||
      debouncedSnapshot.weightKg <= 0
    ) {
      return null;
    }
    return {
      ...debouncedSnapshot,
      receiverLat: resolvedLocation.lat,
      receiverLng: resolvedLocation.lng,
    };
  }, [snapshotPending, resolvedLocation, debouncedSnapshot]);

  const settledQuoteKey = settledQuoteRequest
    ? stableRateKey(settledQuoteRequest as unknown as Record<string, unknown>)
    : null;

  useEffect(() => {
    if (!settledQuoteKey) return;
    quoteGenerationRef.current += 1;
    void queryClient.cancelQueries({ queryKey: ['shipping', 'rates'] });
  }, [settledQuoteKey, queryClient]);

  const ratesQuery = useQuery({
    queryKey: settledQuoteRequest
      ? QK.shipping.rates(settledQuoteRequest as unknown as Record<string, unknown>)
      : ['shipping', 'rates', 'idle'],
    queryFn: async ({ signal }) => {
      if (!settledQuoteRequest) {
        throw new DOMException('Quote inputs not ready', 'AbortError');
      }
      const generation = quoteGenerationRef.current;
      const result = await ShippingApi.quoteRates(
        {
          packageType: settledQuoteRequest.packageType,
          weightKg: settledQuoteRequest.weightKg,
          deliveryType: settledQuoteRequest.deliveryType,
          pickupType: settledQuoteRequest.pickupType,
          volumeCbm: settledQuoteRequest.volumeCbm,
          governorate: settledQuoteRequest.governorate,
          city: settledQuoteRequest.city,
          neighborhood: settledQuoteRequest.neighborhood,
          receiverLat: settledQuoteRequest.receiverLat,
          receiverLng: settledQuoteRequest.receiverLng,
          parts: settledQuoteRequest.parts,
          ...(settledQuoteRequest.codAmount != null &&
          Number.isFinite(settledQuoteRequest.codAmount)
            ? { codAmount: settledQuoteRequest.codAmount }
            : {}),
        },
        signal,
      );
      if (signal.aborted || generation !== quoteGenerationRef.current) {
        throw new DOMException('Quote request superseded', 'AbortError');
      }
      return result;
    },
    enabled: Boolean(settledQuoteRequest) && !hideCarrierSelect,
    staleTime: 0,
    gcTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      return failureCount < 1;
    },
  });

  const inputsReady =
    inputsHaveAddress &&
    Boolean(settledQuoteRequest) &&
    Number.isFinite(quoteWeight) &&
    quoteWeight > 0 &&
    Boolean(value.packageType) &&
    Boolean(value.deliveryType) &&
    !packingInvalid;

  const isRefreshingCarrierQuotes =
    !hideCarrierSelect &&
    inputsHaveAddress &&
    (snapshotPending ||
      isResolvingLocation ||
      (inputsReady && (ratesQuery.isFetching || ratesQuery.isPending)));

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
    if (!inputsHaveAddress) {
      emptyHint = 'Complete Governorate and City/Region to calculate carrier rates.';
    } else if (packingInvalid) {
      emptyHint = 'Fix over-packed quantities before requesting carrier rates.';
    } else if (!resolvedLocation) {
      emptyHint = 'Resolving delivery pin from address…';
    } else if (!(weightKg > 0) && value.packageType !== 'envelope') {
      emptyHint = 'Assign products to packages so total weight can be calculated.';
    }
  }

  const mapLat = resolvedLocation?.lat ?? null;
  const mapLng = resolvedLocation?.lng ?? null;

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

      <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
          Delivery location
        </div>
        <ResolvedDeliveryLocationPreview
          lat={mapLat}
          lng={mapLng}
          loading={isResolvingLocation}
          error={locationResolveError}
          resolveSource={resolvedLocation?.source ?? null}
          resolvedLabel={resolvedLocation?.resolvedLabel ?? ''}
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

        {value.packageType === 'box' ? (
          <>
            <TextField
              label="Number of packages"
              type="number"
              min={1}
              max={50}
              step={1}
              value={value.packageCount}
              disabled={readOnly}
              onChange={(e) => {
                const n = Math.max(1, Math.min(50, Math.floor(Number(e.target.value)) || 1));
                onChange(
                  patch(value, {
                    packageCount: String(n),
                    cartons: resizeCartons(value.cartons, n, value.catalog),
                  }),
                );
              }}
            />
            <p className="text-[11px] text-text-faint">
              Physical cartons the carrier will receive (not product quantity).
            </p>

            <PackingSummaryPanel rows={packingRows} />

            <ShippingCartonEditor
              cartons={value.cartons}
              catalog={value.catalog}
              readOnly={readOnly}
              onChange={(cartons) => onChange(patch(value, { cartons }))}
            />

            <div>
              <div className="text-xs font-medium text-text-muted">Total shipment weight</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-text-strong">
                {weightKg} kg
              </div>
              <p className="mt-0.5 text-[11px] text-text-faint">
                Sum of calculated carton weights ({partsCount} package{partsCount === 1 ? '' : 's'}).
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            Envelope shipments use a single 1 kg part; package breakdown is not required.
          </p>
        )}

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
