import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

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
import { ShippingReceiverLocationMap } from './ShippingReceiverLocationMap';

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

  const connectedProviders = useMemo(
    () => (providersQuery.data ?? []).filter((p) => p.connected && p.enabled),
    [providersQuery.data],
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
  const ratesReady = carrier && hasPin && hasWeight && hasVolume && hasPackage && hasDelivery;

  const rateParams = {
    receiverLat: latN,
    receiverLng: lngN,
    packageType: value.shippingPackageType,
    weightKg: weightN,
    volumeCbm: volumeN,
    deliveryType: value.shippingDeliveryType,
    pickupType: value.shippingPickupType || undefined,
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
        receiverLat: debouncedRates.receiverLat as number,
        receiverLng: debouncedRates.receiverLng as number,
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
        debouncedRates.receiverLat != null &&
        debouncedRates.receiverLng != null &&
        debouncedRates.packageType &&
        debouncedRates.deliveryType,
    ),
    staleTime: 30_000,
  });

  const quotes = ratesQuery.data?.quotes ?? [];
  const rateErrors = ratesQuery.data?.errors ?? [];

  useEffect(() => {
    if (!carrier || lockIntent || intentReadOnly) return;
    if (ratesQuery.isFetching || !ratesQuery.isFetched) return;
    if (!value.shippingProviderCode) return;
    const stillOffered = quotes.some((q) => q.carrierId === value.shippingProviderCode);
    if (!stillOffered) {
      onChange(patch(value, { shippingProviderCode: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier, quotes, ratesQuery.isFetching, ratesQuery.isFetched]);

  let emptyHint: string | null = null;
  if (carrier && !ratesQuery.isFetching) {
    if (!hasDestination) {
      emptyHint = 'Select a receiver location to see available shipping companies.';
    } else if (!hasPin) {
      emptyHint = 'Select a receiver location to see available shipping companies.';
    } else if (!hasWeight) {
      emptyHint = 'Enter the shipment weight to calculate shipping rates.';
    } else if (!hasPackage) {
      emptyHint = 'Select a package type to calculate shipping rates.';
    } else if (!hasVolume) {
      emptyHint = 'Enter the shipment volume to calculate shipping rates.';
    } else if (!hasDelivery) {
      emptyHint = 'Select a delivery type to calculate shipping rates.';
    } else if (
      ratesQuery.isFetched &&
      quotes.length === 0 &&
      rateErrors.length === 0 &&
      connectedProviders.length === 0
    ) {
      emptyHint = 'No connected shipping companies. Connect one under Shipping Companies.';
    } else if (ratesQuery.isFetched && quotes.length === 0 && rateErrors.length === 0) {
      emptyHint = 'No shipping companies currently serve this destination for this shipment.';
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
          <ShippingReceiverLocationMap
            lat={value.shippingReceiverLat}
            lng={value.shippingReceiverLng}
            disabled={readOnly}
            boundaryGeometry={geometry}
            areaLabel={areaLabel}
            boundaryLoading={boundaryQuery.isFetching}
            boundaryMissing={boundaryMissing}
            selectionEnabled={hasDestination}
            onChange={({ lat, lng }) =>
              onChange(
                patch(value, {
                  shippingReceiverLat: lat,
                  shippingReceiverLng: lng,
                }),
              )
            }
          />

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
            <TextField
              label="Weight (kg)"
              value={value.shippingWeightKg}
              disabled={readOnly}
              onChange={(e) =>
                onChange(patch(value, { shippingWeightKg: e.target.value }))
              }
              placeholder={
                suggestedWeightKg != null ? String(suggestedWeightKg) : 'e.g. 1.5'
              }
              hint={
                weightSource
                  ? `${weightSource} from product unit weight × quantity (editable).`
                  : 'Actual package weight in kilograms.'
              }
            />
            <TextField
              label="Volume (m³)"
              value={value.shippingVolumeCbm}
              disabled={readOnly}
              onChange={(e) =>
                onChange(patch(value, { shippingVolumeCbm: e.target.value }))
              }
              placeholder={
                suggestedVolumeCbm != null ? String(suggestedVolumeCbm) : 'e.g. 0.05'
              }
              hint={
                volumeSource
                  ? `${volumeSource} from product unit volume × quantity (editable)`
                  : 'Actual packed shipment volume (optional override).'
              }
            />
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
                { value: 'address', label: 'Address' },
                { value: 'hub', label: 'Hub' },
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
                { value: 'address', label: 'Address' },
                { value: 'hub', label: 'Hub' },
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

          <TextField
            label="Contents"
            value={value.shippingContents}
            disabled={readOnly}
            onChange={(e) =>
              onChange(patch(value, { shippingContents: e.target.value }))
            }
            placeholder="Describe package contents"
          />

          <ShippingCarrierCards
            quotes={quotes}
            errors={rateErrors}
            selectedCarrierId={value.shippingProviderCode}
            onSelect={(carrierId) =>
              onChange(patch(value, { shippingProviderCode: carrierId }))
            }
            loading={ratesReady && ratesQuery.isFetching}
            disabled={intentReadOnly || (ratesReady && ratesQuery.isFetching)}
            emptyHint={emptyHint}
          />
        </>
      ) : null}
    </div>
  );
}
