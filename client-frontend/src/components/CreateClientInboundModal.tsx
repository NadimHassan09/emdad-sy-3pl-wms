import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Textarea } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@wms/components/FilterPanel';
import { Modal } from '@wms/components/Modal';
import { TextField } from '@wms/components/TextField';

import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import {
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';
import type { CreateClientInboundOrderInput } from '../services/clientInboundOrdersService';
import { ClientOrderLinesTable } from './ClientOrderLinesTable';

type DraftLine = { productId: string; expectedQuantity: string };

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  submitError?: string | null;
  onSubmit: (input: CreateClientInboundOrderInput) => void;
  isArabic: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New inbound order': 'طلب وارد جديد',
    'Expected arrival date': 'تاريخ الوصول المتوقع',
    Notes: 'ملاحظات',
    Lines: 'البنود',
    Product: 'المنتج',
    'Pick product…': 'اختر المنتج…',
    Quantity: 'الكمية',
    'No lines yet — add a product below.': 'لا توجد بنود بعد — أضف منتجاً بالأسفل.',
    Remove: 'إزالة',
    '+ Add line': '+ إضافة بند',
    Cancel: 'إلغاء',
    Back: 'رجوع',
    Next: 'التالي',
    'Submit for approval': 'إرسال للموافقة',
    'Current quantity:': 'الكمية الحالية:',
    'Expected arrival date cannot be before today.': 'لا يمكن أن يكون تاريخ الوصول قبل اليوم.',
    'Add at least one line with quantity.': 'أضف بنداً واحداً على الأقل بكمية.',
  };
  return ar[text] ?? text;
}

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

export function CreateClientInboundModal({
  open,
  onClose,
  loading,
  submitError,
  onSubmit,
  isArabic,
}: Props): ReactElement {
  const t = (s: string) => label(s, isArabic);
  const [arrival, setArrival] = useState(() => localCalendarDateYmd());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', expectedQuantity: '' }]);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['client', 'products', 'create-inbound'],
    queryFn: () => fetchClientProducts({ limit: 200 }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const productOptions = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
        hint: `${p.uom} · on hand ${formatOnHand(p)}`,
      })),
    [products.data],
  );

  const productsById = useMemo(() => {
    const m = new Map<string, ClientProductRow>();
    for (const p of products.data?.items ?? []) m.set(p.id, p);
    return m;
  }, [products.data]);

  const tableLines = useMemo(
    () =>
      lines.map((l, idx) => ({
        lineKey: String(idx),
        productId: l.productId,
        quantity: l.expectedQuantity,
      })),
    [lines],
  );

  useEffect(() => {
    if (!open) return;
    setArrival(localCalendarDateYmd());
    setNotes('');
    setLines([{ productId: '', expectedQuantity: '' }]);
    setStep(1);
    setError(null);
  }, [open]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const goToLines = () => {
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      setError(t('Expected arrival date cannot be before today.'));
      return;
    }
    setError(null);
    setStep(2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step !== 2) return;
    const payloadLines = lines
      .filter((l) => l.productId && l.expectedQuantity)
      .map((l) => ({
        productId: l.productId,
        expectedQuantity: Number(l.expectedQuantity),
      }));
    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity.'));
      return;
    }
    setError(null);
    onSubmit({
      expectedArrivalDate: arrival,
      notes: notes.trim() || undefined,
      lines: payloadLines,
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('New inbound order')}
      widthClass="max-w-3xl"
      footer={
        step === 1 ? (
          <>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={loading}
              className={FILTER_PRIMARY_BUTTON_CLASS}
              onClick={goToLines}
            >
              {t('Next')}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={loading}>
              {t('Back')}
            </Button>
            <Button
              form="create-client-inbound"
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {t('Submit for approval')}
            </Button>
          </>
        )
      }
    >
      <form id="create-client-inbound" onSubmit={submit} className="space-y-4">
        {error || submitError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error ?? submitError}
          </p>
        ) : null}
        {step === 1 ? (
          <div className="space-y-4">
            <TextField
              label={t('Expected arrival date')}
              type="date"
              required
              min={localCalendarDateYmd()}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        ) : (
          <ClientOrderLinesTable
            title={t('Lines')}
            productHeader={t('Product')}
            lines={tableLines}
            productOptions={productOptions}
            productsById={productsById}
            pickProductPlaceholder={t('Pick product…')}
            quantityHeader={t('Quantity')}
            emptyMessage={t('No lines yet — add a product below.')}
            removeLabel={t('Remove')}
            loading={loading || products.isLoading}
            formatOnHand={formatOnHand}
            onHandLabel={t('Current quantity:')}
            onUpdateLine={(lineKey, patch) => {
              const idx = Number(lineKey);
              updateLine(idx, {
                ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
                ...(patch.quantity !== undefined ? { expectedQuantity: patch.quantity } : {}),
              });
            }}
            onRemoveLine={(lineKey) => {
              setLines((prev) => prev.filter((_, i) => i !== Number(lineKey)));
            }}
            toolbar={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => setLines((prev) => [...prev, { productId: '', expectedQuantity: '' }])}
              >
                {t('+ Add line')}
              </Button>
            }
          />
        )}
      </form>
    </Modal>
  );
}
