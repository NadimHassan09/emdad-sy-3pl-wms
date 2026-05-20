import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, Button, Textarea } from '@ds';

import { CompaniesApi } from '../api/companies';
import {
  CreateInboundOrderInput,
  InboundApi,
  InboundOrder,
} from '../api/inbound';
import { Product, ProductsApi } from '../api/products';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { OrderDraftLinesTable } from '../components/OrderDraftLinesTable';
import { FILTER_PRIMARY_BUTTON_CLASS, FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { inboundHasQuantityShortfall } from '../lib/inbound-shortfall';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';

type ListDraft = {
  orderSearch: string;
  companyId: string;
  createdFrom: string;
  createdTo: string;
};

function inboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Inbound orders': 'طلبات الوارد',
    '+ New inbound': '+ وارد جديد',
    'Search order...': 'ابحث عن الطلب...',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'Order filters': 'فلاتر الطلبات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Expected arrival': 'تاريخ الوصول المتوقع',
    Lines: 'البنود',
    Created: 'تاريخ الإنشاء',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
    'New inbound order': 'طلب وارد جديد',
    'Expected arrival date': 'تاريخ الوصول المتوقع',
    Notes: 'ملاحظات',
    Barcode: 'الباركود',
    'Scan or type…': 'امسح أو اكتب…',
    'Add by barcode': 'إضافة بالباركود',
    'Scan barcode': 'مسح الباركود',
    '+ Add line': '+ إضافة بند',
    'No lines yet — add a product below.': 'لا توجد بنود بعد — أضف منتجاً بالأسفل.',
    Remove: 'إزالة',
    Product: 'المنتج',
    'Pick product…': 'اختر المنتج…',
    Quantity: 'الكمية',
    Cancel: 'إلغاء',
    Back: 'رجوع',
    Create: 'إنشاء',
    'All clients': 'كل العملاء',
    'Expected arrival date cannot be before today.':
      'لا يمكن أن يكون تاريخ الوصول المتوقع قبل اليوم.',
  };
  return ar[label] ?? label;
}

