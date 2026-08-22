import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Alert, Button, Textarea } from '@ds';

import { CompaniesApi } from '../../api/companies';
import { CreateInboundOrderInput, InboundApi } from '../../api/inbound';
import type { Product } from '../../api/products';
import { ProductsApi } from '../../api/products';
import { Combobox } from '../../components/Combobox';
import { ReceivingDockPicker } from '../../components/locations/ReceivingDockPicker';
import { StorageLocationPicker } from '../../components/locations/StorageLocationPicker';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import type { InboundExecutionPlan, OrderExecutionMode } from '../../lib/execution-plan';
import { inboundAdminPlanReadinessIssues } from '../../lib/execution-plan';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../../lib/order-planning-dates';

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';
const NOTES_MAX = 500;

type PutawayRow = { key: string; locationId: string; qty: string };
type DraftLine = {
  key: string;
  productId: string;
  expectedQuantity: string;
  putaway: PutawayRow[];
};

function tLabel(label: string, ar: boolean): string {
  if (!ar) return label;
  const map: Record<string, string> = {
    'Inbound orders': 'طلبات الوارد',
    'New inbound order': 'طلب وارد جديد',
    'Edit inbound plan': 'تعديل خطة الوارد',
    'Plan everything before execution.': 'خطّط كل شيء قبل التنفيذ.',
    'Create a warehouse receipt request': 'إنشاء طلب إيصال وارد للمستودع',
    'Back to inbound orders': 'العودة إلى طلبات الوارد',
    'Save plan': 'حفظ الخطة',
    Cancel: 'إلغاء',
    'General information': 'معلومات عامة',
    Client: 'العميل',
    'Expected arrival': 'تاريخ الوصول المتوقع',
    Notes: 'ملاحظات',
    'Add any notes about this inbound order…': 'أضف أي ملاحظات عن طلب الوارد…',
    Products: 'المنتجات',
    '+ Add line': '+ إضافة بند',
    Product: 'المنتج',
    Quantity: 'الكمية',
    'Enter Qty': 'أدخل الكمية',
    'Select a product first': 'اختر منتجاً أولاً',
    'Search and select a product...': 'ابحث واختر منتجاً...',
    'Current quantity:': 'الكمية الحالية:',
    'Total items:': 'إجمالي القطع:',
    'Receiving dock': 'رصيف الاستلام',
    Warehouse: 'المستودع',
    'This is where the shipment will arrive. All items will be received at this dock first.':
      'هنا ستصل الشحنة. ستُستلم جميع الأصناف في هذا الرصيف أولاً.',
    'Putaway plan (where to store items)': 'خطة التخزين (أين تُخزَّن الأصناف)',
    'Distribute quantities across one or more storage locations. Total allocated quantity must equal the expected quantity for each product.':
      'وزّع الكميات على موقع تخزين واحد أو أكثر. يجب أن يساوي المجموع الكمية المتوقعة لكل منتج.',
    'Storage location': 'موقع التخزين',
    'Allocate qty': 'كمية التخصيص',
    Allocated: 'مخصص',
    'Add location': 'إضافة موقع',
    'Execution mode': 'وضع التنفيذ',
    Recommended: 'موصى به',
    'Execute by Admin': 'تنفيذ بواسطة المسؤول',
    'Who performs physical work after you Confirm. Same planning screen either way.':
      'من ينفّذ العمل الفعلي بعد التأكيد. شاشة التخطيط واحدة في الحالتين.',
    'I will do the warehouse work myself, then Approve and complete each stage.':
      'سأتولى عمل المستودع بنفسي، ثم أوافق وأكمل كل مرحلة.',
    'You will receive printable instructions': 'ستحصل على تعليمات قابلة للطباعة',
    'Saving the plan only configures the workflow — stages are completed on the order page.':
      'حفظ الخطة يضبط سير العمل فقط — إكمال المراحل يتم من صفحة الطلب.',
    'Execute by Workers': 'تنفيذ بواسطة العمال',
    'Release to workers after the plan is ready. Workers execute Tasks.':
      'أطلِق للعمل بعد جاهزية الخطة. ينفّذ العمال المهام.',
    'Workers will see tasks in their accounts': 'سيرى العمال المهام في حساباتهم',
    'You can monitor progress from the order page.': 'يمكنك متابعة التقدم من صفحة الطلب.',
    'Next steps': 'الخطوات التالية',
    'Click Save plan to create a draft. Print and Approve (or Release) from the order page.':
      'اضغط حفظ الخطة لإنشاء مسودة. اطبع ووافق (أو أطلِق) من صفحة الطلب.',
    'Pick product…': 'اختر منتجاً…',
    Remove: 'إزالة',
    'All products are already on this order.': 'كل المنتجات مضافة مسبقاً إلى هذا الطلب.',
    'Each product can only appear once on the order.': 'لا يمكن تكرار نفس المنتج أكثر من مرة في الطلب.',
    'Add products above to plan putaway.': 'أضف منتجات أعلاه لتخطيط التخزين.',
    Status: 'الحالة',
    'Expected qty': 'الكمية المتوقعة',
  };
  return map[label] ?? label;
}

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
      {title}
    </h2>
  );
}

