import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { OmsReturnsApi, type OmsReturn } from '../api/oms';
import { Alert, Button, Card, Skeleton } from '@ds';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { useResolvedLocations } from '../hooks/useResolvedLocations';
import {
  inboundAdminPlanIsComplete,
  isAdminExecutionMode,
  normalizeExecutionMode,
} from '../lib/execution-plan';

function fmtQty(s: string | number): string {
  const n = Number(s);
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return String(s);
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

function locationLabel(
  id: string,
  locationById: Map<string, { fullPath?: string | null; barcode?: string | null }>,
): string {
  const loc = locationById.get(id);
  if (!loc) return id;
  return loc.fullPath?.trim() || id;
}

function productImageSrc(imagePath?: string | null): string | null {
  if (!imagePath?.trim()) return null;
  return `/api/client/media/${imagePath.replace(/^\/+/, '')}`;
}

function AdminOmsReturnSummary({ omsReturn }: { omsReturn: OmsReturn }) {
  const toast = useToast();
  const qc = useQueryClient();
  const mode = normalizeExecutionMode(omsReturn.executionMode);
  const isAdminMode = isAdminExecutionMode(omsReturn.executionMode);
  const isWaitingApproval = omsReturn.status === 'requested';
  const isPlannable = isWaitingApproval;
  const plan = omsReturn.executionPlan;

  const planReady = useMemo(
    () =>
      inboundAdminPlanIsComplete(
        plan,
        omsReturn.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          expectedQuantity: l.quantity,
        })),
      ),
    [omsReturn.lines, plan],
  );

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

  const adminStageAction = omsReturn.nextAdminAction ?? null;

  const stageMut = useMutation({
    mutationFn: async () => {
      if (adminStageAction === 'approve') {
        if (!planReady || !plan) throw new Error('Complete the warehouse plan first.');
        return OmsReturnsApi.approve(omsReturn.id, plan.warehouseId);
      }
      if (adminStageAction === 'complete_receiving') {
        return OmsReturnsApi.completeReceiving(omsReturn.id);
      }
      if (adminStageAction === 'complete_putaway') {
        return OmsReturnsApi.completePutaway(omsReturn.id);
      }
      throw new Error('No stage action available.');
    },
    onSuccess: () => {
      const messages = {
        approve: 'Return approved. Waiting for receiving.',
        complete_receiving: 'Receiving marked complete.',
        complete_putaway: 'Putaway marked complete.',
      } as const;
      if (adminStageAction) toast.success(messages[adminStageAction]);
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      void qc.invalidateQueries({ queryKey: ['oms-return', omsReturn.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => OmsReturnsApi.reject(omsReturn.id),
    onSuccess: () => {
      toast.success('Return rejected.');
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      void qc.invalidateQueries({ queryKey: ['oms-return', omsReturn.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stageCtaLabel =
    adminStageAction === 'approve'
      ? 'Approve'
      : adminStageAction === 'complete_receiving'
        ? 'Mark Receiving as Complete'
        : adminStageAction === 'complete_putaway'
          ? 'Mark Putaway as Complete'
          : null;

  const statusDisplayLabel =
    isWaitingApproval
      ? planReady
        ? 'Waiting for Approval'
        : 'Plan incomplete'
      : adminStageAction === 'complete_receiving'
        ? 'Waiting for Receiving'
        : adminStageAction === 'complete_putaway'
          ? 'Waiting for Putaway'
          : null;

  const whByProduct = useMemo(() => {
    const map = new Map<string, { received: string; expected: string; posted: string }>();
    for (const l of omsReturn.warehouseReturn?.lines ?? []) {
      map.set(l.productId, {
        received: l.receivedQuantity,
        expected: l.expectedQuantity,
        posted: l.postedQuantity,
      });
    }
    return map;
  }, [omsReturn.warehouseReturn?.lines]);

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/oms/returns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-strong"
      >
        ← All OMS returns
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-text-strong font-mono">
              {omsReturn.returnNumber || omsReturn.id}
            </h1>
            {statusDisplayLabel ? (
              <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
                {statusDisplayLabel}
              </span>
            ) : (
              <StatusBadge status={omsReturn.status} />
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {isAdminMode
              ? 'Complete the plan, then approve, receive, and put away each stage separately.'
              : 'Review the return and warehouse plan.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPlannable ? (
            <Link
              to={`/oms/returns/${omsReturn.id}/edit`}
              className="inline-flex h-[34px] items-center rounded-lg border border-border bg-surface-card px-3 text-sm font-medium text-text-strong hover:bg-surface-sunken"
            >
              {planReady ? 'Edit plan' : 'Complete plan'}
            </Link>
          ) : null}
          {isWaitingApproval ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={rejectMut.isPending}
              onClick={() => rejectMut.mutate()}
            >
              Reject
            </Button>
          ) : null}
          {stageCtaLabel ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={stageMut.isPending}
              disabled={adminStageAction === 'approve' && !planReady}
              title={
                adminStageAction === 'approve' && !planReady
                  ? 'Complete the warehouse plan (dock + putaway) first.'
                  : undefined
              }
              onClick={() => stageMut.mutate()}
            >
              {stageCtaLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {isPlannable && !planReady ? (
        <Alert variant="warning" title="Warehouse plan incomplete">
          Open Complete plan, set the receiving area and putaway locations, then Approve.
        </Alert>
      ) : null}

      <Card padding="none">
        <Card.Header>
          <Card.Title>Return details</Card.Title>
        </Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <DetailRow label="Return #" value={omsReturn.returnNumber || omsReturn.id} />
            <DetailRow
              label="OMS order"
              value={
                omsReturn.omsOrder ? (
                  <Link
                    to={`/orders/oms/${omsReturn.omsOrderId}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {omsReturn.omsOrder.orderNumber}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <DetailRow label="Client" value={omsReturn.company?.name ?? '—'} />
            <DetailRow label="Execution" value={mode === 'admin' ? 'Admin' : 'Workers'} />
            <DetailRow label="Created" value={formatDateTime(omsReturn.createdAt)} />
            {omsReturn.approvedAt ? (
              <DetailRow label="Approved" value={formatDateTime(omsReturn.approvedAt)} />
            ) : null}
            {omsReturn.completedAt ? (
              <DetailRow label="Completed" value={formatDateTime(omsReturn.completedAt)} />
            ) : null}
            {omsReturn.warehouseReturn ? (
              <DetailRow
                label="Warehouse return"
                value={
                  <Link
                    to={`/returns/${omsReturn.warehouseReturn.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {omsReturn.warehouseReturn.orderNumber}
                  </Link>
                }
              />
            ) : null}
            <DetailRow
              label="Reason"
              value={omsReturn.reason?.trim() || '—'}
              className="sm:col-span-2"
              preWrap
            />
            <DetailRow
              label="Notes"
              value={omsReturn.notes?.trim() || '—'}
              className="sm:col-span-2"
              preWrap
            />
          </dl>
        </Card.Body>
      </Card>

      {plan ? (
        <Card padding="none">
          <Card.Header>
            <Card.Title>Warehouse plan</Card.Title>
          </Card.Header>
          <Card.Body>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow
                label="Receiving area"
                value={
                  plan.receivingDockId
                    ? locationLabel(plan.receivingDockId, locationById)
                    : '—'
                }
              />
              <DetailRow
                label="Plan updated"
                value={plan.planUpdatedAt ? formatDateTime(plan.planUpdatedAt) : '—'}
              />
            </dl>
            <div className="mt-4 space-y-3">
              {(plan.lines ?? []).map((line) => (
                <div key={line.productId} className="text-sm">
                  <div className="font-medium text-text-strong">
                    {omsReturn.lines.find((l) => l.productId === line.productId)?.product
                      ?.sku ?? line.productId}{' '}
                    · qty {fmtQty(line.expectedQty)}
                  </div>
                  <ul className="mt-1 list-inside list-disc text-text-muted">
                    {(line.putaway ?? []).map((p) => (
                      <li key={`${p.locationId}-${p.qty}`}>
                        {locationLabel(p.locationId, locationById)} — {fmtQty(p.qty)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <Card.Header>
          <Card.Title>Line items</Card.Title>
          <span className="text-xs font-medium text-text-muted">
            {omsReturn.lines.length} {omsReturn.lines.length === 1 ? 'item' : 'items'}
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
                <th className="px-4 py-2.5 text-right">Return qty</th>
                <th className="px-4 py-2.5 text-right">Received</th>
                <th className="px-4 py-2.5 text-right">Put away</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {omsReturn.lines.map((line) => {
                const imageSrc = productImageSrc(line.product?.imagePath);
                const wh = whByProduct.get(line.productId);
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
                    <td className="px-4 py-2.5 text-right font-mono">{fmtQty(line.quantity)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {wh ? fmtQty(wh.received) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {wh ? fmtQty(wh.posted) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {isAdminMode ? (
        <p className="text-xs text-text-muted">
          Approve starts receiving only. Mark receiving complete, then mark putaway complete —
          each stage separately. Putaway restocks inventory to the planned locations.
        </p>
      ) : null}
    </div>
  );
}

export function OmsReturnDetailPage() {
  const { id = '' } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['oms-return', id],
    queryFn: () => OmsReturnsApi.get(id),
    enabled: !!id,
  });

  if (!id) return null;
  if (query.isLoading) {
    return (
      <div className="space-y-4 animate-enter">
        <Skeleton height={20} width="30%" />
        <Skeleton height={180} />
        <Skeleton height={220} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="animate-enter">
        <Alert variant="error" title="Failed to load OMS return." />
      </div>
    );
  }

  return <AdminOmsReturnSummary omsReturn={query.data} />;
}
