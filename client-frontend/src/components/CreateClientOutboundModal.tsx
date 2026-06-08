import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { Button, Modal, Textarea } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@wms/components/FilterPanel';
import { TextField } from '@wms/components/TextField';

import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import { fetchProductAvailability } from '../services/clientInventoryService';
import {
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';
import type { CreateClientOutboundOrderInput } from '../services/clientOutboundOrdersService';
import { ClientOrderLinesTable } from './ClientOrderLinesTable';

type DraftLine = { productId: string; requestedQuantity: string };

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  submitError?: string | null;
  onSubmit: (input: CreateClientOutboundOrderInput) => void;
  isArabic: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New outbound order': 'طلب صادر جديد',
    'Required ship date': 'تاريخ الشحن المطلوب',
    Destination: 'الوجهة',
    Carrier: 'الناقل',
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
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.',
    'Destination is required.': 'الوجهة مطلوبة.',
    'Add at least one line with quantity.': 'أضف بنداً واحداً على الأقل بكمية.',
    'Exceeds available stock': 'يتجاوز المخزون المتاح',
    Available: 'المتاح',
    'Requested across lines': 'المطلوب عبر البنود',
    'Order cannot be created — insufficient stock:': 'لا يمكن إنشاء الطلب — مخزون غير كافٍ:',
    requested: 'مطلوب',
    available: 'متاح',
    'Insufficient stock for one or more products.': 'مخزون غير كافٍ لمنتج واحد أو أكثر.',
  };
  return ar[text] ?? text;
}

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

export function CreateClientOutboundModal({
  open,
  onClose,
  loading,
  submitError,
  onSubmit,
  isArabic,
}: Props): ReactElement {
  const t = (s: string) => label(s, isArabic);
  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd());
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', requestedQuantity: '' }]);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['client', 'products', 'create-outbound'],
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
        quantity: l.requestedQuantity,
      })),
    [lines],
  );

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: ['client', 'availability', pid],
      queryFn: () => fetchProductAvailability(pid),
      enabled: open && !!pid,
      staleTime: 10_000,
    })),
  });

  const availabilityByProduct = useMemo(() => {
    const m = new Map<string, number>();
    distinctProductIds.forEach((pid, i) => {
      const r = availabilityResults[i]?.data;
      if (r) m.set(pid, Number(r.available));
    });
    return m;
  }, [availabilityResults, distinctProductIds]);

  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (!l.productId) continue;
      const n = Number(l.requestedQuantity);
      if (!Number.isFinite(n) || n <= 0) continue;
      m.set(l.productId, (m.get(l.productId) ?? 0) + n);
    }
    return m;
  }, [lines]);

  const shortages = useMemo(() => {
    const out: { productId: string; requested: number; available: number }[] = [];
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid);
      if (avail !== undefined && qty > avail) {
        out.push({ productId: pid, requested: qty, available: avail });
      }
    });
    return out;
  }, [availabilityByProduct, requestedByProduct]);

  const submitDisabled = shortages.length > 0;

  useEffect(() => {
    if (!open) return;
    setShipDate(localCalendarDateYmd());
    setDestination('');
    setCarrier('');
    setNotes('');
    setLines([{ productId: '', requestedQuantity: '' }]);
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
    if (!destination.trim()) {
      setError(t('Destination is required.'));
      return;
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError(t('Required ship date cannot be before today.'));
      return;
    }
    setError(null);
    setStep(2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step !== 2) return;
    if (shortages.length > 0) {
      setError(t('Insufficient stock for one or more products.'));
      return;
    }
    const payloadLines = lines
      .filter((l) => l.productId && l.requestedQuantity)
      .map((l) => ({
        productId: l.productId,
        requestedQuantity: Number(l.requestedQuantity),
      }));
    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity.'));
      return;
    }
    setError(null);
    onSubmit({
      destinationAddress: destination.trim(),
      requiredShipDate: shipDate,
      carrier: carrier.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: payloadLines,
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('New outbound order')}
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
              form="create-client-outbound"
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              disabled={submitDisabled}
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {t('Submit for approval')}
            </Button>
          </>
        )
      }
    >
      <form id="create-client-outbound" onSubmit={submit} className="space-y-4">
        {error || submitError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error ?? submitError}
          </p>
        ) : null}
        {step === 1 ? (
          <div className="space-y-4">
            <TextField
              label={t('Destination')}
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField
                label={t('Required ship date')}
                type="date"
                required
                min={localCalendarDateYmd()}
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
              />
              <TextField
                label={t('Carrier')}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </div>
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
            renderProductFooter={(productId) => {
              const avail = availabilityByProduct.get(productId);
              const summed = requestedByProduct.get(productId) ?? 0;
              if (avail === undefined) return null;
              const isShort = summed > avail;
              return (
                <div className={`mt-1 text-xs ${isShort ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {t('Available')}: {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  {summed > 0 && (
                    <>
                      {' '}
                      • {t('Requested across lines')}:{' '}
                      {summed.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </>
                  )}
                </div>
              );
            }}
            quantityError={(row) => {
              if (!row.productId) return undefined;
              const avail = availabilityByProduct.get(row.productId);
              const summed = requestedByProduct.get(row.productId) ?? 0;
              if (avail !== undefined && summed > avail) return t('Exceeds available stock');
              return undefined;
            }}
            onUpdateLine={(lineKey, patch) => {
              const idx = Number(lineKey);
              updateLine(idx, {
                ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
                ...(patch.quantity !== undefined ? { requestedQuantity: patch.quantity } : {}),
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
                onClick={() => setLines((prev) => [...prev, { productId: '', requestedQuantity: '' }])}
              >
                {t('+ Add line')}
              </Button>
            }
          />
        )}
        {step === 2 && shortages.length > 0 ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <strong className="block">{t('Order cannot be created — insufficient stock:')}</strong>
            <ul className="mt-1 list-disc pl-4">
              {shortages.map((s) => {
                const p = products.data?.items.find((x) => x.id === s.productId);
                return (
                  <li key={s.productId}>
                    {p ? `${p.sku} — ${p.name}` : s.productId}: {t('requested')} {s.requested},{' '}
                    {t('available')} {s.available}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
