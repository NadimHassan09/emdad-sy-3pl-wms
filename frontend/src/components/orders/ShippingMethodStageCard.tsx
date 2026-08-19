import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import { ShippingApi, type ShippingRateQuote, type ShippingRateError } from '../../api/shipping';
import { Alert, Button, Card } from '@ds';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';

type Props = { order: OutboundOrder };

type MethodChoice = 'manual' | 'carrier' | null;

export function ShippingMethodStageCard({ order }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [method, setMethod] = useState<MethodChoice>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });
    invalidateWorkflowTasksInventory(qc, {
      referenceId: order.id,
      referenceType: 'outbound_order',
    });
  };

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    staleTime: 60_000,
  });

  const allProviders = providersQuery.data ?? [];

  const submitMut = useMutation({
    mutationFn: () =>
      OutboundApi.selectShippingMethod(
        order.id,
        {
          shippingMethod: method === 'carrier' ? 'carrier' : 'manual',
          shippingProviderCode: method === 'carrier' ? selectedProvider : undefined,
        },
        order.companyId,
      ),
    onSuccess: () => {
      toast.success(
        method === 'carrier'
          ? 'Shipping company selected. Proceed to shipping details.'
          : 'Manual shipping selected. Proceed to shipping details.',
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit =
    method === 'manual' || (method === 'carrier' && selectedProvider.trim() !== '');

  return (
    <Card padding="none">
      <Card.Header>
        <Card.Title>Select Shipping Method</Card.Title>
      </Card.Header>
      <Card.Body className="space-y-4">
        <p className="text-sm text-text-body">
          Choose how this order will be shipped. This determines the next step in the workflow.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMethod('manual');
              setSelectedProvider('');
            }}
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
            onClick={() => setMethod('carrier')}
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
          <div className="space-y-3">
            <div className="text-sm font-medium text-text-strong">
              Available Shipping Companies
            </div>
            {providersQuery.isLoading ? (
              <p className="text-xs text-text-muted">Loading providers...</p>
            ) : allProviders.length === 0 ? (
              <Alert variant="warning" title="No shipping companies configured">
                Connect a shipping company under Shipping Companies settings first.
              </Alert>
            ) : (
              <div className="grid gap-2">
                {allProviders.map((provider) => {
                  const available = provider.connected && provider.enabled;
                  const isSelected = selectedProvider === provider.code;
                  return (
                    <button
                      key={provider.code}
                      type="button"
                      disabled={!available}
                      onClick={() => setSelectedProvider(provider.code)}
                      className={[
                        'relative flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all',
                        !available
                          ? 'cursor-not-allowed border-border bg-surface-sunken opacity-60'
                          : isSelected
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                            : 'border-border hover:border-border-strong',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold',
                            available
                              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                              : 'bg-surface-card-muted text-text-faint',
                          ].join(' ')}
                        >
                          {provider.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-strong">
                            {provider.name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {available ? (
                              <span className="text-green-600 dark:text-green-400">Available</span>
                            ) : (
                              <span className="text-status-danger-fg">
                                Unavailable
                                {provider.lastErrorSafe
                                  ? ` — ${provider.lastErrorSafe}`
                                  : !provider.connected
                                    ? ' — Not connected'
                                    : !provider.enabled
                                      ? ' — Disabled'
                                      : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <i
                          className="fa-solid fa-circle-check text-green-600"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
          <Button
            type="button"
            variant="primary"
            loading={submitMut.isPending}
            disabled={!canSubmit}
            onClick={() => submitMut.mutate()}
          >
            {method === 'manual' ? 'Continue with Manual Shipping' : 'Continue with Selected Carrier'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
