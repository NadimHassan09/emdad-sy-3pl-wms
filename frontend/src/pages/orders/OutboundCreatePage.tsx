import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Alert, AppPageHeader, Breadcrumb, Button, Card, Textarea } from '@ds';

import { CompaniesApi } from '../../api/companies';
import { InventoryApi } from '../../api/inventory';
import { CreateOutboundOrderInput, OutboundApi } from '../../api/outbound';
import type { Product } from '../../api/products';
import { ProductsApi } from '../../api/products';
import { Combobox } from '../../components/Combobox';
import { ProductThumbWithFallback } from '../../components/products/ProductThumb';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import type { OrderExecutionMode, OutboundExecutionPlan } from '../../lib/execution-plan';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../../lib/order-planning-dates';

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';
const FORM_ID = 'outbound-plan-form';
const NOTES_MAX = 500;

const CARRIER_OPTIONS = [
  { value: 'Aramex', label: 'Aramex' },
  { value: 'DHL', label: 'DHL' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'Local courier', label: 'Local courier' },
  { value: 'Customer pickup', label: 'Customer pickup' },
];

type DraftLine = {
  key: string;
  productId: string;
  requestedQuantity: string;
};

function tLabel(label: string, ar: boolean): string {
  if (!ar) return label;
  const map: Record<string, string> = {
    'Outbound orders': 'طلبات الصادر',
    New: 'جديد',
    'New outbound order': 'طلب صادر جديد',
    'Edit outbound plan': 'تعديل خطة الصادر',
    'Plan everything before execution.': 'خطّط كل شيء قبل التنفيذ.',
    'Review and update the plan before execution.': 'راجع وحدّث الخطة قبل التنفيذ.',
    'Save plan': 'حفظ الخطة',
    Cancel: 'إلغاء',
    'General information': 'معلومات عامة',
    Client: 'العميل',
    'Required ship date': 'تاريخ الشحن المطلوب',
    Carrier: 'الناقل',
    'Select carrier (optional)': 'اختر الناقل (اختياري)',
    Notes: 'ملاحظات',
    'Add any notes about this outbound order…': 'أضف أي ملاحظات عن طلب الصادر…',
    'Destination address': 'عنوان الوجهة',
    'Packing & dispatch': 'التغليف والإرسال',
    'Packing required': 'التغليف مطلوب',
    'Each product will be packed before dispatch.': 'سيُغلَّف كل منتج قبل الإرسال.',
    'When enabled, the workflow is: pick → pack → dispatch. When disabled, pick goes straight to the delivery area.':
      'عند التفعيل يكون المسار: التقاط ← تغليف ← إرسال. عند الإلغاء يذهب الالتقاط مباشرة إلى منطقة التسليم.',
    'Execution mode': 'وضع التنفيذ',
    Recommended: 'موصى به',
    'Execute by Admin': 'تنفيذ بواسطة المسؤول',
    'I will do everything myself. No tasks will be assigned to workers.':
      'سأتولى كل شيء بنفسي. لن تُسند مهام إلى العمال.',
    'Pick, pack (if required) and dispatch': 'التقاط وتغليف (إن لزم) وإرسال',
    'No tasks will be created.': 'لن تُنشأ مهام.',
    'Execute by Workers': 'تنفيذ بواسطة العمال',
    'Tasks will be created and assigned to warehouse workers.':
      'ستُنشأ مهام وتُسند إلى عمال المستودع.',
    'Tasks will be created for workers': 'ستُنشأ مهام للعمال',
    'You can monitor progress in real time.': 'يمكنك متابعة التقدم في الوقت الفعلي.',
    Lines: 'البنود',
    '+ Add line': '+ إضافة بند',
    '+ Add product': '+ إضافة منتج',
    Product: 'المنتج',
    SKU: 'رمز الصنف',
    Available: 'المتاح',
    'Expected qty': 'الكمية المتوقعة',
    Unit: 'الوحدة',
    'Total items:': 'إجمالي القطع:',
    'Pick product…': 'اختر منتجاً…',
    Remove: 'إزالة',
    'Next steps': 'الخطوات التالية',
    'Click Save plan to create a draft. You can print instructions and confirm the order after completing the work.':
      'اضغط حفظ الخطة لإنشاء مسودة. يمكنك طباعة التعليمات وتأكيد الطلب بعد إنجاز العمل.',
    'Pick a client.': 'اختر عميلاً.',
    'Enter a destination address.': 'أدخل عنوان الوجهة.',
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن المطلوب قبل اليوم.',
    'All products are already on this order.': 'كل المنتجات مضافة مسبقاً إلى هذا الطلب.',
    'Each product can only appear once on the order.': 'لا يمكن تكرار نفس المنتج أكثر من مرة في الطلب.',
    'Exceeds available stock': 'تتجاوز المخزون المتاح',
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

export function OutboundCreatePage() {
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId && editId !== 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => tLabel(label, isArabic);

  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd());
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [requiresPacking, setRequiresPacking] = useState(true);
  const [executionMode, setExecutionMode] = useState<OrderExecutionMode>('admin');
  const { warehouseId } = useDefaultWarehouseId();
  const [lines, setLines] = useState<DraftLine[]>([
    { key: '1', productId: '', requestedQuantity: '' },
  ]);

  const existing = useQuery({
    queryKey: [...QK.outboundOrders, editId],
    queryFn: () => OutboundApi.get(editId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing.data) return;
    const o = existing.data;
    setCompanyId(o.companyId);
    setShipDate(o.requiredShipDate.slice(0, 10));
    setDestination(o.destinationAddress ?? '');
    setCarrier(o.carrier ?? '');
    setNotes(o.notes ?? '');
    setRequiresPacking(o.requiresPacking !== false);
    setExecutionMode(o.executionMode === 'workers' ? 'workers' : 'admin');
    setLines(
      o.lines.map((l) => ({
        key: l.id,
        productId: l.productId,
        requestedQuantity: String(l.requestedQuantity),
      })),
    );
  }, [existing.data]);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
  });

  const products = useQuery({
    queryKey: [...QK.products, companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 200 }),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (isEdit) return;
    if (!companyId && companies.data?.length) {
      const fallback =
        companies.data.find((c) => c.id === DEFAULT_COMPANY_ID) ?? companies.data[0];
      setCompanyId(fallback.id);
    }
  }, [companyId, companies.data, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    setLines([{ key: String(Date.now()), productId: '', requestedQuantity: '' }]);
  }, [companyId, isEdit]);

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

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: QK.availability(pid, companyId),
      queryFn: () => InventoryApi.availability(pid, companyId),
      enabled: !!pid && !!companyId,
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

  const totalItems = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const n = Number(l.requestedQuantity);
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
      { key: `n-${Date.now()}`, productId: '', requestedQuantity: '' },
    ]);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!companyId.trim()) throw new Error(t('Pick a client.'));
      if (!isYmdOnOrAfterLocalToday(shipDate)) {
        throw new Error(t('Required ship date cannot be before today.'));
      }
      if (!destination.trim()) throw new Error(t('Enter a destination address.'));
      const validLines = lines.filter((l) => l.productId && Number(l.requestedQuantity) > 0);
      if (validLines.length === 0) throw new Error('Add at least one product line.');
      const ids = validLines.map((l) => l.productId);
      if (new Set(ids).size !== ids.length) {
        throw new Error(t('Each product can only appear once on the order.'));
      }
      if (shortages.length > 0) throw new Error('Insufficient stock for one or more products.');

      const executionPlan: OutboundExecutionPlan | undefined =
        executionMode === 'admin'
          ? {
              warehouseId: warehouseId || '',
              requiresPacking,
              lines: validLines.map((l) => ({
                productId: l.productId,
                expectedQty: Number(l.requestedQuantity),
              })),
              planUpdatedAt: new Date().toISOString(),
            }
          : undefined;

      if (isEdit) {
        return OutboundApi.updatePlan(editId!, {
          executionMode,
          executionPlan,
          requiredShipDate: shipDate,
          notes: notes.trim() || undefined,
          destinationAddress: destination.trim(),
          requiresPacking,
        });
      }

      const input: CreateOutboundOrderInput = {
        companyId,
        destinationAddress: destination.trim(),
        requiredShipDate: shipDate,
        carrier: carrier.trim() || undefined,
        notes: notes.trim() || undefined,
        requiresPacking,
        executionMode,
        executionPlan,
        lines: validLines.map((l) => ({
          productId: l.productId,
          requestedQuantity: Number(l.requestedQuantity),
        })),
      };
      return OutboundApi.create(input);
    },
    onSuccess: (order) => {
      toast.success(isEdit ? 'Plan updated.' : `Outbound order ${order.orderNumber} created.`);
      void qc.invalidateQueries({ queryKey: QK.outboundOrders });
      navigate(`/orders/outbound/${order.id}`);
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

  const uomLabel = (uom?: string) =>
    uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : '—';

  const carrierOptions = useMemo(() => {
    if (carrier && !CARRIER_OPTIONS.some((c) => c.value === carrier)) {
      return [{ value: carrier, label: carrier }, ...CARRIER_OPTIONS];
    }
    return CARRIER_OPTIONS;
  }, [carrier]);

  return (
    <div className="w-full max-w-[1100px] space-y-4 animate-enter pb-10">
      <Breadcrumb
        items={[
          { label: t('Outbound orders'), href: '/orders/outbound' },
          { label: isEdit ? t('Edit outbound plan') : t('New') },
        ]}
      />
      <AppPageHeader
        className="!mb-1"
        title={isEdit ? t('Edit outbound plan') : t('New outbound order')}
        description={
          isEdit
            ? t('Review and update the plan before execution.')
            : t('Plan everything before execution.')
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(isEdit ? `/orders/outbound/${editId}` : '/orders/outbound')
              }
            >
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              loading={saveMut.isPending}
              disabled={shortages.length > 0}
            >
              {t('Save plan')}
            </Button>
          </div>
        }
      />

      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4">
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
              label={`${t('Required ship date')} *`}
              type="date"
              required
              min={localCalendarDateYmd()}
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
            />
            <Combobox
              label={t('Carrier')}
              value={carrier}
              onChange={setCarrier}
              options={carrierOptions}
              placeholder={t('Select carrier (optional)')}
              clearable
            />
            <div>
              <Textarea
                label={t('Notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                rows={3}
                maxLength={NOTES_MAX}
                placeholder={t('Add any notes about this outbound order…')}
              />
              <p className="mt-1.5 text-end text-xs tabular-nums text-text-muted">
                {notes.length} / {NOTES_MAX}
              </p>
            </div>
          </div>
          <div className="relative">
            <TextField
              label={`${t('Destination address')} *`}
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="!ps-10"
            />
            <i
              className="fa-solid fa-location-dot pointer-events-none absolute start-3.5 top-[2.45rem] text-sm text-text-muted"
              aria-hidden
            />
          </div>
        </PlanCard>

        {/* ─── 2. Packing & dispatch ─── */}
        <PlanCard>
          <SectionHeading n={2}>{t('Packing & dispatch')}</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.9fr)] lg:items-start">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-sunken/40 px-4 py-4">
              <input
                type="checkbox"
                checked={requiresPacking}
                onChange={(e) => setRequiresPacking(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-semibold text-text-strong">
                  {t('Packing required')}
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  {t('Each product will be packed before dispatch.')}
                </span>
              </span>
            </label>
            <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-relaxed text-sky-900">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <i className="fa-solid fa-circle-info" aria-hidden />
              </span>
              <p>
                {t(
                  'When enabled, the workflow is: pick → pack → dispatch. When disabled, pick goes straight to the delivery area.',
                )}
              </p>
            </div>
          </div>
        </PlanCard>

        {/* ─── 3. Execution mode ─── */}
        <PlanCard>
          <SectionHeading n={3}>{t('Execution mode')}</SectionHeading>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setExecutionMode('admin')}
              className={[
                'rounded-2xl border-2 p-5 text-start transition',
                executionMode === 'admin'
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-border bg-white hover:border-border-strong',
              ].join(' ')}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={[
                    'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                    executionMode === 'admin' ? 'border-brand-600' : 'border-border-strong',
                  ].join(' ')}
                >
                  {executionMode === 'admin' ? (
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
                      <i className="fa-solid fa-check mt-0.5 text-brand-600" aria-hidden />
                      <span>{t('Pick, pack (if required) and dispatch')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="fa-solid fa-check mt-0.5 text-brand-600" aria-hidden />
                      <span>{t('No tasks will be created.')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setExecutionMode('workers')}
              className={[
                'rounded-2xl border-2 p-5 text-start transition',
                executionMode === 'workers'
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-border bg-white hover:border-border-strong',
              ].join(' ')}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={[
                    'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                    executionMode === 'workers' ? 'border-brand-600' : 'border-border-strong',
                  ].join(' ')}
                >
                  {executionMode === 'workers' ? (
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
                      <i className="fa-solid fa-check mt-0.5 text-brand-600" aria-hidden />
                      <span>{t('Tasks will be created for workers')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="fa-solid fa-check mt-0.5 text-brand-600" aria-hidden />
                      <span>{t('You can monitor progress in real time.')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </button>
          </div>
        </PlanCard>

        {/* ─── 4. Lines ─── */}
        <PlanCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading n={4}>{t('Lines')}</SectionHeading>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addLine}
              disabled={!companyId || !canAddLine || saveMut.isPending}
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
                  <th className="min-w-[260px] px-3 py-3 font-medium">{t('Product')}</th>
                  <th className="w-36 px-3 py-3 font-medium">{t('SKU')}</th>
                  <th className="w-28 px-3 py-3 font-medium">{t('Available')}</th>
                  <th className="w-36 px-3 py-3 font-medium">{t('Expected qty')}</th>
                  <th className="w-28 px-3 py-3 font-medium">{t('Unit')}</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const p = productById.get(line.productId);
                  const avail = line.productId
                    ? availabilityByProduct.get(line.productId)
                    : undefined;
                  const summed = line.productId
                    ? requestedByProduct.get(line.productId) ?? 0
                    : 0;
                  const isShort = avail !== undefined && summed > avail;
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
                                    l.key === line.key ? { ...l, productId: id } : l,
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
                        <div
                          className={[
                            'flex h-11 items-center rounded-lg border border-border bg-surface-sunken/40 px-3 tabular-nums',
                            isShort ? 'text-status-error-fg' : 'text-text-body',
                          ].join(' ')}
                        >
                          {avail !== undefined
                            ? avail.toLocaleString(undefined, { maximumFractionDigits: 4 })
                            : line.productId
                              ? '…'
                              : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <TextField
                          type="number"
                          min={0}
                          step="1"
                          value={line.requestedQuantity}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, requestedQuantity: e.target.value }
                                  : l,
                              ),
                            )
                          }
                          error={isShort ? t('Exceeds available stock') : undefined}
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
                          disabled={lines.length <= 1 || saveMut.isPending}
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
              disabled={!companyId || !canAddLine || saveMut.isPending}
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

          {shortages.length > 0 ? (
            <Alert variant="error" title="Order cannot be saved — insufficient stock:">
              <ul className="mt-1 list-disc pl-4 text-xs">
                {shortages.map((s) => {
                  const p = productById.get(s.productId);
                  return (
                    <li key={s.productId}>
                      {p ? `${p.sku} — ${p.name}` : s.productId}: requested {s.requested}, available{' '}
                      {s.available}
                    </li>
                  );
                })}
              </ul>
            </Alert>
          ) : null}
        </PlanCard>

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
