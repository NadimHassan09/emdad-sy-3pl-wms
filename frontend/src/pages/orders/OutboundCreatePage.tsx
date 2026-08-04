import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Alert, Button, Textarea } from '@ds';

import { CompaniesApi } from '../../api/companies';
import { InventoryApi } from '../../api/inventory';
import { CreateOutboundOrderInput, OutboundApi } from '../../api/outbound';
import type { Product } from '../../api/products';
import { ProductsApi } from '../../api/products';
import { Combobox } from '../../components/Combobox';
import { DispatchDockPicker } from '../../components/locations/DispatchDockPicker';
import { PackingLocationPicker } from '../../components/locations/PackingLocationPicker';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import type { OrderExecutionMode, OutboundExecutionPlan } from '../../lib/execution-plan';
import { outboundAdminPlanReadinessIssues } from '../../lib/execution-plan';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../../lib/order-planning-dates';

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';
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
    'New outbound order': 'طلب صادر جديد',
    'Edit outbound plan': 'تعديل خطة الصادر',
    'Plan everything before execution.': 'خطّط كل شيء قبل التنفيذ.',
    'Create a warehouse shipment request': 'إنشاء طلب شحن صادر للمستودع',
    'Back to outbound orders': 'العودة إلى طلبات الصادر',
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
    'Packing location': 'موقع التغليف',
    'Dispatch dock': 'رصيف الإرسال',
    Warehouse: 'المستودع',
    'Where items are packed before shipping.': 'مكان تغليف المنتجات قبل الشحن.',
    'Where the shipment leaves the warehouse.': 'مكان مغادرة الشحنة للمستودع.',
    'Set a default warehouse first.': 'عيّن مستودعاً افتراضياً أولاً.',
    'Select a packing location.': 'اختر موقع التغليف.',
    'Select a dispatch dock.': 'اختر رصيف الإرسال.',
    'Execution mode': 'وضع التنفيذ',
    'Execute by Admin': 'تنفيذ بواسطة المسؤول',
    'I will do the warehouse work myself, then Confirm order.':
      'سأتولى عمل المستودع بنفسي، ثم أؤكّد الطلب.',
    'Pick, pack (if required) and dispatch': 'التقاط وتغليف (إن لزم) وإرسال',
    'Confirm once from the order page — no stage tabs.':
      'تأكيد واحد من صفحة الطلب — بدون تبويبات مراحل.',
    'Execute by Workers': 'تنفيذ بواسطة العمال',
    'Release to workers after the plan is ready. Workers execute Tasks.':
      'أطلق للعمال بعد جاهزية الخطة. العمال ينفّذون المهام.',
    'Tasks will be created for workers': 'ستُنشأ مهام للعمال',
    'You can monitor progress from the order page.': 'يمكنك متابعة التقدم من صفحة الطلب.',
    Products: 'المنتجات',
    '+ Add line': '+ إضافة بند',
    Product: 'المنتج',
    Quantity: 'الكمية',
    'Enter Qty': 'أدخل الكمية',
    'Select a product first': 'اختر منتجاً أولاً',
    'Search and select a product...': 'ابحث واختر منتجاً...',
    'Current quantity:': 'الكمية الحالية:',
    Available: 'المتاح',
    'Total items:': 'إجمالي القطع:',
    'Next steps': 'الخطوات التالية',
    'Click Save plan to create a draft. Print and Confirm (or Release) from the order page.':
      'اضغط حفظ الخطة لإنشاء مسودة. اطبع وأكّد (أو أطلِق) من صفحة الطلب.',
    'Pick a client.': 'اختر عميلاً.',
    'Enter a destination address.': 'أدخل عنوان الوجهة.',
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن المطلوب قبل اليوم.',
    'All products are already on this order.': 'كل المنتجات مضافة مسبقاً إلى هذا الطلب.',
    'Each product can only appear once on the order.': 'لا يمكن تكرار نفس المنتج أكثر من مرة في الطلب.',
    'Exceeds available stock': 'تتجاوز المخزون المتاح',
    Remove: 'إزالة',
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

