import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  ShippingApi,
  type OrderShippingFieldsValue,
} from '../../api/shipping';
import { QK } from '../../constants/query-keys';
import { SelectField } from '../SelectField';

type Props = {
  value: Pick<OrderShippingFieldsValue, 'shippingMethod' | 'shippingProviderCode'>;
  onChange: (next: Pick<OrderShippingFieldsValue, 'shippingMethod' | 'shippingProviderCode'>) => void;
  locked?: boolean;
  disabled?: boolean;
  showTitle?: boolean;
  /** When false, method/provider stay disabled until products + quantities exist. */
  available?: boolean;
  calculatedWeightKg?: number | null;
  calculatedVolumeCbm?: number | null;
  lockMessage?: string;
};

/**
 * OMS / early outbound: shipping decision only (method + provider).
 * Provider-specific package fields belong on the Shipping Details stage.
 */
export function OrderShippingIntentFields({
  value,
  onChange,
  locked = false,
  disabled = false,
  showTitle = true,
  available = true,
  calculatedWeightKg = null,
  calculatedVolumeCbm = null,
  lockMessage,
}: Props) {
  const readOnly = locked || disabled || !available;

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    staleTime: 60_000,
  });

  const connectedProviders = useMemo(
    () => (providersQuery.data ?? []).filter((p) => p.connected && p.enabled),
    [providersQuery.data],
  );

  const providerOptions = useMemo(
    () => [
      { value: '', label: 'Select shipping company…' },
      ...connectedProviders.map((p) => ({ value: p.code, label: p.name })),
      ...(value.shippingProviderCode &&
      !connectedProviders.some((p) => p.code === value.shippingProviderCode)
        ? [{ value: value.shippingProviderCode, label: value.shippingProviderCode }]
        : []),
    ],
    [connectedProviders, value.shippingProviderCode],
  );

  const carrier = value.shippingMethod === 'carrier';

  return (
    <div className="space-y-3">
      {showTitle ? (
        <div className="text-sm font-medium text-text-strong">Shipping plan</div>
      ) : null}
      {locked ? (
        <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-body">
          {lockMessage || 'Shipping method/provider is locked for this order.'}
        </p>
      ) : !available ? (
        <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-body">
          Add products and their quantities first, then choose the shipping method for this
          plan. Package details (contents, dimensions, etc.) are still completed after packing.
        </p>
      ) : (
        <p className="text-xs text-text-muted">
          Choose Manual or a shipping company for this plan. Provider-specific package
          details (contents, pickup/delivery, etc.) are completed after packing — not here.
        </p>
      )}

      {available && (calculatedWeightKg != null || calculatedVolumeCbm != null) ? (
        <p className="text-xs text-text-muted">
          Calculated from products:{' '}
          {calculatedWeightKg != null ? `${calculatedWeightKg} kg` : 'weight unavailable'}
          {' · '}
          {calculatedVolumeCbm != null ? `${calculatedVolumeCbm} m³` : 'volume unavailable'}
          . Admin can override these after packing.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Shipping method"
          value={value.shippingMethod}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              shippingMethod: e.target.value === 'carrier' ? 'carrier' : 'manual',
              shippingProviderCode:
                e.target.value === 'carrier' ? value.shippingProviderCode : '',
            })
          }
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'carrier', label: 'Shipping Company' },
          ]}
        />

        {carrier ? (
          <SelectField
            label="Shipping company"
            value={value.shippingProviderCode}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                shippingMethod: 'carrier',
                shippingProviderCode: e.target.value,
              })
            }
            options={providerOptions}
          />
        ) : null}
      </div>
    </div>
  );
}
