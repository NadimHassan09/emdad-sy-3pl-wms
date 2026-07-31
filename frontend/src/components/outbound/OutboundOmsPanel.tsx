import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement, type ReactNode } from 'react';

import { Button } from '@ds';
import type { OmsOrderDetail, OmsOrderEvent, OmsStockReservation } from '../../api/oms';
import { OmsApi } from '../../api/oms';
import { QK } from '../../constants/query-keys';
import { useToast } from '../ToastProvider';

type TabId = 'order' | 'customer' | 'financial' | 'shipment' | 'allocation' | 'timeline';

const TABS: { id: TabId; label: string }[] = [
  { id: 'order', label: 'Order info' },
  { id: 'customer', label: 'Customer' },
  { id: 'financial', label: 'Financial' },
  { id: 'shipment', label: 'Shipment' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'timeline', label: 'Timeline' },
];

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text-strong">{value}</div>
    </div>
  );
}

function CodBadge({ order }: { order: OmsOrderDetail }) {
  if (order.paymentMethod !== 'COD') return null;
  const status = order.codStatus ?? 'pending';
  const colors: Record<string, string> = {
    pending: 'bg-status-warning-bg text-status-warning-fg',
    collected: 'bg-brand-100 text-brand-900 dark:bg-brand-950/50 dark:text-brand-200',
    remitted: 'bg-indigo-100 text-indigo-900',
    settled: 'bg-status-success-bg text-status-success-fg',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${colors[status] ?? 'bg-surface-card-muted'}`}>
      COD {status}
    </span>
  );
}

export function OutboundOmsPanel({
  orderId,
  order,
  onRefresh,
}: {
  orderId: string;
  order: OmsOrderDetail;
  onRefresh: () => void;
}): ReactElement {
  const [tab, setTab] = useState<TabId>('order');
  const toast = useToast();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (action: string) => {
      switch (action) {
        case 'allocate':
          return OmsApi.allocate(orderId);
        case 'release':
          return OmsApi.releaseAllocation(orderId);
        case 'out':
          return OmsApi.outForDelivery(orderId);
        case 'delivered':
          return OmsApi.delivered(orderId);
        case 'returned':
          return OmsApi.returned(orderId);
        case 'collect':
          return OmsApi.collectCod(orderId);
        case 'settle':
          return OmsApi.settleCod(orderId);
        default:
          throw new Error('Unknown action');
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...QK.outboundOrders, orderId] });
      onRefresh();
      toast.success('Order updated.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mb-4 rounded-xl border border-border-subtle bg-surface-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-text-strong">OMS</h2>
        <CodBadge order={order} />
        {order.allocationStatus && order.allocationStatus !== 'none' ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900">
            Allocation: {order.allocationStatus}
          </span>
        ) : null}
        <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-xs font-semibold text-text-body">
          Delivery: {order.status}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border-subtle pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-status-success-bg text-status-success-fg' : 'text-text-body hover:bg-surface-sunken'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'order' && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Client reference" value={order.clientReference ?? '—'} />
          <Field label="Payment" value={order.paymentMethod ?? '—'} />
          <Field label="Currency" value={order.currency ?? '—'} />
          <Field label="Notes" value={order.notes ? <span className="whitespace-pre-wrap">{order.notes}</span> : '—'} />
        </div>
      )}

      {tab === 'customer' && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Recipient" value={order.recipientName ?? '—'} />
          <Field label="Phone" value={order.recipientPhone ?? '—'} />
          <Field label="City" value={order.city ?? '—'} />
          <Field label="District" value={order.district ?? '—'} />
          <Field label="Address" value={order.addressLine1 ?? order.destinationAddress} />
          <Field label="Address line 2" value={order.addressLine2 ?? '—'} />
          <Field
            label="Instructions"
            value={
              order.deliveryInstructions ? (
                <span className="whitespace-pre-wrap">{order.deliveryInstructions}</span>
              ) : (
                '—'
              )
            }
          />
        </div>
      )}

      {tab === 'financial' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Subtotal" value={order.subtotal ?? '—'} />
            <Field label="Shipping" value={order.shippingFee ?? '—'} />
            <Field label="COD amount" value={order.codAmount ?? '—'} />
            <Field label="COD status" value={order.codStatus ?? '—'} />
          </div>
          <div className="flex flex-wrap gap-2">
            {order.paymentMethod === 'COD' && order.codStatus !== 'collected' && order.codStatus !== 'settled' ? (
              <Button size="sm" variant="secondary" loading={mut.isPending} onClick={() => mut.mutate('collect')}>
                Mark COD collected
              </Button>
            ) : null}
            {order.paymentMethod === 'COD' && order.codStatus === 'collected' ? (
              <Button size="sm" variant="secondary" loading={mut.isPending} onClick={() => mut.mutate('settle')}>
                Settle COD
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'shipment' && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Carrier" value={order.carrier ?? '—'} />
          <Field label="Tracking" value={order.trackingNumber ?? '—'} />
          <Field label="Required ship" value={new Date(order.requiredShipDate).toLocaleDateString()} />
          <Field label="Out for delivery" value={order.outForDeliveryAt ? new Date(order.outForDeliveryAt).toLocaleString() : '—'} />
          <Field label="Delivered" value={order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'} />
        </div>
      )}

      {tab === 'allocation' && (
        <div className="space-y-3">
          <Field label="Allocation status" value={order.allocationStatus ?? 'none'} />
          <Field
            label="Reserved rows"
            value={order.reservations?.length ? String(order.reservations.length) : '0'}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={mut.isPending} onClick={() => mut.mutate('allocate')}>
              Allocate
            </Button>
            <Button size="sm" variant="danger" loading={mut.isPending} onClick={() => mut.mutate('release')}>
              Release allocation
            </Button>
          </div>
          {order.reservations?.length ? (
            <ul className="text-xs text-text-body">
              {order.reservations.map((r: OmsStockReservation) => (
                <li key={r.id} className="font-mono">
                  {r.productId.slice(0, 8)}… · qty {r.quantity} · {r.status}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {tab === 'timeline' && (
        <ul className="space-y-2 text-sm">
          {(order.timeline ?? []).length === 0 ? (
            <li className="text-text-muted">No events yet.</li>
          ) : (
            order.timeline!.map((ev: OmsOrderEvent) => (
              <li key={ev.id} className="rounded-lg border border-border-subtle px-3 py-2">
                <div className="font-medium text-text-strong">{ev.eventType}</div>
                <div className="text-xs text-text-muted">
                  {new Date(ev.createdAt).toLocaleString()}
                  {ev.creator?.fullName ? ` · ${ev.creator.fullName}` : ''}
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
        <Button size="sm" variant="secondary" loading={mut.isPending} onClick={() => mut.mutate('out')}>
          Out for delivery
        </Button>
        <Button size="sm" variant="secondary" loading={mut.isPending} onClick={() => mut.mutate('delivered')}>
          Mark delivered
        </Button>
        <Button size="sm" variant="danger" loading={mut.isPending} onClick={() => mut.mutate('returned')}>
          Mark returned
        </Button>
      </div>
    </div>
  );
}
