import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Combobox, Textarea, TextField, FILTER_PRIMARY_BUTTON_CLASS } from '@ds';

import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import {
  fetchClientOmsOrder,
  fetchClientOmsOrders,
} from '../services/clientOmsOrdersService';
import {
  fetchClientOutboundOrder,
  fetchClientOutboundOrders,
} from '../services/clientOutboundOrdersService';
import {
  createClientReturn,
  fetchClientOutboundReturnQuota,
  type CreateClientReturnInput,
} from '../services/clientReturnsService';
import {
  createClientOmsReturn,
  type CreateClientOmsReturnInput,
} from '../services/clientOmsReturnsService';
import type { ReturnsSource } from './ReturnsListPage';

const MAX_RETURN_LINES = 50;

type DraftLine = {
  productId: string;
  outboundOrderLineId: string;
  expectedQuantity: string;
};

const emptyLine = (): DraftLine => ({
  productId: '',
  outboundOrderLineId: '',
  expectedQuantity: '',
});

function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function sanitizePositiveIntegerInput(raw: string): string | null {
  if (raw === '') return '';
  if (!/^[1-9]\d*$/.test(raw)) return null;
  return raw;
}

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
    'New online return': 'مرتجع إلكتروني جديد',
    'New outbound return': 'مرتجع صادر جديد',
    'Return items from an online order': 'إرجاع أصناف من طلب إلكتروني',
    'Return items from a shipped outbound order': 'إرجاع أصناف من طلب صادر مشحون',
    'Back to returns': 'العودة إلى المرتجعات',
    'Linked order': 'الطلب المرتبط',
    'Select order…': 'اختر الطلب…',
    'Return reason / notes': 'سبب الإرجاع / ملاحظات',
    Products: 'المنتجات',
    Product: 'المنتج',
    Quantity: 'الكمية',
    'Search and select a product...': 'ابحث واختر منتجاً...',
    'Enter Qty': 'أدخل الكمية',
    'Select a product first': 'اختر منتجاً أولاً',
    'Select a linked order first': 'اختر الطلب المرتبط أولاً',
    Remove: 'إزالة',
    '+ Add line': '+ إضافة بند',
    Cancel: 'إلغاء',
    'Create return': 'إنشاء المرتجع',
    Available: 'المتاح',
    remaining: 'متبقي',
    'Current quantity:': 'الكمية الحالية:',
    'Exceeds available stock': 'يتجاوز المخزون المتاح',
    'All products already added': 'تمت إضافة كل المنتجات',
    'No available products': 'لا توجد منتجات متاحة',
    'Add at least one line with quantity.': 'أضف بنداً واحداً على الأقل بكمية.',
    'Each product can only be added once.': 'يمكن إضافة كل منتج مرة واحدة فقط.',
    'Quantity must be a positive whole number (1, 2, 3, …).':
      'يجب أن تكون الكمية عدداً صحيحاً موجباً (1، 2، 3، …).',
    'Quantity exceeds returnable remaining.': 'الكمية تتجاوز المتبقي القابل للإرجاع.',
    'Linked order is required.': 'الطلب المرتبط مطلوب.',
    'Creating returns is not available for your account right now.':
      'إنشاء المرتجعات غير متاح لحسابك حالياً.',
    'No returnable orders available.': 'لا توجد طلبات قابلة للإرجاع.',
    'Quantities are capped by the linked order.': 'الكميات محدودة بالطلب المرتبط.',
  };
  return ar[text] ?? text;
}

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
      {title}
    </h2>
  );
}

type ProductOption = {
  value: string;
  label: string;
  hint?: string;
  productId: string;
  outboundOrderLineId?: string;
  maxQty: number;
  uom?: string;
};

type Props = { source: ReturnsSource };

