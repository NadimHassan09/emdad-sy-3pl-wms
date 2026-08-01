import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Alert, AppPageHeader, Breadcrumb, Button, Card, Textarea } from '@ds';

import { CompaniesApi } from '../../api/companies';
import { CreateInboundOrderInput, InboundApi } from '../../api/inbound';
import type { Product } from '../../api/products';
import { ProductsApi } from '../../api/products';
import { Combobox } from '../../components/Combobox';
import { ReceivingDockPicker } from '../../components/locations/ReceivingDockPicker';
import { StorageLocationPicker } from '../../components/locations/StorageLocationPicker';
import { ProductThumbWithFallback } from '../../components/products/ProductThumb';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import type { InboundExecutionPlan, OrderExecutionMode } from '../../lib/execution-plan';
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
    New: 'جديد',
    'New inbound order': 'طلب وارد جديد',
    'Edit inbound plan': 'تعديل خطة الوارد',
    'Plan everything before execution.': 'خطّط كل شيء قبل التنفيذ.',
    'Save plan': 'حفظ الخطة',
    Cancel: 'إلغاء',
    'General information': 'معلومات عامة',
    Client: 'العميل',
    'Expected arrival': 'تاريخ الوصول المتوقع',
    Notes: 'ملاحظات',
    'Add any notes about this inbound order…': 'أضف أي ملاحظات عن طلب الوارد…',
    Products: 'المنتجات',
    '+ Add line': '+ إضافة بند',
    '+ Add product': '+ إضافة منتج',
    Product: 'المنتج',
    SKU: 'رمز الصنف',
    'Expected qty': 'الكمية المتوقعة',
    Unit: 'الوحدة',
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
    'I will do everything myself. No tasks will be assigned to workers.':
      'سأتولى كل شيء بنفسي. لن تُسند مهام إلى العمال.',
    'You will receive printable instructions': 'ستحصل على تعليمات قابلة للطباعة',
    'Confirm once after completing the work.': 'أكّد مرة واحدة بعد إنجاز العمل.',
    'Execute by Workers': 'تنفيذ بواسطة العمال',
    'Tasks will be created and assigned to warehouse workers.':
      'ستُنشأ مهام وتُسند إلى عمال المستودع.',
    'Workers will see tasks in their accounts': 'سيرى العمال المهام في حساباتهم',
    'You can monitor progress in real time.': 'يمكنك متابعة التقدم في الوقت الفعلي.',
    'Next steps': 'الخطوات التالية',
    'Click Save plan to create a draft. You can print instructions and confirm the order after completing the work.':
      'اضغط حفظ الخطة لإنشاء مسودة. يمكنك طباعة التعليمات وتأكيد الطلب بعد إنجاز العمل.',
    'Pick product…': 'اختر منتجاً…',
    Remove: 'إزالة',
    'All products are already on this order.': 'كل المنتجات مضافة مسبقاً إلى هذا الطلب.',
    'Each product can only appear once on the order.': 'لا يمكن تكرار نفس المنتج أكثر من مرة في الطلب.',
    'Add products above to plan putaway.': 'أضف منتجات أعلاه لتخطيط التخزين.',
  };
  return map[label] ?? label;
}

function SectionHeading({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {n}
      </span>
      <h2 className="text-base font-semibold text-text-strong">{children}</h2>
    </div>
  );
}

function PlanCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Card padding="none" elevation="raised" className={`border-border ${className}`}>
      <Card.Body className="space-y-5 px-6 py-6">{children}</Card.Body>
    </Card>
  );
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
        'flex min-h-[5.5rem] min-w-[8.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center',
        complete
          ? 'border-brand-300 bg-brand-50 text-brand-800'
          : 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
      ].join(' ')}
    >
      <i
        className={`fa-solid text-base ${complete ? 'fa-check text-brand-600' : 'fa-triangle-exclamation'}`}
        aria-hidden
      />
      <div className="text-[13px] font-semibold leading-snug tabular-nums">
        {allocated.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        {' / '}
        {expected.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
        {label}
      </div>
    </div>
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
      .map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
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
        if (!effectiveWarehouseId) throw new Error('Select a warehouse.');
        if (!receivingDockId.trim()) throw new Error('Select a receiving dock.');
        for (const l of validLines) {
          const sum = l.putaway.reduce((a, r) => a + (Number(r.qty) || 0), 0);
          if (Math.abs(sum - Number(l.expectedQuantity)) > 1e-6) {
            const sku = productById.get(l.productId)?.sku ?? l.productId;
            throw new Error(`Putaway qty for ${sku} must equal ${l.expectedQuantity}.`);
          }
          if (l.putaway.some((r) => !r.locationId.trim() || !(Number(r.qty) > 0))) {
            throw new Error('Each putaway row needs a location and quantity.');
          }
        }
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
  const execStep = mode === 'admin' ? 5 : 3;
  const uomLabel = (uom?: string) =>
    uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : '—';

  return (
    <div className="w-full max-w-[1100px] space-y-4 animate-enter pb-10">
      <Breadcrumb
        items={[
          { label: t('Inbound orders'), to: '/orders/inbound' },
          { label: isEdit ? t('Edit inbound plan') : t('New') },
        ]}
      />
      <AppPageHeader
        className="!mb-1"
        title={isEdit ? t('Edit inbound plan') : t('New inbound order')}
        description={t('Plan everything before execution.')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/orders/inbound')}>
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              form="inbound-plan-form"
              variant="primary"
              loading={saveMut.isPending}
            >
              {t('Save plan')}
            </Button>
          </div>
        }
      />

      <form id="inbound-plan-form" onSubmit={onSubmit} className="space-y-4">
        {/* ─── 1. General information ─── */}
        <PlanCard>
          <SectionHeading n={1}>{t('General information')}</SectionHeading>
          <div className="grid gap-5 md:grid-cols-2">
            <Combobox
              label={`${t('Client')} *`}
              required
              value={companyId}
              onChange={setCompanyId}
              options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              disabled={isEdit}
              clearable={false}
            />
            <TextField
              label={`${t('Expected arrival')} *`}
              type="date"
              required
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
        </PlanCard>

        {/* ─── 2. Products ─── */}
        <PlanCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading n={2}>{t('Products')}</SectionHeading>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addLine}
              disabled={!canAddLine}
              className="!border-brand-200 !text-brand-700 hover:!bg-brand-50"
            >
              {t('+ Add line')}
            </Button>
          </div>

          <div className="overflow-visible rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/60 text-start text-xs font-medium text-text-muted">
                  <th className="w-10 px-4 py-3 font-medium">#</th>
                  <th className="min-w-[280px] px-3 py-3 font-medium">{t('Product')}</th>
                  <th className="w-40 px-3 py-3 font-medium">{t('SKU')}</th>
                  <th className="w-36 px-3 py-3 font-medium">{t('Expected qty')}</th>
                  <th className="w-28 px-3 py-3 font-medium">{t('Unit')}</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const p = productById.get(line.productId);
                  return (
                    <tr key={line.key} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3.5 align-middle text-text-muted tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductThumbWithFallback
                            productId={line.productId || null}
                            name={p?.name}
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
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
                              placeholder={t('Pick product…')}
                              disabled={!companyId}
                              clearable={false}
                              emptyMessage={t('All products are already on this order.')}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div className="flex h-11 items-center rounded-lg border border-border bg-surface-sunken/40 px-3 font-mono text-xs text-text-muted">
                          {p?.sku ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <TextField
                          type="number"
                          min={0}
                          step="1"
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
                        />
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div className="flex h-11 items-center rounded-lg border border-border bg-surface-sunken/40 px-3 text-text-body">
                          {uomLabel(p?.uom)}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-danger-500 hover:bg-danger-50 disabled:opacity-40"
                          disabled={lines.length <= 1}
                          aria-label={t('Remove')}
                          onClick={() =>
                            setLines((prev) => prev.filter((l) => l.key !== line.key))
                          }
                        >
                          <i className="fa-regular fa-trash-can text-sm" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addLine}
              disabled={!canAddLine}
            >
              {t('+ Add product')}
            </Button>
            <p className="text-sm text-text-muted">
              {t('Total items:')}{' '}
              <span className="font-semibold tabular-nums text-text-strong">
                {totalItems.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </p>
          </div>
        </PlanCard>

        {mode === 'admin' ? (
          <>
            {/* ─── 3. Receiving dock ─── */}
            <PlanCard>
              <SectionHeading n={3}>{t('Receiving dock')}</SectionHeading>
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
                />
              ) : null}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.85fr)] lg:items-start">
                {effectiveWarehouseId ? (
                  <ReceivingDockPicker
                    warehouseId={effectiveWarehouseId}
                    value={receivingDockId}
                    onChange={setReceivingDockId}
                    label={`${t('Receiving dock')} *`}
                  />
                ) : (
                  <Alert variant="warning" title="Set a default warehouse first." />
                )}
                <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-4 text-sm leading-relaxed text-brand-800">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-brand-600">
                    <i className="fa-solid fa-warehouse" aria-hidden />
                  </span>
                  <p>
                    {t(
                      'This is where the shipment will arrive. All items will be received at this dock first.',
                    )}
                  </p>
                </div>
              </div>
            </PlanCard>

            {/* ─── 4. Putaway plan ─── */}
            <PlanCard>
              <SectionHeading n={4}>{t('Putaway plan (where to store items)')}</SectionHeading>

              <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-brand-600" aria-hidden />
                <p>
                  {t(
                    'Distribute quantities across one or more storage locations. Total allocated quantity must equal the expected quantity for each product.',
                  )}
                </p>
              </div>

              {productLines.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t('Add products above to plan putaway.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Column headers */}
                  <div className="hidden grid-cols-[minmax(200px,1.1fr)_5.5rem_minmax(180px,1.2fr)_6.5rem_2.5rem_8rem] gap-3 px-1 text-xs font-medium text-text-muted md:grid">
                    <div>{t('Product')}</div>
                    <div>{t('Expected qty')}</div>
                    <div>{t('Storage location')}</div>
                    <div>{t('Allocate qty')}</div>
                    <div />
                    <div className="text-center">Status</div>
                  </div>

                  {productLines.map((line) => {
                    const p = productById.get(line.productId);
                    const expected = Number(line.expectedQuantity) || 0;
                    const allocated = line.putaway.reduce(
                      (a, r) => a + (Number(r.qty) || 0),
                      0,
                    );
                    const complete =
                      expected > 0 && Math.abs(allocated - expected) < 1e-6;

                    return (
                      <div
                        key={line.key}
                        className="rounded-xl border border-border bg-surface-panel p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[minmax(200px,1.1fr)_5.5rem_minmax(0,1fr)_8rem] md:items-start">
                          {/* Product */}
                          <div className="flex items-start gap-3">
                            <ProductThumbWithFallback
                              productId={line.productId}
                              name={p?.name}
                              size="md"
                            />
                            <div className="min-w-0 pt-0.5">
                              <div className="truncate font-semibold text-text-strong">
                                {p?.name ?? '—'}
                              </div>
                              <div className="mt-0.5 font-mono text-xs text-text-muted">
                                {p?.sku ?? '—'}
                              </div>
                            </div>
                          </div>

                          {/* Expected */}
                          <div className="pt-2.5 font-mono text-sm tabular-nums text-text-strong">
                            <span className="mr-2 text-xs font-medium text-text-muted md:hidden">
                              {t('Expected qty')}:
                            </span>
                            {line.expectedQuantity || '—'}
                          </div>

                          {/* Locations + qty + delete */}
                          <div className="space-y-2.5">
                            {line.putaway.map((row) => (
                              <div
                                key={row.key}
                                className="grid grid-cols-[minmax(0,1fr)_6.5rem_2.5rem] items-start gap-2"
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
                                                  r.key === row.key
                                                    ? { ...r, locationId: id }
                                                    : r,
                                                ),
                                              },
                                        ),
                                      )
                                    }
                                    label=""
                                    hint=""
                                    placeholder={t('Storage location')}
                                  />
                                ) : (
                                  <div />
                                )}
                                <TextField
                                  type="number"
                                  min={0}
                                  step="0.0001"
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
                                />
                                <button
                                  type="button"
                                  className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-danger-500 hover:bg-danger-50 disabled:opacity-40"
                                  disabled={line.putaway.length <= 1}
                                  aria-label={t('Remove')}
                                  onClick={() =>
                                    setLines((prev) =>
                                      prev.map((l) =>
                                        l.key !== line.key
                                          ? l
                                          : {
                                              ...l,
                                              putaway: l.putaway.filter(
                                                (r) => r.key !== row.key,
                                              ),
                                            },
                                      ),
                                    )
                                  }
                                >
                                  <i className="fa-regular fa-trash-can text-sm" aria-hidden />
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="!border-brand-200 !text-brand-700 hover:!bg-brand-50"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key !== line.key
                                      ? l
                                      : {
                                          ...l,
                                          putaway: [
                                            ...l.putaway,
                                            {
                                              key: `${Date.now()}`,
                                              locationId: '',
                                              qty: '',
                                            },
                                          ],
                                        },
                                  ),
                                )
                              }
                            >
                              + {t('Add location')}
                            </Button>
                          </div>

                          {/* Allocation status */}
                          <div className="flex justify-end md:justify-center">
                            <AllocationBadge
                              allocated={allocated}
                              expected={expected}
                              complete={complete}
                              label={t('Allocated')}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </PlanCard>
          </>
        ) : null}

        {/* ─── 5. Execution mode ─── */}
        <PlanCard>
          <SectionHeading n={execStep}>{t('Execution mode')}</SectionHeading>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Admin */}
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={[
                'rounded-2xl border-2 p-5 text-start transition',
                mode === 'admin'
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-border bg-white hover:border-border-strong',
              ].join(' ')}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={[
                    'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                    mode === 'admin' ? 'border-brand-600' : 'border-border-strong',
                  ].join(' ')}
                >
                  {mode === 'admin' ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  ) : null}
                </span>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <i className="fa-solid fa-user" aria-hidden />
                    </span>
                    <span className="text-[15px] font-semibold text-text-strong">
                      {t('Execute by Admin')}
                    </span>
                    <span className="rounded-full border border-brand-200 bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      {t('Recommended')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {t('I will do everything myself. No tasks will be assigned to workers.')}
                  </p>
                  <ul className="space-y-2 text-sm text-text-body">
                    <li className="flex items-start gap-2">
                      <i
                        className="fa-solid fa-check mt-0.5 text-brand-600"
                        aria-hidden
                      />
                      <span>{t('You will receive printable instructions')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i
                        className="fa-solid fa-check mt-0.5 text-brand-600"
                        aria-hidden
                      />
                      <span>{t('Confirm once after completing the work.')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </button>

            {/* Workers */}
            <button
              type="button"
              onClick={() => setMode('workers')}
              className={[
                'rounded-2xl border-2 p-5 text-start transition',
                mode === 'workers'
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-border bg-white hover:border-border-strong',
              ].join(' ')}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={[
                    'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                    mode === 'workers' ? 'border-brand-600' : 'border-border-strong',
                  ].join(' ')}
                >
                  {mode === 'workers' ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  ) : null}
                </span>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-text-muted">
                      <i className="fa-solid fa-users" aria-hidden />
                    </span>
                    <span className="text-[15px] font-semibold text-text-strong">
                      {t('Execute by Workers')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {t('Tasks will be created and assigned to warehouse workers.')}
                  </p>
                  <ul className="space-y-2 text-sm text-text-body">
                    <li className="flex items-start gap-2">
                      <i
                        className="fa-solid fa-check mt-0.5 text-brand-600"
                        aria-hidden
                      />
                      <span>{t('Workers will see tasks in their accounts')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i
                        className="fa-solid fa-check mt-0.5 text-brand-600"
                        aria-hidden
                      />
                      <span>{t('You can monitor progress in real time.')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </button>
          </div>
        </PlanCard>

        {/* ─── Next steps banner ─── */}
        <div className="flex items-start gap-3.5 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <i className="fa-solid fa-lightbulb" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 leading-relaxed">
            <div className="font-semibold text-sky-950">{t('Next steps')}</div>
            <p className="mt-0.5 text-sky-800/90">
              {t(
                'Click Save plan to create a draft. You can print instructions and confirm the order after completing the work.',
              )}
            </p>
          </div>
          <span className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100/80 text-sky-500 sm:flex">
            <i className="fa-solid fa-print text-lg" aria-hidden />
          </span>
        </div>
      </form>
    </div>
  );
}
