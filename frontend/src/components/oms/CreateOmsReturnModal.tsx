import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { OmsReturnsApi, type OmsReturn } from '../../api/oms';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';

const DISCRETE_UOMS = new Set(['piece', 'box', 'roll', 'pallet', 'carton']);

function isDiscreteUom(uom: string | undefined): boolean {
  return !!uom && DISCRETE_UOMS.has(uom);
}

type PreviewLine = {
  productId: string;
  sku: string;
  name: string;
  uom?: string;
  ordered: number;
  alreadyReturned: number;
  returnable: number;
};

type OrderBlock = {
  key: string;
  reference: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  omsOrderId?: string;
  orderNumber?: string;
  clientReference?: string | null;
  lines?: PreviewLine[];
  /** productId → return qty string */
  returnQty: Record<string, string>;
};

type ImportErrorRow = {
  order_reference: string;
  product_reference: string;
  quantity: number;
  reason: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** When set, pre-resolve this OMS order UUID as the first block. */
  initialOrderId?: string;
  onSuccess?: (created: OmsReturn) => void;
  isArabic?: boolean;
};

let keyCounter = 0;
function nextKey() {
  return `nr-${++keyCounter}`;
}

function emptyBlock(reference = ''): OrderBlock {
  return { key: nextKey(), reference, status: 'idle', returnQty: {} };
}

const CSV_HEADER_RE = /^order[_\s-]*reference$/i;

function parseNormalReturnCsv(text: string): Array<{
  orderReference: string;
  productReference: string;
  quantity: number;
}> {
  const rows: Array<{ orderReference: string; productReference: string; quantity: number }> = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (!cols[0] || CSV_HEADER_RE.test(cols[0])) continue;
    if (cols.length < 3) continue;
    const quantity = Number(cols[2]);
    rows.push({
      orderReference: cols[0],
      productReference: cols[1],
      quantity: Number.isFinite(quantity) ? quantity : NaN,
    });
  }
  return rows;
}

