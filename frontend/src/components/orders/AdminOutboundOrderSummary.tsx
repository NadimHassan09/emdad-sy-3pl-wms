import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import { WorkflowsApi } from '../../api/workflows';
import { Alert, Button, Card } from '@ds';
import { OrderDocumentsCard } from '../documents/OrderDocumentsCard';
import { StatusBadge } from '../StatusBadge';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { useResolvedLocations } from '../../hooks/useResolvedLocations';
import {
  isAdminExecutionMode,
  normalizeExecutionMode,
  outboundAdminPlanIsComplete,
} from '../../lib/execution-plan';
import { openOutboundInstructionsPdf } from '../../lib/order-instructions-print';
import { invalidateWorkflowTasksInventory } from '../../lib/invalidate-wms-queries';
import { taskDetailHref } from '../../lib/workflow-next-task';

type Props = { order: OutboundOrder };

function fmtQty(s: string | number): string {
  const n = Number(s);
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return String(s);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function DetailRow({
  label,
  value,
  className,
  preWrap,
}: {
  label: string;
  value?: ReactNode;
  className?: string;
  preWrap?: boolean;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-text-strong ${preWrap ? 'whitespace-pre-wrap' : ''}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

function productImageSrc(imagePath?: string | null): string | null {
  if (!imagePath?.trim()) return null;
  return `/api/client/media/${imagePath.replace(/^\/+/, '')}`;
}

function locationLabel(
  id: string,
  locationById: Map<string, { fullPath?: string | null; barcode?: string | null }>,
): string {
  const loc = locationById.get(id);
  if (!loc) return id;
  return loc.fullPath?.trim() || id;
}

export function AdminOutboundOrderSummary({ order }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const mode = normalizeExecutionMode(order.executionMode);
  const isAdminMode = isAdminExecutionMode(order.executionMode);
  const isPlannable =
    order.status === 'draft' ||
    order.status === 'pending_approval' ||
    order.status === 'allocated';
  const plan = order.executionPlan;
  const requiresPacking = order.requiresPacking !== false;
  const lines = order.lines ?? [];
  const [printedAt, setPrintedAt] = useState<string | null>(null);

  const planReady = useMemo(
    () => outboundAdminPlanIsComplete(plan, lines),
    [lines, plan],
  );

  const printStale =
    printedAt != null && plan?.planUpdatedAt != null && plan.planUpdatedAt !== printedAt;

  const locationIds = useMemo(() => {
    const ids: string[] = [];
    if (plan?.packingLocationId) ids.push(plan.packingLocationId);
    if (plan?.dispatchDockId) ids.push(plan.dispatchDockId);
    return ids;
  }, [plan]);

  const { locationById } = useResolvedLocations(locationIds);

  const pickAllocations = useMemo(() => {
    const productById = new Map(
      lines.map((l) => [l.productId, l.product] as const),
    );
    return (order.stockReservations ?? []).map((r) => {
      const product = r.product ?? productById.get(r.productId);
      return {
        id: r.id,
        productName: product?.name ?? '—',
        productSku: product?.sku ?? '—',
        location:
          r.location?.fullPath?.trim() ||
          r.location?.barcode?.trim() ||
          r.locationId,
        lotNumber: r.lot?.lotNumber?.trim() || '—',
        quantity: r.quantity,
      };
    });
  }, [lines, order.stockReservations]);

  const timeline = useQuery({
    queryKey: QK.workflows.timeline('outbound_order', order.id),
    queryFn: () => WorkflowsApi.getTimeline('outbound_order', order.id, order.companyId),
    enabled: !isPlannable,
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!planReady || !plan) throw new Error('Complete the warehouse plan first.');
      if (isAdminMode) {
        return OutboundApi.executeAdmin(order.id, order.companyId);
      }
      return OutboundApi.confirm(order.id, { warehouseId: plan.warehouseId }, order.companyId);
    },
    onSuccess: () => {
      toast.success(
        isAdminMode
          ? 'Order confirmed. Inventory updated.'
          : 'Released to workers. Tasks are ready.',
      );
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      invalidateWorkflowTasksInventory(qc, {
        referenceId: order.id,
        referenceType: 'outbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openTasks = (timeline.data?.tasks ?? []).filter(
    (t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress',
  );

  const skuCount = new Set(lines.map((line) => line.product?.sku || line.productId)).size;

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
            {isPlannable ? (
              <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
                {order.status === 'pending_approval' ? 'Pending approval' : 'Planned'}
              </span>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {isAdminMode
              ? 'Review plan, print instructions, execute physically, then confirm.'
              : 'Complete the plan, then release work to warehouse workers.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPlannable ? (
            <Link
              to={`/orders/outbound/${order.id}/edit`}
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
              if (!openOutboundInstructionsPdf(order)) {
                toast.error('Allow pop-ups to print.');
                return;
              }
              setPrintedAt(plan?.planUpdatedAt ?? new Date().toISOString());
            }}
          >
            Print instructions
          </Button>
          {isPlannable ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={confirmMut.isPending}
              disabled={!planReady}
              title={
                planReady ? undefined : 'Complete the warehouse plan before confirming.'
              }
              onClick={() => confirmMut.mutate()}
            >
              {isAdminMode ? 'Confirm order' : 'Release to workers'}
            </Button>
          ) : null}
        </div>
      </div>

      {isPlannable && !planReady ? (
        <Alert variant="warning" title="Warehouse plan incomplete">
          Open Complete plan, then {isAdminMode ? 'Confirm' : 'Release'}.
        </Alert>
      ) : null}

      {printStale ? (
        <Alert variant="warning" title="Plan changed since last print">
          Editing invalidates previous instruction sheets. Print again before physical work.
        </Alert>
      ) : null}

      <Card padding="none">
        <Card.Header>
          <Card.Title>Order details</Card.Title>
        </Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <DetailRow label="Order #" value={order.orderNumber || order.id} />
            <DetailRow label="Number of SKUs" value={String(skuCount)} />
            <DetailRow label="Required ship date" value={formatDate(order.requiredShipDate)} />
            <DetailRow label="Created" value={formatDateTime(order.createdAt)} />
            <DetailRow label="Client" value={order.company?.name ?? '—'} />
            <DetailRow
              label="Execution"
              value={mode === 'admin' ? 'Admin' : 'Workers'}
            />
            <DetailRow label="Carrier" value={order.carrier?.trim() || '—'} />
            <DetailRow
              label="Packing"
              value={requiresPacking ? 'Required' : 'Skipped'}
            />
            {order.confirmedAt ? (
              <DetailRow label="Confirmed" value={formatDateTime(order.confirmedAt)} />
            ) : null}
            {order.shippedAt ? (
              <DetailRow label="Shipped" value={formatDateTime(order.shippedAt)} />
            ) : null}
            <DetailRow
              label="Destination"
              value={order.destinationAddress?.trim() || '—'}
              className="sm:col-span-2"
              preWrap
            />
            <DetailRow
              label="Notes"
              value={order.notes?.trim() || '—'}
              className="sm:col-span-2"
              preWrap
            />
          </dl>
        </Card.Body>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <Card.Header>
          <Card.Title>Line items</Card.Title>
          <span className="text-xs font-medium text-text-muted">
            {lines.length} {lines.length === 1 ? 'item' : 'items'}
          </span>
        </Card.Header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-4 py-2.5 text-left">#</th>
                <th className="px-4 py-2.5 text-left">Image</th>
                <th className="px-4 py-2.5 text-left">Product</th>
                <th className="px-4 py-2.5 text-left">SKU</th>
                <th className="px-4 py-2.5 text-right">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {lines.map((line) => {
                const imageSrc = productImageSrc(line.product?.imagePath);
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-2.5 text-text-muted">{line.lineNumber}</td>
                    <td className="px-4 py-2.5">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt=""
                          className="h-10 w-10 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-text-faint">
                          <i className="fa-solid fa-box text-xs" aria-hidden="true" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-strong">
                      {line.product?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                      {line.product?.sku ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                      {fmtQty(line.requestedQuantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <Card.Header>
          <Card.Title>Pick allocation</Card.Title>
          <span className="text-xs font-medium text-text-muted">
            {pickAllocations.length}{' '}
            {pickAllocations.length === 1 ? 'slice' : 'slices'}
          </span>
        </Card.Header>
        {pickAllocations.length === 0 ? (
          <Card.Body>
            <p className="text-sm text-text-muted">
              No system pick allocation yet. Stock is reserved when the order is
              created (or after allocate).
            </p>
          </Card.Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">Product</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-left">Lot</th>
                  <th className="px-4 py-2.5 text-right">Qty to pick</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {pickAllocations.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-text-strong">{row.productName}</div>
                      <div className="mt-0.5 font-mono text-xs text-text-muted">
                        {row.productSku}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-body">{row.location}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                      {row.lotNumber}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                      {fmtQty(row.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="none">
        <Card.Header>
          <Card.Title>Warehouse plan</Card.Title>
        </Card.Header>
        <Card.Body className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <DetailRow
              label="Packing"
              value={
                plan?.requiresPacking !== false && requiresPacking ? 'Required' : 'Skipped'
              }
            />
            <DetailRow
              label="Packing location"
              value={
                plan?.packingLocationId
                  ? locationLabel(plan.packingLocationId, locationById)
                  : '—'
              }
            />
            <DetailRow
              label="Dispatch dock"
              value={
                plan?.dispatchDockId
                  ? locationLabel(plan.dispatchDockId, locationById)
                  : '—'
              }
            />
          </dl>
        </Card.Body>
      </Card>

      {!isPlannable && openTasks.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface-card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-text-strong">Open warehouse tasks</h2>
          <p className="text-xs text-text-muted">Monitor only — Workers execute on the Tasks page.</p>
          <ul className="space-y-1 text-sm">
            {openTasks.map((t) => (
              <li key={t.id}>
                <Link
                  to={taskDetailHref(t.id, order.companyId)}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {t.taskType} · {t.status}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <OrderDocumentsCard
        referenceType="outbound_order"
        referenceId={order.id}
        companyIdOverride={order.companyId}
        showPanel={false}
      />

      {isPlannable ? (
        <Alert variant="info" title={isAdminMode ? 'After physical work' : 'After release'}>
          {isAdminMode
            ? 'Click Confirm order to complete pick/pack/dispatch and update inventory. You do not need the Tasks page.'
            : 'Release starts the workflow. Workers complete tasks on /tasks. Do not confirm stages here.'}
        </Alert>
      ) : null}
    </div>
  );
}
