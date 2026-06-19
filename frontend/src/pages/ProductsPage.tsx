import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import {
  CreateProductInput,
  Product,
  ProductUom,
  ProductsApi,
  UpdateProductInput,
} from '../api/products';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { BarcodeImageModal } from '../components/BarcodeImageModal';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';
import { generateSku } from '../lib/identifiers';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';
import { productStatusLabel, productUomLabel, PRODUCT_UOM_MESSAGES } from '../lib/ui-labels/products';
import { useWmsTranslation } from '../lib/ui-i18n';

const UOM_VALUES = Object.keys(PRODUCT_UOM_MESSAGES) as ProductUom[];

function parseOptionalCreateDim(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Empty input clears the dimension in the database. */
function parseDimUpdate(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type ProductSearchCategory = 'name' | 'sku' | 'barcode';

type ProductDraftFilters = {
  companyId: string;
  searchCategory: ProductSearchCategory;
  searchQuery: string;
};

function isProductsPageOneChunkKey(key: readonly unknown[]): boolean {
  const last = key[key.length - 1] as { offset?: number } | undefined;
  return key[1] === 'list' && (last?.offset ?? 0) === 0;
}

function prependProductAcrossCaches(qc: ReturnType<typeof useQueryClient>, created: Product) {
  const queries = qc.getQueryCache().findAll({ queryKey: QK.products, exact: false });
  for (const q of queries) {
    if (!isProductsPageOneChunkKey(q.queryKey)) continue;
    qc.setQueryData<{ items?: Product[]; total: number }>(q.queryKey, (prev) => {
      if (!prev?.items) return prev;
      return { ...prev, items: [created, ...prev.items], total: prev.total + 1 };
    });
  }
}

function upsertProductAcrossCaches(qc: ReturnType<typeof useQueryClient>, updated: Product) {
  const queries = qc.getQueryCache().findAll({ queryKey: QK.products, exact: false });
  for (const q of queries) {
    if (!isProductsPageOneChunkKey(q.queryKey)) continue;
    qc.setQueryData<{ items?: Product[] }>(q.queryKey, (prev) => {
      if (!prev?.items) return prev;
      return {
        ...prev,
        items: prev.items.map((p) => (p.id === updated.id ? { ...updated, company: updated.company ?? p.company } : p)),
      };
    });
  }
}
export function ProductsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useWmsTranslation();
  const initialProductFilters = useMemo<ProductDraftFilters>(
    () => ({
      companyId: '',
      searchCategory: 'name',
      searchQuery: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
    useFilters(initialProductFilters);

  const [openCreate, setOpenCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [barcodePreview, setBarcodePreview] = useState<{ value: string; name: string } | null>(null);
  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-product-action-trigger="true"]') ||
        target.closest('[data-product-action-menu="true"]') ||
        target.closest('[data-product-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const [scanOpen, setScanOpen] = useState(false);

  const filters = useMemo(() => {
    const base = {
      companyId: appliedFilters.companyId.trim() || undefined,
    };
    const q = appliedFilters.searchQuery.trim();
    if (!q) return base;
    switch (appliedFilters.searchCategory) {
      case 'name':
        return { ...base, productName: q };
      case 'sku':
        return { ...base, sku: q };
      case 'barcode':
        return { ...base, productBarcode: q };
      default:
        return base;
    }
  }, [appliedFilters]);

  const pagination = useChunkedServerPagination<Product>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: filters,
    fetchChunk: (offset, limit) => ProductsApi.list({ ...filters, offset, limit }),
    rtQueryKeyPrefix: QK.products,
    chunkQueryKeyPrefix: 'products-chunk',
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: ProductsApi.create,
    onSuccess: (created) => {
      toast.success(t(['Product created.', 'تم إنشاء المنتج.']));
      prependProductAcrossCaches(qc, created);
      setOpenCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      ProductsApi.update(id, input),
    onSuccess: (updated) => {
      toast.success(t(['Product saved.', 'تم حفظ المنتج.']));
      upsertProductAcrossCaches(qc, updated);
      setEditProduct(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invalidateProducts = () => {
    qc.invalidateQueries({ queryKey: QK.products });
  };

  const suspendMut = useMutation({
    mutationFn: (id: string) => ProductsApi.suspend(id),
    onSuccess: (updated) => {
      toast.success(
        t([
          'Product suspended — it cannot be added to new inbound/outbound lines.',
          'تم إيقاف المنتج — لا يمكن إضافته إلى بنود وارد/صادر جديدة.',
        ]),
      );
      upsertProductAcrossCaches(qc, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unsuspendMut = useMutation({
    mutationFn: (id: string) => ProductsApi.unsuspend(id),
    onSuccess: (updated) => {
      toast.success(t(['Product reactivated.', 'تم إعادة تفعيل المنتج.']));
      upsertProductAcrossCaches(qc, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hardDeleteMut = useMutation({
    mutationFn: (id: string) => ProductsApi.hardDelete(id),
    onSuccess: (_, id) => {
      toast.success(t(['Product deleted.', 'تم حذف المنتج.']));
      invalidateProducts();
      setEditProduct((prev) => (prev?.id === id ? null : prev));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => ProductsApi.archive(id),
    onSuccess: (updated) => {
      toast.success(
        t([
          'Product archived — it is hidden from the catalog but history is kept.',
          'تم أرشفة المنتج — يُخفى من قائمة المنتجات مع الاحتفاظ بالسجل.',
        ]),
      );
      invalidateProducts();
      setEditProduct((prev) => (prev?.id === updated.id ? null : prev));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<Product>[] = useMemo(
    () => [
    { header: t(['Product Name', 'اسم المنتج']), accessor: (p) => p.name },
    {
      header: t(['Client Name', 'اسم العميل']),
      accessor: (p) => p.company?.name ?? '—',
      width: '200px',
    },
    {
      header: 'SKU',
      accessor: (p) => <span className="font-mono">{p.sku}</span>,
      width: '200px',
    },
    {
      header: 'Barcode',
      accessor: (p) =>
        p.barcode ? (
          <button
            type="button"
            className="font-mono text-left text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-900"
            onClick={(e) => {
              e.stopPropagation();
              setBarcodePreview({ value: p.barcode!, name: p.name });
            }}
          >
            {p.barcode}
          </button>
        ) : (
          <span className="font-mono text-slate-400">—</span>
        ),
      width: '220px',
    },
    {
      header: 'UOM',
      accessor: (p) => <span className="text-slate-800">{productUomLabel(p.uom, t)}</span>,
      width: '110px',
    },
    {
      header: t(['Status', 'الحالة']),
      accessor: (p) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            p.status === 'active'
              ? 'bg-emerald-50 text-emerald-700'
              : p.status === 'suspended'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {productStatusLabel(p.status, t)}
        </span>
      ),
      width: '110px',
    },
    {
      header: t(['Actions', 'إجراءات']),
      accessor: (p) => {
        if (p.status === 'archived') {
          return <span className="text-xs text-slate-400">—</span>;
        }
        const canEdit = p.status === 'active' || p.status === 'suspended';
        const busy =
          suspendMut.isPending ||
          unsuspendMut.isPending ||
          hardDeleteMut.isPending ||
          archiveMut.isPending ||
          updateMut.isPending;
        return (
          <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
            <AnchoredDropdown
              open={openActionId === p.id}
              align="end"
              menuRootProps={{ 'data-product-action-menu': 'true' }}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                  disabled={busy}
                  data-product-action-trigger="true"
                  onClick={() => setOpenActionId((cur) => (cur === p.id ? null : p.id))}
                  aria-label={t(['Open actions', 'فتح الإجراءات'])}
                  aria-expanded={openActionId === p.id}
                  aria-haspopup="menu"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                  </svg>
                </button>
              }
            >
              {canEdit ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  data-product-action-menu-button="true"
                  onClick={() => {
                    setOpenActionId(null);
                    setEditProduct(p);
                  }}
                >
                  {t(['Edit', 'تعديل'])}
                </button>
              ) : null}
              {p.status === 'active' ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  data-product-action-menu-button="true"
                  onClick={() => {
                    if (
                      window.confirm(
                        t([
                          `Suspend ${p.sku}? It will be blocked from new inbound/outbound lines.`,
                          `إيقاف ${p.sku}؟ لن يُسمح بإضافته إلى بنود وارد/صادر جديدة.`,
                        ]),
                      )
                    ) {
                      suspendMut.mutate(p.id);
                    }
                  }}
                >
                  {t(['Suspend', 'إيقاف'])}
                </button>
              ) : null}
              {p.status === 'suspended' ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  data-product-action-menu-button="true"
                  onClick={() => unsuspendMut.mutate(p.id)}
                >
                  {t(['Unsuspend', 'إلغاء الإيقاف'])}
                </button>
              ) : null}
              {p.deletable ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                  data-product-action-menu-button="true"
                  onClick={() => {
                    if (
                      window.confirm(
                        t([
                          `Permanently delete ${p.sku}? This cannot be undone. Only available for products with zero stock and no order or inventory history.`,
                          `حذف ${p.sku} نهائياً؟ لا يمكن التراجع. متاح فقط للمنتجات بلا مخزون ولا سجل طلبات أو مخزون.`,
                        ]),
                      )
                    ) {
                      hardDeleteMut.mutate(p.id);
                    }
                  }}
                >
                  {t(['Delete', 'حذف'])}
                </button>
              ) : null}
              {p.archivable && !p.deletable ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                  data-product-action-menu-button="true"
                  onClick={() => {
                    if (
                      window.confirm(
                        t([
                          `Archive ${p.sku}? It will be hidden from the catalog. Order and inventory history are kept.`,
                          `أرشفة ${p.sku}؟ سيُخفى من قائمة المنتجات مع الاحتفاظ بسجل الطلبات والمخزون.`,
                        ]),
                      )
                    ) {
                      archiveMut.mutate(p.id);
                    }
                  }}
                >
                  {t(['Archive', 'أرشفة'])}
                </button>
              ) : null}
            </AnchoredDropdown>
          </div>
        );
      },
      width: '140px',
    },
  ],
    [t, openActionId, suspendMut.isPending, unsuspendMut.isPending, hardDeleteMut.isPending, archiveMut.isPending, updateMut.isPending],
  );

  const searchByOptions = useMemo(
    () => [
      { value: 'name' as const, label: t(['Product name', 'اسم المنتج']) },
      { value: 'sku' as const, label: 'SKU' },
      { value: 'barcode' as const, label: 'Barcode' },
    ],
    [t],
  );

  const clientFilterOptions = useMemo(
    () => [
      { value: '', label: t(['All clients', 'كل العملاء']) },
      ...(companies.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.contactEmail,
      })),
    ],
    [companies.data, t],
  );

  return (
    <>
      <FilterPanel
        title={t(['Product filters', 'فلاتر المنتجات'])}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق الفلاتر'])}
        resetLabel={t(['Reset', 'إعادة تعيين'])}
      >
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <TextField
          label={t(['Search', 'بحث'])}
          value={draftFilters.searchQuery}
          onChange={(e) => setDraft({ searchQuery: e.target.value })}
          placeholder={t(['Contains…', 'يحتوي…'])}
          className={`min-w-[12.5rem] flex-1 basis-32 ${draftFilters.searchCategory !== 'name' ? 'font-mono' : ''}`}
        />
        <SelectField
          label={t(['Search by', 'البحث حسب'])}
          name="productSearchCategory"
          value={draftFilters.searchCategory}
          onChange={(e) =>
            setDraft({ searchCategory: e.target.value as ProductSearchCategory })
          }
          options={searchByOptions}
          className="min-w-[8.75rem] max-w-[11rem] shrink-0"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-[34px] shrink-0 px-2.5"
          title={t(['Scan a barcode with the device camera', 'مسح Barcode بالكاميرا'])}
          aria-label={t(['Scan barcode', 'مسح Barcode'])}
          onClick={() => setScanOpen(true)}
        >
          <BarcodeScanIcon className="h-5 w-5" />
        </Button>
        <Combobox
          label={t(['Client', 'العميل'])}
          value={draftFilters.companyId}
          onChange={(v) => setDraft({ companyId: v })}
          options={clientFilterOptions}
          placeholder={t(['All clients', 'كل العملاء'])}
          className="min-w-[220px] max-w-xs shrink-0"
        />
      </div>
      </FilterPanel>

      <DataTable
        title={t(['Products', 'المنتجات'])}
        actions={
          <Button variant="brand" onClick={() => setOpenCreate(true)}>
            {t(['+ New product', '+ منتج جديد'])}
          </Button>
        }
        columns={columns}
        rows={pagination.rows}
        rowKey={(p) => p.id}
        loading={pagination.isInitialLoading}
        empty={t(['No products match the filters.', 'لا توجد منتجات مطابقة للفلاتر.'])}
        onRowClick={(p) => navigate(`/products/${encodeURIComponent(p.id)}`)}
        serverPagination={pagination.serverPagination}
      />

      <CreateProductModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        loading={createMut.isPending}
        defaultCompanyId={draftFilters.companyId}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditProductModal
        open={!!editProduct}
        product={editProduct}
        loading={updateMut.isPending}
        onClose={() => setEditProduct(null)}
        onSubmit={(input) =>
          editProduct && updateMut.mutate({ id: editProduct.id, input })
        }
      />

      <BarcodeImageModal
        open={!!barcodePreview}
        onClose={() => setBarcodePreview(null)}
        value={barcodePreview?.value ?? ''}
        productName={barcodePreview?.name ?? ''}
      />

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          applyPatch({ searchCategory: 'barcode', searchQuery: text.trim() });
          toast.success(
            t(['Barcode scanned — search updated.', 'تم مسح Barcode — تم تحديث البحث.']),
          );
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </>
  );
}

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  /** When empty, first company in the directory is pre-selected after open. */
  defaultCompanyId?: string;
  onSubmit: (input: CreateProductInput) => void;
}

function CreateProductModal({
  open,
  onClose,
  loading,
  defaultCompanyId,
  onSubmit,
}: CreateProductModalProps) {
  const { t } = useWmsTranslation();
  const uomOptions = useMemo(
    () => UOM_VALUES.map((value) => ({ value, label: productUomLabel(value, t) })),
    [t],
  );
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [uom, setUom] = useState('piece');
  const [minStock, setMinStock] = useState('0');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [expiryTracking, setExpiryTracking] = useState(true);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (!companyId && companies.data?.length) {
      const fallback = defaultCompanyId
        ? companies.data.find((c) => c.id === defaultCompanyId) ?? companies.data[0]
        : companies.data[0];
      setCompanyId(fallback.id);
    }
  }, [open, companyId, companies.data, defaultCompanyId]);

  const reset = () => {
    setCompanyId(defaultCompanyId ?? '');
    setName('');
    setSku('');
    setBarcode('');
    setDescription('');
    setUom('piece');
    setMinStock('0');
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setWeightKg('');
    setExpiryTracking(true);
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: CreateProductInput = {
      companyId,
      name,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      uom: uom as CreateProductInput['uom'],
      expiryTracking,
      minStockThreshold:
        minStock.trim() === '' ? undefined : Math.max(0, parseInt(minStock, 10) || 0),
    };
    const l = parseOptionalCreateDim(lengthCm);
    const w = parseOptionalCreateDim(widthCm);
    const h = parseOptionalCreateDim(heightCm);
    const wt = parseOptionalCreateDim(weightKg);
    if (l !== undefined) input.lengthCm = l;
    if (w !== undefined) input.widthCm = w;
    if (h !== undefined) input.heightCm = h;
    if (wt !== undefined) input.weightKg = wt;
    onSubmit(input);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t(['New product', 'منتج جديد'])}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button
            variant="danger"
            className={MODAL_CANCEL_BUTTON_CLASS}
            onClick={handleClose}
            type="button"
            disabled={loading}
          >
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button
            form="create-product"
            type="submit"
            variant="brand"
            loading={loading}
          >
            {t(['Create', 'إنشاء'])}
          </Button>
        </>
      }
    >
      <form id="create-product" onSubmit={submit} className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
        <Combobox
          label={t(['Client', 'العميل'])}
          required
          value={companyId}
          onChange={setCompanyId}
          options={(companies.data ?? []).map((c) => ({
            value: c.id,
            label: c.name,
            hint: c.contactEmail,
          }))}
          placeholder={t(['Pick a client…', 'اختر عميلاً…'])}
        />
        <TextField
          label={t(['Name', 'الاسم'])}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField
            label={t(['SKU (optional)', 'SKU (اختياري)'])}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSku(generateSku())}
          >
            {t(['Generate SKU', 'إنشاء SKU'])}
          </Button>
        </div>
        <TextField
          label={t(['Barcode (optional)', 'Barcode (اختياري)'])}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          hint={t(['Leave blank to auto-generate.', 'اتركه فارغاً للإنشاء التلقائي.'])}
          className="font-mono"
        />
        <TextField
          label={t(['Description (optional)', 'الوصف (اختياري)'])}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField
          label="UOM"
          value={uom}
          onChange={(e) => setUom(e.target.value)}
          options={uomOptions}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={expiryTracking}
            onChange={(e) => setExpiryTracking(e.target.checked)}
          />
          {t(['Product has an expiry date', 'المنتج له تاريخ انتهاء'])}
        </label>
        <TextField
          label={t(['Min stock threshold', 'حد المخزون الأدنى'])}
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
        <div>
          <span className="text-sm font-medium text-slate-700">
            {t(['Dimensions (cm, optional)', 'الأبعاد (سم، اختياري)'])}
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <TextField
              label={t(['Length', 'الطول'])}
              type="number"
              min={0}
              step="0.01"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
            />
            <TextField
              label={t(['Width', 'العرض'])}
              type="number"
              min={0}
              step="0.01"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
            <TextField
              label={t(['Height', 'الارتفاع'])}
              type="number"
              min={0}
              step="0.01"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
        </div>
        <TextField
          label={t(['Weight (kg, optional)', 'الوزن (كغ، اختياري)'])}
          type="number"
          min={0}
          step="0.0001"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
        />
      </form>
    </Modal>
  );
}

interface EditProductModalProps {
  open: boolean;
  product: Product | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateProductInput) => void;
}

function EditProductModal({ open, product, loading, onClose, onSubmit }: EditProductModalProps) {
  const { t } = useWmsTranslation();
  const uomOptions = useMemo(
    () => UOM_VALUES.map((value) => ({ value, label: productUomLabel(value, t) })),
    [t],
  );
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [uom, setUom] = useState('piece');
  const [minStock, setMinStock] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [expiryTracking, setExpiryTracking] = useState(true);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setBarcode(product.barcode ?? '');
      setDescription(product.description ?? '');
      setUom(product.uom);
      setMinStock(String(product.minStockThreshold ?? 0));
      setLengthCm(product.lengthCm != null && product.lengthCm !== '' ? String(product.lengthCm) : '');
      setWidthCm(product.widthCm != null && product.widthCm !== '' ? String(product.widthCm) : '');
      setHeightCm(product.heightCm != null && product.heightCm !== '' ? String(product.heightCm) : '');
      setWeightKg(product.weightKg != null && product.weightKg !== '' ? String(product.weightKg) : '');
      setExpiryTracking(product.expiryTracking);
    }
  }, [product]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minParsed = minStock.trim() === '' ? 0 : Math.max(0, parseInt(minStock, 10) || 0);
    onSubmit({
      expiryTracking,
      name,
      sku: sku.trim(),
      barcode: barcode.trim(),
      description: description.trim(),
      uom: uom as UpdateProductInput['uom'],
      minStockThreshold: minParsed,
      lengthCm: parseDimUpdate(lengthCm),
      widthCm: parseDimUpdate(widthCm),
      heightCm: parseDimUpdate(heightCm),
      weightKg: parseDimUpdate(weightKg),
    });
  };

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`${t(['Edit', 'تعديل'])} ${product.sku}`}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button
            variant="danger"
            className={MODAL_CANCEL_BUTTON_CLASS}
            type="button"
            onClick={handleClose}
            disabled={loading}
          >
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button
            form="edit-product"
            type="submit"
            variant="brand"
            loading={loading}
          >
            {t(['Save', 'حفظ'])}
          </Button>
        </>
      }
    >
      <form id="edit-product" onSubmit={submit} className="space-y-3">
        <TextField
          label={t(['Client', 'العميل'])}
          value={product.company?.name ?? product.companyId}
          readOnly
          disabled
          className="bg-slate-50 text-slate-600"
        />
        <TextField
          label={t(['Name', 'الاسم'])}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField
            label="SKU"
            required
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="font-mono"
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => setSku(generateSku())}>
            {t(['Generate SKU', 'إنشاء SKU'])}
          </Button>
        </div>
        <TextField
          label="Barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          hint={t(['Clear to remove barcode.', 'امسح الحقل لإزالة Barcode.'])}
          className="font-mono"
        />
        <TextField
          label={t(['Description', 'الوصف'])}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField label="UOM" value={uom} onChange={(e) => setUom(e.target.value)} options={uomOptions} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={expiryTracking}
            onChange={(e) => setExpiryTracking(e.target.checked)}
          />
          {t(['Product has an expiry date', 'المنتج له تاريخ انتهاء'])}
        </label>
        <TextField
          label={t(['Min stock threshold', 'حد المخزون الأدنى'])}
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
        <div>
          <span className="text-sm font-medium text-slate-700">
            {t(['Dimensions (cm)', 'الأبعاد (سم)'])}
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <TextField
              label={t(['Length', 'الطول'])}
              type="number"
              min={0}
              step="0.01"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
            />
            <TextField
              label={t(['Width', 'العرض'])}
              type="number"
              min={0}
              step="0.01"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
            <TextField
              label={t(['Height', 'الارتفاع'])}
              type="number"
              min={0}
              step="0.01"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t(['Clear a field to remove that dimension.', 'امسح الحقل لإزالة هذا البُعد.'])}
          </p>
        </div>
        <TextField
          label={t(['Weight (kg)', 'الوزن (كغ)'])}
          type="number"
          min={0}
          step="0.0001"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          hint={t(['Clear to remove stored weight.', 'امسح الحقل لإزالة الوزن المخزّن.'])}
        />
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          {t([
            'Lot tracking is fixed for this product. Client cannot be changed here.',
            'تتبع Lot ثابت لهذا المنتج. لا يمكن تغيير العميل من هنا.',
          ])}
        </div>
      </form>
    </Modal>
  );
}
