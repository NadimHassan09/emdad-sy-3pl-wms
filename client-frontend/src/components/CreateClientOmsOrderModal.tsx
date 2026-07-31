import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { Button, Modal, Textarea } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@ds';
import { Combobox } from '@ds';
import { SelectField } from '@ds';
import { TextField } from '@ds';

import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import { fetchProductAvailability } from '../services/clientInventoryService';
import {
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';
import type { CreateClientOmsOrderInput } from '../services/clientOmsOrdersService';
import { ClientFormSection } from './ClientWizardSteps';

type DraftLine = { productId: string; requestedQuantity: string; unitPrice: string };

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  submitError?: string | null;
  onSubmit: (input: CreateClientOmsOrderInput) => void;
  isArabic: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'Create OMS Order': 'إنشاء طلب OMS',
    'Required ship date': 'تاريخ الشحن المطلوب',
    'Recipient name': 'اسم المستلم',
    'Recipient phone': 'هاتف المستلم',
    City: 'المدينة',
    District: 'المنطقة',
    Address: 'العنوان',
    'Sales channel': 'قناة البيع',
    'Payment method': 'طريقة الدفع',
    Notes: 'ملاحظات',
    'Order lines': 'بنود الطلب',
    Product: 'المنتج',
    'Pick product…': 'اختر المنتج…',
    Qty: 'الكمية',
    Price: 'السعر',
    Remove: 'إزالة',
    '+ Add line': '+ إضافة بند',
    Cancel: 'إلغاء',
    'Submit for approval': 'إرسال للموافقة',
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.',
    'Add at least one line with quantity and price.': 'أضف بنداً واحداً على الأقل بكمية وسعر.',
    'Exceeds available stock': 'يتجاوز المخزون المتاح',
    Available: 'المتاح',
    'Requested across lines': 'المطلوب عبر البنود',
    'Order cannot be created — insufficient stock:': 'لا يمكن إنشاء الطلب — مخزون غير كافٍ:',
    requested: 'مطلوب',
    available: 'متاح',
    'Insufficient stock for one or more products.': 'مخزون غير كافٍ لمنتج واحد أو أكثر.',
    'Each product line needs a valid price.': 'كل بند يحتاج سعراً صالحاً.',
    'Order will be submitted for admin approval. Shipping fee is set by the warehouse.':
      'سيُرسل الطلب لموافقة الإدارة. رسوم الشحن يحددها المستودع.',
    'Shipping information': 'معلومات الشحن',
    'Order details': 'تفاصيل الطلب',
    Products: 'المنتجات',
  };
  return ar[text] ?? text;
}

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

const emptyLine = (): DraftLine => ({ productId: '', requestedQuantity: '1', unitPrice: '' });

