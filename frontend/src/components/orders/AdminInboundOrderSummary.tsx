import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import type { InboundOrder } from '../../api/inbound';
import { InboundApi } from '../../api/inbound';
import { Alert, Button } from '@ds';
import { OrderDocumentsCard } from '../documents/OrderDocumentsCard';
import { StatusBadge } from '../StatusBadge';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { useResolvedLocations } from '../../hooks/useResolvedLocations';
import { isAdminExecutionMode, usesAdminOrderExecutionUi } from '../../lib/execution-plan';
import { openInboundInstructionsPdf } from '../../lib/order-instructions-print';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';

type Props = {
  order: InboundOrder;
};

function locationLabel(
  id: string,
  locationById: Map<string, { fullPath?: string | null; barcode?: string | null }>,
): string {
  const loc = locationById.get(id);
  if (!loc) return id;
  const path = loc.fullPath?.trim();
  return path || id;
}

function ProgressStrip({ status }: { status: string }) {
  const completed = status === 'completed';
  const inProgress = status === 'in_progress' || status === 'partially_received';
  const steps = [
    { label: 'Receiving', state: completed || inProgress ? 'done' : 'planned' },
    { label: 'Putaway', state: completed ? 'done' : inProgress ? 'planned' : 'planned' },
    { label: 'Completed', state: completed ? 'done' : 'idle' },
  ];
  return (
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
  );
}

export function AdminInboundOrderSummary({ order }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const showAdminUi = usesAdminOrderExecutionUi(order.executionMode);
  const isDraft = order.status === 'draft' || order.status === 'pending_approval';
  const plan = order.executionPlan;

  const planReady = useMemo(() => {
    if (!isAdminExecutionMode(order.executionMode)) return false;
    if (!plan?.receivingDockId?.trim() || !plan.warehouseId?.trim()) return false;
    if (!order.lines.length) return false;
    for (const line of order.lines) {
      const pl =
        plan.lines.find((x) => x.orderLineId === line.id) ??
        plan.lines.find((x) => x.productId === line.productId);
      const putaway = pl?.putaway ?? [];
      if (putaway.length === 0) return false;
      const expected = Number(line.expectedQuantity);
      const allocated = putaway.reduce((a, s) => a + Number(s.qty), 0);
      if (!(expected > 0) || Math.abs(allocated - expected) > 1e-6) return false;
      if (putaway.some((s) => !s.locationId?.trim())) return false;
    }
    return true;
  }, [order.executionMode, order.lines, plan]);

  const locationIds = useMemo(() => {
    const ids: string[] = [];
    if (plan?.receivingDockId) ids.push(plan.receivingDockId);
    for (const line of plan?.lines ?? []) {
      for (const split of line.putaway ?? []) {
        if (split.locationId) ids.push(split.locationId);
      }
    }
    return ids;
  }, [plan]);

  const { locationById } = useResolvedLocations(locationIds);

  const locationLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const id of locationIds) {
      labels[id] = locationLabel(id, locationById);
    }
    return labels;
  }, [locationIds, locationById]);

  const confirmMut = useMutation({
    mutationFn: () => InboundApi.executeAdmin(order.id, order.companyId),
    onSuccess: () => {
      toast.success('Order confirmed. Inventory updated.');
      qc.invalidateQueries({ queryKey: [...QK.inboundOrders, order.id] });
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      invalidateWorkflowTasksInventory(qc, {
        referenceId: order.id,
        referenceType: 'inbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!showAdminUi) return null;

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/orders/inbound"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-strong"
      >
        ← All inbound orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-text-strong font-mono">
              {order.orderNumber || order.id}
            </h1>
            {isDraft ? (
              <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
                {order.status === 'pending_approval' ? 'Pending approval' : 'Planned'}
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
              to={`/orders/inbound/${order.id}/edit`}
              className="inline-flex h-[34px] items-center rounded-lg border border-border bg-surface-card px-3 text-sm font-medium text-text-strong hover:bg-surface-sunken"
            >
              {planReady ? 'Edit plan' : 'Complete plan'}
            </Link>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              if (!openInboundInstructionsPdf(order, locationLabels)) {
                toast.error('Allow pop-ups to print.');
              }
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
              disabled={!planReady}
              title={
                planReady
                  ? undefined
                  : 'Complete the warehouse plan (dock + putaway) before confirming.'
              }
              onClick={() => confirmMut.mutate()}
            >
              Confirm order
            </Button>
          ) : null}
        </div>
      </div>

      {isDraft && !planReady ? (
        <Alert variant="warning" title="Warehouse plan incomplete">
          This order still needs receiving dock and putaway locations. Open Complete plan (same
          screen as New inbound order), then Confirm.
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-strong">Order information</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
          <div>
            <div className="text-text-muted">Client</div>
            <div className="font-medium text-text-strong">{order.company?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-text-muted">Expected arrival</div>
            <div className="font-medium text-text-strong">
              {new Date(order.expectedArrivalDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-text-muted">Receiving dock</div>
            <div className="font-medium text-text-strong">
              {plan?.receivingDockId
                ? locationLabel(plan.receivingDockId, locationById)
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-text-muted">Execution</div>
            <div className="font-medium text-text-strong">
              {isAdminExecutionMode(order.executionMode) ? 'Admin' : 'Needs plan'}
            </div>
          </div>
        </div>
        <ProgressStrip status={order.status} />
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-strong">Products &amp; putaway plan</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="py-2 pe-3">SKU</th>
                <th className="py-2 pe-3">Product</th>
                <th className="py-2 pe-3">Qty</th>
                <th className="py-2">Putaway</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => {
                const pl =
                  plan?.lines.find((x) => x.orderLineId === l.id) ??
                  plan?.lines.find((x) => x.productId === l.productId);
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-2 pe-3 font-mono">{l.product?.sku ?? '—'}</td>
                    <td className="py-2 pe-3">{l.product?.name ?? '—'}</td>
                    <td className="py-2 pe-3 font-mono">{l.expectedQuantity}</td>
                    <td className="py-2 text-text-body">
                      {(pl?.putaway ?? []).length === 0 ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        (pl?.putaway ?? []).map((s, i) => (
                          <div key={i} className="text-sm">
                            {locationLabel(s.locationId, locationById)}
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {order.notes?.trim() ? (
        <div className="rounded-xl border border-border bg-surface-card p-5">
          <h2 className="text-sm font-semibold text-text-strong">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-body">{order.notes}</p>
        </div>
      ) : null}

      <OrderDocumentsCard
        referenceType="inbound_order"
        referenceId={order.id}
        companyIdOverride={order.companyId}
        showPanel={false}
      />

      {isDraft ? (
        <Alert variant="info" title="After physical work">
          Click Confirm order to complete receiving and putaway, update inventory, and generate the
          GRN. You do not need the Tasks page.
        </Alert>
      ) : null}
    </div>
  );
}
