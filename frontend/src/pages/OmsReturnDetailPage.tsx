import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { OmsReturnsApi, type OmsReturn } from '../api/oms';
import { Alert, Badge, Button, Card, Modal, Skeleton } from '@ds';
import { useToast } from '../components/ToastProvider';
import { useResolvedLocations } from '../hooks/useResolvedLocations';
import { useAuth } from '../auth/AuthContext';
import { getReturnStatusDisplay, RETURN_STATUS_TONE } from '../lib/oms-return-status';
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

function useIsArabic(): boolean {
  return (
    typeof document !== 'undefined' &&
    (document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl')
  );
}

function AdminOmsReturnSummary({ omsReturn }: { omsReturn: OmsReturn }) {
  const isArabic = useIsArabic();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canRollback =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'wh_operator';
  const [rollbackTarget, setRollbackTarget] = useState<'out_for_delivery' | 'ready_to_ship' | null>(null);
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

  const confirmReturnMut = useMutation({
    mutationFn: () => OmsReturnsApi.confirmReturn(omsReturn.id),
    onSuccess: () => {
      toast.success(
        isArabic
          ? 'تم تأكيد واستلام الإرجاع بنجاح في قسم المرتجعات.'
          : 'Return confirmed and restocked successfully in Returns location.',
      );
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      void qc.invalidateQueries({ queryKey: ['oms-return', omsReturn.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stageMut = useMutation({
    mutationFn: async () => {
      if (adminStageAction === 'approve') {
        return OmsReturnsApi.approve(omsReturn.id, plan?.warehouseId);
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
        approve: isArabic ? 'تمت الموافقة على المرتجع. بانتظار الاستلام.' : 'Return approved. Waiting for receiving.',
        complete_receiving: isArabic ? 'تم تأكيد الاستلام في المستودع.' : 'Receiving marked complete.',
        complete_putaway: isArabic ? 'تم تخزين المرتجع في منطقة المرتجعات بنجاح.' : 'Putaway marked complete.',
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
      toast.success(isArabic ? 'تم رفض المرتجع.' : 'Return rejected.');
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      void qc.invalidateQueries({ queryKey: ['oms-return', omsReturn.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rollbackMut = useMutation({
    mutationFn: (targetStatus: 'out_for_delivery' | 'ready_to_ship') =>
      OmsReturnsApi.rollbackReturn(omsReturn.id, { targetStatus }),
    onSuccess: (res) => {
      setRollbackTarget(null);
      toast.success(
        isArabic
          ? (res.message || 'تم التراجع عن استلام المرتجع وعكس المخزون بنجاح.')
          : (res.message || 'Return rolled back and stock reversed successfully.'),
      );
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      void qc.invalidateQueries({ queryKey: ['oms-return', omsReturn.id] });
      void qc.invalidateQueries({ queryKey: ['oms-orders'] });
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

      {omsReturn.notes?.includes('Rollback executed') && (
        <Alert
          variant="warning"
          title={isArabic ? 'تم التراجع عن المرتجع وعكس المخزون' : 'Return Rolled Back'}
        >
          {omsReturn.notes}
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-text-strong font-mono">
              {omsReturn.returnNumber || omsReturn.id}
            </h1>
            <Badge tone={RETURN_STATUS_TONE[omsReturn.status] || 'neutral'} size="sm" dot>
              {getReturnStatusDisplay(omsReturn.status, isArabic)}
            </Badge>
            {statusDisplayLabel ? (
              <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
                {statusDisplayLabel}
              </span>
            ) : null}
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
              {planReady
                ? isArabic ? 'تعديل الخطة' : 'Edit plan'
                : isArabic ? 'تخصيص الخطة' : 'Customize plan'}
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
              {isArabic ? 'رفض' : 'Reject'}
            </Button>
          ) : null}
          {isWaitingApproval ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={confirmReturnMut.isPending}
              onClick={() => confirmReturnMut.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <i className="fa-solid fa-check me-1.5" aria-hidden="true" />
              {isArabic ? 'تأكيد واستلام المرتجع' : 'Confirm & Restock Return'}
            </Button>
          ) : null}
          {stageCtaLabel && !isWaitingApproval ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={stageMut.isPending}
              onClick={() => stageMut.mutate()}
            >
              {stageCtaLabel}
            </Button>
          ) : null}
          {omsReturn.status === 'completed' && canRollback ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="border-blue-400 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
                onClick={() => setRollbackTarget('out_for_delivery')}
              >
                <i className="fa-solid fa-truck-fast me-1.5" aria-hidden="true" />
                {isArabic ? 'إعادة الإرسال مع الناقل الأصلي' : 'Rollback to Out for Delivery'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="border-indigo-400 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                onClick={() => setRollbackTarget('ready_to_ship')}
              >
                <i className="fa-solid fa-box-archive me-1.5" aria-hidden="true" />
                {isArabic ? 'إعادة لتجهيز الشحن' : 'Rollback to Ready to Ship'}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {isPlannable && !planReady ? (
        <Alert variant="info" title={isArabic ? 'خطة المستودع الافتراضية' : 'Default Warehouse Plan'}>
          {isArabic
            ? 'سيتم استلام وتخزين المرتجع تلقائياً في قسم Returns عبر رصيف الاستلام الافتراضي عند الضغط على "تأكيد واستلام المرتجع".'
            : 'Return will be automatically received and restocked into the Returns location via the default receiving dock upon confirmation.'}
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
              label={isArabic ? 'الحالة' : 'Status'}
              value={
                <Badge tone={RETURN_STATUS_TONE[omsReturn.status] || 'neutral'} size="xs" dot>
                  {getReturnStatusDisplay(omsReturn.status, isArabic)}
                </Badge>
              }
            />
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

      <Modal
        open={Boolean(rollbackTarget)}
        onClose={() => setRollbackTarget(null)}
        title={
          rollbackTarget === 'out_for_delivery'
            ? isArabic
              ? 'إعادة الإرسال مع الناقل الأصلي (خارج للتسليم)'
              : 'Rollback to Out for Delivery (Reship with original carrier)'
            : isArabic
            ? 'إعادة الطلب لتجهيز الشحن (جاهز للشحن)'
            : 'Rollback to Ready to Ship'
        }
      >
        <div className="space-y-4 text-sm text-text-strong">
          <Alert
            variant="warning"
            title={
              isArabic
                ? 'تنبيه: سيتم عكس المخزون وإلغاء الاستلام'
                : 'Warning: Inventory will be reversed and return cancelled'
            }
          >
            {isArabic
              ? `سيتم سحب كامل الكمية المستلمة في المرتجع (${omsReturn.returnNumber || omsReturn.id}) من موقع المرتجعات بحركة تعويضية في السجل، وإعادة الطلب (${omsReturn.omsOrder?.orderNumber ?? omsReturn.omsOrderId}) لدورة الشحن.`
              : `The received quantities for return (${omsReturn.returnNumber || omsReturn.id}) will be deducted from the Returns location with a compensating ledger entry, and the order (${omsReturn.omsOrder?.orderNumber ?? omsReturn.omsOrderId}) will return to the shipping workflow.`}
          </Alert>
          {rollbackTarget === 'out_for_delivery' ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              {isArabic
                ? 'الخيار (أ): سيتم إنشاء طلب إعادة شحن فوري مع الناقل الأصلي عبر الـ API. لن يتم تحويل حالة الطلب إلى "خارج للتسليم" إلا بعد تأكيد قبول الناقل للشحنة بنجاح.'
                : 'Option A: An immediate reshipment will be submitted to the original carrier via API. The order will NOT advance to Out for Delivery unless the carrier API confirms acceptance.'}
            </div>
          ) : (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
              {isArabic
                ? 'الخيار (ب): سيعود الطلب إلى "جاهز للشحن" في مرحلة "تفاصيل الشحن". لن يتم إرسال أي شحنة للناقل تلقائياً، مما يتيح لك مراجعة وتعديل البيانات واختيار شركة شحن أخرى.'
                : 'Option B: The order will return to Ready to Ship / Shipping Details. No shipment is created automatically, allowing you to review details and select another carrier.'}
            </div>
          )}
          <p className="text-text-muted">
            {isArabic
              ? 'يرجى التأكد من أن البضاعة ما زالت موجودة في موقع المرتجعات ولم يتم نقلها أو صرفها لطلب آخر.'
              : 'Please ensure that the inventory is still untouched in the Returns location and has not been transferred or allocated to another order.'}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRollbackTarget(null)}>
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              loading={rollbackMut.isPending}
              onClick={() => rollbackTarget && rollbackMut.mutate(rollbackTarget)}
            >
              <i className="fa-solid fa-rotate-left mr-1.5" aria-hidden />
              {isArabic ? 'تأكيد التراجع وعكس المخزون' : 'Confirm Rollback'}
            </Button>
          </div>
        </div>
      </Modal>
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