function formatOnHand(p: Product): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

function AllocationBadge({
  allocated,
  expected,
  complete,
  label,
}: {
  allocated: number;
  expected: number;
  complete: boolean;
  label: string;
}) {
  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums',
        complete
          ? 'bg-brand-50 text-brand-800'
          : 'bg-status-warning-bg text-status-warning-fg',
      ].join(' ')}
    >
      <i
        className={`fa-solid text-[10px] ${complete ? 'fa-check text-brand-600' : 'fa-triangle-exclamation'}`}
        aria-hidden
      />
      {allocated.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      {' / '}
      {expected.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
    </div>
  );
}

function ModeOption({
  selected,
  onSelect,
  icon,
  title,
  bullets,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  bullets: string[];
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'rounded-2xl border-2 p-5 text-start transition',
        selected
          ? 'border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-950/40'
          : 'border-border bg-surface-card hover:border-border-strong',
      ].join(' ')}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={[
            'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-brand-600' : 'border-border-strong',
          ].join(' ')}
          aria-hidden
        >
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : null}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={[
                'flex h-10 w-10 items-center justify-center rounded-full',
                selected ? 'bg-brand-100 text-brand-700' : 'bg-surface-sunken text-text-muted',
              ].join(' ')}
            >
              <i className={`fa-solid ${icon}`} aria-hidden />
            </span>
            <span className="text-[15px] font-semibold text-text-strong">{title}</span>
          </div>
          <ul className="space-y-2 text-sm text-text-body">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <i className="fa-solid fa-check mt-0.5 text-brand-600" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}

