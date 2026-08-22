import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { OutboundOrder } from '../../api/outbound';
import { OutboundApi } from '../../api/outbound';
import { ShippingApi } from '../../api/shipping';
import { WorkflowsApi } from '../../api/workflows';
import { Alert, Button, Card } from '@ds';
import { ConfirmModal } from '../ConfirmModal';
import { OrderDocumentsCard } from '../documents/OrderDocumentsCard';
import { ShippingDetailsStageCard } from './ShippingDetailsStageCard';
import { ShippingMethodStageCard } from './ShippingMethodStageCard';
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

  type AdminStageAction =
    | 'approve'
    | 'complete_picking'
    | 'complete_packing'
    | 'complete_dispatch'
    | 'release';

  const adminStageAction: AdminStageAction | null = useMemo(() => {
    if (!isAdminMode) {
      return isPlannable ? 'release' : null;
    }
    if (isPlannable) return 'approve';
    if (order.status === 'picking') return 'complete_picking';
    if (order.status === 'packing') return 'complete_packing';
    // Shipping details stage uses ShippingDetailsStageCard (Save / Send / Complete).
    if (order.status === 'ready_to_ship') return 'complete_dispatch';
    return null;
  }, [isAdminMode, isPlannable, order.status]);

  const stageMut = useMutation({
    mutationFn: async () => {
      if (adminStageAction === 'release') {
        if (!planReady || !plan) throw new Error('Complete the warehouse plan first.');
        return OutboundApi.confirm(order.id, { warehouseId: plan.warehouseId }, order.companyId);
      }
      if (adminStageAction === 'approve') {
        if (!planReady || !plan) throw new Error('Complete the warehouse plan first.');
        return OutboundApi.approve(order.id, order.companyId);
      }
      if (adminStageAction === 'complete_picking') {
        return OutboundApi.completePicking(order.id, order.companyId);
      }
      if (adminStageAction === 'complete_packing') {
        return OutboundApi.completePacking(order.id, order.companyId);
      }
      if (adminStageAction === 'complete_dispatch') {
        return OutboundApi.completeDispatch(order.id, order.companyId);
      }
      throw new Error('No stage action available.');
    },
    onSuccess: (updated) => {
      const messages: Record<AdminStageAction, string> = {
        approve: 'Order approved. Waiting for picking.',
        complete_picking: 'Picking marked complete.',
        complete_packing: 'Packing marked complete. Waiting for Shipping Details.',
        complete_dispatch: 'Dispatch complete. Order shipped.',
        release: 'Released to workers. Tasks are ready.',
      };
      if (adminStageAction) toast.success(messages[adminStageAction]);
      // Apply mutation payload immediately so stage CTA/status do not linger on stale cache.
      if (updated?.id) {
        qc.setQueryData([...QK.outboundOrders, updated.id], updated);
      }
      void qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
      void qc.invalidateQueries({ queryKey: QK.outboundOrders });
      invalidateWorkflowTasksInventory(qc, {
        referenceId: order.id,
        referenceType: 'outbound_order',
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const latestCarrierShipment = order.carrierShipments?.[0] ?? null;
  const carrierMethod = order.shippingMethod === 'carrier';
  const canRetryCarrier =
    carrierMethod &&
    latestCarrierShipment?.status === 'failed' &&
    (order.status === 'waiting_for_shipping_details' ||
      order.status === 'ready_to_ship' ||
      order.status === 'shipped');

  const retryShipmentMut = useMutation({
    mutationFn: () => ShippingApi.retryShipment(order.id),
    onSuccess: () => {
      toast.success('Carrier shipment retry started.');
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] });
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stageCtaLabel =
    adminStageAction === 'approve'
      ? 'Approve'
      : adminStageAction === 'complete_picking'
        ? 'Mark Picking as Complete'
        : adminStageAction === 'complete_packing'
          ? 'Mark Packing as Complete'
          : adminStageAction === 'complete_dispatch'
            ? 'Mark Dispatch as Complete'
            : adminStageAction === 'release'
              ? 'Release to workers'
              : null;

  const [dispatchConfirmOpen, setDispatchConfirmOpen] = useState(false);

  const runStageAction = () => {
    if (adminStageAction === 'complete_dispatch') {
      setDispatchConfirmOpen(true);
      return;
    }
    stageMut.mutate();
  };

  const statusDisplayLabel =
    order.status === 'pending_approval'
      ? 'Waiting for Approval'
      : order.status === 'picking'
        ? 'Waiting for Picking'
        : order.status === 'packing'
          ? 'Waiting for Packing'
          : order.status === 'waiting_for_shipping_method'
            ? 'Waiting for Shipping Method'
            : order.status === 'waiting_for_shipping_details'
              ? 'Waiting for Shipping Details'
              : order.status === 'ready_to_ship'
              ? 'Waiting for Dispatch'
              : order.status === 'externally_fulfilled'
                ? 'Fulfilled outside warehouse'
                : null;

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
                {order.status === 'pending_approval' ? 'Waiting for Approval' : 'Planned'}
              </span>
            ) : statusDisplayLabel ? (
              <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
                {statusDisplayLabel}
              </span>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {isAdminMode
              ? 'Review plan, then complete each warehouse stage explicitly.'
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
          {stageCtaLabel ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={stageMut.isPending}
              disabled={
                (adminStageAction === 'approve' || adminStageAction === 'release') && !planReady
              }
              title={
                (adminStageAction === 'approve' || adminStageAction === 'release') && !planReady
                  ? 'Complete the warehouse plan first.'
                  : undefined
              }
              onClick={runStageAction}
            >
              {stageCtaLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {isPlannable && !planReady ? (
        <Alert variant="warning" title="Warehouse plan incomplete">
          Open Complete plan, then {isAdminMode ? 'Approve' : 'Release'}.
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
            <DetailRow
              label="Shipping method"
              value={carrierMethod ? 'Shipping Company' : 'Manual'}
            />
            {carrierMethod ? (
              <DetailRow
                label="Shipping company"
                value={order.shippingProviderCode?.trim() || order.carrier?.trim() || '—'}
              />
            ) : order.carrier?.trim() ? (
              <DetailRow label="Carrier label" value={order.carrier.trim()} />
            ) : null}
            {order.omsOrder ? (
              <DetailRow
                label="Linked OMS"
                value={
                  <Link
                    to={`/orders/oms/${order.omsOrder.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {order.omsOrder.orderNumber}
                  </Link>
                }
              />
            ) : null}
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

      {order.status === 'waiting_for_shipping_method' ? (
        <>
          {!isAdminMode ? (
            <Alert variant="info" title="Admin handoff — shipping method">
              Warehouse workers completed pick/pack. An admin or manager must select Manual or
              Shipping Company before shipping details and dispatch can continue.
            </Alert>
          ) : null}
          <ShippingMethodStageCard order={order} />
        </>
      ) : null}

      {order.status === 'waiting_for_shipping_details' ? (
        <ShippingDetailsStageCard order={order} />
      ) : null}

      {carrierMethod && order.status !== 'waiting_for_shipping_details' ? (
        <Card padding="none">
          <Card.Header>
            <Card.Title>Carrier shipment</Card.Title>
            {canRetryCarrier ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={retryShipmentMut.isPending}
                onClick={() => retryShipmentMut.mutate()}
              >
                Retry
              </Button>
            ) : null}
          </Card.Header>
          <Card.Body>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow
                label="Status"
                value={
                  latestCarrierShipment?.status === 'created'
                    ? 'Created'
                    : latestCarrierShipment?.status === 'failed'
                      ? 'Failed'
                      : latestCarrierShipment?.status === 'pending'
                        ? 'Pending'
                        : '—'
                }
              />
              <DetailRow
                label="Provider"
                value={latestCarrierShipment?.providerCode ?? order.shippingProviderCode ?? '—'}
              />
              <DetailRow
                label="AWB"
                value={
                  latestCarrierShipment?.externalAwb?.trim() ||
                  order.trackingNumber?.trim() ||
                  '—'
                }
              />
              <DetailRow
                label="Tracking"
                value={
                  latestCarrierShipment?.trackingNumber?.trim() ||
                  order.trackingNumber?.trim() ||
                  '—'
                }
              />
              {latestCarrierShipment?.lastErrorSafe ? (
                <DetailRow
                  label="Error"
                  value={latestCarrierShipment.lastErrorSafe}
                  className="sm:col-span-2"
                  preWrap
                />
              ) : null}
            </dl>
          </Card.Body>
        </Card>
      ) : null}

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
          <p className="text-xs text-text-muted">
            {isAdminMode
              ? 'Stage actions above complete the current open task.'
              : 'Monitor only — Workers execute on the Tasks page.'}
          </p>
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
        <Alert variant="info" title={isAdminMode ? 'Staged Admin execution' : 'After release'}>
          {isAdminMode
            ? 'Approve starts picking only. Mark each stage complete after physical work. Dispatch complete sets OMS to Shipped.'
            : 'Release starts the workflow. Workers complete tasks on /tasks. Do not confirm stages here.'}
        </Alert>
      ) : null}

      <ConfirmModal
        open={dispatchConfirmOpen}
        title="Mark Dispatch as Complete?"
        confirmLabel="Mark Dispatch as Complete"
        loading={stageMut.isPending}
        onClose={() => !stageMut.isPending && setDispatchConfirmOpen(false)}
        onConfirm={() => {
          stageMut.mutate(undefined, {
            onSettled: () => setDispatchConfirmOpen(false),
          });
        }}
      >
        This will mark the outbound order as dispatched and update the linked OMS order to Shipped.
      </ConfirmModal>
    </div>
  );
}
