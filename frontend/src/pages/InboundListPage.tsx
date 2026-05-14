import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import {
  CreateInboundOrderInput,
  InboundApi,
  InboundOrder,
} from '../api/inbound';
import { Product, ProductsApi } from '../api/products';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterActions } from '../components/FilterActions';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
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
    'Order id / number': 'معرف / رقم الطلب',
    'UUID or contains order #': 'UUID أو يحتوي على رقم الطلب #',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
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
    Product: 'المنتج',
    'Pick product…': 'اختر المنتج…',
    Quantity: 'الكمية',
    Cancel: 'إلغاء',
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
          <div className="flex flex-col gap-0.5">
            <StatusBadge status={o.status} />
            {inboundHasQuantityShortfall(o) && (o.status === 'completed' || o.status === 'partially_received') ? (
              <span className="text-[10px] leading-tight text-amber-800">Missing quantities</span>
            ) : null}
          </div>
        ),
        width: '160px',
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
      <PageHeader
        title={t('Inbound orders')}
        actions={
          <Button
            onClick={() => setOpen(true)}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            {t('+ New inbound')}
          </Button>
        }
      />

      {!wid ? (
        <p className="mb-3 text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <FilterPanel showLabel={t('Show filters')} hideLabel={t('Hide filters')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <TextField
            label={t('Order id / number')}
            value={draftFilters.orderSearch}
            onChange={(e) => setDraft({ orderSearch: e.target.value })}
            placeholder={t('UUID or contains order #')}
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
        <FilterActions onApply={applyFilters} onReset={resetFilters} loading={list.isFetching} applyLabel={t('Apply filters')} resetLabel={t('Reset filters')} />
      </FilterPanel>

      <DataTable
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
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

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

  const reset = () => {
    setCompanyId(DEFAULT_COMPANY_ID);
    setArrival(localCalendarDateYmd());
    setNotes('');
    setLines([{ productId: '', expectedQuantity: '' }]);
    setBarcodeInput('');
    setScanOpen(false);
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
      toast.error('Enter or scan a barcode.');
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
      setBarcodeInput('');
      toast.success(`${product.sku} added from barcode.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed.');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
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
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button
            form="create-inbound"
            type="submit"
            loading={loading}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            {t('Create')}
          </Button>
        </>
      }
    >
      <form id="create-inbound" onSubmit={submit} className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Combobox
            label={t('Client')}
            required
            value={companyId}
            onChange={setCompanyId}
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
        <TextField label={t('Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">{t('Lines')}</span>
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label={t('Barcode')}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder={t('Scan or type…')}
                className="min-w-[160px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void applyProductByBarcode(barcodeInput);
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!companyId || loading}
                onClick={() => void applyProductByBarcode(barcodeInput)}
              >
                {t('Add by barcode')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!companyId || loading}
                onClick={() => setScanOpen(true)}
              >
                {t('Scan barcode')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLines((prev) => [...prev, { productId: '', expectedQuantity: '' }])}
              >
                {t('+ Add line')}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {lines.map((l, idx) => {
              const selectedProduct = (products.data?.items ?? []).find((p) => p.id === l.productId);
              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <div className="col-span-8">
                    <Combobox
                      label={idx === 0 ? t('Product') : ''}
                      value={l.productId}
                      onChange={(v) => updateLine(idx, { productId: v })}
                      options={productOptions}
                      placeholder={!companyId ? (isArabic ? 'اختر عميلاً أولاً' : 'Pick a client first') : t('Pick product…')}
                      disabled={!companyId}
                    />
                    {selectedProduct ? (
                      <p className="mt-1 text-[11px] text-slate-600">
                        Current quantity:{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {formatProductOnHand(selectedProduct)}
                        </span>{' '}
                        <span className="uppercase text-slate-700">{selectedProduct.uom}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="col-span-3">
                    <TextField
                      label={idx === 0 ? t('Quantity') : ''}
                      type="number"
                      min={0}
                      step="0.0001"
                      required
                      value={l.expectedQuantity}
                      onChange={(e) => updateLine(idx, { expectedQuantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        title="Remove line"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
