import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ShippingApi } from '../../api/shipping';
import {
  mapPayerForCarrier,
  resolvePaymentModeFromPayer,
  type ShippingPaymentMode,
} from '../../lib/shipping-payer';
import { QK } from '../../constants/query-keys';
import {
  applyQuoteCurrency,
  buildClientDestinationKey,
  createClientQuoteFingerprint,
  isClientHubQuoteStale,
  type RateCurrencyFilter,
} from '../../lib/shipping-compare';
import { useDebounced } from '../../lib/useDebounced';
import { CascadingAddressSelector } from '../CascadingAddressSelector';
import { TextField } from '../TextField';
import {
  getBabelPackingValidationError,
  hasOverPacking,
  isBabelProvider,
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
  isArabic?: boolean;
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
  pickupType: 'address';
  currency: ShippingCurrency;
  codAmount: number | null;
  parts: Array<{ weight: number }>;
  packingInvalid: boolean;
  hubId: string;
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
  isArabic: isArabicProp,
  onQuotesRefreshingChange,
  onSelectedCarrierAvailableChange,
}: Props) {
  const isArabic = isArabicProp ?? (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');
  const qc = useQueryClient();
  const readOnly = locked || disabled;
  const [rateCurrency, setRateCurrency] = useState<RateCurrencyFilter>('all');
  /** Monotonic id — late responses from superseded requests are discarded. */
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

  const isBabel = isBabelProvider(value.shippingProviderCode);
  const partsCount = value.cartons.length;
  const weightKg =
    value.packageType === 'envelope' ? 1 : totalCartonsWeightKg(value.cartons, value.catalog);
  const volumeCbm =
    value.packageType === 'envelope' ? 0 : totalCartonsVolumeCbm(value.cartons);
  const packingRows = packingSummary(value.cartons, value.catalog);
  const babelValidationError = useMemo(
    () => (isBabel && value.packageType === 'box' ? getBabelPackingValidationError(value.cartons, value.catalog, false) : null),
    [isBabel, value.packageType, value.cartons, value.catalog],
  );
  const packingInvalid = hasOverPacking(packingRows) || Boolean(babelValidationError);
  const babelParts = toBabelPartsFromCartons(
    value.cartons,
    value.catalog,
    value.packageType,
  );
  const quoteWeight =
    value.packageType === 'envelope' ? Math.max(weightKg, 1) : Math.max(weightKg, 0.001);

  const liveAddressSnapshot = useMemo(
    () => ({
      governorate: value.city.trim(),
      city: value.district.trim(),
      neighborhood: value.addressLine1.trim(),
    }),
    [value.city, value.district, value.addressLine1],
  );

  const debouncedAddress = useDebounced(liveAddressSnapshot, SHIPPING_QUOTE_DEBOUNCE_MS);
  const addressPending =
    liveAddressSnapshot.governorate !== debouncedAddress.governorate ||
    liveAddressSnapshot.city !== debouncedAddress.city ||
    liveAddressSnapshot.neighborhood !== debouncedAddress.neighborhood;

  const inputsHaveAddress = Boolean(liveAddressSnapshot.governorate && liveAddressSnapshot.city);

  const addressResolveQuery = useQuery({
    queryKey: QK.shipping.resolveAddress({
      governorate: debouncedAddress.governorate,
      city: debouncedAddress.city,
      neighborhood: debouncedAddress.neighborhood,
    }),
    queryFn: ({ signal }) =>
      ShippingApi.resolveAddressFromNames(
        {
          governorate: debouncedAddress.governorate,
          cityRegion: debouncedAddress.city,
          townNeighborhood: debouncedAddress.neighborhood,
        },
        signal,
      ),
    enabled:
      Boolean(debouncedAddress.governorate && debouncedAddress.city) && !addressPending,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const resolvedLocation = useMemo(() => {
    if (addressPending || addressResolveQuery.isFetching) return null;
    if (addressResolveQuery.data?.found !== true) return null;
    return addressResolveQuery.data;
  }, [addressPending, addressResolveQuery.isFetching, addressResolveQuery.data]);

  const isResolvingLocation =
    inputsHaveAddress && (addressPending || addressResolveQuery.isFetching);

  const locationResolveError =
    inputsHaveAddress &&
    !isResolvingLocation &&
    addressResolveQuery.isSuccess &&
    addressResolveQuery.data?.found === false
      ? addressResolveQuery.data.message
      : null;

  const settledQuoteRequest = useMemo<SettledQuoteRequest | null>(() => {
    if (addressPending || !resolvedLocation || packingInvalid) return null;
    if (
      !debouncedAddress.governorate ||
      !debouncedAddress.city ||
      !value.packageType ||
      !value.deliveryType ||
      !Number.isFinite(quoteWeight) ||
      quoteWeight <= 0
    ) {
      return null;
    }
    return {
      governorate: debouncedAddress.governorate,
      city: debouncedAddress.city,
      neighborhood: debouncedAddress.neighborhood,
      packageType: value.packageType,
      weightKg: quoteWeight,
      volumeCbm,
      deliveryType: value.deliveryType,
      pickupType: 'address',
      currency: value.collectionCurrency || value.currency,
      codAmount,
      parts: babelParts,
      packingInvalid,
      hubId: value.deliveryType === 'hub' ? value.shippingHubId.trim() : '',
      receiverLat: resolvedLocation.lat,
      receiverLng: resolvedLocation.lng,
    };
  }, [
    addressPending,
    resolvedLocation,
    packingInvalid,
    debouncedAddress,
    value.packageType,
    value.deliveryType,
    value.shippingHubId,
    value.currency,
    value.collectionCurrency,
    quoteWeight,
    volumeCbm,
    codAmount,
    babelParts,
  ]);

  const settledQuoteKey = settledQuoteRequest
    ? stableRateKey(settledQuoteRequest as unknown as Record<string, unknown>)
    : null;

  // Increment the generation counter whenever the settled quote request changes.
  // The queryFn checks this to discard superseded responses without cancelling the query.
  useEffect(() => {
    if (!settledQuoteKey) return;
    quoteGenerationRef.current += 1;
  }, [settledQuoteKey]);

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
            ? {
                codAmount: settledQuoteRequest.codAmount,
                // Collection currency decides which carriers can actually take this COD.
                currency: settledQuoteRequest.currency,
                collectionMode: 'explicit' as const,
              }
            : {}),
          ...(settledQuoteRequest.hubId ? { hubId: settledQuoteRequest.hubId } : {}),
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
    (addressPending ||
      isResolvingLocation ||
      (inputsReady && (ratesQuery.isFetching || ratesQuery.isPending)));

  const quotes = applyQuoteCurrency(
    isRefreshingCarrierQuotes || !ratesQuery.isSuccess ? [] : (ratesQuery.data?.quotes ?? []),
    rateCurrency,
  );
  const rateErrors =
    isRefreshingCarrierQuotes || !ratesQuery.isSuccess ? [] : (ratesQuery.data?.errors ?? []);

  const selectedQuote =
    quotes.find((q) => q.serviceId === value.shippingServiceId) ??
    quotes.find((q) => q.carrierId === value.shippingProviderCode);
  const hubRequired =
    selectedQuote?.deliveryType === 'hub' && (selectedQuote.hubs?.length ?? 0) > 0;
  const hubReady = !hubRequired || Boolean(value.shippingHubId.trim());

  const hubQuoteStale = isClientHubQuoteStale({
    deliveryType: value.deliveryType,
    selectedHubId: value.shippingHubId,
    fingerprintHubId: value.quoteFingerprint?.hubId,
  });

  const selectedAvailable = Boolean(
    value.shippingProviderCode &&
      quotes.some((q) => q.carrierId === value.shippingProviderCode) &&
      hubReady &&
      !hubQuoteStale &&
      !ratesQuery.isError,
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

  useEffect(() => {
    if (isRefreshingCarrierQuotes || !selectedQuote) return;
    const fp = createClientQuoteFingerprint({
      providerCode: selectedQuote.carrierId,
      serviceId: selectedQuote.serviceId,
      currency: selectedQuote.currency,
      amount: selectedQuote.price,
      deliveryType: selectedQuote.deliveryType || value.deliveryType,
      packageType: value.packageType,
      weightKg: quoteWeight,
      destinationKey: buildClientDestinationKey({
        governorate: value.city,
        city: value.district,
        neighborhood: value.addressLine1,
      }),
      partsKey: babelParts.map((p) => String(p.weight)).join(','),
      hubId: value.deliveryType === 'hub' ? value.shippingHubId : '',
    });
    const prev = value.quoteFingerprint;
    if (
      prev &&
      prev.serviceId === fp.serviceId &&
      prev.amount === fp.amount &&
      prev.currency === fp.currency &&
      (prev.hubId || '') === (fp.hubId || '') &&
      prev.deliveryType === fp.deliveryType
    ) {
      return;
    }
    onChange(patch(value, { quoteFingerprint: fp }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRefreshingCarrierQuotes,
    selectedQuote,
    value.shippingHubId,
    value.deliveryType,
    quoteWeight,
  ]);

  useEffect(() => {
    if (readOnly || hideCarrierSelect) return;
    if (value.deliveryType !== 'hub' || value.shippingHubId.trim()) return;
    const quote =
      quotes.find((q) => q.serviceId === value.shippingServiceId) ??
      quotes.find((q) => q.carrierId === value.shippingProviderCode);
    if (quote?.nearestHubDetermined && quote.nearestHubId) {
      onChange(patch(value, { shippingHubId: quote.nearestHubId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, value.shippingServiceId, value.deliveryType, value.shippingHubId, readOnly, hideCarrierSelect]);

  const handleSelectCarrier = (carrierId: string, serviceId?: string) => {
    if (isRefreshingCarrierQuotes) return;
    const quote = quotes.find((q) => q.serviceId === serviceId);
    const nextHub =
      quote?.deliveryType === 'hub'
        ? value.shippingHubId || quote.nearestHubId || ''
        : '';
    const currentMode = resolvePaymentModeFromPayer(value.shippingPayer);
    const nextPayer = carrierId ? mapPayerForCarrier(currentMode, carrierId) : value.shippingPayer;
    onChange(
      patch(value, {
        shippingProviderCode: carrierId,
        shippingServiceId: serviceId ?? '',
        shippingHubId: nextHub,
        shippingPayer: nextPayer,
        ...(quote?.deliveryType === 'hub' && nextHub !== (value.quoteFingerprint?.hubId || '')
          ? { quoteFingerprint: null }
          : {}),
      }),
    );
  };

  const handleSelectHub = (carrierId: string, serviceId: string, hubId: string) => {
    if (isRefreshingCarrierQuotes) return;
    const currentMode = resolvePaymentModeFromPayer(value.shippingPayer);
    const nextPayer = carrierId ? mapPayerForCarrier(currentMode, carrierId) : value.shippingPayer;
    onChange(
      patch(value, {
        shippingProviderCode: carrierId,
        shippingServiceId: serviceId,
        shippingHubId: hubId,
        shippingPayer: nextPayer,
        quoteFingerprint: null,
      }),
    );
    qc.invalidateQueries({ queryKey: ['shipping', 'rates'] });
  };

  const handleRefreshHubQuote = () => {
    qc.invalidateQueries({ queryKey: ['shipping', 'rates'] });
    void ratesQuery.refetch();
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
    } else if (ratesQuery.isError) {
      emptyHint =
        ratesQuery.error instanceof Error
          ? ratesQuery.error.message
          : 'Carrier quote failed. Confirm the destination and retry before sending.';
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
        <div>
          <TextField
            label="Street / Detailed Address *"
            value={value.addressLine2}
            onChange={(e) => onChange(patch(value, { addressLine2: e.target.value }))}
            disabled={readOnly}
            placeholder="Street, building, floor (more than 10 characters)…"
            required
          />
          <p className="mt-1 text-xs text-text-muted">
            Must be more than 10 characters / يجب أن يكون العنوان أكثر من 10 أحرف
          </p>
        </div>
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
            {isBabel ? (
              <div className="rounded-xl border border-sky-300 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-100">
                  <i className="fa-solid fa-boxes-stacked text-sky-600" />
                  <span>توزيع الطرود لشحنة بابل إكسبريس (Babel Multi-Package Breakdown)</span>
                </div>
                <p className="text-xs text-sky-800/90 dark:text-sky-200/90">
                  شركة بابل تدعم تقسيم الطلب على عدة طرود وتصدر بوليصة شحن وباركود منفصل لكل طرد. يرجى تحديد عدد الطرود وتوزيع كميات المنتجات عليها بالكامل.
                </p>
                {babelValidationError ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 p-2 rounded-lg border border-amber-500/30">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600" />
                    <span>{babelValidationError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 p-2 rounded-lg border border-emerald-500/30">
                    <i className="fa-solid fa-circle-check text-emerald-600" />
                    <span>تم توزيع كافة المنتجات على {partsCount} طرد بنجاح.</span>
                  </div>
                )}
              </div>
            ) : null}

            <TextField
              label="Number of packages / عدد الطرود"
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
          <div className="mb-1.5 text-xs font-medium text-text-muted">
            COD currency / عملة التحصيل
          </div>
          <PillToggle<ShippingCurrency>
            disabled={readOnly}
            value={value.collectionCurrency || value.currency}
            onChange={(collectionCurrency) => onChange(patch(value, { collectionCurrency }))}
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'SYP', label: 'ل.س' },
            ]}
          />
          <p className="mt-1 text-[11px] text-text-faint">
            Collection currency for the carrier. Changing it converts the amount with the USD/SYP rate and leaves the original order value unchanged.
          </p>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Delivery type</div>
          <PillToggle
            disabled={readOnly}
            value={value.deliveryType}
            onChange={(deliveryType) =>
              onChange(
                patch(value, {
                  deliveryType,
                  shippingHubId: deliveryType === 'hub' ? value.shippingHubId : '',
                }),
              )
            }
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

        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">
            {isArabic ? 'دافع أجور الشحن' : 'Shipping Payer'}
          </div>
          <PillToggle<ShippingPaymentMode>
            disabled={readOnly}
            value={resolvePaymentModeFromPayer(value.shippingPayer)}
            onChange={(mode) => {
              const carrier = value.shippingProviderCode.trim();
              const nextPayer = carrier
                ? mapPayerForCarrier(mode, carrier)
                : mode === 'RECIPIENT_PAYS'
                  ? 'receiver'
                  : 'sender';
              onChange(patch(value, { shippingPayer: nextPayer }));
            }}
            options={[
              {
                value: 'EMDAD_PAYS',
                label: isArabic ? 'إمداد تتحمل تكلفة الشحن (افتراضي)' : 'Emdad Pays (Default)',
              },
              {
                value: 'RECIPIENT_PAYS',
                label: isArabic ? 'المستلم يتحمل تكلفة الشحن' : 'Recipient Pays',
              },
            ]}
          />
          <p className="mt-1 text-[11px] text-text-faint">
            {isArabic
              ? 'إمداد تسدد أجور الشحن لشركة النقل وتفوتر المتجر؛ لا يُطلب من المستلم دفع أجور شحن.'
              : 'Emdad settles shipping charges with the carrier; client is billed separately; recipient pays 0 shipping.'}
          </p>
        </div>
      </section>

      {!hideCarrierSelect ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Rate currency / عملة السعر</span>
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'USD', label: 'USD' },
                { value: 'SYP', label: 'ل.س' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={readOnly}
                onClick={() => setRateCurrency(opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  rateCurrency === opt.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-border-subtle text-text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

        {hubQuoteStale ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <i className={`fa-solid fa-arrows-rotate text-amber-600 dark:text-amber-400 ${ratesQuery.isFetching ? 'fa-spin' : ''}`} />
              <span>
                {isArabic
                  ? 'تم تغيير فرع التسليم — يرجى تحديث سعر الشحن وتأكيده قبل إرسال الشحنة.'
                  : 'Delivery hub selection changed. Refresh the quote and confirm the new rate before sending.'}
              </span>
            </div>
            <button
              type="button"
              disabled={ratesQuery.isFetching}
              onClick={handleRefreshHubQuote}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <i className={`fa-solid fa-rotate text-[11px] ${ratesQuery.isFetching ? 'fa-spin' : ''}`} />
              <span>{isArabic ? 'تحديث وتأكيد السعر' : 'Refresh & Confirm Rate'}</span>
            </button>
          </div>
        ) : null}

        <ShippingCarrierCards
          providers={listedProviders}
          quotes={quotes}
          errors={rateErrors}
          selectedCarrierId={value.shippingProviderCode}
          selectedServiceId={value.shippingServiceId}
          selectedHubId={value.shippingHubId}
          onSelect={handleSelectCarrier}
          onSelectHub={handleSelectHub}
          loading={isRefreshingCarrierQuotes}
          disabled={readOnly || isRefreshingCarrierQuotes}
          emptyHint={emptyHint}
          providersLoading={providersQuery.isLoading}
          preferredCurrency={value.currency}
          getSupportedCurrencies={providerSupportedCurrencies}
        />
        </div>
      ) : null}
    </div>
  );
}
