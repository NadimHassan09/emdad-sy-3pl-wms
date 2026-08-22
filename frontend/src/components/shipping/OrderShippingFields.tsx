import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ShippingApi,
  type OrderShippingFieldsValue,
  type ShippingDestinationArea,
} from '../../api/shipping';
import { QK } from '../../constants/query-keys';
import { pointInGeoJson } from '../../lib/geo-polygon';
import { useDebounced } from '../../lib/useDebounced';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import { ShippingCarrierCards } from './ShippingCarrierCards';


type Props = {
  value: OrderShippingFieldsValue;
  onChange: (next: OrderShippingFieldsValue) => void;
  /** When true, all fields are read-only. */
  locked?: boolean;
  /** Lock method/provider only (details remain editable). */
  lockIntent?: boolean;
  /** Override lock explanation (defaults to ready-to-ship lock message). */
  lockMessage?: string;
  /** Hide the inner "Shipping" title when the parent section already has a heading. */
  showTitle?: boolean;
  /** Prefill weight when carrier is selected (sum of product.weightKg × qty). */
  suggestedWeightKg?: number | null;
  /** Prefill volume when carrier is selected (sum of product.volumeCbm × qty). */
  suggestedVolumeCbm?: number | null;
  disabled?: boolean;
  /** Governorate / city / neighborhood used for map bounds and rate quotes. */
  destination?: ShippingDestinationArea;
  /** COD amount forwarded to adapters that price COD. */
  codAmount?: number | null;
};

function patch(
  value: OrderShippingFieldsValue,
  partial: Partial<OrderShippingFieldsValue>,
): OrderShippingFieldsValue {
  return { ...value, ...partial };
}

function sourceBadge(
  currentRaw: string,
  suggested: number | null | undefined,
): 'Calculated' | 'Edited' | null {
  if (suggested == null) return null;
  const current = currentRaw.trim();
  if (current === '') return 'Calculated';
  const n = Number(current);
  if (!Number.isFinite(n)) return 'Edited';
  return Math.abs(n - suggested) < 1e-9 ? 'Calculated' : 'Edited';
}

