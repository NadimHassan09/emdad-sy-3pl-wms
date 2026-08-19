import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { OmsReturnsApi } from '../../api/oms';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';

type ValidatedOrder = {
  omsOrderId: string;
  orderNumber: string;
  productCount: number;
  returnableItemCount: number;
};

type ExpressReturnResult = {
  created: number;
  failed: number;
  failures: Array<{ omsOrderId: string; error: string }>;
};

type OrderInput = {
  key: string;
  value: string;
  status: 'idle' | 'loading' | 'valid' | 'invalid' | 'duplicate';
  error?: string;
  orderData?: ValidatedOrder;
};

type Props = {
  open: boolean;
  onClose: () => void;
  isArabic?: boolean;
  onSuccess?: (result: ExpressReturnResult) => void;
};

let keyCounter = 0;
function nextKey() {
  return `oi-${++keyCounter}`;
}

function makeEmptyRow(): OrderInput {
  return { key: nextKey(), value: '', status: 'idle' };
}

function parseCSV(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(',')[0]?.trim() ?? '')
    .filter((v) => v && !/^order\s*id$/i.test(v));
}

export function ExpressReturnModal({
  open,
  onClose,
  isArabic = false,
  onSuccess,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const fileRef = useRef<HTMLInputElement>(null);

  const [orderInputs, setOrderInputs] = useState<OrderInput[]>([makeEmptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ExpressReturnResult | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrderInputs([makeEmptyRow()]);
    setIsSubmitting(false);
    setResult(null);
    setImportSummary(null);
  }, [open]);

  const existingValues = useCallback(
    (exclude?: string) =>
      new Set(
        orderInputs
          .filter((r) => r.value.trim() && r.key !== exclude)
          .map((r) => r.value.trim().toLowerCase()),
      ),
    [orderInputs],
  );

  const validateRow = useCallback(
    async (key: string, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      if (existingValues(key).has(trimmed.toLowerCase())) {
        setOrderInputs((prev) =>
          prev.map((r) =>
            r.key === key
              ? { ...r, status: 'duplicate' as const, error: t('Order already added', 'الطلب مضاف مسبقاً') }
              : r,
          ),
        );
        return;
      }

      setOrderInputs((prev) =>
        prev.map((r) => (r.key === key ? { ...r, status: 'loading' as const } : r)),
      );

      try {
        const res = await OmsReturnsApi.validateForExpress({ omsOrderIds: [trimmed] });
        const item = res[0];
        if (!item || item.eligible === false) {
          setOrderInputs((prev) =>
            prev.map((r) =>
              r.key === key
                ? { ...r, status: 'invalid' as const, error: item?.error ?? t('Not eligible', 'غير مؤهل') }
                : r,
            ),
          );
        } else {
          const returnableCount = item.lines?.reduce((s, l) => s + l.returnable, 0) ?? 0;
          setOrderInputs((prev) =>
            prev.map((r) =>
              r.key === key
                ? {
                    ...r,
                    status: 'valid' as const,
                    error: undefined,
                    orderData: {
                      omsOrderId: item.omsOrderId,
                      orderNumber: item.orderNumber,
                      productCount: item.lines?.length ?? 0,
                      returnableItemCount: returnableCount,
                    },
                  }
                : r,
            ),
          );
        }
      } catch (e: any) {
        setOrderInputs((prev) =>
          prev.map((r) =>
            r.key === key
              ? { ...r, status: 'invalid' as const, error: e?.message ?? t('Validation failed', 'فشل التحقق') }
              : r,
          ),
        );
      }
    },
    [existingValues, t],
  );

  const addRow = () => setOrderInputs((prev) => [...prev, makeEmptyRow()]);

  const removeRow = (key: string) =>
    setOrderInputs((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length === 0 ? [makeEmptyRow()] : next;
    });

  const handleImport = async (file: File) => {
    const text = await file.text();
    const ids = parseCSV(text);
    if (ids.length === 0) {
      toast.error(t('No order IDs found in file', 'لم يتم العثور على أرقام طلبات في الملف'));
      return;
    }

    const existing = existingValues();
    let added = 0;
    let duplicates = 0;
    const newRows: OrderInput[] = [];

    for (const id of ids) {
      if (existing.has(id.toLowerCase())) {
        duplicates++;
      } else {
        existing.add(id.toLowerCase());
        newRows.push({ key: nextKey(), value: id, status: 'idle' });
        added++;
      }
    }

    setOrderInputs((prev) => {
      const cleaned = prev.filter((r) => r.value.trim());
      return [...cleaned, ...newRows, ...(cleaned.length + newRows.length === 0 ? [makeEmptyRow()] : [])];
    });

    setImportSummary(
      t(
        `Added ${added}, ${duplicates} duplicates skipped`,
        `تمت إضافة ${added}، تم تخطي ${duplicates} مكرر`,
      ),
    );

    for (const row of newRows) {
      validateRow(row.key, row.value);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['Order ID\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'express_return_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validOrders = orderInputs.filter((r) => r.status === 'valid' && r.orderData);

  const submitMut = useMutation({
    mutationFn: async () => {
      const ids = validOrders.map((r) => r.orderData!.omsOrderId);
      const raw = await OmsReturnsApi.expressReturn({ omsOrderIds: ids, reason: 'Express return' });
      return {
        created: raw.created.length,
        failed: raw.failed.length,
        failures: raw.failed,
      } satisfies ExpressReturnResult;
    },
    onSuccess: (res) => {
      setResult(res);
      toast.success(
        t(`Created ${res.created} returns`, `تم إنشاء ${res.created} مرتجعات`) +
          (res.failed > 0 ? ` (${res.failed} ${t('failed', 'فشل')})` : ''),
      );
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      onSuccess?.(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (validOrders.length === 0) return;
    submitMut.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Express Return', 'مرتجع سريع')}
      widthClass="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Result view */}
        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-card-muted p-4 text-sm">
              <p className="font-medium text-text-strong">
                {t('Express return completed', 'اكتمل المرتجع السريع')}
              </p>
              <p className="mt-1 text-text-body">
                {t(`${result.created} returns created`, `${result.created} مرتجعات تم إنشاؤها`)}
                {result.failed > 0 && (
                  <span className="text-status-error-fg">
                    {' · '}
                    {t(`${result.failed} failed`, `${result.failed} فشل`)}
                  </span>
                )}
              </p>
              {result.failures.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.failures.map((f, i) => (
                    <li key={i} className="text-xs text-status-error-fg">
                      {f.omsOrderId}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>{t('Close', 'إغلاق')}</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Order inputs */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-text-muted">
                {t('Add OMS Orders', 'إضافة طلبات OMS')}
              </div>
              {orderInputs.map((row) => (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <TextField
                        placeholder={t('OMS Order ID or Reference', 'رقم طلب OMS أو المرجع')}
                        value={row.value}
                        onChange={(e) =>
                          setOrderInputs((prev) =>
                            prev.map((r) =>
                              r.key === row.key ? { ...r, value: e.target.value, status: 'idle', error: undefined } : r,
                            ),
                          )
                        }
                        onBlur={() => validateRow(row.key, row.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            validateRow(row.key, row.value);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-card-muted hover:text-status-error-fg"
                      aria-label={t('Remove', 'إزالة')}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                  {row.status === 'loading' && (
                    <p className="text-xs text-text-muted">{t('Validating…', 'جاري التحقق…')}</p>
                  )}
                  {row.status === 'valid' && (
                    <p className="text-xs text-green-600">
                      <i className="fa-solid fa-check mr-1" />
                      {t('Eligible', 'مؤهل')}
                      {row.orderData && ` — ${row.orderData.returnableItemCount} ${t('returnable items', 'عناصر قابلة للإرجاع')}`}
                    </p>
                  )}
                  {(row.status === 'invalid' || row.status === 'duplicate') && (
                    <p className="text-xs text-status-error-fg">
                      <i className="fa-solid fa-xmark mr-1" />
                      {row.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addRow}>
                <i className="fa-solid fa-plus mr-1" />
                {t('Add Order', 'إضافة طلب')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <i className="fa-solid fa-file-import mr-1" />
                {t('Import CSV', 'استيراد CSV')}
              </Button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-xs text-brand-primary underline hover:text-brand-primary-hover"
              >
                {t('Download Template', 'تحميل القالب')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                  e.target.value = '';
                }}
              />
            </div>

            {importSummary && (
              <p className="text-xs text-text-muted">{importSummary}</p>
            )}

            {/* Validated orders table */}
            {validOrders.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-text-muted">
                  {t('Selected Orders', 'الطلبات المحددة')} ({validOrders.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-card-muted text-text-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t('Order #', 'رقم الطلب')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('Products', 'المنتجات')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('Returnable Items', 'عناصر قابلة للإرجاع')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('Status', 'الحالة')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validOrders.map((row) => (
                        <tr key={row.key}>
                          <td className="px-3 py-2 text-text-strong">{row.orderData!.orderNumber}</td>
                          <td className="px-3 py-2">{row.orderData!.productCount}</td>
                          <td className="px-3 py-2">{row.orderData!.returnableItemCount}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                              {t('Eligible', 'مؤهل')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2">
              <Button variant="danger" onClick={onClose} disabled={submitMut.isPending}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                loading={submitMut.isPending}
                disabled={validOrders.length === 0 || submitMut.isPending}
                onClick={handleSubmit}
              >
                {t(`Create Returns (${validOrders.length} orders)`, `إنشاء مرتجعات (${validOrders.length} طلبات)`)}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