function CreateReturnPage({ source }: Props): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic = isClientArabic();
  const t = (s: string) => label(s, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);

  const basePath = source === 'oms' ? '/ecommerce-orders/returns' : '/outbound-orders/returns';
  const [linkedOrderId, setLinkedOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const omsOrders = useQuery({
    queryKey: ['client', 'oms-orders', 'returns-create'],
    queryFn: () => fetchClientOmsOrders({ limit: 100 }),
    enabled: billingAccess.operationalAllowed && source === 'oms',
    staleTime: 60_000,
  });

  const outboundOrders = useQuery({
    queryKey: ['client', 'outbound-orders', 'returns-create'],
    queryFn: () => fetchClientOutboundOrders({ status: 'shipped', limit: 100 }),
    enabled: billingAccess.operationalAllowed && source === 'outbound',
    staleTime: 60_000,
  });

  const omsDetail = useQuery({
    queryKey: ['client', 'oms-orders', linkedOrderId],
    queryFn: () => fetchClientOmsOrder(linkedOrderId),
    enabled: source === 'oms' && !!linkedOrderId,
  });

  const omsOutboundId = omsDetail.data?.linkedOutboundOrder?.id ?? '';

  const outboundDetail = useQuery({
    queryKey: ['client', 'outbound-orders', source === 'outbound' ? linkedOrderId : omsOutboundId],
    queryFn: () =>
      fetchClientOutboundOrder(source === 'outbound' ? linkedOrderId : omsOutboundId),
    enabled:
      billingAccess.operationalAllowed &&
      (source === 'outbound' ? !!linkedOrderId : !!omsOutboundId),
  });

  const quotaOutboundId = source === 'outbound' ? linkedOrderId : omsOutboundId;

  const outboundQuota = useQuery({
    queryKey: ['client', 'returns', 'outbound-quota', quotaOutboundId],
    queryFn: () => fetchClientOutboundReturnQuota(quotaOutboundId),
    enabled: billingAccess.operationalAllowed && !!quotaOutboundId,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: async (
      input: CreateClientReturnInput | CreateClientOmsReturnInput,
    ): Promise<{ id: string }> => {
      if (source === 'oms') {
        return createClientOmsReturn(input as CreateClientOmsReturnInput);
      }
      return createClientReturn(input as CreateClientReturnInput);
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'returns'] });
      void queryClient.invalidateQueries({ queryKey: ['client', 'oms-returns'] });
      navigate(`${basePath}/${order.id}`);
    },
    onError: (err: Error) => setError(err.message || 'Could not create return.'),
  });

  const linkedOrderOptions = useMemo(() => {
    if (source === 'oms') {
      // Commercial OMS returns are allowed only after Delivered.
      return (omsOrders.data?.items ?? [])
        .filter((o) => o.status === 'delivered')
        .map((o) => ({
          value: o.id,
          label: `${o.orderNumber} · ${o.status}${o.recipientName ? ` · ${o.recipientName}` : ''}`,
        }));
    }
    return (outboundOrders.data?.items ?? []).map((o) => ({
      value: o.id,
      label: `${o.orderNumber} · ${o.status}`,
    }));
  }, [source, omsOrders.data, outboundOrders.data]);

  const quotaByLineId = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of outboundQuota.data?.lines ?? []) {
      m.set(q.outboundOrderLineId, Number(q.remaining));
    }
    return m;
  }, [outboundQuota.data]);

  const productOptions: ProductOption[] = useMemo(() => {
    if (!linkedOrderId) return [];

    if (source === 'outbound' || omsOutboundId) {
      const ob = outboundDetail.data;
      if (!ob) return [];
      return (ob.lines ?? []).map((l) => {
        const remaining = quotaByLineId.get(l.id) ?? Number(l.pickedQuantity);
        return {
          value: l.product.id,
          label: `${l.product.sku} — ${l.product.name}`,
          hint: `${t('remaining')} ${remaining}`,
          productId: l.product.id,
          outboundOrderLineId: l.id,
          maxQty: Math.max(0, Math.floor(remaining)),
          uom: l.product.uom ?? undefined,
        };
      });
    }

    // OMS without linked outbound — use OMS lines
    return (omsDetail.data?.lines ?? [])
      .filter((l) => l.product?.id)
      .map((l) => {
        const maxQty = Math.max(0, Math.floor(Number(l.requestedQuantity) || 0));
        return {
          value: l.product!.id,
          label: `${l.product!.sku} — ${l.product!.name}`,
          hint: `${t('remaining')} ${maxQty}`,
          productId: l.product!.id,
          maxQty,
        };
      });
  }, [
    linkedOrderId,
    source,
    omsOutboundId,
    outboundDetail.data,
    omsDetail.data,
    quotaByLineId,
    isArabic,
  ]);

  const productsById = useMemo(() => {
    const m = new Map<string, ProductOption>();
    for (const o of productOptions) m.set(o.productId, o);
    return m;
  }, [productOptions]);

  const optionsForLine = (lineIdx: number) => {
    const taken = new Set(
      lines
        .map((l, i) => (i !== lineIdx && l.productId ? l.productId : null))
        .filter((id): id is string => Boolean(id)),
    );
    return productOptions
      .filter((o) => !taken.has(o.productId) || o.productId === lines[lineIdx]?.productId)
      .filter((o) => o.maxQty > 0 || o.productId === lines[lineIdx]?.productId)
      .map((o) => ({ value: o.productId, label: o.label, hint: o.hint }));
  };

  const productCount = productOptions.filter((o) => o.maxQty > 0).length;
  const canAddLine = productCount > 0 && lines.length < Math.min(MAX_RETURN_LINES, productCount);

  useEffect(() => {
    setLines([emptyLine()]);
  }, [linkedOrderId]);

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    if (patch.productId) {
      const alreadyUsed = lines.some((l, i) => i !== idx && l.productId === patch.productId);
      if (alreadyUsed) {
        setError(t('Each product can only be added once.'));
        return;
      }
      const opt = productsById.get(patch.productId);
      patch.outboundOrderLineId = opt?.outboundOrderLineId ?? '';
    }
    setError(null);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t('Creating returns is not available for your account right now.'),
      );
      return;
    }
    if (!linkedOrderId) {
      setError(t('Linked order is required.'));
      return;
    }

    const seen = new Set<string>();
    const lineQty: Array<{ productId: string; qty: number; outboundOrderLineId?: string }> = [];

    for (const row of lines) {
      if (!row.productId) continue;
      if (!isPositiveIntegerString(row.expectedQuantity)) {
        setError(t('Quantity must be a positive whole number (1, 2, 3, …).'));
        return;
      }
      if (seen.has(row.productId)) {
        setError(t('Each product can only be added once.'));
        return;
      }
      seen.add(row.productId);
      const qty = Number(row.expectedQuantity);
      const opt = productsById.get(row.productId);
      const max = opt?.maxQty ?? 0;
      if (qty > max) {
        setError(t('Quantity exceeds returnable remaining.'));
        return;
      }
      lineQty.push({
        productId: row.productId,
        qty,
        outboundOrderLineId: row.outboundOrderLineId || opt?.outboundOrderLineId || undefined,
      });
    }

    if (lineQty.length === 0) {
      setError(t('Add at least one line with quantity.'));
      return;
    }

    setError(null);
    if (source === 'oms') {
      createMut.mutate({
        omsOrderId: linkedOrderId,
        notes: notes.trim() || undefined,
        reason: notes.trim() || undefined,
        lines: lineQty.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
        })),
      });
      return;
    }

    createMut.mutate({
      originalOutboundOrderId: linkedOrderId,
      notes: notes.trim() || undefined,
      lines: lineQty.map((l) => ({
        productId: l.productId,
        expectedQuantity: l.qty,
        outboundOrderLineId: l.outboundOrderLineId,
      })),
    });
  };

  const loading = createMut.isPending;
  const fieldsDisabled = loading || !billingAccess.operationalAllowed;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to={basePath}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to returns')}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">
            {source === 'oms' ? t('New online return') : t('New outbound return')}
          </h1>
          <p className="text-sm text-text-muted">
            {source === 'oms'
              ? t('Return items from an online order')
              : t('Return items from a shipped outbound order')}
          </p>
        </header>
      </div>

      {!billingAccess.operationalAllowed ? (
        <p
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
          role="alert"
        >
          {billingAccess.actionBlockedReason ||
            t('Creating returns is not available for your account right now.')}
        </p>
      ) : null}

      <form id="create-client-return" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-5">
          <Combobox
            label={t('Linked order')}
            required
            value={linkedOrderId}
            onChange={(v) => {
              setLinkedOrderId(v);
              setError(null);
            }}
            options={linkedOrderOptions}
            placeholder={t('Select order…')}
            emptyMessage={t('No returnable orders available.')}
            clearable={false}
            dropdownInFlow
            disabled={fieldsDisabled}
          />
          <Textarea
            label={t('Return reason / notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={fieldsDisabled}
          />
          {linkedOrderId ? (
            <p className="text-xs text-text-muted">{t('Quantities are capped by the linked order.')}</p>
          ) : null}
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
              const maxQty = product?.maxQty;
              const isShort =
                maxQty !== undefined &&
                isPositiveIntegerString(row.expectedQuantity) &&
                Number(row.expectedQuantity) > maxQty;

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                >
                  <div className="min-w-0">
                    <Combobox
                      value={row.productId}
                      onChange={(v) => updateLine(idx, { productId: v, expectedQuantity: '' })}
                      options={optionsForLine(idx)}
                      placeholder={
                        linkedOrderId
                          ? t('Search and select a product...')
                          : t('Select a linked order first')
                      }
                      emptyMessage={t('No available products')}
                      disabled={fieldsDisabled || !linkedOrderId}
                      clearable={false}
                      dropdownInFlow
                      required
                    />
                    {product ? (
                      <p className="mt-1.5 text-[11px] text-text-muted">
                        {t('Current quantity:')}{' '}
                        <span className="font-mono font-semibold text-text-strong">
                          {product.maxQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                        {product.uom ? (
                          <>
                            {' '}
                            <span className="uppercase text-text-body">{product.uom}</span>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                    {product ? (
                      <p
                        className={`mt-1 text-xs ${
                          isShort
                            ? 'text-danger-600 dark:text-status-danger-fg'
                            : 'text-brand-700 dark:text-brand-400'
                        }`}
                      >
                        {t('Available')}:{' '}
                        {product.maxQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {isShort ? ` · ${t('Exceeds available stock')}` : null}
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
                      const next = clampPositiveIntegerToMax(e.target.value, maxQty);
                      if (next === null) return;
                      updateLine(idx, { expectedQuantity: next });
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
                  setLines((prev) => [...prev, emptyLine()]);
                }}
                className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-lg border border-border-strong bg-surface-card text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5 dark:hover:text-brand-400 sm:justify-self-auto"
              >
                <i className="fa-solid fa-plus text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-6">
          <Button type="button" variant="ghost" disabled={loading} onClick={() => navigate(basePath)}>
            {t('Cancel')}
          </Button>
          <button
            type="submit"
            form="create-client-return"
            disabled={fieldsDisabled || !linkedOrderId}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {loading ? (
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-check" aria-hidden="true" />
            )}
            {t('Create return')}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CreateEcommerceReturnPage(): ReactElement {
  return <CreateReturnPage source="oms" />;
}

export function CreateOutboundReturnPage(): ReactElement {
  return <CreateReturnPage source="outbound" />;
}
