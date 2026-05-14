import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi } from '../api/inventory';
import { CreateOutboundOrderInput, OutboundApi, OutboundOrder } from '../api/outbound';
import type { Product } from '../api/products';
import { ProductsApi } from '../api/products';
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

const DEFAULT_COMPANY_ID = (import.meta.env.VITE_MOCK_COMPANY_ID as string | undefined) ?? '';

function formatProductOnHand(p: Product): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : String(p.totalOnHand ?? '0');
}

type OutListDraft = {
  orderSearch: string;
  companyId: string;
  createdFrom: string;
  createdTo: string;
};

function outboundLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Outbound orders': 'طلبات الصادر',
    '+ New outbound': '+ صادر جديد',
    'Order id / number': 'معرف / رقم الطلب',
    'UUID or contains order #': 'UUID أو يحتوي على رقم الطلب #',
    Client: 'العميل',
    'Created from': 'تاريخ الإنشاء من',
    'Created to': 'تاريخ الإنشاء إلى',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'Order #': 'رقم الطلب #',
    Status: 'الحالة',
    'Required ship': 'الشحن المطلوب',
    Lines: 'البنود',
    Destination: 'الوجهة',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
    'New outbound order': 'طلب صادر جديد',
    Cancel: 'إلغاء',
    Create: 'إنشاء',
    'All clients': 'كل العملاء',
  };
  return ar[label] ?? label;
}

export function OutboundListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (label: string) => outboundLabel(label, isArabic);
  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialList = useMemo<OutListDraft>(
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
    queryKey: [...QK.outboundOrders, listParams],
    queryFn: () => OutboundApi.list(listParams),
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
    mutationFn: OutboundApi.create,
    onSuccess: (order) => {
      toast.success(`Outbound order ${order.orderNumber} created.`);
      qc.invalidateQueries({ queryKey: QK.outboundOrders });
      setOpen(false);
      navigate(`/orders/outbound/${order.id}`);
    },
    onError: (err: Error & { code?: string }) => {
      toast.error(err.message);
    },
  });

  const columns: Column<OutboundOrder>[] = useMemo(
    () => [
      {
        header: t('Order #'),
        accessor: (o) => <span className="font-mono">{o.orderNumber || '—'}</span>,
        width: '170px',
      },
      { header: t('Client'), accessor: (o) => o.company?.name ?? '—', width: '200px' },
      { header: t('Status'), accessor: (o) => <StatusBadge status={o.status} />, width: '160px' },
      {
        header: t('Required ship'),
        accessor: (o) => new Date(o.requiredShipDate).toLocaleDateString(),
        width: '140px',
      },
      { header: t('Lines'), accessor: (o) => o._count?.lines ?? 0, width: '70px' },
      { header: t('Destination'), accessor: (o) => o.destinationAddress },
    ],
    [isArabic],
  );

  return (
    <>
      <PageHeader
        title={t('Outbound orders')}
        actions={
          <Button
            onClick={() => setOpen(true)}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            {t('+ New outbound')}
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
      <FilterActions
        onApply={applyFilters}
        onReset={resetFilters}
        loading={list.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      />
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(o) => o.id}
        loading={list.isLoading || !wid}
        onRowClick={(o) => navigate(`/orders/outbound/${o.id}`)}
        empty={wid ? 'No outbound orders match the filters.' : 'Warehouse not resolved yet.'}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />

      <CreateOutboundModal
        open={open}
        onClose={() => setOpen(false)}
        loading={createMut.isPending}
        onSubmit={(input) => createMut.mutate(input)}
      />
    </>
  );
}

interface DraftLine {
  productId: string;
  requestedQuantity: string;
}

interface CreateOutboundModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (input: CreateOutboundOrderInput) => void;
}