function csvEscape(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function errorsToCsv(errors: ImportErrorRow[]): string {
  const lines = ['order_reference,product_reference,quantity,reason'];
  for (const e of errors) {
    lines.push(
      [
        e.order_reference,
        e.product_reference,
        String(e.quantity),
        e.reason,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

function downloadText(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreateOmsReturnModal({
  open,
  onClose,
  initialOrderId,
  onSuccess,
  isArabic = false,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const fileRef = useRef<HTMLInputElement>(null);

  const [blocks, setBlocks] = useState<OrderBlock[]>([emptyBlock()]);
  const [returnReason, setReturnReason] = useState('');
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportErrorRow[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReturnReason('');
    setImportSummary(null);
    setImportErrors([]);
    setImporting(false);
    if (initialOrderId) {
      const block = emptyBlock(initialOrderId);
      setBlocks([block]);
      void resolveBlock(block.key, initialOrderId);
    } else {
      setBlocks([emptyBlock()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve on open only
  }, [open, initialOrderId]);

  const resolveBlock = async (key: string, reference: string) => {
    const trimmed = reference.trim();
    if (!trimmed) return;

    setBlocks((prev) =>
      prev.map((b) =>
        b.key === key ? { ...b, reference: trimmed, status: 'loading', error: undefined } : b,
      ),
    );

    try {
      const preview = await OmsReturnsApi.preview({ orderReference: trimmed });

      setBlocks((prev) => {
        const duplicate = prev.some(
          (b) => b.key !== key && b.status === 'ready' && b.omsOrderId === preview.omsOrderId,
        );
        if (duplicate) {
          return prev.map((b) =>
            b.key === key
              ? {
                  ...b,
                  status: 'error' as const,
                  error: t(
                    'This OMS order is already added',
                    'طلب OMS هذا مضاف مسبقاً',
                  ),
                }
              : b,
          );
        }

        const returnQty: Record<string, string> = {};
        for (const line of preview.lines) {
          returnQty[line.productId] = line.returnable > 0 ? '0' : '0';
        }

        return prev.map((b) =>
          b.key === key
            ? {
                ...b,
                reference: trimmed,
                status: 'ready' as const,
                error: undefined,
                omsOrderId: preview.omsOrderId,
                orderNumber: preview.orderNumber,
                clientReference: preview.clientReference,
                lines: preview.lines,
                returnQty,
              }
            : b,
        );
      });
    } catch (e: any) {
      setBlocks((prev) =>
        prev.map((b) =>
          b.key === key
            ? {
                ...b,
                status: 'error' as const,
                error: e?.response?.data?.error?.message ?? e?.message ?? t('Not found', 'غير موجود'),
                omsOrderId: undefined,
                lines: undefined,
              }
            : b,
        ),
      );
    }
  };

  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock()]);

  const removeBlock = (key: string) =>
    setBlocks((prev) => {
      const next = prev.filter((b) => b.key !== key);
      return next.length === 0 ? [emptyBlock()] : next;
    });

  const setQty = (blockKey: string, productId: string, value: string, returnable: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.key !== blockKey) return b;
        let v = value;
        const n = Number(v);
        if (v !== '' && Number.isFinite(n)) {
          if (n < 0) v = '0';
          if (n > returnable) v = String(returnable);
        }
        return { ...b, returnQty: { ...b.returnQty, [productId]: v } };
      }),
    );
  };

  const readyBlocks = blocks.filter((b) => b.status === 'ready' && b.omsOrderId && b.lines);

  const selectedLineCount = readyBlocks.reduce((count, b) => {
    for (const line of b.lines ?? []) {
      const qty = Number(b.returnQty[line.productId] ?? 0);
      if (qty > 0) count += 1;
    }
    return count;
  }, 0);

  const submitMut = useMutation({
    mutationFn: async () => {
      const created: OmsReturn[] = [];
      for (const block of readyBlocks) {
        const lines = (block.lines ?? [])
          .map((line) => {
            const qty = Number(block.returnQty[line.productId] ?? 0);
            if (!Number.isFinite(qty) || qty <= 0) return null;
            if (qty > line.returnable) {
              throw new Error(
                t(
                  `Return qty for ${line.sku} exceeds returnable (${line.returnable}).`,
                  `كمية الإرجاع لـ ${line.sku} تتجاوز المتاح (${line.returnable}).`,
                ),
              );
            }
            if (isDiscreteUom(line.uom) && !Number.isInteger(qty)) {
              throw new Error(
                t(
                  `Return qty for ${line.sku} must be a whole number.`,
                  `يجب أن تكون كمية الإرجاع لـ ${line.sku} عدداً صحيحاً.`,
                ),
              );
            }
            return { productId: line.productId, quantity: qty };
          })
          .filter(Boolean) as Array<{ productId: string; quantity: number }>;

        if (lines.length === 0) continue;

        const row = await OmsReturnsApi.create({
          omsOrderId: block.omsOrderId!,
          reason: returnReason.trim() || undefined,
          lines,
        });
        created.push(row);
      }
      if (created.length === 0) {
        throw new Error(
          t('Enter a return quantity for at least one product.', 'أدخل كمية إرجاع لمنتج واحد على الأقل.'),
        );
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(
        t(
          `Created ${created.length} return(s).`,
          `تم إنشاء ${created.length} مرتجع/مرتجعات.`,
        ),
      );
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      onSuccess?.(created[0]);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleImport = async (file: File) => {
    const text = await file.text();
    const rows = parseNormalReturnCsv(text);
    if (rows.length === 0) {
      toast.error(t('No valid rows found in file', 'لم يتم العثور على صفوف صالحة في الملف'));
      return;
    }

    setImporting(true);
    setImportErrors([]);
    try {
      // Validate only — do not create. Admin reviews then Confirm.
      const result = await OmsReturnsApi.validateImport({ rows });
      setImportErrors(result.failed);

      const existingReady = blocks.filter(
        (b) => b.status === 'ready' && b.omsOrderId && b.lines,
      );
      const existingIds = new Set(existingReady.map((b) => b.omsOrderId!));

      const newBlocks: OrderBlock[] = [];
      for (const order of result.ready) {
        if (existingIds.has(order.omsOrderId)) continue;
        existingIds.add(order.omsOrderId);
        const returnQty: Record<string, string> = {};
        for (const line of order.lines) {
          returnQty[line.productId] = String(line.quantity ?? 0);
        }
        newBlocks.push({
          key: nextKey(),
          reference: order.orderNumber,
          status: 'ready',
          omsOrderId: order.omsOrderId,
          orderNumber: order.orderNumber,
          clientReference: order.clientReference,
          lines: order.lines.map((l) => ({
            productId: l.productId,
            sku: l.sku,
            name: l.name,
            uom: l.uom,
            ordered: l.ordered,
            alreadyReturned: l.alreadyReturned,
            returnable: l.returnable,
          })),
          returnQty,
        });
      }

      const next = [...existingReady, ...newBlocks];
      setBlocks(next.length === 0 ? [emptyBlock()] : next);
      setImportSummary(
        t(
          `Ready to confirm: ${newBlocks.length} order(s), ${result.failed.length} invalid row(s). Review quantities then Confirm.`,
          `جاهز للتأكيد: ${newBlocks.length} طلب/طلبات، ${result.failed.length} صف غير صالح. راجع الكميات ثم أكّد.`,
        ),
      );
      if (newBlocks.length === 0 && result.failed.length > 0) {
        toast.error(
          t('No valid rows to review; see errors CSV.', 'لا توجد صفوف صالحة للمراجعة؛ راجع ملف الأخطاء.'),
        );
      }
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error?.message ??
          e?.message ??
          t('Import validation failed', 'فشل التحقق من الاستيراد'),
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Create OMS return', 'إنشاء مرتجع OMS')}
      widthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <TextField
          label={t('Reason (optional)', 'السبب (اختياري)')}
          value={returnReason}
          onChange={(e) => setReturnReason(e.target.value)}
        />

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase text-text-muted">
            {t('OMS orders', 'طلبات OMS')}
          </div>
          <p className="text-xs text-text-muted">
            {t(
              'Add one or more orders by OMS Order Number / ID or Client Reference. Select products and quantities per order.',
              'أضف طلباً أو أكثر برقم OMS أو المعرّف أو المرجع الخارجي. اختر المنتجات والكميات لكل طلب.',
            )}
          </p>

          {blocks.map((block) => (
            <div
              key={block.key}
              className="space-y-2 rounded-lg border border-border bg-surface-card-muted/40 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <TextField
                    label={t(
                      'Order ID / OMS Order Number / Client Reference',
                      'معرّف الطلب / رقم OMS / المرجع الخارجي',
                    )}
                    value={block.reference}
                    onChange={(e) =>
                      setBlocks((prev) =>
                        prev.map((b) =>
                          b.key === block.key
                            ? {
                                ...b,
                                reference: e.target.value,
                                status: 'idle',
                                error: undefined,
                                lines: undefined,
                                omsOrderId: undefined,
                              }
                            : b,
                        ),
                      )
                    }
                    onBlur={() => void resolveBlock(block.key, block.reference)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void resolveBlock(block.key, block.reference);
                      }
                    }}
                    disabled={!!initialOrderId && blocks.length === 1}
                  />
                </div>
                {!initialOrderId || blocks.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeBlock(block.key)}
                    className="mt-6 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-card-muted hover:text-status-error-fg"
                    aria-label={t('Remove', 'إزالة')}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                ) : null}
              </div>

              {block.status === 'loading' ? (
                <p className="text-xs text-text-muted">{t('Resolving…', 'جاري البحث…')}</p>
              ) : null}
              {block.status === 'error' ? (
                <p className="text-xs text-status-error-fg">{block.error}</p>
              ) : null}

              {block.status === 'ready' && block.lines ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-text-strong">
                    {block.orderNumber}
                    {block.clientReference ? (
                      <span className="ml-2 text-xs font-normal text-text-muted">
                        · {block.clientReference}
                      </span>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-card-muted text-text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            {t('Product', 'المنتج')}
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            {t('Ordered', 'الكمية المطلوبة')}
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            {t('Returnable', 'قابل للإرجاع')}
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            {t('Return Qty', 'كمية الإرجاع')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {block.lines.map((line) => {
                          const disabled = line.returnable <= 0;
                          return (
                            <tr key={line.productId} className={disabled ? 'opacity-60' : undefined}>
                              <td className="px-3 py-2">
                                <div className="font-medium text-text-strong">{line.name || line.sku}</div>
                                <div className="text-xs text-text-muted">{line.sku}</div>
                              </td>
                              <td className="px-3 py-2">{line.ordered}</td>
                              <td className="px-3 py-2">{line.returnable}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={line.returnable}
                                  step={isDiscreteUom(line.uom) ? 1 : 'any'}
                                  disabled={disabled}
                                  className="w-24 rounded-md border border-border px-2 py-1 text-sm disabled:bg-surface-card-muted"
                                  value={block.returnQty[line.productId] ?? '0'}
                                  onChange={(e) =>
                                    setQty(block.key, line.productId, e.target.value, line.returnable)
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!initialOrderId ? (
            <Button variant="ghost" size="sm" onClick={addBlock}>
              <i className="fa-solid fa-plus mr-1" />
              {t('Add Order', 'إضافة طلب')}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            loading={importing}
            onClick={() => fileRef.current?.click()}
          >
            <i className="fa-solid fa-file-import mr-1" />
            {t('Import CSV', 'استيراد CSV')}
          </Button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                'normal_return_template.csv',
                'order_reference,product_reference,quantity\n',
              )
            }
            className="text-xs text-brand-primary underline hover:text-brand-primary-hover"
          >
            {t('Download Template', 'تحميل القالب')}
          </button>
          {importErrors.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadText('normal-return-errors.csv', errorsToCsv(importErrors))}
              className="text-xs text-status-error-fg underline hover:opacity-80"
            >
              {t('Download errors CSV', 'تحميل CSV للأخطاء')}
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>

        {importSummary ? <p className="text-xs text-text-muted">{importSummary}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="danger" onClick={onClose} disabled={submitMut.isPending || importing}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            loading={submitMut.isPending}
            disabled={selectedLineCount === 0 || submitMut.isPending || importing}
            onClick={() => submitMut.mutate()}
          >
            {t(
              `Confirm (${selectedLineCount} lines)`,
              `تأكيد (${selectedLineCount} بنود)`,
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
