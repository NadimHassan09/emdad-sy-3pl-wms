import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import { Alert, Button } from '@ds';
import { OrderDocumentsCard } from '../documents/OrderDocumentsCard';
import { StatusBadge } from '../StatusBadge';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { isAdminExecutionMode } from '../../lib/execution-plan';
import { openOutboundInstructionsPdf } from '../../lib/order-instructions-print';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';

type Props = { order: OutboundOrder };

export function AdminOutboundOrderSummary({ order }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const isAdmin = isAdminExecutionMode(order.executionMode);
  const isDraft = order.status === 'draft' || order.status === 'pending_approval';
  const plan = order.executionPlan;
  const requiresPacking = order.requiresPacking !== false;

  const confirmMut = useMutation({
    mutationFn: () => OutboundApi.executeAdmin(order.id, order.companyId),
    onSuccess: () => {
      toast.success('Order confirmed. Inventory updated.');
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      invalidateWorkflowTasksInventory(qc, {
        referenceId: order.id,
        referenceType: 'outbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isAdmin) return null;

  const steps = [
    { label: 'Pick', state: order.status === 'shipped' ? 'done' : isDraft ? 'planned' : 'planned' },
    ...(requiresPacking
      ? [{ label: 'Pack', state: order.status === 'shipped' ? 'done' : 'planned' }]
      : []),
    { label: 'Dispatch', state: order.status === 'shipped' ? 'done' : 'planned' },
    { label: 'Completed', state: order.status === 'shipped' ? 'done' : 'idle' },
  ];

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/orders/outbound"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-strong"
      >
        ← All outbound orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-text-strong font-mono">
              {order.orderNumber || order.id}
            </h1>
            {isDraft ? (
              <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
                Planned
              </span>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Review plan, print instructions, execute physically, then confirm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Link
              to={`/orders/outbound/${order.id}/edit`}
              className="inline-flex h-[34px] items-center rounded-lg border border-border bg-surface-card px-3 text-sm font-medium text-text-strong hover:bg-surface-sunken"
            >
              Edit plan
            </Link>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              if (!openOutboundInstructionsPdf(order)) toast.error('Allow pop-ups to print.');
            }}
          >
            Print instructions
          </Button>
          {isDraft ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={confirmMut.isPending}
              onClick={() => confirmMut.mutate()}
            >
              Confirm order
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-strong">Order information</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
          <div>
            <div className="text-text-muted">Client</div>
            <div className="font-medium text-text-strong">{order.company?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-text-muted">Ship date</div>
            <div className="font-medium text-text-strong">
              {new Date(order.requiredShipDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-text-muted">Packing</div>
            <div className="font-medium text-text-strong">
              {requiresPacking ? 'Required' : 'Skipped'}
            </div>
          </div>
          <div>
            <div className="text-text-muted">Execution</div>
            <div className="font-medium text-text-strong">Admin</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 ? <span className="text-text-muted">→</span> : null}
              <span
                className={
                  s.state === 'done'
                    ? 'rounded-full bg-status-success-bg px-2.5 py-1 font-medium text-status-success-fg'
                    : s.state === 'planned'
                      ? 'rounded-full bg-status-warning-bg px-2.5 py-1 font-medium text-status-warning-fg'
                      : 'rounded-full bg-surface-sunken px-2.5 py-1 text-text-muted'
                }
              >
                {s.label}: {s.state === 'done' ? 'Done' : s.state === 'planned' ? 'Planned' : 'Not started'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-strong">
          Products &amp; suggested picking locations
        </h2>
        <p className="text-xs text-text-muted">
          FEFO locations are assigned when you Confirm. Print after save for a planning sheet; the
          confirm step re-validates stock.
        </p>
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-text-muted">
            <tr>
              <th className="py-2 pe-3">SKU</th>
              <th className="py-2 pe-3">Product</th>
              <th className="py-2">Qty</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines ?? []).map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="py-2 pe-3 font-mono">{l.product?.sku ?? '—'}</td>
                <td className="py-2 pe-3">{l.product?.name ?? '—'}</td>
                <td className="py-2 font-mono">{l.requestedQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(plan?.suggestedPicks?.length ?? 0) > 0 ? (
          <div className="mt-3 text-xs text-text-body space-y-1">
            {plan!.suggestedPicks!.map((p, i) => (
              <div key={i} className="font-mono">
                {p.locationPath ?? p.locationId} × {p.qty}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-strong">Documents</h2>
        <OrderDocumentsCard
          referenceType="outbound_order"
          referenceId={order.id}
          companyIdOverride={order.companyId}
        />
      </div>

      {isDraft ? (
        <Alert variant="info" title="After physical work">
          Follow suggested locations, pick and pack, then Confirm order to complete all tasks and
          update inventory.
        </Alert>
      ) : null}
    </div>
  );
}
