import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import { Alert, Button, Card } from '@ds';
import { CarrierShippingDetailsForm } from '../shipping/CarrierShippingDetailsForm';
import {
  buildCarrierShippingFormFromOrder,
  carrierFormToSavePayload,
  hasOverPacking,
  packingSummary,
  type CarrierShippingFormValue,
} from '../shipping/carrier-shipping-form';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';

type Props = { order: OutboundOrder };

type MethodChoice = 'manual' | 'carrier' | null;

/**
 * Waiting-for-shipping-method stage:
 * 1) Choose Manual vs Shipping Company
 * 2) If company → prefilled Shipping Details + company cards (Available / Unavailable)
 */
export function ShippingMethodStageCard({ order }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [method, setMethod] = useState<MethodChoice>(null);
  const [form, setForm] = useState<CarrierShippingFormValue>(() =>
    buildCarrierShippingFormFromOrder(order),
  );
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);
  const [selectedCarrierAvailable, setSelectedCarrierAvailable] = useState(false);

  useEffect(() => {
    setForm(buildCarrierShippingFormFromOrder(order));
  }, [order]);

  const codAmount = useMemo(() => {
    const raw = order.codAmount;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [order.codAmount]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });
    invalidateWorkflowTasksInventory(qc, {
      referenceId: order.id,
      referenceType: 'outbound_order',
    });
  };

  const submitMut = useMutation({
    mutationFn: () => {
      if (method === 'manual') {
        return OutboundApi.selectShippingMethod(
          order.id,
          { shippingMethod: 'manual' },
          order.companyId,
        );
      }
      const details = carrierFormToSavePayload(form);
      return OutboundApi.selectShippingMethod(
        order.id,
        {
          ...details,
          shippingMethod: 'carrier',
          shippingProviderCode: form.shippingProviderCode.trim() || undefined,
        },
        order.companyId,
      );
    },
    onSuccess: () => {
      toast.success(
        method === 'carrier'
          ? 'Shipping company and details saved. Continue with Send / Complete on Shipping Details.'
          : 'Manual shipping selected. Proceed to shipping details.',
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const packingInvalid = useMemo(
    () => hasOverPacking(packingSummary(form.cartons, form.catalog)),
    [form.cartons, form.catalog],
  );

  const canSubmit =
    method === 'manual' ||
    (method === 'carrier' &&
      !quotesRefreshing &&
      !packingInvalid &&
      selectedCarrierAvailable &&
      form.shippingProviderCode.trim() !== '' &&
      form.city.trim() !== '' &&
      form.district.trim() !== '' &&
      form.addressLine1.trim() !== '');

  return (
    <Card padding="none">
      <Card.Header>
        <Card.Title>Select Shipping Method</Card.Title>
      </Card.Header>
      <Card.Body className="space-y-5">
        <p className="text-sm text-text-body">
          Choose how this order will be shipped. For Shipping Company, review the prefilled
          shipment details, then pick an available carrier.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod('manual')}
            className={[
              'relative rounded-xl border-2 p-4 text-left transition-all',
              method === 'manual'
                ? 'border-green-500 bg-green-50 dark:bg-green-950/30 ring-1 ring-green-500/30'
                : 'border-border hover:border-border-strong hover:bg-surface-sunken',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  method === 'manual'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-surface-card-muted text-text-muted',
                ].join(' ')}
              >
                <i className="fa-solid fa-hand-holding-box text-lg" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-strong">Manual</div>
                <div className="mt-0.5 text-xs text-text-muted">
                  Handle shipping manually without a carrier API
                </div>
              </div>
            </div>
            {method === 'manual' ? (
              <div className="absolute end-3 top-3">
                <i className="fa-solid fa-circle-check text-green-600" aria-hidden="true" />
              </div>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setMethod('carrier');
              setQuotesRefreshing(true);
              setSelectedCarrierAvailable(false);
            }}
            className={[
              'relative rounded-xl border-2 p-4 text-left transition-all',
              method === 'carrier'
                ? 'border-green-500 bg-green-50 dark:bg-green-950/30 ring-1 ring-green-500/30'
                : 'border-border hover:border-border-strong hover:bg-surface-sunken',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  method === 'carrier'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-surface-card-muted text-text-muted',
                ].join(' ')}
              >
                <i className="fa-solid fa-truck-fast text-lg" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-strong">Shipping Company</div>
                <div className="mt-0.5 text-xs text-text-muted">
                  Use a connected carrier to create AWB and track
                </div>
              </div>
            </div>
            {method === 'carrier' ? (
              <div className="absolute end-3 top-3">
                <i className="fa-solid fa-circle-check text-green-600" aria-hidden="true" />
              </div>
            ) : null}
          </button>
        </div>

        {method === 'carrier' ? (
          <div className="space-y-3 border-t border-border-subtle pt-4">
            {!form.city || !form.district ? (
              <Alert variant="warning" title="Address incomplete">
                Governorate / city are missing on this order. Complete the address so carriers can
                quote correctly.
              </Alert>
            ) : null}
            <CarrierShippingDetailsForm
              value={form}
              onChange={setForm}
              codAmount={codAmount}
              showTitle
              onQuotesRefreshingChange={setQuotesRefreshing}
              onSelectedCarrierAvailableChange={setSelectedCarrierAvailable}
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
          <Button
            type="button"
            variant="primary"
            loading={submitMut.isPending}
            disabled={!canSubmit}
            title={
              method === 'carrier' && packingInvalid
                ? 'Fix over-packed product quantities in packages.'
                : method === 'carrier' && quotesRefreshing
                ? 'Wait until carrier availability finishes updating.'
                : method === 'carrier' && !selectedCarrierAvailable
                  ? 'Select an available shipping company.'
                  : undefined
            }
            onClick={() => submitMut.mutate()}
          >
            {method === 'manual'
              ? 'Continue with Manual Shipping'
              : quotesRefreshing
                ? 'Updating carriers…'
                : 'Continue with Selected Carrier'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
