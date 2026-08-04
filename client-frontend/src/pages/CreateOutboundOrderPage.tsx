import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Combobox, Textarea, TextField } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@ds';

import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import { fetchProductAvailability } from '../services/clientInventoryService';
import {
  createClientOutboundOrder,
  type CreateClientOutboundOrderInput,
} from '../services/clientOutboundOrdersService';
import {
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';

type DraftLine = { productId: string; requestedQuantity: string };

function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function sanitizePositiveIntegerInput(raw: string): string | null {
  if (raw === '') return '';
  if (!/^[1-9]\d*$/.test(raw)) return null;
  return raw;
}

/** Cap a positive integer string to maxAvailable (floor). Empty stays empty. */
function clampPositiveIntegerToMax(raw: string, maxAvailable: number | undefined): string | null {
  const next = sanitizePositiveIntegerInput(raw);
  if (next === null) return null;
  if (next === '') return '';
  if (maxAvailable === undefined) return next;
  const max = Math.floor(maxAvailable);
  if (max < 1) return '';
  return Number(next) > max ? String(max) : next;
}

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New outbound order': 'طلب صادر جديد',
    'Create a warehouse shipment request': 'إنشاء طلب شحن صادر من المستودع',
    'Back to outbound orders': 'العودة إلى طلبات الصادر',
    'Required ship date': 'تاريخ الشحن المطلوب',
    Destination: 'الوجهة',
    Carrier: 'الناقل',
    Notes: 'ملاحظات',
    'Add any notes about this outbound order...': 'أضف أي ملاحظات حول طلب الصادر هذا...',
    Product: 'المنتج',
    'Search and select a product...': 'ابحث واختر منتجاً...',
    Quantity: 'الكمية',
    Remove: 'إزالة',
    '+ Add line': '+ إضافة بند',
    Cancel: 'إلغاء',
    'Submit for approval': 'إرسال للموافقة',
    'Current quantity:': 'الكمية الحالية:',
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.',
    'Destination is required.': 'الوجهة مطلوبة.',
    'Add at least one line with quantity.': 'أضف بنداً واحداً على الأقل بكمية.',
    'Quantity must be a positive whole number (1, 2, 3, …).':
      'يجب أن تكون الكمية عدداً صحيحاً موجباً (1، 2، 3، …).',
    'Quantity cannot exceed available stock.': 'لا يمكن أن تتجاوز الكمية المخزون المتاح.',
    'Enter Qty': 'أدخل الكمية',
    'Select a product first': 'اختر منتجاً أولاً',
    'All products already added': 'تمت إضافة كل المنتجات',
    'Each product can only be added once.': 'يمكن إضافة كل منتج مرة واحدة فقط.',
    'No available products': 'لا توجد منتجات متاحة',
    'Exceeds available stock': 'يتجاوز المخزون المتاح',
    Available: 'المتاح',
    'Order cannot be created — insufficient stock:': 'لا يمكن إنشاء الطلب — مخزون غير كافٍ:',
    requested: 'مطلوب',
    available: 'متاح',
    'Insufficient stock for one or more products.': 'مخزون غير كافٍ لمنتج واحد أو أكثر.',
    'Shipping information': 'معلومات الشحن',
    Products: 'المنتجات',
    'Creating orders is not available for your account right now.':
      'إنشاء الطلبات غير متاح لحسابك حالياً.',
  };
  return ar[text] ?? text;
}

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
      {title}
    </h2>
  );
}