function parseCoord(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatAreaLabel(dest?: ShippingDestinationArea): string {
  return [dest?.governorate, dest?.city, dest?.neighborhood].filter(Boolean).join(' / ');
}

export function OrderShippingFields({
  value,
  onChange,
  locked = false,
  lockIntent = false,
  lockMessage,
  showTitle = true,
  suggestedWeightKg = null,
  suggestedVolumeCbm = null,
  disabled = false,
  destination,
  codAmount = null,
}: Props) {
  const readOnly = locked || disabled;
  const intentReadOnly = readOnly || lockIntent;
  const lastSuggestedWeightRef = useRef<number | null>(null);
  const lastSuggestedVolumeRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (value.shippingMethod !== 'carrier') return;
    if (suggestedWeightKg == null) return;
    const prev = lastSuggestedWeightRef.current;
    lastSuggestedWeightRef.current = suggestedWeightKg;
    const current = value.shippingWeightKg.trim();
    const matchesPrev =
      prev != null && current !== '' && Number(current) === prev;
    if (current === '' || matchesPrev) {
      onChange(patch(value, { shippingWeightKg: String(suggestedWeightKg) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when suggestion / method changes
  }, [suggestedWeightKg, value.shippingMethod]);

  useEffect(() => {
    if (value.shippingMethod !== 'carrier') return;
    if (suggestedVolumeCbm == null) return;
    const prev = lastSuggestedVolumeRef.current;
    lastSuggestedVolumeRef.current = suggestedVolumeCbm;
    const current = value.shippingVolumeCbm.trim();
    const matchesPrev =
      prev != null && current !== '' && Number(current) === prev;
    if (current === '' || matchesPrev) {
      onChange(patch(value, { shippingVolumeCbm: String(suggestedVolumeCbm) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when suggestion / method changes
  }, [suggestedVolumeCbm, value.shippingMethod]);

  const carrier = value.shippingMethod === 'carrier';
  const weightSource = sourceBadge(value.shippingWeightKg, suggestedWeightKg);
  const volumeSource = sourceBadge(value.shippingVolumeCbm, suggestedVolumeCbm);
  const [weightEditable, setWeightEditable] = useState(false);
  const [volumeEditable, setVolumeEditable] = useState(false);
  const [contentsEditable, setContentsEditable] = useState(false);

  const destKey = {
    governorate: destination?.governorate?.trim() || '',
    city: destination?.city?.trim() || '',
    neighborhood: destination?.neighborhood?.trim() || '',
  };
  const debouncedDest = useDebounced(destKey, 400);
  const hasDestination = Boolean(debouncedDest.governorate && debouncedDest.city);

  const boundaryQuery = useQuery({
    queryKey: QK.shipping.boundary(
      debouncedDest.governorate,
      debouncedDest.city,
      debouncedDest.neighborhood,
    ),
    queryFn: () => ShippingApi.getAreaBoundary(debouncedDest),
    enabled: carrier && hasDestination,
    staleTime: 60 * 60_000,
  });

  const geometry = boundaryQuery.data?.geometry ?? null;
  const boundaryMissing =
    hasDestination && boundaryQuery.isFetched && !geometry;

  useEffect(() => {
    if (!carrier || !geometry) return;
    const lat = parseCoord(value.shippingReceiverLat);
    const lng = parseCoord(value.shippingReceiverLng);
    if (lat == null || lng == null) return;
    if (pointInGeoJson(geometry, { lat, lng })) return;
    onChange(patch(value, { shippingReceiverLat: '', shippingReceiverLng: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear pin only when area/geometry changes
  }, [carrier, geometry, debouncedDest.governorate, debouncedDest.city, debouncedDest.neighborhood]);

  const latN = parseCoord(value.shippingReceiverLat);
  const lngN = parseCoord(value.shippingReceiverLng);
  const weightN = Number(value.shippingWeightKg);
  const volumeN = Number(value.shippingVolumeCbm);
  const hasPin = latN != null && lngN != null;
  const hasWeight = value.shippingWeightKg.trim() !== '' && Number.isFinite(weightN) && weightN > 0;
  const hasVolume =
    value.shippingVolumeCbm.trim() !== '' && Number.isFinite(volumeN) && volumeN >= 0;
  const hasPackage = Boolean(value.shippingPackageType);
  const hasDelivery = Boolean(value.shippingDeliveryType);
  const hasBabelHood = parseCoord(value.babelNeighbourhoodId) != null;
  const ratesReady =
    carrier &&
    (hasPin || hasBabelHood) &&
    hasWeight &&
    hasVolume &&
    hasPackage &&
    hasDelivery;

  const rateParams = {
    receiverLat: latN,
    receiverLng: lngN,
    neighbourhoodId: parseCoord(value.babelNeighbourhoodId),
    packageType: value.shippingPackageType,
    weightKg: weightN,
    volumeCbm: volumeN,
    deliveryType: value.shippingDeliveryType,
    pickupType: value.shippingPickupType || 'hub',
    governorate: destKey.governorate,
    city: destKey.city,
    neighborhood: destKey.neighborhood,
    codAmount,
  };
  const debouncedRates = useDebounced(rateParams, 600);

  const ratesQuery = useQuery({
    queryKey: QK.shipping.rates(debouncedRates as unknown as Record<string, unknown>),
    queryFn: () =>
      ShippingApi.quoteRates({
        ...(debouncedRates.receiverLat != null
          ? { receiverLat: debouncedRates.receiverLat as number }
          : {}),
        ...(debouncedRates.receiverLng != null
          ? { receiverLng: debouncedRates.receiverLng as number }
          : {}),
        ...(debouncedRates.neighbourhoodId != null
          ? { neighbourhoodId: debouncedRates.neighbourhoodId as number }
          : {}),
        packageType: debouncedRates.packageType as 'box' | 'envelope',
        weightKg: debouncedRates.weightKg,
        deliveryType: debouncedRates.deliveryType as 'address' | 'hub',
        ...(debouncedRates.pickupType
          ? { pickupType: debouncedRates.pickupType as 'address' | 'hub' }
          : {}),
        ...(Number.isFinite(debouncedRates.volumeCbm)
          ? { volumeCbm: debouncedRates.volumeCbm }
          : {}),
        ...(debouncedRates.governorate ? { governorate: debouncedRates.governorate } : {}),
        ...(debouncedRates.city ? { city: debouncedRates.city } : {}),
        ...(debouncedRates.neighborhood
          ? { neighborhood: debouncedRates.neighborhood }
          : {}),
        ...(debouncedRates.codAmount != null && Number.isFinite(debouncedRates.codAmount)
          ? { codAmount: debouncedRates.codAmount }
          : {}),
      }),
    enabled: Boolean(
      ratesReady &&
        (debouncedRates.neighbourhoodId != null ||
          (debouncedRates.receiverLat != null && debouncedRates.receiverLng != null)) &&
        debouncedRates.packageType &&
        debouncedRates.deliveryType,
    ),
    staleTime: 30_000,
  });

  const quotes = ratesQuery.data?.quotes ?? [];
  const rateErrors = ratesQuery.data?.errors ?? [];

  // Clear selection only if the selected provider is no longer connected/enabled.
  useEffect(() => {
    if (!carrier || lockIntent || intentReadOnly) return;
    if (!value.shippingProviderCode) return;
    const stillConnected = connectedProviders.some((p) => p.code === value.shippingProviderCode);
    if (!stillConnected) {
      onChange(patch(value, { shippingProviderCode: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier, connectedProviders, value.shippingProviderCode]);

  // When Babel only serves a pin via hub delivery, align delivery type so Save/Send match the quote.
  useEffect(() => {
    if (!carrier || readOnly || ratesQuery.isFetching || !ratesQuery.isFetched) return;
    const hubQuote = quotes.find((q) => q.deliveryType === 'hub');
    if (hubQuote && value.shippingDeliveryType === 'address') {
      onChange(patch(value, { shippingDeliveryType: 'hub' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier, quotes, ratesQuery.isFetching, ratesQuery.isFetched, value.shippingDeliveryType]);

  let emptyHint: string | null = null;
  if (carrier && !ratesQuery.isFetching) {
    if (!hasDestination) {
      emptyHint = 'Select a receiver location — carriers stay listed while you complete shipping details.';
    } else if (!hasPin) {
      emptyHint = 'Place or enter map coordinates to calculate rates. Carriers remain listed below.';
    } else if (!hasWeight) {
      emptyHint = 'Enter the shipment weight to calculate shipping rates.';
    } else if (!hasPackage) {
      emptyHint = 'Select a package type to calculate shipping rates.';
    } else if (!hasVolume) {
      emptyHint = 'Enter the shipment volume to calculate shipping rates.';
    } else if (!hasDelivery) {
      emptyHint = 'Select a delivery type to calculate shipping rates.';
    }
  }

  const areaLabel = formatAreaLabel(destination);

  return (
    <div className="space-y-3">
      {showTitle ? (
        <div className="text-sm font-medium text-text-strong">Shipping</div>
      ) : null}
      {locked ? (
        <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-body">
          {lockMessage ??
            'Shipping settings are locked after the order reaches ready to ship.'}
        </p>
      ) : null}

      <SelectField
        label="Shipping method"
        value={value.shippingMethod}
        disabled={intentReadOnly}
        onChange={(e) =>
          onChange(
            patch(value, {
              shippingMethod: e.target.value === 'carrier' ? 'carrier' : 'manual',
              shippingProviderCode: e.target.value === 'carrier' ? value.shippingProviderCode : '',
            }),
          )
        }
        options={[
          { value: 'manual', label: 'Manual' },
          { value: 'carrier', label: 'Shipping Company' },
        ]}
      />

      {carrier ? (
        <>
          {value.shippingReceiverLat && value.shippingReceiverLng ? (
            <div className="rounded-lg border border-border bg-surface-card-muted px-3 py-2 text-sm">
              <div className="text-xs font-semibold uppercase text-text-muted">Delivery Location</div>
              <div className="mt-1 text-text-body">
                Lat: {value.shippingReceiverLat} · Lng: {value.shippingReceiverLng}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg">
              Delivery coordinates not set. Edit the order address to place a delivery pin.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Package type"
              value={value.shippingPackageType}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  patch(value, {
                    shippingPackageType: e.target.value as OrderShippingFieldsValue['shippingPackageType'],
                  }),
                )
              }
              options={[
                { value: '', label: '—' },
                { value: 'box', label: 'Box' },
                { value: 'envelope', label: 'Envelope' },
              ]}
            />
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-text-body">Weight (kg)</label>
                {!readOnly && !weightEditable ? (
                  <button
                    type="button"
                    onClick={() => setWeightEditable(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                    title="Edit weight"
                  >
                    <i className="fa-solid fa-pencil text-[10px]" aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
              </div>
              <TextField
                value={value.shippingWeightKg}
                disabled={readOnly || !weightEditable}
                onChange={(e) =>
                  onChange(patch(value, { shippingWeightKg: e.target.value }))
                }
                placeholder={
                  suggestedWeightKg != null ? String(suggestedWeightKg) : 'e.g. 1.5'
                }
                hint={
                  weightSource
                    ? `${weightSource} from product unit weight × quantity.`
                    : 'Actual package weight in kilograms.'
                }
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-text-body">Volume (m³)</label>
                {!readOnly && !volumeEditable ? (
                  <button
                    type="button"
                    onClick={() => setVolumeEditable(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                    title="Edit volume"
                  >
                    <i className="fa-solid fa-pencil text-[10px]" aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
              </div>
              <TextField
                value={value.shippingVolumeCbm}
                disabled={readOnly || !volumeEditable}
                onChange={(e) =>
                  onChange(patch(value, { shippingVolumeCbm: e.target.value }))
                }
                placeholder={
                  suggestedVolumeCbm != null ? String(suggestedVolumeCbm) : 'e.g. 0.05'
                }
                hint={
                  volumeSource
                    ? `${volumeSource} from product unit volume × quantity.`
                    : 'Actual packed shipment volume (optional override).'
                }
              />
            </div>
            <SelectField
              label="Delivery type"
              value={value.shippingDeliveryType}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  patch(value, {
                    shippingDeliveryType: e.target.value as OrderShippingFieldsValue['shippingDeliveryType'],
                  }),
                )
              }
              options={[
                { value: '', label: '—' },
                { value: 'address', label: 'Address (door delivery)' },
                { value: 'hub', label: 'Hub (customer collects)' },
              ]}
            />
            <SelectField
              label="Pickup type"
              value={value.shippingPickupType}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  patch(value, {
                    shippingPickupType: e.target.value as OrderShippingFieldsValue['shippingPickupType'],
                  }),
                )
              }
              options={[
                { value: '', label: '—' },
                { value: 'address', label: 'Address (courier pickup)' },
                { value: 'hub', label: 'Hub (drop at Babel hub)' },
              ]}
            />
            <SelectField
              label="Payer"
              value={value.shippingPayer}
              disabled={readOnly}
              onChange={(e) =>
                onChange(
                  patch(value, {
                    shippingPayer: e.target.value as OrderShippingFieldsValue['shippingPayer'],
                  }),
                )
              }
              options={[
                { value: '', label: '—' },
                { value: 'sender', label: 'Sender' },
                { value: 'receiver', label: 'Receiver' },
                { value: 'reseller', label: 'Reseller' },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-text-body">Contents</label>
              {!readOnly && !contentsEditable ? (
                <button
                  type="button"
                  onClick={() => setContentsEditable(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                  title="Edit contents"
                >
                  <i className="fa-solid fa-pencil text-[10px]" aria-hidden="true" />
                  Edit
                </button>
              ) : null}
            </div>
            <TextField
              value={value.shippingContents}
              disabled={readOnly || !contentsEditable}
              onChange={(e) =>
                onChange(patch(value, { shippingContents: e.target.value }))
              }
              placeholder="Auto-generated from product names"
              hint={!contentsEditable ? 'Auto-generated from order products.' : undefined}
            />
          </div>

          <ShippingCarrierCards
            providers={listedProviders}
            quotes={quotes}
            errors={rateErrors}
            selectedCarrierId={value.shippingProviderCode}
            onSelect={(carrierId) =>
              onChange(patch(value, { shippingProviderCode: carrierId }))
            }
            loading={Boolean(ratesReady && ratesQuery.isFetching)}
            providersLoading={providersQuery.isLoading}
            disabled={intentReadOnly || Boolean(ratesReady && ratesQuery.isFetching)}
            emptyHint={emptyHint}
          />
        </>
      ) : null}
    </div>
  );
}