function CreateOutboundModal({ open, onClose, loading, onSubmit }: CreateOutboundModalProps) {
  const toast = useToast();
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [shipDate, setShipDate] = useState(() =>
    new Date(Date.now() + 86400_000).toISOString().slice(0, 10),
  );
  const [destination, setDestination] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', requestedQuantity: '' }]);
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
        hint: `${p.uom} · on hand ${formatProductOnHand(p)}`,
      })),
    [products.data],
  );

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: QK.availability(pid, companyId),
      queryFn: () => InventoryApi.availability(pid, companyId),
      enabled: open && !!pid && !!companyId,
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

  const reset = () => {
    setCompanyId(DEFAULT_COMPANY_ID);
    setShipDate(new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
    setDestination('');
    setCarrier('');
    setNotes('');
    setLines([{ productId: '', requestedQuantity: '' }]);
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
        return [...prev, { productId: product.id, requestedQuantity: '' }];
      });
      setBarcodeInput('');
      toast.success(`${product.sku} added from barcode.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed.');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      companyId,
      destinationAddress: destination,
      requiredShipDate: shipDate,
      carrier: carrier || undefined,
      notes: notes || undefined,
      lines: lines
        .filter((l) => l.productId && l.requestedQuantity)
        .map((l) => ({ productId: l.productId, requestedQuantity: Number(l.requestedQuantity) })),
    });
  };

  const submitDisabled = shortages.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New outbound order"
      widthClass="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            form="create-outbound"
            type="submit"
            loading={loading}
            disabled={submitDisabled}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            Create
          </Button>
        </>
      }
    >
      <form
        id="create-outbound"
        onSubmit={submit}
        className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Combobox
            label="Client"
            required
            value={companyId}
            onChange={setCompanyId}
            dropdownInFlow
            options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Pick a client…"
          />
          <TextField
            label="Required ship date"
            type="date"
            required
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <TextField
          label="Destination address"
          required
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Lines</span>
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="Barcode"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan or type…"
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
                Add by barcode
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!companyId || loading}
                onClick={() => setScanOpen(true)}
              >
                Scan barcode
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLines((prev) => [...prev, { productId: '', requestedQuantity: '' }])}
              >
                + Add line
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {lines.map((l, idx) => {
              const avail = l.productId ? availabilityByProduct.get(l.productId) : undefined;
              const summed = l.productId ? requestedByProduct.get(l.productId) ?? 0 : 0;
              const isShort = avail !== undefined && summed > avail;
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                  <div className="col-span-7">
                    <Combobox
                      label={idx === 0 ? 'Product' : ''}
                      value={l.productId}
                      onChange={(v) => updateLine(idx, { productId: v })}
                      options={productOptions}
                      placeholder={!companyId ? 'Pick a client first' : 'Pick product…'}
                      disabled={!companyId}
                    />
                    {l.productId && avail !== undefined && (
                      <div
                        className={`mt-1 text-xs ${isShort ? 'text-rose-600' : 'text-emerald-700'}`}
                      >
                        Available: {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {summed > 0 && (
                          <>
                            {' '}
                            • Requested across lines:{' '}
                            {summed.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-4">
                    <TextField
                      label={idx === 0 ? 'Quantity' : ''}
                      type="number"
                      min={0}
                      step="0.0001"
                      required
                      value={l.requestedQuantity}
                      onChange={(e) => updateLine(idx, { requestedQuantity: e.target.value })}
                      error={isShort ? 'Exceeds available stock' : undefined}
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
          {shortages.length > 0 && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <strong className="block">Order cannot be created — insufficient stock:</strong>
              <ul className="mt-1 list-disc pl-4">
                {shortages.map((s) => {
                  const p = products.data?.items.find((x) => x.id === s.productId);
                  return (
                    <li key={s.productId}>
                      {p ? `${p.sku} — ${p.name}` : s.productId}: requested {s.requested}, available{' '}
                      {s.available}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <BarcodeScanModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onScan={(text) => {
            void applyProductByBarcode(text);
            setScanOpen(false);
          }}
        />
      </form>
    </Modal>
  );
}