export function CreateOutboundOrderPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic = isClientArabic();
  const t = (s: string) => label(s, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);

  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd());
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', requestedQuantity: '' }]);
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['client', 'products', 'create-outbound'],
    queryFn: () => fetchClientProducts({ limit: 200 }),
    enabled: billingAccess.operationalAllowed,
    staleTime: 5 * 60_000,
  });

  const productCount = products.data?.items?.length ?? 0;
  const canAddLine = productCount > 0 && lines.length < productCount;

  useEffect(() => {
    if (!products.isSuccess) return;
    const max = products.data?.items?.length ?? 0;
    if (max <= 0) {
      setLines([{ productId: '', requestedQuantity: '' }]);
      return;
    }
    setLines((prev) => (prev.length > max ? prev.slice(0, max) : prev));
  }, [products.isSuccess, products.data?.items?.length]);

  const createMut = useMutation({
    mutationFn: (input: CreateClientOutboundOrderInput) => createClientOutboundOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'outbound-orders'] });
      navigate(`/outbound-orders/${order.id}`);
    },
    onError: (err: Error) => setError(err.message || 'Could not submit order.'),
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

  const optionsForLine = (lineIdx: number) => {
    const taken = new Set(
      lines
        .map((l, i) => (i !== lineIdx && l.productId ? l.productId : null))
        .filter((id): id is string => Boolean(id)),
    );
    return productOptions.filter((o) => !taken.has(o.value));
  };

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: ['client', 'availability', pid],
      queryFn: () => fetchProductAvailability(pid),
      enabled: billingAccess.operationalAllowed && !!pid,
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
      if (!l.productId || !isPositiveIntegerString(l.requestedQuantity)) continue;
      const n = Number(l.requestedQuantity);
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

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    if (patch.productId) {
      const alreadyUsed = lines.some((l, i) => i !== idx && l.productId === patch.productId);
      if (alreadyUsed) {
        setError(t('Each product can only be added once.'));
        return;
      }
    }
    setError(null);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  // Keep typed quantities within live available stock once availability loads.
  useEffect(() => {
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if (!l.productId || !isPositiveIntegerString(l.requestedQuantity)) return l;
        const avail = availabilityByProduct.get(l.productId);
        if (avail === undefined) return l;
        const max = Math.floor(avail);
        const qty = Number(l.requestedQuantity);
        if (max < 1) {
          if (l.requestedQuantity === '') return l;
          changed = true;
          return { ...l, requestedQuantity: '' };
        }
        if (qty > max) {
          changed = true;
          return { ...l, requestedQuantity: String(max) };
        }
        return l;
      });
      return changed ? next : prev;
    });
  }, [availabilityByProduct]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t('Creating orders is not available for your account right now.'),
      );
      return;
    }
    if (!destination.trim()) {
      setError(t('Destination is required.'));
      return;
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError(t('Required ship date cannot be before today.'));
      return;
    }
    const incomplete = lines.some(
      (l) => l.productId && !isPositiveIntegerString(l.requestedQuantity),
    );
    if (incomplete) {
      setError(t('Quantity must be a positive whole number (1, 2, 3, …).'));
      return;
    }
    const overStock = lines.some((l) => {
      if (!l.productId || !isPositiveIntegerString(l.requestedQuantity)) return false;
      const avail = availabilityByProduct.get(l.productId);
      if (avail === undefined) return false;
      return Number(l.requestedQuantity) > Math.floor(avail);
    });
    if (overStock || shortages.length > 0) {
      setError(t('Quantity cannot exceed available stock.'));
      return;
    }
    const payloadLines = lines
      .filter((l) => l.productId && isPositiveIntegerString(l.requestedQuantity))
      .map((l) => ({
        productId: l.productId,
        requestedQuantity: Number(l.requestedQuantity),
      }));
    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity.'));
      return;
    }
    const productIds = payloadLines.map((l) => l.productId);
    if (new Set(productIds).size !== productIds.length) {
      setError(t('Each product can only be added once.'));
      return;
    }
    setError(null);
    createMut.mutate({
      destinationAddress: destination.trim(),
      requiredShipDate: shipDate,
      carrier: carrier.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: payloadLines,
    });
  };

  const loading = createMut.isPending;
  const fieldsDisabled = loading || !billingAccess.operationalAllowed;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to="/outbound-orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to outbound orders')}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">
            {t('New outbound order')}
          </h1>
          <p className="text-sm text-text-muted">{t('Create a warehouse shipment request')}</p>
        </header>
      </div>

      {!billingAccess.operationalAllowed ? (
        <p
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
          role="alert"
        >
          {billingAccess.actionBlockedReason ||
            t('Creating orders is not available for your account right now.')}
        </p>
      ) : null}

      <form id="create-client-outbound" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-5">
          <SectionHeading title={t('Shipping information')} />
          <div className="space-y-5">
            <TextField
              label={t('Destination')}
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={fieldsDisabled}
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField
                label={t('Required ship date')}
                type="date"
                required
                min={localCalendarDateYmd()}
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                disabled={fieldsDisabled}
              />
              <TextField
                label={t('Carrier')}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={t('Add any notes about this outbound order...')}
              disabled={fieldsDisabled}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading title={t('Products')} />

          <div className="space-y-3">
            <div className="hidden gap-3 px-0.5 sm:grid sm:grid-cols-[minmax(0,1fr)_140px_40px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                {t('Product')}
                <span aria-hidden="true" className="ms-0.5 text-danger-600">
                  *
                </span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                {t('Quantity')}
                <span aria-hidden="true" className="ms-0.5 text-danger-600">
                  *
                </span>
              </span>
              <span className="sr-only">{t('Remove')}</span>
            </div>

            {lines.map((row, idx) => {
              const product = row.productId ? productsById.get(row.productId) : undefined;
              const avail = row.productId ? availabilityByProduct.get(row.productId) : undefined;
              const maxQty = avail !== undefined ? Math.floor(avail) : undefined;
              const summed = row.productId ? (requestedByProduct.get(row.productId) ?? 0) : 0;
              const isShort = avail !== undefined && summed > avail;

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                >
                  <div className="min-w-0">
                    <Combobox
                      value={row.productId}
                      onChange={(v) =>
                        updateLine(idx, { productId: v, requestedQuantity: '' })
                      }
                      options={optionsForLine(idx)}
                      placeholder={t('Search and select a product...')}
                      emptyMessage={t('No available products')}
                      disabled={fieldsDisabled || products.isLoading}
                      clearable={false}
                      dropdownInFlow
                      required
                    />
                    {product ? (
                      <p className="mt-1.5 text-[11px] text-text-muted">
                        {t('Current quantity:')}{' '}
                        <span className="font-mono font-semibold text-text-strong">
                          {formatOnHand(product)}
                        </span>{' '}
                        <span className="uppercase text-text-body">{product.uom}</span>
                      </p>
                    ) : null}
                    {avail !== undefined ? (
                      <p
                        className={`mt-1 text-xs ${
                          isShort
                            ? 'text-danger-600 dark:text-status-danger-fg'
                            : 'text-brand-700 dark:text-brand-400'
                        }`}
                      >
                        {t('Available')}:{' '}
                        {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {isShort ? ` · ${t('Exceeds available stock')}` : null}
                      </p>
                    ) : null}
                  </div>
                  <TextField
                    type="text"
                    inputMode="numeric"
                    pattern="[1-9][0-9]*"
                    aria-label={t('Quantity')}
                    value={row.requestedQuantity}
                    onChange={(e) => {
                      const next = clampPositiveIntegerToMax(e.target.value, maxQty);
                      if (next === null) return;
                      updateLine(idx, { requestedQuantity: next });
                    }}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
                    }}
                    disabled={fieldsDisabled || !row.productId}
                    placeholder={row.productId ? t('Enter Qty') : t('Select a product first')}
                    required={Boolean(row.productId)}
                    error={
                      isShort
                        ? t('Exceeds available stock')
                        : row.productId &&
                            row.requestedQuantity !== '' &&
                            !isPositiveIntegerString(row.requestedQuantity)
                          ? t('Quantity must be a positive whole number (1, 2, 3, …).')
                          : undefined
                    }
                  />
                  <button
                    type="button"
                    aria-label={t('Remove')}
                    disabled={fieldsDisabled || lines.length <= 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-muted transition hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="fa-solid fa-trash-can text-sm" aria-hidden="true" />
                  </button>
                </div>
              );
            })}

            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]">
              <div className="hidden sm:block" />
              <div className="hidden sm:block" />
              <button
                type="button"
                aria-label={t('+ Add line')}
                disabled={fieldsDisabled || !canAddLine}
                title={
                  !canAddLine && productCount > 0
                    ? t('All products already added')
                    : t('+ Add line')
                }
                onClick={() => {
                  if (!canAddLine) return;
                  setLines((prev) => [...prev, { productId: '', requestedQuantity: '' }]);
                }}
                className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-lg border border-border-strong bg-surface-card text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5 dark:hover:text-brand-400 sm:justify-self-auto"
              >
                <i className="fa-solid fa-plus text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>

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
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="danger"
            onClick={() => navigate('/outbound-orders')}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={!billingAccess.operationalAllowed || shortages.length > 0}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('Submit for approval')}
          </Button>
        </div>
      </form>
    </div>
  );
}
