import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { OmsApi, type OmsOrderListItem } from '../api/oms';
import { OutboundApi, type BulkIdsResponse } from '../api/outbound';
import { AdminListPageShell } from '../components/AdminListPageShell';
import { DataTable, type Column } from '../components/DataTable';
import { OmsBulkShippingDetailsModal } from '../components/oms/OmsBulkShippingDetailsModal';
import { useOmsOrderRowActions } from '../components/oms/useOmsOrderRowActions';
import { OmsStageBadge } from '../components/oms/OmsStageBadge';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { runInChunks } from '../lib/chunk-ids';
import { isOmsAdminCancellableStatus } from '../lib/oms-order-cancel';
import { omsOperationalStageLabel, orderOperationalStage } from '../lib/oms-operational-stage';
import {
  getClientFxSnapshot,
  toComparableUsd,
} from '../lib/shipping-compare';

const CHUNK = 100;
const ISSUE = new Set(['failed_delivery', 'cancelled', 'rejected', 'returned']);

function useArabic() {
  return (
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl')
  );
}

function outboundId(order: OmsOrderListItem) {
  return order.outboundOrderId ?? order.linkedOutboundOrder?.id ?? null;
}

const CONFIRMED_SHIPPING = new Set([
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'returned',
]);

function labelReadiness(order: OmsOrderListItem): 'ready' | 'missing' | 'unconfirmed' {
  const confirmed =
    CONFIRMED_SHIPPING.has(order.status) ||
    CONFIRMED_SHIPPING.has(order.linkedOutboundOrder?.status ?? '');
  if (!confirmed) return 'unconfirmed';
  return 'ready';
}

function shipmentSent(order: OmsOrderListItem) {
  return Boolean(
    order.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.trackingNumber?.trim() ||
      order.linkedOutboundOrder?.hasCarrierShipment,
  );
}

function summarize(result: { failed?: number; requested?: number }) {
  return result.failed ? `${result.failed} failed` : '';
}