export function InboundCreatePage() {
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId && editId !== 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => tLabel(label, isArabic);

  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId) || '';

  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [arrival, setArrival] = useState(() => localCalendarDateYmd());
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<OrderExecutionMode>('admin');
  const [receivingDockId, setReceivingDockId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { key: '1', productId: '', expectedQuantity: '', putaway: [{ key: '1a', locationId: '', qty: '' }] },
  ]);

  const existing = useQuery({
    queryKey: [...QK.inboundOrders, editId],
    queryFn: () => InboundApi.get(editId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing.data) return;
    const o = existing.data;
    setCompanyId(o.companyId);
    setArrival(o.expectedArrivalDate.slice(0, 10));
    setNotes(o.notes ?? '');
    setMode(o.executionMode === 'workers' ? 'workers' : 'admin');
    const plan = o.executionPlan;
    if (plan?.warehouseId) setSelectedWarehouseId(plan.warehouseId);
    if (plan?.receivingDockId) setReceivingDockId(plan.receivingDockId);
    setLines(
      o.lines.map((l, i) => {
        const pl =
          plan?.lines.find((x) => x.orderLineId === l.id) ??
          plan?.lines.find((x) => x.productId === l.productId);
        const putaway =
          pl?.putaway?.length
            ? pl.putaway.map((p, j) => ({
                key: `${i}-${j}`,
                locationId: p.locationId,
                qty: String(p.qty),
              }))
            : [{ key: `${i}-0`, locationId: '', qty: String(l.expectedQuantity) }];
        return {
          key: l.id,
          productId: l.productId,
          expectedQuantity: String(l.expectedQuantity),
          putaway,
        };
      }),
    );
  }, [existing.data]);

  useEffect(() => {
    setSelectedWarehouseId((cur) =>
      cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId,
    );
  }, [warehouseId, warehouses]);

  const companies = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list() });
  const products = useQuery({
    queryKey: [...QK.products, companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 200 }),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!companyId && companies.data?.length) {
      const fallback =
        companies.data.find((c) => c.id === DEFAULT_COMPANY_ID) ?? companies.data[0];
      setCompanyId(fallback.id);
    }
  }, [companyId, companies.data]);

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products.data?.items ?? []) m.set(p.id, p);
    return m;
  }, [products.data]);

  const activeProducts = useMemo(
    () => (products.data?.items ?? []).filter((p) => p.status === 'active'),
    [products.data],
  );

  const usedProductIds = useMemo(
    () => new Set(lines.map((l) => l.productId).filter(Boolean)),
    [lines],
  );

  const optionsForLine = (lineKey: string) => {
    const current = lines.find((l) => l.key === lineKey)?.productId;
    return activeProducts
      .filter((p) => p.id === current || !usedProductIds.has(p.id))
      .map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  };

  const canAddLine = activeProducts.some((p) => !usedProductIds.has(p.id));

  const totalItems = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const n = Number(l.expectedQuantity);
        return sum + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [lines],
  );

  const addLine = () => {
    if (!canAddLine) {
      toast.error(t('All products are already on this order.'));
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `n-${Date.now()}`,
        productId: '',
        expectedQuantity: '',
        putaway: [{ key: `p-${Date.now()}`, locationId: '', qty: '' }],
      },
    ]);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!isYmdOnOrAfterLocalToday(arrival)) {
        throw new Error('Expected arrival date cannot be before today.');
      }
      const validLines = lines.filter((l) => l.productId && Number(l.expectedQuantity) > 0);
      if (validLines.length === 0) throw new Error('Add at least one product line.');

      const ids = validLines.map((l) => l.productId);
      if (new Set(ids).size !== ids.length) {
        throw new Error(t('Each product can only appear once on the order.'));
      }

      let executionPlan: InboundExecutionPlan | undefined;
      if (mode === 'admin') {
        executionPlan = {
          warehouseId: effectiveWarehouseId,
          receivingDockId: receivingDockId.trim(),
          lines: validLines.map((l) => ({
            productId: l.productId,
            expectedQty: Number(l.expectedQuantity),
            putaway: l.putaway.map((r) => ({
              locationId: r.locationId.trim(),
              qty: Number(r.qty),
            })),
          })),
          planUpdatedAt: new Date().toISOString(),
        };
        const issues = inboundAdminPlanReadinessIssues(
          executionPlan,
          validLines.map((l) => ({
            productId: l.productId,
            expectedQuantity: l.expectedQuantity,
          })),
        );
        if (issues.length) throw new Error(issues[0]!);
      }

      const payload: CreateInboundOrderInput = {
        companyId,
        expectedArrivalDate: arrival,
        notes: notes.trim() || undefined,
        executionMode: mode,
        executionPlan,
        lines: validLines.map((l) => ({
          productId: l.productId,
          expectedQuantity: Number(l.expectedQuantity),
        })),
      };

      if (isEdit) {
        return InboundApi.updatePlan(editId!, {
          executionMode: mode,
          executionPlan,
          expectedArrivalDate: arrival,
          notes: notes.trim() || undefined,
        });
      }
      return InboundApi.create(payload);
    },
    onSuccess: (order) => {
      toast.success(isEdit ? 'Plan updated.' : 'Plan saved.');
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      navigate(`/orders/inbound/${order.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveMut.mutate();
  }

  if (isEdit && existing.isLoading) {
    return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  }

  const productLines = lines.filter((l) => l.productId);
  const loading = saveMut.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter pb-10">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to="/orders/inbound"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to inbound orders')}
          </Link>
        </nav>
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">
            {isEdit ? t('Edit inbound plan') : t('New inbound order')}
          </h1>
          <p className="text-sm text-text-muted">
            {isEdit ? t('Plan everything before execution.') : t('Create a warehouse receipt request')}
          </p>
        </header>
      </div>

      <form id="inbound-plan-form" onSubmit={onSubmit} className="space-y-10">
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
            {t('Execution mode')}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ModeOption
              selected={mode === 'admin'}
              onSelect={() => setMode('admin')}
              icon="fa-user"
              title={t('Execute by Admin')}
              bullets={[
                t('I will do the warehouse work myself, then Approve and complete each stage.'),
                t('You will receive printable instructions'),
                t('Saving the plan only configures the workflow — stages are completed on the order page.'),
              ]}
            />
            <ModeOption
              selected={mode === 'workers'}
              onSelect={() => setMode('workers')}
              icon="fa-users"
              title={t('Execute by Workers')}
              bullets={[
                t('Release to workers after the plan is ready. Workers execute Tasks.'),
                t('Workers will see tasks in their accounts'),
                t('You can monitor progress from the order page.'),
              ]}
            />
          </div>
        </section>

        {/* General information */}
        <section className="space-y-5">
          <SectionHeading title={t('General information')} />
          <div className="grid gap-5 md:grid-cols-2">
            <Combobox
              label={t('Client')}
              required
              value={companyId}
              onChange={setCompanyId}
              options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              disabled={isEdit}
              clearable={false}
              dropdownInFlow
            />
            <TextField
              label={t('Expected arrival')}
              type="date"
              required
              min={localCalendarDateYmd()}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </div>
          <div>
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              rows={4}
              maxLength={NOTES_MAX}
              placeholder={t('Add any notes about this inbound order…')}
            />
            <p className="mt-1.5 text-end text-xs tabular-nums text-text-muted">
              {notes.length} / {NOTES_MAX}
            </p>
          </div>
        </section>

        {/* Products */}
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

            {lines.map((line) => {
              const p = productById.get(line.productId);
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                >
                  <div className="min-w-0">
                    <Combobox
                      value={line.productId}
                      onChange={(id) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key !== line.key
                              ? l
                              : {
                                  ...l,
                                  productId: id,
                                  putaway:
                                    l.putaway.length === 1
                                      ? [{ ...l.putaway[0]!, qty: l.expectedQuantity }]
                                      : l.putaway,
                                },
                          ),
                        )
                      }
                      options={optionsForLine(line.key)}
                      placeholder={t('Search and select a product...')}
                      disabled={!companyId}
                      clearable={false}
                      dropdownInFlow
                      emptyMessage={t('All products are already on this order.')}
                    />
                    {p ? (
                      <p className="mt-1.5 text-[11px] text-text-muted">
                        {t('Current quantity:')}{' '}
                        <span className="font-mono font-semibold text-text-strong">
                          {formatOnHand(p)}
                        </span>{' '}
                        <span className="uppercase text-text-body">{p.uom}</span>
                      </p>
                    ) : null}
                  </div>
                  <TextField
                    type="number"
                    min={0}
                    step="1"
                    aria-label={t('Quantity')}
                    value={line.expectedQuantity}
                    onChange={(e) => {
                      const qty = e.target.value;
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key !== line.key
                            ? l
                            : {
                                ...l,
                                expectedQuantity: qty,
                                putaway:
                                  l.putaway.length === 1
                                    ? [{ ...l.putaway[0]!, qty }]
                                    : l.putaway,
                              },
                        ),
                      );
                    }}
                    disabled={!line.productId}
                    placeholder={line.productId ? t('Enter Qty') : t('Select a product first')}
                  />
                  <button
                    type="button"
                    aria-label={t('Remove')}
                    disabled={lines.length <= 1}
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-muted transition hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="fa-solid fa-trash-can text-sm" aria-hidden />
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
                disabled={!canAddLine}
                title={
                  !canAddLine && activeProducts.length > 0
                    ? t('All products are already on this order.')
                    : t('+ Add line')
                }
                onClick={addLine}
                className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-lg border border-border-strong bg-surface-card text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-auto"
              >
                <i className="fa-solid fa-plus text-sm" aria-hidden />
              </button>
            </div>

            <p className="text-sm text-text-muted">
              {t('Total items:')}{' '}
              <span className="font-semibold tabular-nums text-text-strong">
                {totalItems.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </p>
          </div>
        </section>

        {mode === 'admin' ? (
          <>
            <section className="space-y-5">
              <SectionHeading title={t('Receiving dock')} />
              {warehouses.length > 1 ? (
                <Combobox
                  label={t('Warehouse')}
                  required
                  value={selectedWarehouseId || warehouseId}
                  onChange={setSelectedWarehouseId}
                  options={warehouses
                    .filter((w) => w.status === 'active')
                    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
                  clearable={false}
                  dropdownInFlow
                />
              ) : null}
              {effectiveWarehouseId ? (
                <ReceivingDockPicker
                  warehouseId={effectiveWarehouseId}
                  value={receivingDockId}
                  onChange={setReceivingDockId}
                  label={t('Receiving dock')}
                  dropdownInFlow
                />
              ) : (
                <Alert variant="warning" title="Set a default warehouse first." />
              )}
              <p className="text-sm text-text-muted">
                {t(
                  'This is where the shipment will arrive. All items will be received at this dock first.',
                )}
              </p>
            </section>

            <section className="space-y-5">
              <SectionHeading title={t('Putaway plan (where to store items)')} />
              <p className="text-sm text-text-muted">
                {t(
                  'Distribute quantities across one or more storage locations. Total allocated quantity must equal the expected quantity for each product.',
                )}
              </p>

              {productLines.length === 0 ? (
                <p className="text-sm text-text-muted">{t('Add products above to plan putaway.')}</p>
              ) : (
                <div className="space-y-6">
                  {productLines.map((line) => {
                    const p = productById.get(line.productId);
                    const expected = Number(line.expectedQuantity) || 0;
                    const allocated = line.putaway.reduce((a, r) => {
                      if (!r.locationId.trim()) return a;
                      return a + (Number(r.qty) || 0);
                    }, 0);
                    const complete = expected > 0 && Math.abs(allocated - expected) < 1e-6;

                    return (
                      <div key={line.key} className="space-y-3 border-b border-border-subtle pb-6 last:border-b-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-text-strong">
                              {p ? `${p.sku} — ${p.name}` : '—'}
                            </div>
                            <div className="mt-0.5 text-xs text-text-muted">
                              {t('Expected qty')}:{' '}
                              <span className="font-mono font-semibold text-text-strong">
                                {line.expectedQuantity || '—'}
                              </span>
                              {p?.uom ? (
                                <span className="ms-1 uppercase text-text-body">{p.uom}</span>
                              ) : null}
                            </div>
                          </div>
                          <AllocationBadge
                            allocated={allocated}
                            expected={expected}
                            complete={complete}
                            label={t('Allocated')}
                          />
                        </div>

                        <div className="space-y-2.5">
                          {line.putaway.map((row) => (
                            <div
                              key={row.key}
                              className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                            >
                              {effectiveWarehouseId ? (
                                <StorageLocationPicker
                                  warehouseId={effectiveWarehouseId}
                                  value={row.locationId}
                                  onChange={(id) =>
                                    setLines((prev) =>
                                      prev.map((l) =>
                                        l.key !== line.key
                                          ? l
                                          : {
                                              ...l,
                                              putaway: l.putaway.map((r) =>
                                                r.key === row.key ? { ...r, locationId: id } : r,
                                              ),
                                            },
                                      ),
                                    )
                                  }
                                  label=""
                                  hint=""
                                  placeholder={t('Storage location')}
                                  dropdownInFlow
                                />
                              ) : (
                                <div />
                              )}
                              <TextField
                                type="number"
                                min={0}
                                step="0.0001"
                                aria-label={t('Allocate qty')}
                                value={row.qty}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.key !== line.key
                                        ? l
                                        : {
                                            ...l,
                                            putaway: l.putaway.map((r) =>
                                              r.key === row.key
                                                ? { ...r, qty: e.target.value }
                                                : r,
                                            ),
                                          },
                                    ),
                                  )
                                }
                                placeholder={t('Enter Qty')}
                              />
                              <button
                                type="button"
                                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-muted transition hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={line.putaway.length <= 1}
                                aria-label={t('Remove')}
                                onClick={() =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.key !== line.key
                                        ? l
                                        : {
                                            ...l,
                                            putaway: l.putaway.filter((r) => r.key !== row.key),
                                          },
                                    ),
                                  )
                                }
                              >
                                <i className="fa-solid fa-trash-can text-sm" aria-hidden />
                              </button>
                            </div>
                          ))}
                          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]">
                            <div className="hidden sm:block" aria-hidden />
                            <div className="hidden sm:block" aria-hidden />
                            <button
                              type="button"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                              aria-label={t('Add location')}
                              title={t('Add location')}
                              onClick={() =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key !== line.key
                                      ? l
                                      : {
                                          ...l,
                                          putaway: [
                                            ...l.putaway,
                                            { key: `${Date.now()}`, locationId: '', qty: '' },
                                          ],
                                        },
                                  ),
                                )
                              }
                            >
                              <i className="fa-solid fa-plus text-sm" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}

        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text-strong">{t('Next steps')}: </span>
          {t(
            'Click Save plan to create a draft. Print and Approve (or Release) from the order page.',
          )}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-6">
          <Button
            type="button"
            variant="danger"
            disabled={loading}
            onClick={() => navigate('/orders/inbound')}
          >
            {t('Cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {t('Save plan')}
          </Button>
        </div>
      </form>
    </div>
  );
}
