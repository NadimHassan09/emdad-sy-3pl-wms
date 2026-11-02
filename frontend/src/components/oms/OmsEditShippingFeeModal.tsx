import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Alert, Badge, Button, Modal, TextField } from '@ds';
import { OmsApi, type OmsBulkShippingFeeResponse } from '../../api/oms';
import { useToast } from '../ToastProvider';

export interface EditableShippingFeeOrder {
  id: string;
  orderNumber: string;
  clientName?: string | null | undefined;
  company?: { name?: string | null | undefined } | null | undefined;
  shippingFee?: string | number | null | undefined;
  clientShippingFee?: string | number | null | undefined;
  shippingRate?: string | number | null | undefined;
  currency?: string | null | undefined;
  status?: string | null | undefined;
}

export interface OmsEditShippingFeeModalProps {
  open: boolean;
  onClose: () => void;
  orders: EditableShippingFeeOrder[];
  onSuccess?: () => void;
  isArabic?: boolean;
}

function parseNum(val: string | number | null | undefined): number {
  if (val == null || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function getOrderShippingFee(order: EditableShippingFeeOrder | undefined): number {
  if (!order) return 0;
  const raw = order.shippingFee ?? order.clientShippingFee ?? order.shippingRate;
  return parseNum(raw);
}

function formatFee(amount: number, currency: string = 'USD'): string {
  const cur = (currency || 'USD').toUpperCase();
  return `${amount.toFixed(2)} ${cur}`;
}

function formatDiff(
  diff: number,
  currency: string = 'USD',
): { text: string; tone: 'neutral' | 'positive' | 'negative' } {
  const cur = (currency || 'USD').toUpperCase();
  if (Math.abs(diff) < 0.0001) {
    return { text: `0.00 ${cur}`, tone: 'neutral' };
  }
  const sign = diff > 0 ? '+' : '';
  return {
    text: `${sign}${diff.toFixed(2)} ${cur}`,
    tone: diff > 0 ? 'positive' : 'negative',
  };
}

export function OmsEditShippingFeeModal({
  open,
  onClose,
  orders,
  onSuccess,
  isArabic = false,
}: OmsEditShippingFeeModalProps) {
  const toast = useToast();

  // Active editable orders list (allows user to delete/remove an order from the modal)
  const [activeOrders, setActiveOrders] = useState<EditableShippingFeeOrder[]>([]);

  // Single order input value
  const [commonFee, setCommonFee] = useState<string>('');
  const [commonReason, setCommonReason] = useState<string>('');

  // Individual values for table rows: map orderId -> { fee: string, reason?: string }
  const [individualValues, setIndividualValues] = useState<
    Record<string, { fee: string; reason?: string }>
  >({});

  // Quick fill uniform helper
  const [quickFillFee, setQuickFillFee] = useState<string>('');

  // Confirmation step before applying bulk changes
  const [confirmStep, setConfirmStep] = useState(false);

  // Results state after batch execution
  const [result, setResult] = useState<OmsBulkShippingFeeResponse | null>(null);

  // Initialize inputs when modal opens or orders change
  useEffect(() => {
    if (open) {
      setActiveOrders(orders);
      setConfirmStep(false);
      setResult(null);
      setQuickFillFee('');
      setCommonReason('');

      const initialMap: Record<string, { fee: string; reason?: string }> = {};
      orders.forEach((o) => {
        const feeNum = getOrderShippingFee(o);
        initialMap[o.id] = {
          fee: feeNum > 0 ? String(feeNum) : '0',
          reason: '',
        };
      });
      setIndividualValues(initialMap);

      if (orders.length === 1 && orders[0]) {
        const singleFee = getOrderShippingFee(orders[0]);
        setCommonFee(singleFee > 0 ? String(singleFee) : '0');
      } else {
        setCommonFee('');
      }
    }
  }, [open, orders]);

  const isSingle = orders.length === 1 && activeOrders.length === 1;
  const singleOrder = activeOrders[0] ?? orders[0];
  const initialCurrency = orders[0]?.currency || 'USD';

  // Remove order from active batch
  const handleRemoveOrder = (orderId: string) => {
    setActiveOrders((prev) => prev.filter((o) => o.id !== orderId));
    setConfirmStep(false);
  };

  // Quick fill helper to set all rows at once
  const handleApplyQuickFill = () => {
    const num = parseFloat(quickFillFee.trim());
    if (isNaN(num) || num < 0) {
      toast.error(
        isArabic ? 'يرجى إدخال قيمة صحيحة وغير سالبة.' : 'Enter a valid non-negative number.',
      );
      return;
    }
    setIndividualValues((prev) => {
      const next = { ...prev };
      activeOrders.forEach((o) => {
        next[o.id] = {
          fee: String(num),
          reason: next[o.id]?.reason || '',
        };
      });
      return next;
    });
    setConfirmStep(false);
    toast.success(
      isArabic
        ? `تم تعيين ${quickFillFee} لجميع الطلبات في الجدول.`
        : `Applied ${quickFillFee} to all orders in table.`,
    );
  };

  // Single order mutation
  const singleMut = useMutation({
    mutationFn: async () => {
      if (!singleOrder) return;
      const num = parseFloat(commonFee.trim());
      if (isNaN(num) || num < 0) {
        throw new Error(
          isArabic ? 'يرجى إدخال رسوم شحن صحيحة وغير سالبة.' : 'Enter a valid non-negative shipping fee.',
        );
      }
      return OmsApi.adjustShippingFee(singleOrder.id, {
        shippingFee: num,
        reason: commonReason.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      if (!data) return;
      toast.success(
        isArabic
          ? `تم تحديث رسوم الشحن للطلب ${data.orderNumber} بنجاح.`
          : `Shipping fee updated for order ${data.orderNumber}.`,
      );
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Bulk mutation (operates on activeOrders with individual values)
  const bulkMut = useMutation({
    mutationFn: async () => {
      if (activeOrders.length === 0) {
        throw new Error(isArabic ? 'لا توجد طلبات لتعديلها.' : 'No orders selected for adjustment.');
      }

      const items = activeOrders.map((o) => {
        const val = individualValues[o.id];
        const num = parseFloat(val?.fee?.trim() ?? '0');
        if (isNaN(num) || num < 0) {
          throw new Error(
            isArabic
              ? `رسوم الشحن للطلب ${o.orderNumber} غير صالحة.`
              : `Invalid shipping fee for order ${o.orderNumber}.`,
          );
        }
        return {
          id: o.id,
          shippingFee: num,
          reason: val?.reason?.trim() || commonReason.trim() || undefined,
        };
      });

      return OmsApi.adjustShippingFeeBulk({ items, reason: commonReason.trim() || undefined });
    },
    onSuccess: (res) => {
      setResult(res);
      setConfirmStep(false);
      onSuccess?.();
      if ((res.failed ?? 0) === 0) {
        toast.success(
          isArabic
            ? `تم تحديث رسوم الشحن لـ ${res.updated ?? activeOrders.length} طلب بنجاح.`
            : `Successfully updated shipping fees for ${res.updated ?? activeOrders.length} orders.`,
        );
      } else {
        toast.error(
          isArabic
            ? `اكتمل التحديث: نجح ${res.updated ?? 0} وفشل ${res.failed ?? 0}.`
            : `Updated ${res.updated ?? 0} orders, ${res.failed ?? 0} failed.`,
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmStep(false);
    },
  });

  const isPending = singleMut.isPending || bulkMut.isPending;

  // Single order diff calculations
  const singleCurrentFee = getOrderShippingFee(singleOrder);
  const singleNewFee = parseNum(commonFee);
  const singleDiff = singleNewFee - singleCurrentFee;
  const singleDiffInfo = formatDiff(singleDiff, singleOrder?.currency || 'USD');

  return (
    <Modal
      open={open}
      onClose={isPending ? () => {} : onClose}
      title={
        isArabic
          ? 'تعديل رسوم الشحن (Client Shipping Fee)'
          : 'Edit Shipping Fee (Client Shipping Fee)'
      }
      widthClass={orders.length > 1 ? 'max-w-4xl' : 'max-w-lg'}
    >
      <div className="space-y-4">
        {/* Banner Explaining Manual Override */}
        <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-200">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            <div className="leading-relaxed">
              <span className="font-semibold">
                {isArabic ? 'تعديل يدوي لرسوم الشحن:' : 'Manual Fee Override:'}
              </span>{' '}
              {isArabic
                ? 'يقوم هذا الإجراء بتعديل رسوم الشحن المحسوبة على العميل في هذا الطلب فقط. لا يؤثر على تكاليف شركة الشحن (Carrier Cost) أو بوالص الشحن أو حالة الطلب.'
                : 'This modifies the client-facing shipping fee charged on this order. It does NOT alter carrier costs, carrier tracking, or order statuses.'}
            </div>
          </div>
        </div>

        {/* ─── RESULT VIEW (After Bulk Execution) ─── */}
        {result ? (
          <div className="space-y-4">
            <div
              className={`rounded-xl p-4 border ${
                (result.failed ?? 0) === 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <i
                  className={`fa-solid ${(result.failed ?? 0) === 0 ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-amber-600'}`}
                  aria-hidden="true"
                />
                <span>
                  {isArabic
                    ? `النتيجة: تم تحديث ${result.updated ?? (result as any).successCount ?? 0} من أصل ${result.requested ?? activeOrders.length} طلب بنجاح.`
                    : `Result: ${result.updated ?? (result as any).successCount ?? 0} of ${result.requested ?? activeOrders.length} orders updated successfully.`}
                </span>
              </div>
              {(result.failed ?? (result as any).failureCount ?? 0) > 0 && (
                <div className="mt-1 text-xs text-danger-700 dark:text-danger-400">
                  {isArabic
                    ? `فشل تحديث ${result.failed ?? (result as any).failureCount} طلب.`
                    : `${result.failed ?? (result as any).failureCount} orders failed to update.`}
                </div>
              )}
            </div>

            {/* List of failures if any */}
            {(result.failures ?? []).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-danger-700 dark:text-danger-400">
                  {isArabic ? 'الطلبات التي تعذر تحديثها' : 'Failed Orders'}
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-danger-200 bg-danger-50/50 p-2 text-xs">
                  {(result.failures ?? []).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between border-b border-danger-100 py-1.5 last:border-0"
                    >
                      <span className="font-mono font-medium text-danger-900">{f.orderNumber || f.id}</span>
                      <span className="text-danger-700">{f.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* List of successes if any */}
            {(result.updatedOrders ?? (result as any).results ?? []).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  {isArabic ? 'الطلبات التي تم تحديثها بنجاح' : 'Successfully Updated Orders'}
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border-subtle bg-surface">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead className="bg-surface-sunken sticky top-0 border-b border-border-subtle text-text-muted">
                      <tr>
                        <th className="py-2 px-3 text-start">{isArabic ? 'رقم الطلب' : 'Order #'}</th>
                        <th className="py-2 px-3 text-end">{isArabic ? 'السابق' : 'Previous'}</th>
                        <th className="py-2 px-3 text-end">{isArabic ? 'الجديد' : 'New Fee'}</th>
                        <th className="py-2 px-3 text-end">{isArabic ? 'الفارق' : 'Diff'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono">
                      {(result.updatedOrders ?? (result as any).results ?? []).map((u: any) => {
                        const diffVal = Number(u.difference ?? 0);
                        const cur = initialCurrency;
                        const diffInfo = formatDiff(diffVal, cur);
                        return (
                          <tr key={u.id} className="hover:bg-surface-sunken/40">
                            <td className="py-2 px-3 font-semibold text-text-strong">{u.orderNumber || u.id}</td>
                            <td className="py-2 px-3 text-end text-text-muted">
                              {formatFee(Number(u.previousShippingFee ?? 0), cur)}
                            </td>
                            <td className="py-2 px-3 text-end font-semibold text-text-strong">
                              {formatFee(Number(u.newShippingFee ?? 0), cur)}
                            </td>
                            <td
                              className={`py-2 px-3 text-end font-semibold ${
                                diffInfo.tone === 'positive'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : diffInfo.tone === 'negative'
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-text-muted'
                              }`}
                            >
                              {diffInfo.text}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>{isArabic ? 'إغلاق' : 'Close'}</Button>
            </div>
          </div>
        ) : isSingle && singleOrder ? (
          /* ─── SINGLE ORDER EDITING VIEW ─── */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-sunken p-3 text-xs border border-border-subtle">
              <div>
                <span className="text-text-muted">{isArabic ? 'رقم الطلب:' : 'Order Number:'}</span>
                <div className="mt-0.5 font-mono font-semibold text-text-strong">
                  {singleOrder.orderNumber}
                </div>
              </div>
              {(singleOrder.clientName || singleOrder.company?.name) && (
                <div>
                  <span className="text-text-muted">{isArabic ? 'العميل:' : 'Client:'}</span>
                  <div className="mt-0.5 font-medium text-text-strong">
                    {singleOrder.clientName || singleOrder.company?.name}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border-subtle p-3 bg-surface">
                <div className="text-xs text-text-muted">{isArabic ? 'الرسوم الحالية' : 'Current Fee'}</div>
                <div className="mt-1 font-semibold text-base text-text-strong">
                  {formatFee(singleCurrentFee, singleOrder.currency || 'USD')}
                </div>
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label={
                    isArabic
                      ? `الرسوم الجديدة (${singleOrder.currency || 'USD'})`
                      : `New Fee (${singleOrder.currency || 'USD'})`
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  value={commonFee}
                  onChange={(e) => setCommonFee(e.target.value)}
                  placeholder={String(singleCurrentFee)}
                  required
                />
              </div>
            </div>

            {/* Live Difference Display */}
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-sunken px-3.5 py-2.5 text-xs">
              <span className="font-medium text-text-muted">{isArabic ? 'الفارق (Difference):' : 'Difference:'}</span>
              <span
                className={`font-semibold font-mono text-sm ${
                  singleDiffInfo.tone === 'positive'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : singleDiffInfo.tone === 'negative'
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-text-muted'
                }`}
              >
                {singleDiffInfo.text}
              </span>
            </div>

            <TextField
              label={isArabic ? 'سبب التعديل (اختياري)' : 'Adjustment Reason (optional)'}
              value={commonReason}
              onChange={(e) => setCommonReason(e.target.value)}
              placeholder={
                isArabic
                  ? 'مثال: خطأ في وزن المنتج المدخل من قبل العميل'
                  : 'e.g. Incorrect product weight entered by client'
              }
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={isPending}>
                {isArabic ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button loading={singleMut.isPending} onClick={() => singleMut.mutate()}>
                {isArabic ? 'حفظ التعديل' : 'Save Fee'}
              </Button>
            </div>
          </div>
        ) : (
          /* ─── BULK EDITING VIEW: TABLE WITH PER-ROW INPUTS (Default & Primary) ─── */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="brand">
                  {isArabic
                    ? `${activeOrders.length} طلبات مختارة للتعديل`
                    : `${activeOrders.length} orders selected for edit`}
                </Badge>
                {orders.length > activeOrders.length && (
                  <span className="text-xs text-text-muted">
                    ({isArabic ? `تم استبعاد ${orders.length - activeOrders.length}` : `${orders.length - activeOrders.length} excluded`})
                  </span>
                )}
              </div>

              {/* Quick Fill Tool (Optional Helper) */}
              {activeOrders.length > 1 && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-sunken p-1.5 text-xs">
                  <span className="text-text-muted text-[11px] whitespace-nowrap">
                    {isArabic ? 'تعيين سعر موحد سريع:' : 'Quick uniform fee:'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={quickFillFee}
                    onChange={(e) => setQuickFillFee(e.target.value)}
                    className="w-20 rounded border border-border-subtle bg-surface px-2 py-1 text-xs font-mono focus:border-purple-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleApplyQuickFill}
                    className="rounded bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-900 px-2 py-1 text-[11px] font-bold text-purple-800 dark:text-purple-200 transition-colors cursor-pointer"
                  >
                    {isArabic ? 'تطبيق على الكل' : 'Apply to all'}
                  </button>
                </div>
              )}
            </div>

            {/* Optional Common Reason */}
            <TextField
              label={isArabic ? 'سبب مشترك للتعديل (اختياري)' : 'Common reason (optional)'}
              value={commonReason}
              onChange={(e) => setCommonReason(e.target.value)}
              placeholder={
                isArabic
                  ? 'مثال: تصحيح أوزان الشحنات أو تعويض عملياتي'
                  : 'e.g. Weight corrections or operational adjustment'
              }
            />

            {/* Main Editable Table */}
            {activeOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-text-muted">
                {isArabic
                  ? 'تمت إزالة جميع الطلبات من نافذة التعديل. اضغط "إلغاء" للعودة.'
                  : 'All orders have been removed from adjustment. Click "Cancel" to return.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-text-strong">
                  {isArabic
                    ? 'جدول الطلبات (يمكنك تعديل "السعر الجديد" لكل طلب على حدة أو حذفه من القائمة):'
                    : 'Orders Table (edit "New Fee" per row or remove order from list):'}
                </div>
                <div className="max-h-80 overflow-y-auto rounded-xl border border-border-subtle bg-surface shadow-xs">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead className="bg-surface-sunken sticky top-0 border-b border-border-subtle text-text-muted z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-start font-semibold">{isArabic ? 'رقم الطلب' : 'Order #'}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{isArabic ? 'العميل' : 'Client'}</th>
                        <th className="py-2.5 px-3 text-end font-semibold">{isArabic ? 'السعر الحالي (قبل)' : 'Current (Before)'}</th>
                        <th className="py-2.5 px-3 text-start min-w-[130px] font-semibold">
                          {isArabic ? 'السعر الجديد (بعد)' : 'New Fee (After)'}
                        </th>
                        <th className="py-2.5 px-3 text-end font-semibold">{isArabic ? 'الفارق' : 'Diff'}</th>
                        <th className="py-2.5 px-3 text-center w-12 font-semibold">{isArabic ? 'حذف' : 'Remove'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono">
                      {activeOrders.map((o) => {
                        const oldF = getOrderShippingFee(o);
                        const rowVal = individualValues[o.id]?.fee ?? String(oldF);
                        const newF = parseNum(rowVal);
                        const diff = newF - oldF;
                        const diffInfo = formatDiff(diff, o.currency || 'USD');

                        return (
                          <tr key={o.id} className="hover:bg-surface-sunken/40 transition-colors">
                            <td className="py-2 px-3 font-semibold text-text-strong">{o.orderNumber}</td>
                            <td className="py-2 px-3 font-sans text-text-body">{o.clientName || o.company?.name || '—'}</td>
                            <td className="py-2 px-3 text-end text-text-muted font-semibold">
                              {formatFee(oldF, o.currency || 'USD')}
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={rowVal}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setIndividualValues((prev) => ({
                                    ...prev,
                                    [o.id]: {
                                      ...prev[o.id],
                                      fee: next,
                                    },
                                  }));
                                  setConfirmStep(false);
                                }}
                                className="w-full rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs font-mono font-bold focus:border-purple-500 focus:ring-1 focus:ring-purple-400 focus:outline-hidden bg-surface"
                                placeholder="0.00"
                              />
                            </td>
                            <td
                              className={`py-2 px-3 text-end font-semibold ${
                                diffInfo.tone === 'positive'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : diffInfo.tone === 'negative'
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-text-muted'
                              }`}
                            >
                              {diffInfo.text}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <button
                                type="button"
                                title={isArabic ? 'إزالة هذا الطلب من التعديل' : 'Remove order from adjustment'}
                                onClick={() => handleRemoveOrder(o.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40 transition-colors cursor-pointer"
                              >
                                <i className="fa-solid fa-trash-can text-xs" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Confirmation Alert */}
            {confirmStep && (
              <Alert
                variant="warning"
                title={isArabic ? 'تأكيد التعديل الجماعي' : 'Confirm Bulk Adjustment'}
              >
                <div className="text-xs space-y-1">
                  <p>
                    {isArabic
                      ? `أنت على وشك حفظ وتطبيق الأسعار الجديدة لـ ${activeOrders.length} طلب.`
                      : `You are about to save and apply the new shipping fees for ${activeOrders.length} orders.`}
                  </p>
                  <p className="font-semibold">
                    {isArabic
                      ? 'هل أنت متأكد من رغبتك في تطبيق هذه التغييرات؟'
                      : 'Are you sure you want to apply these changes?'}
                  </p>
                </div>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={isPending}>
                {isArabic ? 'إلغاء' : 'Cancel'}
              </Button>
              {activeOrders.length > 0 && (
                <>
                  {!confirmStep ? (
                    <Button
                      onClick={() => {
                        // Validate all rows
                        for (const o of activeOrders) {
                          const val = individualValues[o.id]?.fee?.trim() ?? '';
                          const num = parseFloat(val);
                          if (val === '' || isNaN(num) || num < 0) {
                            toast.error(
                              isArabic
                                ? `يرجى إدخال قيمة صحيحة للطلب ${o.orderNumber}.`
                                : `Please enter a valid shipping fee for ${o.orderNumber}.`,
                            );
                            return;
                          }
                        }
                        setConfirmStep(true);
                      }}
                    >
                      {isArabic ? 'متابعة للتأكيد' : 'Review & Confirm'}
                    </Button>
                  ) : (
                    <Button
                      loading={bulkMut.isPending}
                      onClick={() => bulkMut.mutate()}
                      className="!bg-purple-600 hover:!bg-purple-700 !text-white font-bold"
                    >
                      {isArabic
                        ? `تأكيد التعديل (${activeOrders.length})`
                        : `Confirm Adjustments (${activeOrders.length})`}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
