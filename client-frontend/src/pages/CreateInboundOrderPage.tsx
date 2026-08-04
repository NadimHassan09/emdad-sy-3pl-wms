import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Combobox, Textarea, TextField } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@ds';

import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import {
  createClientInboundOrder,
  type CreateClientInboundOrderInput,
} from '../services/clientInboundOrdersService';
import {
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';

type DraftLine = { productId: string; expectedQuantity: string };

/** Empty or a positive integer string (1, 2, 3, …) — never 0 / decimals / signs. */
function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function sanitizePositiveIntegerInput(raw: string): string | null {
  if (raw === '') return '';
  if (!/^[1-9]\d*$/.test(raw)) return null;
  return raw;
}

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New inbound order': 'طلب وارد جديد',
    'Create a warehouse receipt request': 'إنشاء طلب إيصال وارد للمستودع',
    'Back to inbound orders': 'العودة إلى طلبات الوارد',
    'Expected arrival date': 'تاريخ الوصول المتوقع',
    Notes: 'ملاحظات',
    'Add any notes about this inbound order...': 'أضف أي ملاحظات حول طلب الوارد هذا...',
    Product: 'المنتج',
    'Search and select a product...': 'ابحث واختر منتجاً...',
    Quantity: 'الكمية',
    Remove: 'إزالة',
    '+ Add line': '+ إضافة بند',
    Cancel: 'إلغاء',
    'Submit for approval': 'إرسال للموافقة',
    'Current quantity:': 'الكمية الحالية:',
    'Expected arrival date cannot be before today.': 'لا يمكن أن يكون تاريخ الوصول قبل اليوم.',
    'Add at least one line with quantity.': 'أضف بنداً واحداً على الأقل بكمية.',
    'Quantity must be a positive whole number (1, 2, 3, …).':
      'يجب أن تكون الكمية عدداً صحيحاً موجباً (1، 2، 3، …).',
    'Enter Qty': 'أدخل الكمية',
    'Select a product first': 'اختر منتجاً أولاً',
    'All products already added': 'تمت إضافة كل المنتجات',
    'Each product can only be added once.': 'يمكن إضافة كل منتج مرة واحدة فقط.',
    'No available products': 'لا توجد منتجات متاحة',
    'General information': 'المعلومات العامة',
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

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactElement;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function CreateInboundOrderPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic = isClientArabic();
  const t = (s: string) => label(s, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);

  const [arrival, setArrival] = useState(() => localCalendarDateYmd());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { productId: '', expectedQuantity: '' },
  ]);
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['client', 'products', 'create-inbound'],
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
      setLines([{ productId: '', expectedQuantity: '' }]);
      return;
    }
    setLines((prev) => (prev.length > max ? prev.slice(0, max) : prev));
  }, [products.isSuccess, products.data?.items?.length]);

  const createMut = useMutation({
    mutationFn: (input: CreateClientInboundOrderInput) => createClientInboundOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'inbound-orders'] });
      navigate(`/inbound-orders/${order.id}`);
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

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    if (patch.productId) {
      const alreadyUsed = lines.some(
        (l, i) => i !== idx && l.productId === patch.productId,
      );
      if (alreadyUsed) {
        setError(t('Each product can only be added once.'));
        return;
      }
    }
    setError(null);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t('Creating orders is not available for your account right now.'),
      );
      return;
    }
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      setError(t('Expected arrival date cannot be before today.'));
      return;
    }
    const incomplete = lines.some(
      (l) => l.productId && !isPositiveIntegerString(l.expectedQuantity),
    );
    if (incomplete) {
      setError(t('Quantity must be a positive whole number (1, 2, 3, …).'));
      return;
    }
    const payloadLines = lines
      .filter((l) => l.productId && isPositiveIntegerString(l.expectedQuantity))
      .map((l) => ({
        productId: l.productId,
        expectedQuantity: Number(l.expectedQuantity),
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
      expectedArrivalDate: arrival,
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
            to="/inbound-orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to inbound orders')}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">
            {t('New inbound order')}
          </h1>
          <p className="text-sm text-text-muted">{t('Create a warehouse receipt request')}</p>
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

      <form id="create-client-inbound" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-5">
          <SectionHeading title={t('General information')} />
          <div className="space-y-5">
            <TextField
              label={t('Expected arrival date')}
              type="date"
              required
              min={localCalendarDateYmd()}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              disabled={fieldsDisabled}
            />
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={t('Add any notes about this inbound order...')}
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
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                >
                  <div className="min-w-0">
                    <Combobox
                      value={row.productId}
                      onChange={(v) =>
                        updateLine(idx, { productId: v, expectedQuantity: '' })
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
                  </div>
                  <TextField
                    type="text"
                    inputMode="numeric"
                    pattern="[1-9][0-9]*"
                    aria-label={t('Quantity')}
                    value={row.expectedQuantity}
                    onChange={(e) => {
                      const next = sanitizePositiveIntegerInput(e.target.value);
                      if (next === null) return;
                      updateLine(idx, { expectedQuantity: next });
                    }}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    disabled={fieldsDisabled || !row.productId}
                    placeholder={row.productId ? t('Enter Qty') : t('Select a product first')}
                    required={Boolean(row.productId)}
                    error={
                      row.productId &&
                      row.expectedQuantity !== '' &&
                      !isPositiveIntegerString(row.expectedQuantity)
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
                  setLines((prev) => [...prev, { productId: '', expectedQuantity: '' }]);
                }}
                className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-lg border border-border-strong bg-surface-card text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5 dark:hover:text-brand-400 sm:justify-self-auto"
              >
                <i className="fa-solid fa-plus text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="danger"
            onClick={() => navigate('/inbound-orders')}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={!billingAccess.operationalAllowed}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('Submit for approval')}
          </Button>
        </div>
      </form>
    </div>
  );
}