function formatOnHand(n: number | undefined): string {
  if (n === undefined) return '…';
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
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
  const { warehouseId, warehouses } = useDefaultWarehouseId();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [packingLocationId, setPackingLocationId] = useState('');
  const [dispatchDockId, setDispatchDockId] = useState('');
  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId)
      ? selectedWarehouseId
      : warehouseId) || '';
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
    const plan = o.executionPlan;
    setCompanyId(o.companyId);
    setShipDate(o.requiredShipDate.slice(0, 10));
    setDestination(o.destinationAddress ?? '');
    setCarrier(o.carrier ?? '');
    setNotes(o.notes ?? '');
    setRequiresPacking(o.requiresPacking !== false);
    setExecutionMode(o.executionMode === 'workers' ? 'workers' : 'admin');
    if (plan?.warehouseId) setSelectedWarehouseId(plan.warehouseId);
    setPackingLocationId(plan?.packingLocationId ?? '');
    setDispatchDockId(plan?.dispatchDockId ?? '');
    setLines(
      (o.lines ?? []).map((l) => ({
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
      .map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
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

  const carrierOptions = useMemo(() => {
    if (carrier && !CARRIER_OPTIONS.some((c) => c.value === carrier)) {
      return [{ value: carrier, label: carrier }, ...CARRIER_OPTIONS];
    }
    return CARRIER_OPTIONS;
  }, [carrier]);

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

      if (executionMode === 'admin') {
        if (!effectiveWarehouseId.trim()) throw new Error(t('Set a default warehouse first.'));
        if (requiresPacking && !packingLocationId.trim()) {
          throw new Error(t('Select a packing location.'));
        }
        if (!dispatchDockId.trim()) throw new Error(t('Select a dispatch dock.'));
      }

      const executionPlan: OutboundExecutionPlan | undefined =
        executionMode === 'admin'
          ? {
              warehouseId: effectiveWarehouseId,
              requiresPacking,
              packingLocationId: requiresPacking ? packingLocationId.trim() : undefined,
              dispatchDockId: dispatchDockId.trim(),
              lines: validLines.map((l) => ({
                productId: l.productId,
                expectedQty: Number(l.requestedQuantity),
              })),
              planUpdatedAt: new Date().toISOString(),
            }
          : undefined;
      if (executionPlan) {
        const issues = outboundAdminPlanReadinessIssues(
          executionPlan,
          validLines.map((l) => ({
            productId: l.productId,
            requestedQuantity: l.requestedQuantity,
          })),
        );
        if (issues.length) throw new Error(issues[0]!);
      }

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

  const loading = saveMut.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter pb-10">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to="/orders/outbound"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to outbound orders')}
          </Link>
        </nav>
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">
            {isEdit ? t('Edit outbound plan') : t('New outbound order')}
          </h1>
          <p className="text-sm text-text-muted">
            {isEdit
              ? t('Plan everything before execution.')
              : t('Create a warehouse shipment request')}
          </p>
        </header>
      </div>

      <form id="outbound-plan-form" onSubmit={onSubmit} className="space-y-10">
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">
            {t('Execution mode')}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <ModeOption
              selected={executionMode === 'admin'}
              onSelect={() => setExecutionMode('admin')}
              icon="fa-user"
              title={t('Execute by Admin')}
              bullets={[
                t('I will do the warehouse work myself, then Confirm order.'),
                t('Pick, pack (if required) and dispatch'),
                t('Confirm once from the order page — no stage tabs.'),
              ]}
            />
            <ModeOption
              selected={executionMode === 'workers'}
              onSelect={() => setExecutionMode('workers')}
              icon="fa-users"
              title={t('Execute by Workers')}
              bullets={[
                t('Release to workers after the plan is ready. Workers execute Tasks.'),
                t('Tasks will be created for workers'),
                t('You can monitor progress from the order page.'),
              ]}
            />
          </div>
        </section>

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
              label={t('Required ship date')}
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
              dropdownInFlow
            />
            <TextField
              label={t('Destination address')}
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div>
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              rows={4}
              maxLength={NOTES_MAX}
              placeholder={t('Add any notes about this outbound order…')}
            />
            <p className="mt-1.5 text-end text-xs tabular-nums text-text-muted">
              {notes.length} / {NOTES_MAX}
            </p>
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

            {lines.map((line) => {
              const p = productById.get(line.productId);
              const avail = line.productId
                ? availabilityByProduct.get(line.productId)
                : undefined;
              const summed = line.productId
                ? requestedByProduct.get(line.productId) ?? 0
                : 0;
              const isShort = avail !== undefined && summed > avail;

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
                            l.key === line.key ? { ...l, productId: id } : l,
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
                        {t('Available')}:{' '}
                        <span
                          className={[
                            'font-mono font-semibold',
                            isShort ? 'text-status-error-fg' : 'text-text-strong',
                          ].join(' ')}
                        >
                          {formatOnHand(avail)}
                        </span>{' '}
                        <span className="uppercase text-text-body">{p.uom}</span>
                      </p>
                    ) : null}
                    {isShort ? (
                      <p className="mt-1 text-[11px] font-medium text-status-error-fg">
                        {t('Exceeds available stock')}
                      </p>
                    ) : null}
                  </div>
                  <TextField
                    type="number"
                    min={0}
                    step="1"
                    aria-label={t('Quantity')}
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
                    disabled={!line.productId}
                    placeholder={line.productId ? t('Enter Qty') : t('Select a product first')}
                  />
                  <button
                    type="button"
                    aria-label={t('Remove')}
                    disabled={lines.length <= 1 || loading}
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
                disabled={!companyId || !canAddLine || loading}
                onClick={() => {
                  if (!canAddLine) {
                    toast.error(t('All products are already on this order.'));
                    return;
                  }
                  setLines((prev) => [
                    ...prev,
                    { key: `n-${Date.now()}`, productId: '', requestedQuantity: '' },
                  ]);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="fa-solid fa-plus text-sm" aria-hidden />
              </button>
            </div>
          </div>

          <p className="text-sm text-text-muted">
            {t('Total items:')}{' '}
            <span className="font-semibold tabular-nums text-text-strong">
              {totalItems.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </p>

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
        </section>

        <section className="space-y-5">
          <SectionHeading title={t('Packing & dispatch')} />
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={requiresPacking}
              onChange={(e) => {
                setRequiresPacking(e.target.checked);
                if (!e.target.checked) setPackingLocationId('');
              }}
              className="mt-1 h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-semibold text-text-strong">
                {t('Packing required')}
              </span>
              <span className="mt-1 block text-sm text-text-muted">
                {t(
                  'When enabled, the workflow is: pick → pack → dispatch. When disabled, pick goes straight to the delivery area.',
                )}
              </span>
            </span>
          </label>

          {executionMode === 'admin' ? (
            <div className="space-y-5">
              {warehouses.length > 1 ? (
                <Combobox
                  label={t('Warehouse')}
                  required
                  value={effectiveWarehouseId}
                  onChange={(id) => {
                    setSelectedWarehouseId(id);
                    setPackingLocationId('');
                    setDispatchDockId('');
                  }}
                  options={warehouses
                    .filter((w) => w.status === 'active')
                    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
                  clearable={false}
                  dropdownInFlow
                />
              ) : null}

              {effectiveWarehouseId ? (
                <>
                  {requiresPacking ? (
                    <div className="space-y-2">
                      <PackingLocationPicker
                        warehouseId={effectiveWarehouseId}
                        value={packingLocationId}
                        onChange={setPackingLocationId}
                        label={t('Packing location')}
                        dropdownInFlow
                      />
                      <p className="text-sm text-text-muted">
                        {t('Where items are packed before shipping.')}
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <DispatchDockPicker
                      warehouseId={effectiveWarehouseId}
                      value={dispatchDockId}
                      onChange={setDispatchDockId}
                      label={t('Dispatch dock')}
                      dropdownInFlow
                    />
                    <p className="text-sm text-text-muted">
                      {t('Where the shipment leaves the warehouse.')}
                    </p>
                  </div>
                </>
              ) : (
                <Alert variant="warning" title={t('Set a default warehouse first.')} />
              )}
            </div>
          ) : null}
        </section>

        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text-strong">{t('Next steps')}: </span>
          {t(
            'Click Save plan to create a draft. Print and Confirm (or Release) from the order page.',
          )}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-6">
          <Button
            type="button"
            variant="danger"
            disabled={loading}
            onClick={() =>
              navigate(isEdit ? `/orders/outbound/${editId}` : '/orders/outbound')
            }
          >
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={shortages.length > 0}
          >
            {t('Save plan')}
          </Button>
        </div>
      </form>
    </div>
  );
}