export function CreateClientOmsOrderModal({
  open,
  onClose,
  loading,
  submitError,
  onSubmit,
  isArabic,
}: Props): ReactElement {
  const t = (s: string) => label(s, isArabic);
  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd());
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [storeChannel, setStoreChannel] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['client', 'products', 'create-oms'],
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

  useEffect(() => {
    if (!open) return;
    setShipDate(localCalendarDateYmd());
    setRecipientName('');
    setRecipientPhone('');
    setCity('');
    setDistrict('');
    setAddressLine1('');
    setStoreChannel('');
    setPaymentMethod('');
    setNotes('');
    setLines([emptyLine()]);
    setError(null);
  }, [open]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError(t('Required ship date cannot be before today.'));
      return;
    }
    if (shortages.length > 0) {
      setError(t('Insufficient stock for one or more products.'));
      return;
    }

    const payloadLines: CreateClientOmsOrderInput['lines'] = [];
    for (const l of lines) {
      if (!l.productId || !l.requestedQuantity) continue;
      const qty = Number(l.requestedQuantity);
      const unitPrice = Number(l.unitPrice);
      if (!(qty > 0)) continue;
      if (Number.isNaN(unitPrice) || unitPrice < 0) {
        setError(t('Each product line needs a valid price.'));
        return;
      }
      payloadLines.push({ productId: l.productId, requestedQuantity: qty, unitPrice });
    }
    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity and price.'));
      return;
    }

    setError(null);
    onSubmit({
      requiredShipDate: shipDate,
      recipientName: recipientName.trim() || undefined,
      recipientPhone: recipientPhone.trim() || undefined,
      city: city.trim() || undefined,
      district: district.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      notes: notes.trim() || undefined,
      storeChannel: storeChannel.trim() || undefined,
      paymentMethod: (paymentMethod || undefined) as CreateClientOmsOrderInput['paymentMethod'],
      lines: payloadLines,
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('Create OMS Order')}
      widthClass="max-w-4xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button
            form="create-client-oms"
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={shortages.length > 0}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('Submit for approval')}
          </Button>
        </>
      }
    >
      <form id="create-client-oms" onSubmit={submit} className="space-y-4">
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {t(
            'Order will be submitted for admin approval. Shipping fee is set by the warehouse.',
          )}
        </p>

        {error || submitError ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error ?? submitError}
          </p>
        ) : null}

        <ClientFormSection title={t('Shipping information')}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField
              label={t('Recipient name')}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            <TextField
              label={t('Recipient phone')}
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
            />
            <TextField label={t('City')} value={city} onChange={(e) => setCity(e.target.value)} />
            <TextField
              label={t('District')}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <div className="md:col-span-2">
              <TextField
                label={t('Address')}
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
          </div>
        </ClientFormSection>

        <ClientFormSection title={t('Order details')}>
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
              label={t('Sales channel')}
              value={storeChannel}
              onChange={(e) => setStoreChannel(e.target.value)}
            />
            <SelectField
              label={t('Payment method')}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={[
                { value: '', label: '—' },
                { value: 'COD', label: 'COD' },
                { value: 'PREPAID', label: 'Prepaid' },
                { value: 'CREDIT', label: 'Credit' },
              ]}
            />
          </div>
          <Textarea
            label={t('Notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </ClientFormSection>

        <ClientFormSection title={t('Products')}>
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const avail = line.productId ? availabilityByProduct.get(line.productId) : undefined;
              const summed = line.productId ? requestedByProduct.get(line.productId) ?? 0 : 0;
              const isShort = avail !== undefined && summed > avail;
              return (
                <div key={idx} className="space-y-1">
                  <div className="grid gap-2 md:grid-cols-[1fr_90px_110px_auto]">
                    <Combobox
                      label={idx === 0 ? t('Product') : undefined}
                      value={line.productId}
                      onChange={(v) =>
                        setLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, productId: v } : row)),
                        )
                      }
                      options={productOptions}
                      placeholder={t('Pick product…')}
                      clearable={false}
                      dropdownInFlow
                    />
                    <TextField
                      label={idx === 0 ? t('Qty') : undefined}
                      value={line.requestedQuantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, requestedQuantity: e.target.value } : row,
                          ),
                        )
                      }
                    />
                    <TextField
                      label={idx === 0 ? t('Price') : undefined}
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, unitPrice: e.target.value } : row,
                          ),
                        )
                      }
                      required
                    />
                    <div className={idx === 0 ? 'pt-6' : 'pt-1'}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={lines.length <= 1 || loading}
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        {t('Remove')}
                      </Button>
                    </div>
                  </div>
                  {line.productId && avail !== undefined ? (
                    <div
                      className={`text-xs ${
                        isShort
                          ? 'text-danger-600 dark:text-status-danger-fg'
                          : 'text-brand-700 dark:text-brand-400'
                      }`}
                    >
                      {t('Available')}: {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      {summed > 0 ? (
                        <>
                          {' '}
                          • {t('Requested across lines')}:{' '}
                          {summed.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          {isShort ? ` — ${t('Exceeds available stock')}` : ''}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              {t('+ Add line')}
            </Button>
          </div>
        </ClientFormSection>

        {shortages.length > 0 ? (
          <div className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg">
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