export function InboundListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => inboundLabel(label, isArabic);
  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialList = useMemo<ListDraft>(
    () => ({
      orderSearch: '',
      companyId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialList);

  const listParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      companyId: appliedFilters.companyId || undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
      limit: 200,
    }),
    [appliedFilters, wid],
  );

  const list = useQuery({
    queryKey: [...QK.inboundOrders, listParams],
    queryFn: () => InboundApi.list(listParams),
    enabled: !!wid,
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('All clients')),
    [companies.data, isArabic],
  );

  const createMut = useMutation({
    mutationFn: InboundApi.create,
    onSuccess: (order) => {
      toast.success(`Inbound order ${order.orderNumber} created.`);
      qc.invalidateQueries({ queryKey: QK.inboundOrders });
      setOpen(false);
      navigate(`/orders/inbound/${order.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<InboundOrder>[] = useMemo(
    () => [
      {
        header: t('Order #'),
        accessor: (o) => <span className="font-mono">{o.orderNumber || '—'}</span>,
        width: '170px',
      },
      {
        header: t('Client'),
        accessor: (o) => o.company?.name ?? '—',
        width: '200px',
      },
      {
        header: t('Status'),
        accessor: (o) => (
          <div className="flex w-fit flex-col gap-0.5">
            <StatusBadge status={o.status} />
            {inboundHasQuantityShortfall(o) && (o.status === 'completed' || o.status === 'partially_received') ? (
              <span className="text-[10px] leading-tight text-amber-800">Missing quantities</span>
            ) : null}
          </div>
        ),
        className: 'w-1 whitespace-nowrap',
      },
      {
        header: t('Expected arrival'),
        accessor: (o) => new Date(o.expectedArrivalDate).toLocaleDateString(),
        width: '160px',
      },
      { header: t('Lines'), accessor: (o) => o._count?.lines ?? 0, width: '70px' },
      {
        header: t('Created'),
        accessor: (o) => new Date(o.createdAt).toLocaleString(),
      },
    ],
    [isArabic],
  );

  return (
    <>
      {!wid && (
        <Alert
          variant="warning"
          title="Warehouse not configured"
          description="The active warehouse could not be resolved. Contact your administrator."
          compact
          className="mb-4"
        />
      )}

      {list.isError && (
        <Alert
          variant="error"
          title="Could not load inbound orders"
          description="Check your connection and try refreshing the page."
          action={
            <Alert.Action variant="error" onClick={() => list.refetch()}>
              Retry
            </Alert.Action>
          }
          className="mb-4"
        />
      )}

      <FilterPanel
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={list.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <TextField
            label={t('Order #')}
            value={draftFilters.orderSearch}
            onChange={(e) => setDraft({ orderSearch: e.target.value })}
            placeholder={t('Search order...')}
            className="font-mono text-xs"
          />
          <Combobox
            label={t('Client')}
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={clientFilterOptions}
            placeholder={t('All clients')}
          />
          <TextField
            label={t('Created from')}
            type="date"
            value={draftFilters.createdFrom}
            onChange={(e) => setDraft({ createdFrom: e.target.value })}
          />
          <TextField
            label={t('Created to')}
            type="date"
            value={draftFilters.createdTo}
            onChange={(e) => setDraft({ createdTo: e.target.value })}
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Inbound orders')}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setOpen(true)}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('+ New inbound')}
          </Button>
        }
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(o) => o.id}
        loading={list.isLoading || !wid}
        onRowClick={(o) => navigate(`/orders/inbound/${o.id}`)}
        empty={wid ? 'No inbound orders match the filters.' : 'Warehouse not resolved yet.'}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />

      <CreateInboundModal
        open={open}
        onClose={() => setOpen(false)}
        loading={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
        isArabic={isArabic}
      />
    </>
  );
}

interface DraftLine {
  productId: string;
  expectedQuantity: string;
}

function formatProductOnHand(p: Product): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : String(p.totalOnHand ?? '0');
}

interface CreateInboundModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (input: CreateInboundOrderInput) => void;
  isArabic: boolean;
}

function CreateInboundModal({ open, onClose, loading, onSubmit, isArabic }: CreateInboundModalProps) {
  const toast = useToast();
  const t = (label: string) => inboundLabel(label, isArabic);
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [arrival, setArrival] = useState(() => localCalendarDateYmd());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', expectedQuantity: '' }]);
  const [scanOpen, setScanOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: open,
  });

  const products = useQuery({
    queryKey: [...QK.products, companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 200 }),
    enabled: open && !!companyId,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (open && !companyId && companies.data?.length) {
      const fallback =
        companies.data.find((c) => c.id === DEFAULT_COMPANY_ID) ?? companies.data[0];
      setCompanyId(fallback.id);
    }
  }, [open, companyId, companies.data]);

  useEffect(() => {
    setLines((prev) => prev.map((l) => ({ ...l, productId: '' })));
  }, [companyId]);

  const productOptions = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
        hint: `On hand ${formatProductOnHand(p)} ${p.uom}`,
      })),
    [products.data],
  );

  const productsById = useMemo(() => {
    const m = new Map<string, Product>();
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

  const reset = () => {
    setCompanyId(DEFAULT_COMPANY_ID);
    setArrival(localCalendarDateYmd());
    setNotes('');
    setLines([{ productId: '', expectedQuantity: '' }]);
    setScanOpen(false);
    setStep(1);
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const applyProductByBarcode = async (raw: string) => {
    const code = raw.trim();
    if (!companyId) {
      toast.error('Pick a client first.');
      return;
    }
    if (!code) {
      toast.error('Scan a barcode.');
      return;
    }
    try {
      const { items } = await ProductsApi.list({
        companyId,
        productBarcode: code,
        limit: 50,
      });
      const norm = code.toLowerCase();
      const exact = items.filter((p) => (p.barcode ?? '').trim().toLowerCase() === norm);
      const product = exact.length === 1 ? exact[0]! : items.length === 1 ? items[0]! : null;
      if (!product) {
        toast.error(
          exact.length > 1
            ? 'Multiple products share this barcode fragment — type a longer code or pick from the list.'
            : 'No product found for this barcode.',
        );
        return;
      }
      setLines((prev) => {
        const emptyIdx = prev.findIndex((l) => !l.productId);
        if (emptyIdx >= 0) {
          return prev.map((l, i) => (i === emptyIdx ? { ...l, productId: product.id } : l));
        }
        return [...prev, { productId: product.id, expectedQuantity: '' }];
      });
      toast.success(`${product.sku} added from barcode.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed.');
    }
  };

  const goToLinesStep = () => {
    if (!companyId.trim()) {
      toast.error(isArabic ? 'اختر عميلاً.' : 'Pick a client.');
      return;
    }
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      toast.error(t('Expected arrival date cannot be before today.'));
      return;
    }
    setStep(2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step !== 2) return;
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      toast.error(t('Expected arrival date cannot be before today.'));
      return;
    }
    onSubmit({
      companyId,
      expectedArrivalDate: arrival,
      notes: notes || undefined,
      lines: lines
        .filter((l) => l.productId && l.expectedQuantity)
        .map((l) => ({
          productId: l.productId,
          expectedQuantity: Number(l.expectedQuantity),
        })),
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
              onClick={goToLinesStep}
            >
              {t('Next')}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
              disabled={loading}
            >
              {t('Back')}
            </Button>
            <Button
              form="create-inbound"
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {t('Create')}
            </Button>
          </>
        )
      }
    >
      {/* No overflow/max-height here — the Modal's body div is the sole scroll zone. */}
      <form id="create-inbound" onSubmit={submit} className="space-y-4">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Combobox
                label={t('Client')}
                required
                value={companyId}
                onChange={setCompanyId}
                clearable={false}
                dropdownInFlow
                options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                placeholder={isArabic ? 'اختر عميلاً…' : 'Pick a client…'}
              />
              <TextField
                label={t('Expected arrival date')}
                type="date"
                required
                min={localCalendarDateYmd()}
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              />
            </div>
            <Textarea
              label={t('Notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        ) : (
          <OrderDraftLinesTable
            title={t('Lines')}
            productHeader={t('Product')}
            lines={tableLines}
            productOptions={productOptions}
            productsById={productsById}
            companyId={companyId}
            companyDisabledMessage={isArabic ? 'اختر عميلاً أولاً' : 'Pick a client first'}
            pickProductPlaceholder={t('Pick product…')}
            quantityHeader={t('Quantity')}
            emptyMessage={t('No lines yet — add a product below.')}
            removeLabel={t('Remove')}
            loading={loading}
            formatOnHand={formatProductOnHand}
            onHandLabel={isArabic ? 'الكمية الحالية:' : 'Current quantity:'}
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
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!companyId || loading}
                  onClick={() => setScanOpen(true)}
                  aria-label={t('Scan barcode')}
                  title={t('Scan barcode')}
                  className="px-2.5"
                >
                  <BarcodeScanIcon className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setLines((prev) => [...prev, { productId: '', expectedQuantity: '' }])}
                >
                  {t('+ Add line')}
                </Button>
              </>
            }
          />
        )}
      </form>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          void applyProductByBarcode(text);
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </Modal>
  );
}