export function OmsBatchDetailPage() {
  const { id = '' } = useParams();
  const isArabic = useArabic();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueNote, setIssueNote] = useState('');
  const [search, setSearch] = useState('');
  const rowActions = useOmsOrderRowActions({ isArabic, batchId: id });

  const query = useQuery({
    queryKey: QK.omsBatch(id),
    queryFn: () => OmsApi.getBatch(id),
    enabled: Boolean(id),
  });
  const batch = query.data;
  const orders = useMemo(() => (batch?.orders ?? []).map((row) => row.order), [batch]);
  const scoped = useMemo(() => {
    if (!selected.size) return orders;
    return orders.filter((order) => selected.has(order.id));
  }, [orders, selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = batch?.orders ?? [];
    if (!q) return source;
    return source.filter((row) => {
      const hay = `${row.order.orderNumber} ${row.order.recipientName ?? ''} ${row.order.company?.name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [batch, search]);

  const waitingConfirm = scoped.filter((order) => order.status === 'waiting_for_confirmation');
  const waitingApproval = scoped.filter(
    (order) =>
      order.status === 'confirmed_waiting_for_admin_approval' ||
      order.status === 'pending_approval' ||
      order.status === 'pending',
  );
  const picking = scoped.filter((order) => {
    const outbound = order.linkedOutboundOrder?.status;
    return (
      order.status === 'processing' &&
      (outbound === 'picking' ||
        outbound === 'draft' ||
        outbound === 'allocated' ||
        outbound === 'pending_approval' ||
        outbound === 'confirmed' ||
        outbound === 'pending_stock')
    );
  });
  const packing = scoped.filter(
    (order) => order.status === 'processing' && order.linkedOutboundOrder?.status === 'packing',
  );
  const shippingDetails = scoped.filter((order) => {
    const outbound = order.linkedOutboundOrder?.status;
    const stage = outbound === 'waiting_for_shipping_method' || outbound === 'waiting_for_shipping_details';
    return stage && !shipmentSent(order);
  });
  // Confirm shipping only after a real AWB / carrier shipment — never because default manual.
  const shippingConfirm = scoped.filter((order) => {
    const outbound = order.linkedOutboundOrder?.status;
    const stage = outbound === 'waiting_for_shipping_method' || outbound === 'waiting_for_shipping_details';
    return stage && shipmentSent(order);
  });

  const inShippingStage = orders.some((order) => {
    const st = order.linkedOutboundOrder?.status;
    return st === 'waiting_for_shipping_method' || st === 'waiting_for_shipping_details';
  });

  const shippingAnalysis = useMemo(() => {
    const fx = getClientFxSnapshot();
    const byProvider = new Map<
      string,
      { label: string; count: number; syp: number; usd: number }
    >();
    let assigned = 0;
    let unassigned = 0;
    let sypTotal = 0;
    let usdTotal = 0;

    for (const order of orders) {
      const st = order.linkedOutboundOrder?.status;
      const inShip =
        st === 'waiting_for_shipping_method' ||
        st === 'waiting_for_shipping_details' ||
        st === 'ready_to_ship' ||
        Boolean(order.trackingNumber) ||
        Boolean(order.linkedOutboundOrder?.shippingProviderCode);
      if (!inShip) continue;

      const method = order.linkedOutboundOrder?.shippingMethod;
      const providerCode = (order.linkedOutboundOrder?.shippingProviderCode || '').toUpperCase();
      // Soft-assign = carrier + provider from Shipping Details (ignore legacy default manual).
      const isSoftAssigned = method === 'carrier' && Boolean(providerCode);

      if (!isSoftAssigned) {
        if (st === 'waiting_for_shipping_method' || st === 'waiting_for_shipping_details') {
          unassigned++;
        }
        continue;
      }

      const code = providerCode;
      const label = order.shippingCarrierName || order.carrier || code;

      assigned++;
      const price = Number(order.linkedOutboundOrder?.shippingQuotedPrice);
      const currency = (order.linkedOutboundOrder?.shippingQuotedCurrency || 'USD').toUpperCase();
      const bucket = byProvider.get(code) ?? { label, count: 0, syp: 0, usd: 0 };
      bucket.count += 1;
      if (Number.isFinite(price) && price >= 0) {
        if (currency === 'SYP') {
          bucket.syp += price;
          sypTotal += price;
        } else {
          bucket.usd += price;
          usdTotal += price;
        }
      }
      byProvider.set(code, bucket);
    }

    const totalOrders = assigned + unassigned;
    const cards = [...byProvider.entries()]
      .map(([code, v]) => ({
        code,
        label: v.label,
        count: v.count,
        share: totalOrders ? Math.round((v.count / totalOrders) * 100) : 0,
        syp: v.syp,
        usd: v.usd,
      }))
      .sort((a, b) => b.count - a.count);

    const totalUsdNorm = usdTotal + toComparableUsd(sypTotal, 'SYP', fx);
    const totalSypNorm = sypTotal + usdTotal * fx.usdToSypRate;

    // Visible only in shipping-details stage after soft-assign (monitoring, not controls).
    return {
      fx,
      cards,
      unassigned,
      assigned,
      sypTotal,
      usdTotal,
      totalUsdNorm,
      totalSypNorm,
      show: inShippingStage && assigned > 0,
    };
  }, [orders, isArabic, inShippingStage]);
  const dispatch = scoped.filter(
    (order) =>
      order.status === 'ready_to_ship' ||
      order.linkedOutboundOrder?.status === 'ready_to_ship' ||
      order.linkedOutboundOrder?.status === 'packed',
  );
  const delivery = scoped.filter((order) => order.status === 'shipped' || order.status === 'out_for_delivery');
  const returns = scoped.filter((order) => order.status === 'failed_delivery');
  const cancellable = scoped.filter(
    (order) => isOmsAdminCancellableStatus(order.status) && order.status !== 'cancelled',
  );
  const printable = orders.filter((order) => labelReadiness(order) === 'ready');

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: QK.omsBatch(id) }),
      qc.invalidateQueries({ queryKey: QK.omsBatches }),
      qc.invalidateQueries({ queryKey: QK.omsOrders }),
    ]);
  }

  async function run(key: string, work: () => Promise<string | void>) {
    setBusy(key);
    try {
      const note = await work();
      toast.success(note || (isArabic ? 'تم تنفيذ الإجراء على الطلبات المناسبة.' : 'Action applied to the eligible orders.'));
      setSelected(new Set());
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function chunkedOms(
    ids: string[],
    call: (ids: string[]) => Promise<{ failed: number }>,
  ) {
    const parts = await runInChunks(ids, CHUNK, call);
    const failed = parts.reduce((sum, part) => sum + part.failed, 0);
    return failed ? (isArabic ? `بعض الطلبات لم تكتمل (${failed}).` : `${failed} orders could not be updated.`) : undefined;
  }

  /**
   * Runs an outbound bulk action in chunks and, if any outbound order fails,
   * flags the matching OMS orders in this batch with the (truncated) error.
   */
  async function outboundBulk(
    list: OmsOrderListItem[],
    call: (ids: string[]) => Promise<BulkIdsResponse>,
  ): Promise<string | undefined> {
    const outboundToOms = new Map<string, string>();
    for (const order of orders) {
      const ob = outboundId(order);
      if (ob) outboundToOms.set(ob, order.id);
    }
    const ids = list.map(outboundId).filter((value): value is string => Boolean(value));
    const parts = await runInChunks(ids, CHUNK, call);
    const failed = parts.reduce((sum, part) => sum + part.failed, 0);
    const failures = parts.flatMap((part) => part.failures ?? []);
    if (!failures.length) return failed ? summarize({ failed }) : undefined;

    const byNote = new Map<string, Set<string>>();
    for (const failure of failures) {
      const omsId = outboundToOms.get(failure.outboundOrderId);
      if (!omsId) continue;
      const note = (failure.error || (isArabic ? 'فشل الإجراء' : 'Action failed')).slice(0, 200);
      const bucket = byNote.get(note) ?? new Set<string>();
      bucket.add(omsId);
      byNote.set(note, bucket);
    }
    let flagged = 0;
    try {
      for (const [note, omsIds] of byNote) {
        await OmsApi.flagBatchOrders(id, [...omsIds], note);
        flagged += omsIds.size;
      }
    } catch {
      // Flagging is best-effort: the bulk action result itself must still be reported.
    }
    return isArabic
      ? `فشل ${failed || failures.length} طلب${flagged ? ` — تم تعليم ${flagged} كمشكلة في المجموعة` : ''}.`
      : `${failed || failures.length} failed${flagged ? ` — ${flagged} flagged as issues in this batch` : ''}.`;
  }

  const progress = batch && batch.orderCount ? Math.round((batch.completedCount / batch.orderCount) * 100) : 0;
  const stageText =
    batch?.stageKind === 'operational' && batch.stageKey
      ? omsOperationalStageLabel(batch.stageKey, isArabic)
      : batch?.stageKind === 'status' && batch.stageKey
        ? null
        : batch?.stageKind === 'mixed'
          ? isArabic
            ? 'حالات متعددة'
            : 'Mixed statuses'
          : isArabic
            ? 'بدون طلبات'
            : 'Empty';

  const columns: Column<(typeof filtered)[number]>[] = [
    {
      header: (
        <input
          type="checkbox"
          aria-label={isArabic ? 'تحديد الصفحة' : 'Select page'}
          checked={filtered.length > 0 && filtered.every((row) => selected.has(row.order.id))}
          onChange={(event) => {
            const next = new Set(selected);
            for (const row of filtered) {
              if (event.target.checked) next.add(row.order.id);
              else next.delete(row.order.id);
            }
            setSelected(next);
          }}
        />
      ),
      accessor: (row) => (
        <input
          type="checkbox"
          aria-label={row.order.orderNumber}
          checked={selected.has(row.order.id)}
          onChange={(event) => {
            const next = new Set(selected);
            if (event.target.checked) next.add(row.order.id);
            else next.delete(row.order.id);
            setSelected(next);
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ),
    },
    {
      header: isArabic ? 'رقم الطلب' : 'Order',
      accessor: (row) => <span className="font-semibold">{row.order.orderNumber}</span>,
    },
    { header: isArabic ? 'العميل' : 'Customer', accessor: (row) => row.order.recipientName || '—' },
    { header: isArabic ? 'الشركة' : 'Client', accessor: (row) => row.order.company?.name || '—' },
    {
      header: isArabic ? 'حالة الطلب' : 'Order status',
      accessor: (row) => <OmsStatusBadge status={row.order.status} isArabic={isArabic} />,
    },
    { header: isArabic ? 'المرحلة' : 'Stage', accessor: (row) => <OmsStageBadge order={row.order} isArabic={isArabic} /> },
    {
      header: isArabic ? 'الشحن' : 'Shipping',
      accessor: (row) => row.order.shippingCarrierName || row.order.carrier || '—',
    },
    { header: isArabic ? 'التتبع' : 'Tracking', accessor: (row) => row.order.trackingNumber || '—' },
    {
      header: isArabic ? 'ملاحظة' : 'Issue',
      accessor: (row) => {
        if (row.issueNote) {
          const isProviderCancel = /provider cancelled/i.test(row.issueNote);
          return (
            <div className="max-w-xs space-y-0.5">
              {isProviderCancel ? (
                <div className="text-[11px] font-bold uppercase tracking-wide text-rose-800">
                  {isArabic ? 'ألغتها شركة الشحن' : 'Provider cancelled'}
                </div>
              ) : null}
              <span className="text-rose-700 text-xs leading-snug whitespace-pre-wrap">
                {row.issueNote}
              </span>
            </div>
          );
        }
        if (ISSUE.has(row.order.status)) {
          return <OmsStatusBadge status={row.order.status} isArabic={isArabic} />;
        }
        return '—';
      },
    },
    {
      header: isArabic ? 'الإجراءات' : 'Actions',
      accessor: (row) => rowActions.menu(row.order),
    },
  ];

  const actionCountHint = selected.size
    ? isArabic
      ? 'الإجراءات ستُطبق على المحدد من بين الطلبات المناسبة فقط.'
      : 'Actions apply only to selected orders that are eligible.'
    : isArabic
      ? 'بدون تحديد، الإجراء يشمل كل الطلبات المناسبة داخل المجموعة.'
      : 'With nothing selected, the action includes every eligible order in this batch.';

  return (
    <AdminListPageShell
      icon="fa-layer-group"
      title={batch ? (batch.name ? `${batch.batchNumber} · ${batch.name}` : batch.batchNumber) : isArabic ? 'مجموعة' : 'Batch'}
      subtitle={
        isArabic
          ? 'نفس الطلبات تبقى داخل هذه المجموعة حتى لو تغيرت حالتها أو اختفت من فلتر قائمة الطلبات.'
          : 'These orders stay in this batch even after their status changes and they leave the orders-list filter.'
      }
      isArabic={isArabic}
      navActions={
        <Link to="/oms/batches" className="text-sm font-semibold text-emerald-800">
          {isArabic ? 'العودة إلى المجموعات' : 'Back to batches'}
        </Link>
      }
    >
      {query.isLoading || !batch ? (
        <p className="text-sm text-text-muted">{isArabic ? 'جارٍ التحميل…' : 'Loading…'}</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-5">
            <Metric label={isArabic ? 'الطلبات' : 'Orders'} value={String(batch.orderCount)} />
            <Metric label={isArabic ? 'مكتمل' : 'Completed'} value={String(batch.completedCount)} />
            <Metric label={isArabic ? 'متبقي' : 'Remaining'} value={String(batch.pendingCount)} />
            <Metric label={isArabic ? 'مشكلات' : 'Issues'} value={String(batch.issueCount)} />
            <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
              <div className="text-sm text-text-muted">{isArabic ? 'التقدم' : 'Progress'}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1 text-xs">
                {batch.completedCount} / {batch.orderCount} · {progress}%
                {stageText ? ` · ${stageText}` : ''}
              </div>
              {batch.stageKind === 'status' && batch.stageKey ? (
                <div className="mt-2">
                  <OmsStatusBadge status={batch.stageKey} isArabic={isArabic} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Metric label={isArabic ? 'محدد' : 'Selected'} value={String(batch.selectedCount ?? batch.orderCount)} />
            <Metric label={isArabic ? 'تم الالتقاط' : 'Picked'} value={String(batch.pickedCount ?? 0)} />
            <Metric label={isArabic ? 'تمت التعبئة' : 'Packed'} value={String(batch.packedCount ?? 0)} />
            <Metric label={isArabic ? 'جاهز للشحن' : 'Ready'} value={String(batch.readyToShipCount ?? 0)} />
            <Metric label={isArabic ? 'تم الشحن' : 'Shipped'} value={String(batch.shippedCount ?? 0)} />
            <Metric label={isArabic ? 'تم التسليم' : 'Delivered'} value={String(batch.deliveredCount ?? 0)} />
            <Metric label={isArabic ? 'مشكلات' : 'Issues'} value={String(batch.issueCount)} />
          </div>

          <Workflow orders={orders} isArabic={isArabic} />

          {shippingAnalysis.show ? (
            <div className="mb-4 space-y-3">
              <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
                <div className="text-sm font-semibold text-text-strong">
                  {isArabic ? 'تحليل شركات الشحن' : 'Shipping companies analysis'}
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {isArabic
                    ? 'يظهر بعد تعيين الشركات في تفاصيل الشحن (مراقبة فقط)'
                    : 'Appears after carrier assignment in Shipping Details (monitoring only)'}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {shippingAnalysis.cards.map((card) => (
                    <div
                      key={card.code}
                      className="rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2.5"
                    >
                      <div className="text-xs font-bold text-text-strong truncate">{card.label}</div>
                      <div className="mt-1 text-lg font-extrabold text-emerald-700">
                        {card.count}{' '}
                        <span className="text-xs font-semibold text-text-muted">
                          ({card.share}%)
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted space-y-0.5">
                        {card.syp > 0 ? (
                          <div>
                            {card.syp.toLocaleString()} SYP
                          </div>
                        ) : null}
                        {card.usd > 0 ? <div>${card.usd.toFixed(2)} USD</div> : null}
                        {card.syp <= 0 && card.usd <= 0 ? (
                          <div>{isArabic ? 'بدون تسعيرة محفوظة' : 'No saved quote yet'}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {shippingAnalysis.unassigned > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 dark:bg-amber-950/30">
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {isArabic ? 'بدون تعيين / محظور' : 'Unassigned / Issues'}
                      </div>
                      <div className="mt-1 text-lg font-extrabold text-amber-800 dark:text-amber-300">
                        {shippingAnalysis.unassigned}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
                <div className="text-sm font-semibold text-text-strong">
                  {isArabic ? 'تكلفة الشحن للدفعة' : 'Batch shipping cost'}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div className="rounded-lg bg-surface-sunken px-3 py-2">
                    <div className="text-text-muted">{isArabic ? 'مجموع الليرة' : 'SYP quotes'}</div>
                    <div className="mt-0.5 font-bold tabular-nums">
                      {shippingAnalysis.sypTotal.toLocaleString()} SYP
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-sunken px-3 py-2">
                    <div className="text-text-muted">{isArabic ? 'مجموع الدولار' : 'USD quotes'}</div>
                    <div className="mt-0.5 font-bold tabular-nums">
                      ${shippingAnalysis.usdTotal.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-sunken px-3 py-2">
                    <div className="text-text-muted">{isArabic ? 'الإجمالي (USD)' : 'Total (USD)'}</div>
                    <div className="mt-0.5 font-bold tabular-nums">
                      ${shippingAnalysis.totalUsdNorm.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-sunken px-3 py-2">
                    <div className="text-text-muted">{isArabic ? 'الإجمالي (SYP)' : 'Total (SYP)'}</div>
                    <div className="mt-0.5 font-bold tabular-nums">
                      {Math.round(shippingAnalysis.totalSypNorm).toLocaleString()} SYP
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-[11px] text-sky-900 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800">
                  <div className="font-semibold">{isArabic ? 'سعر الصرف المستخدم' : 'Exchange rate used'}</div>
                  <div className="mt-0.5">
                    1 USD = {shippingAnalysis.fx.usdToSypRate.toLocaleString()} SYP · 1 SYP ={' '}
                    {(1 / shippingAnalysis.fx.usdToSypRate).toFixed(8)} USD
                  </div>
                  <div className="mt-0.5 text-sky-800/80 dark:text-sky-200/80">
                    {isArabic ? 'المصدر' : 'Source'}: {shippingAnalysis.fx.source} ·{' '}
                    {new Date(shippingAnalysis.fx.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {(() => {
            const basis = selected.size ? scoped : orders;
            const ready = basis.filter((order) => labelReadiness(order) === 'ready');
            const missing = basis.filter((order) => labelReadiness(order) === 'missing');
            const confirmed = basis.filter((order) => labelReadiness(order) !== 'unconfirmed');
            if (!orders.length) return null;
            return (
              <div className="mb-3 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs text-text-muted">
                <div>
                  {isArabic
                    ? `تأكيد الشحن: ${confirmed.length} · بوليصات متاحة: ${ready.length} · بدون بوليصة: ${missing.length}`
                    : `Shipping confirmed: ${confirmed.length} · Labels available: ${ready.length} · No label: ${missing.length}`}
                </div>
              </div>
            );
          })()}

          <div className="mb-4 rounded-xl border border-border-subtle bg-surface p-3">
            <div className="mb-2 text-xs text-text-muted">{actionCountHint}</div>
            <div className="flex flex-wrap gap-1.5">
              <Action
                show={waitingConfirm.length > 0}
                busy={busy}
                label={isArabic ? `تأكيد (${waitingConfirm.length})` : `Confirm (${waitingConfirm.length})`}
                onClick={() =>
                  void run('confirm', () => chunkedOms(waitingConfirm.map((order) => order.id), OmsApi.confirmBulk))
                }
              />
              <Action
                show={waitingApproval.length > 0}
                busy={busy}
                label={isArabic ? `موافقة (${waitingApproval.length})` : `Approve (${waitingApproval.length})`}
                onClick={() =>
                  void run('approve', () => chunkedOms(waitingApproval.map((order) => order.id), OmsApi.approveBulk))
                }
              />
              <Action
                show={picking.length > 0}
                busy={busy}
                label={isArabic ? `متابعة إلى التعبئة (${picking.length})` : `Continue to packing (${picking.length})`}
                onClick={() =>
                  void run('picking', () =>
                    outboundBulk(picking, (chunk) => OutboundApi.bulkCompletePicking(chunk)),
                  )
                }
              />
              <Action
                show={packing.length > 0}
                busy={busy}
                label={isArabic ? `متابعة إلى الشحن (${packing.length})` : `Continue to shipping (${packing.length})`}
                onClick={() =>
                  void run('packing', () =>
                    outboundBulk(packing, (chunk) => OutboundApi.bulkCompletePacking(chunk)),
                  )
                }
              />
              <Action
                show={shippingDetails.length > 0}
                busy={busy}
                label={isArabic ? `تفاصيل الشحن (${shippingDetails.length})` : `Shipping details (${shippingDetails.length})`}
                onClick={() => setShippingOpen(true)}
              />
              <Action
                show={shippingConfirm.length > 0}
                busy={busy}
                label={isArabic ? `تأكيد الشحن (${shippingConfirm.length})` : `Confirm shipping (${shippingConfirm.length})`}
                onClick={() =>
                  void run('shipping-confirm', () =>
                    outboundBulk(shippingConfirm, (chunk) => OutboundApi.bulkCompleteShippingDetails(chunk)),
                  )
                }
              />
              <Action
                show={dispatch.length > 0}
                busy={busy}
                label={isArabic ? `خروج للتسليم (${dispatch.length})` : `Out for delivery (${dispatch.length})`}
                onClick={() =>
                  void run('dispatch', () =>
                    outboundBulk(dispatch, (chunk) => OutboundApi.bulkCompleteDispatch(chunk)),
                  )
                }
              />
              <Action
                show={delivery.length > 0}
                busy={busy}
                label={isArabic ? `تم التسليم (${delivery.length})` : `Mark delivered (${delivery.length})`}
                onClick={() =>
                  void run('delivered', () => chunkedOms(delivery.map((order) => order.id), OmsApi.deliveredBulk))
                }
              />
              <Action
                show={delivery.length > 0}
                busy={busy}
                label={isArabic ? `تعذر التسليم (${delivery.length})` : `Failed delivery (${delivery.length})`}
                onClick={() =>
                  void run('failed', () => chunkedOms(delivery.map((order) => order.id), OmsApi.failedDeliveryBulk))
                }
              />
              <Action
                show={returns.length > 0}
                busy={busy}
                label={isArabic ? `مرتجع (${returns.length})` : `Returned (${returns.length})`}
                onClick={() =>
                  void run('returned', () => chunkedOms(returns.map((order) => order.id), OmsApi.returnedBulk))
                }
              />
              <Action
                show={cancellable.length > 0}
                busy={busy}
                variant="danger"
                label={isArabic ? `إلغاء (${cancellable.length})` : `Cancel (${cancellable.length})`}
                onClick={() =>
                  void run('cancel', () => chunkedOms(cancellable.map((order) => order.id), OmsApi.cancelBulk))
                }
              />
              <Action
                show={batch.orderCount > 0}
                busy={busy}
                variant="secondary"
                label={isArabic ? 'تحميل قائمة الالتقاط' : 'Download Picking List'}
                onClick={() =>
                  void run('picking-pdf', async () => {
                    await OmsApi.downloadBatchInstructionsPdf(id, 'picking');
                  })
                }
              />
              <Action
                show={batch.orderCount > 0}
                busy={busy}
                variant="secondary"
                label={isArabic ? 'تحميل قائمة التعبئة' : 'Download Packing List'}
                onClick={() =>
                  void run('packing-pdf', async () => {
                    await OmsApi.downloadBatchInstructionsPdf(id, 'packing');
                  })
                }
              />
              <Action
                show={printable.length > 0}
                busy={busy}
                variant="secondary"
                label={
                  isArabic
                    ? `تحميل بوالص الشحن PDF (${printable.length})`
                    : `Download Waybills PDF (${printable.length})`
                }
                onClick={() =>
                  void run('labels-download', async () => {
                    const source = (selected.size ? scoped : printable)
                      .filter((order) => labelReadiness(order) === 'ready');
                    const ordered = (source.length ? source : printable)
                      .slice()
                      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true }));
                    await OmsApi.downloadBatchLabels(
                      id,
                      ordered.map((order) => order.id),
                      'download',
                    );
                  })
                }
              />
              <Action
                show={printable.length > 0}
                busy={busy}
                variant="secondary"
                label={isArabic ? 'طباعة البوالص' : 'Print waybills'}
                onClick={() =>
                  void run('labels-print', async () => {
                    const source = (selected.size ? scoped : printable)
                      .filter((order) => labelReadiness(order) === 'ready');
                    const ordered = (source.length ? source : printable)
                      .slice()
                      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true }));
                    await OmsApi.downloadBatchLabels(
                      id,
                      ordered.map((order) => order.id),
                      'print',
                    );
                  })
                }
              />
              {selected.size > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setIssueOpen(true)}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {isArabic ? `تعليم مشكلة (${selected.size})` : `Flag issue (${selected.size})`}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() =>
                      void run('clear', async () => {
                        await OmsApi.clearBatchFlags(id, [...selected]);
                      })
                    }
                    className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {isArabic ? `حل المشكلة (${selected.size})` : `Resolve issue (${selected.size})`}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() =>
                      void run('remove', async () => {
                        await OmsApi.removeBatchOrders(id, [...selected]);
                        return isArabic
                          ? 'أُزيلت الطلبات المحددة من المجموعة. حالاتها لم تتغير.'
                          : 'Selected orders were removed from the batch. Their statuses were not changed.';
                      })
                    }
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-50"
                  >
                    {isArabic ? `إزالة من المجموعة (${selected.size})` : `Remove from batch (${selected.size})`}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mb-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isArabic ? 'بحث داخل المجموعة' : 'Search inside this batch'}
              className="w-full max-w-md rounded-lg border border-border-subtle px-3 py-2 text-sm"
            />
          </div>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.membershipId}
            getRowClassName={(row) =>
              row.issueNote ? 'bg-rose-50/80 dark:bg-rose-950/20 ring-1 ring-inset ring-rose-200' : undefined
            }
            onRowClick={(row) => navigate(`/orders/oms/${row.order.id}`)}
            empty={isArabic ? 'لا توجد طلبات في هذه المجموعة.' : 'This batch has no active orders.'}
          />
          {rowActions.modals}
          <OmsBulkShippingDetailsModal
            open={shippingOpen}
            selectedOrders={shippingDetails}
            isArabic={isArabic}
            onClose={() => {
              setShippingOpen(false);
              // Refresh so soft-saved quotes power analysis cards even without Confirm.
              void refresh();
            }}
            onSuccess={() => {
              setShippingOpen(false);
              void refresh();
            }}
          />
          {issueOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form
                className="w-full max-w-md rounded-xl bg-surface p-4 shadow-lg"
                onSubmit={(event) => {
                  event.preventDefault();
                  const note = issueNote.trim();
                  if (!note) return;
                  setIssueOpen(false);
                  void run('flag', async () => {
                    await OmsApi.flagBatchOrders(id, [...selected], note);
                    setIssueNote('');
                    return isArabic ? 'تم حفظ الملاحظة دون تغيير حالة الطلب.' : 'Issue note saved without changing order status.';
                  });
                }}
              >
                <h2 className="text-base font-bold">{isArabic ? 'ملاحظة المشكلة' : 'Issue note'}</h2>
                <textarea
                  value={issueNote}
                  onChange={(event) => setIssueNote(event.target.value)}
                  maxLength={200}
                  className="mt-3 min-h-24 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm"
                  placeholder={isArabic ? 'سبب إبقاء هذه الطلبات دون إيقاف بقية المجموعة' : 'Why these orders should stay aside'}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setIssueOpen(false)}>
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                    {isArabic ? 'حفظ' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </>
      )}
    </AdminListPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
      <div className="text-sm text-text-muted">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Action({
  show,
  label,
  busy,
  onClick,
  variant = 'primary',
}: {
  show: boolean;
  label: string;
  busy: string | null;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  if (!show) return null;
  const className =
    variant === 'danger'
      ? 'rounded-lg border border-rose-600 bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50'
      : variant === 'secondary'
        ? 'rounded-lg border border-emerald-700 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50'
        : 'rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50';
  return (
    <button type="button" disabled={!!busy} onClick={onClick} className={className}>
      {label}
    </button>
  );
}

function Workflow({ orders = [], isArabic }: { orders?: OmsOrderListItem[]; isArabic: boolean }) {
  const counts = {
    confirmation: orders.filter((order) => order.status === 'waiting_for_confirmation').length,
    approval: orders.filter(
      (order) =>
        order.status === 'confirmed_waiting_for_admin_approval' ||
        order.status === 'pending_approval' ||
        order.status === 'pending',
    ).length,
    picking: orders.filter((order) => orderOperationalStage(order) === 'picking').length,
    packing: orders.filter((order) => orderOperationalStage(order) === 'packing').length,
    shipping: orders.filter((order) => {
      const stage = orderOperationalStage(order);
      return stage === 'shipping_details' || stage === 'shipping_confirmation';
    }).length,
    dispatch: orders.filter(
      (order) =>
        order.status === 'ready_to_ship' ||
        order.linkedOutboundOrder?.status === 'ready_to_ship' ||
        order.linkedOutboundOrder?.status === 'packed',
    ).length,
    delivery: orders.filter((order) => order.status === 'shipped' || order.status === 'out_for_delivery').length,
    delivered: orders.filter((order) => order.status === 'delivered' || order.status === 'completed').length,
  };
  const steps = [
    { key: 'confirmation', label: isArabic ? 'تأكيد' : 'Confirmation', count: counts.confirmation },
    { key: 'approval', label: isArabic ? 'موافقة الإدارة' : 'Admin approval', count: counts.approval },
    { key: 'picking', label: isArabic ? 'التقاط' : 'Picking', count: counts.picking },
    { key: 'packing', label: isArabic ? 'تعبئة' : 'Packing', count: counts.packing },
    { key: 'shipping', label: isArabic ? 'شحن' : 'Shipping', count: counts.shipping },
    { key: 'dispatch', label: isArabic ? 'جاهز للخروج' : 'Ready to dispatch', count: counts.dispatch },
    { key: 'delivery', label: isArabic ? 'خرج للتسليم' : 'Out for delivery', count: counts.delivery },
    { key: 'delivered', label: isArabic ? 'تم التسليم' : 'Delivered', count: counts.delivered },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {steps.map((step) => (
        <div
          key={step.key}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            step.count ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-border-subtle text-text-muted'
          }`}
        >
          {step.label} · {step.count}
        </div>
      ))}
    </div>
  );
}
