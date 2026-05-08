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
import { BarcodeImageModal } from '../components/BarcodeImageModal';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { FilterActions } from '../components/FilterActions';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import { generateSku } from '../lib/identifiers';

const UOM_OPTIONS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kilogram' },
  { value: 'litre', label: 'Litre' },
  { value: 'carton', label: 'Carton' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'box', label: 'Box' },
  { value: 'roll', label: 'Roll' },
];

function uomLabel(uom: ProductUom) {
  return UOM_OPTIONS.find((o) => o.value === uom)?.label ?? uom;
}

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

type ProductDraftFilters = {
  companyId: string;
  name: string;
  sku: string;
  barcode: string;
};

function prependProductAcrossCaches(qc: ReturnType<typeof useQueryClient>, created: Product) {
  const queries = qc.getQueryCache().findAll({ queryKey: QK.products, exact: false });
  for (const q of queries) {
    qc.setQueryData<{ items?: Product[]; total: number }>(q.queryKey, (prev) => {
      if (!prev?.items) return prev;
      return { ...prev, items: [created, ...prev.items], total: prev.total + 1 };
    });
  }
}

function upsertProductAcrossCaches(qc: ReturnType<typeof useQueryClient>, updated: Product) {
  const queries = qc.getQueryCache().findAll({ queryKey: QK.products, exact: false });
  for (const q of queries) {
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
  const initialProductFilters = useMemo<ProductDraftFilters>(
    () => ({
      companyId: '',
      name: '',
      sku: '',
      barcode: '',
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

  const filters = useMemo(
    () => ({
      companyId: appliedFilters.companyId.trim() || undefined,
      productName: appliedFilters.name.trim() || undefined,
      sku: appliedFilters.sku.trim() || undefined,
      productBarcode: appliedFilters.barcode.trim() || undefined,
    }),
    [appliedFilters],
  );

  const list = useQuery({
    queryKey: [...QK.products, filters],
    queryFn: () => ProductsApi.list(filters),
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: ProductsApi.create,
    onSuccess: (created) => {
      toast.success('Product created.');
      prependProductAcrossCaches(qc, created);
      setOpenCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      ProductsApi.update(id, input),
    onSuccess: (updated) => {
      toast.success('Product saved.');
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
      toast.success('Product suspended — it cannot be added to new inbound/outbound lines.');
      upsertProductAcrossCaches(qc, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unsuspendMut = useMutation({
    mutationFn: (id: string) => ProductsApi.unsuspend(id),
    onSuccess: (updated) => {
      toast.success('Product reactivated.');
      upsertProductAcrossCaches(qc, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hardDeleteMut = useMutation({
    mutationFn: (id: string) => ProductsApi.hardDelete(id),
    onSuccess: (_, id) => {
      toast.success('Product deleted.');
      invalidateProducts();
      setEditProduct((prev) => (prev?.id === id ? null : prev));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: Column<Product>[] = [
    { header: 'Product Name', accessor: (p) => p.name },
    {
      header: 'Client Name',
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
      accessor: (p) => <span className="text-slate-800">{uomLabel(p.uom)}</span>,
      width: '110px',
    },
    {
      header: 'Status',
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
          {p.status}
        </span>
      ),
      width: '110px',
    },
    {
      header: 'Actions',
      accessor: (p) => {
        if (p.status === 'archived') {
          return <span className="text-xs text-slate-400">—</span>;
        }
        const canEdit = p.status === 'active' || p.status === 'suspended';
        const busy =
          suspendMut.isPending || unsuspendMut.isPending || hardDeleteMut.isPending || updateMut.isPending;
        const menuOpen = openActionId === p.id;
        return (
          <div className="relative inline-flex">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              disabled={busy}
              data-product-action-trigger="true"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionId((cur) => (cur === p.id ? null : p.id));
              }}
              aria-label="Open actions"
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
              </svg>
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-9 z-10 min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
                {canEdit ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    data-product-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenActionId(null);
                      setEditProduct(p);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {p.status === 'active' ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    data-product-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Suspend ${p.sku}? It will be blocked from new inbound/outbound lines.`,
                        )
                      ) {
                        suspendMut.mutate(p.id);
                      }
                    }}
                  >
                    Suspend
                  </button>
                ) : null}
                {p.status === 'suspended' ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    data-product-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      unsuspendMut.mutate(p.id);
                    }}
                  >
                    Unsuspend
                  </button>
                ) : null}
                {p.deletable ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                    data-product-action-menu-button="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Permanently delete ${p.sku}? This cannot be undone. The server only allows this when the product has zero stock and no order, adjustment, or ledger references.`,
                        )
                      ) {
                        hardDeleteMut.mutate(p.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
      width: '140px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <Button
            onClick={() => setOpenCreate(true)}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            + New product
          </Button>
        }
      />

      <FilterPanel showLabel="Show filters" hideLabel="Hide filters">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Combobox
            label="Client filter"
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={[
              { value: '', label: 'All clients' },
              ...(companies.data ?? []).map((c) => ({
                value: c.id,
                label: c.name,
                hint: c.contactEmail,
              })),
            ]}
            placeholder="All clients"
            className="min-w-[220px] max-w-xs"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField
            label="Product name"
            value={draftFilters.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder="Contains…"
          />
          <TextField
            label="SKU"
            className="font-mono"
            value={draftFilters.sku}
            onChange={(e) => setDraft({ sku: e.target.value })}
            placeholder="Contains…"
          />
          <div className="flex items-end gap-2">
            <TextField
              label="Barcode"
              className="min-w-0 flex-1 font-mono"
              value={draftFilters.barcode}
              onChange={(e) => setDraft({ barcode: e.target.value })}
              placeholder="Contains…"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              title="Scan a barcode with the device camera"
              onClick={() => setScanOpen(true)}
            >
              Scan
            </Button>
          </div>
        </div>
        <FilterActions
          onApply={applyFilters}
          onReset={resetFilters}
          loading={list.isFetching}
        />
      </div>
      </FilterPanel>

      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        empty="No products match the filters."
        onRowClick={(p) => navigate(`/products/${encodeURIComponent(p.sku)}`)}
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
          applyPatch({ barcode: text.trim() });
          toast.success('Barcode scanned — barcode filter updated.');
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
      title="New product"
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button
            form="create-product"
            type="submit"
            loading={loading}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            Create
          </Button>
        </>
      }
    >
      <form id="create-product" onSubmit={submit} className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1">
        <Combobox
          label="Client"
          required
          value={companyId}
          onChange={setCompanyId}
          options={(companies.data ?? []).map((c) => ({
            value: c.id,
            label: c.name,
            hint: c.contactEmail,
          }))}
          placeholder="Pick a client…"
        />
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField label="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setSku(generateSku())}
          >
            Generate SKU
          </Button>
        </div>
        <TextField
          label="Barcode (optional)"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          hint="Leave blank to auto-generate."
          className="font-mono"
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField label="UOM" value={uom} onChange={(e) => setUom(e.target.value)} options={UOM_OPTIONS} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={expiryTracking}
            onChange={(e) => setExpiryTracking(e.target.checked)}
          />
          Product has an expiry date (required on lots when receiving or picking)
        </label>
        <TextField
          label="Min stock threshold"
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
        <div>
          <span className="text-sm font-medium text-slate-700">Dimensions (cm, optional)</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <TextField
              label="Length"
              type="number"
              min={0}
              step="0.01"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
            />
            <TextField
              label="Width"
              type="number"
              min={0}
              step="0.01"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
            <TextField
              label="Height"
              type="number"
              min={0}
              step="0.01"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
        </div>
        <TextField
          label="Weight (kg, optional)"
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
      title={`Edit ${product.sku}`}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button form="edit-product" type="submit" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-product" onSubmit={submit} className="space-y-3">
        <TextField
          label="Client"
          value={product.company?.name ?? product.companyId}
          readOnly
          disabled
          className="bg-slate-50 text-slate-600"
        />
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <TextField label="SKU" required value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
          <Button type="button" size="sm" variant="secondary" onClick={() => setSku(generateSku())}>
            Generate SKU
          </Button>
        </div>
        <TextField
          label="Barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          hint="Clear to remove barcode."
          className="font-mono"
        />
        <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <SelectField label="UOM" value={uom} onChange={(e) => setUom(e.target.value)} options={UOM_OPTIONS} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={expiryTracking}
            onChange={(e) => setExpiryTracking(e.target.checked)}
          />
          Product has an expiry date (required on lots when receiving or picking)
        </label>
        <TextField
          label="Min stock threshold"
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
        <div>
          <span className="text-sm font-medium text-slate-700">Dimensions (cm)</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <TextField
              label="Length"
              type="number"
              min={0}
              step="0.01"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
            />
            <TextField
              label="Width"
              type="number"
              min={0}
              step="0.01"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
            <TextField
              label="Height"
              type="number"
              min={0}
              step="0.01"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Clear a field to remove that dimension.</p>
        </div>
        <TextField
          label="Weight (kg)"
          type="number"
          min={0}
          step="0.0001"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          hint="Clear to remove stored weight."
        />
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          Lot tracking is fixed for this product. Client cannot be changed here.
        </div>
      </form>
    </Modal>
  );
}
