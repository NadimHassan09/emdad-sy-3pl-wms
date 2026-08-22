import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, LedgerRow } from '../api/inventory';
import type { Location } from '../api/locations';
import { ProductsApi, type ProductListQuery } from '../api/products';
import { AdjustmentStockLocationPicker } from '../components/locations/AdjustmentStockLocationPicker';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { ADJUSTMENT_CANCEL_BUTTON_CLASS } from '../components/adjustments/adjustment-button-styles';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { WedgeScanField } from '../components/WedgeScanField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useResolvedLocations } from '../hooks/useResolvedLocations';
import { fmtLedgerQty } from '../lib/ledger-display';
import {
  buildStockSourceLocationOptions,
  transferableQtyAtRow,
  uniqueStockLocationIds,
} from '../lib/inventory-location-options';
import { resolveLocationByScan } from '../lib/location-resolve';
import { localizedLocationTypeLabel } from '../lib/ui-labels/locations';
import { useWmsTranslation } from '../lib/ui-i18n';

/** Subset of `LocationType` allowed for internal transfers (matches backend adjustment-stock types). */
type TransferLocationTypeFilter = '' | 'internal' | 'fridge' | 'quarantine' | 'scrap';

const TRANSFER_LOCATION_TYPE_OPTIONS: { value: TransferLocationTypeFilter; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'internal', label: 'Storage' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'scrap', label: 'Scrap' },
];

type ProductSearchCategory = 'name' | 'sku' | 'barcode';

function productListQuery(
  companyId: string | undefined,
  category: ProductSearchCategory,
  query: string,
): ProductListQuery {
  const q = query.trim();
  const base: ProductListQuery = { limit: 200, ...(companyId ? { companyId } : {}) };
  if (!q) return base;
  switch (category) {
    case 'name':
      return { ...base, productName: q };
    case 'sku':
      return { ...base, sku: q };
    case 'barcode':
      return { ...base, productBarcode: q };
    default:
      return base;
  }
}

function formatTransferLocationLabel(loc: Location | undefined, id: string | null | undefined): string {
  if (!id) return '—';
  if (!loc) return `${id.slice(0, 8)}…`;
  const primary = loc.fullPath?.trim() || loc.name?.trim() || loc.barcode?.trim();
  if (primary) return primary;
  return `${id.slice(0, 8)}…`;
}

export function InternalTransferPage() {
  const isArabic =
    typeof window !== 'undefined' && (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const [createOpen, setCreateOpen] = useState(false);
  const { warehouseId } = useDefaultWarehouseId();

  const transfers = useQuery({
    queryKey: [...QK.ledger, 'internal-transfers', warehouseId],
    queryFn: () =>
      InventoryApi.ledger({
        warehouseId: warehouseId || undefined,
        movementType: 'internal_transfer',
        referenceType: 'transfer',
        limit: 300,
      }),
    enabled: !!warehouseId,
  });

  const historyLocationIds = useMemo(() => {
    const ids: string[] = [];
    for (const r of transfers.data?.items ?? []) {
      if (r.fromLocationId) ids.push(r.fromLocationId);
      if (r.toLocationId) ids.push(r.toLocationId);
    }
    return ids;
  }, [transfers.data?.items]);

  const { locationById } = useResolvedLocations(historyLocationIds);

  const columns: Column<LedgerRow>[] = useMemo(
    () => [
      {
        header: 'When',
        accessor: (r) => new Date(r.createdAt).toLocaleString(),
        width: '170px',
      },
      {
        header: 'Client',
        accessor: (r) => r.company.name,
        width: '140px',
      },
      {
        header: 'Product',
        accessor: (r) => (
          <div>
            <div className="font-medium text-text-strong">{r.product.name}</div>
            <div className="font-mono text-xs text-text-muted">{r.product.sku}</div>
          </div>
        ),
      },
      {
        header: 'Lot',
        accessor: (r) => (
          <span className="font-mono text-xs text-text-body">{r.lot?.lotNumber ?? '—'}</span>
        ),
        width: '120px',
      },
      {
        header: 'Qty',
        accessor: (r) => <span className="font-mono text-text-body">{fmtLedgerQty(r.quantity)}</span>,
        width: '100px',
        className: 'text-right',
      },
      {
        header: 'From → To',
        accessor: (r) => {
          const fromLoc = r.fromLocationId ? locationById.get(r.fromLocationId) : undefined;
          const toLoc = r.toLocationId ? locationById.get(r.toLocationId) : undefined;
          const fromLabel = formatTransferLocationLabel(fromLoc, r.fromLocationId);
          const toLabel = formatTransferLocationLabel(toLoc, r.toLocationId);
          return (
            <div className="text-xs text-text-body">
              <div className="font-medium text-text-strong" title={fromLoc?.fullPath ?? r.fromLocationId ?? undefined}>
                {fromLabel}
              </div>
              <div className="mt-0.5 text-text-muted">→</div>
              <div className="font-medium text-text-strong" title={toLoc?.fullPath ?? r.toLocationId ?? undefined}>
                {toLabel}
              </div>
            </div>
          );
        },
        width: '260px',
      },
      {
        header: 'Ref',
        accessor: (r) => (
          <Link to={`/inventory/ledger/transfer/${r.referenceId}`} className="text-brand-700 underline">
            {r.referenceId.slice(0, 8)}...
          </Link>
        ),
        width: '120px',
      },
    ],
    [locationById],
  );

  return (
    <div className="space-y-4">
      {!warehouseId ? (
        <p className="text-sm text-text-body">{t('Resolve warehouse configuration first.', 'قم بحل إعدادات المستودع أولاً.')}</p>
      ) : (
        <DataTable
          title={t('Internal transfer', 'نقل داخلي')}
          actions={
            <Button
              variant="brand"
              onClick={() => setCreateOpen(true)}
            >
              {t('Create Internal Transfer', 'إنشاء نقل داخلي')}
            </Button>
          }
          columns={columns}
          rows={transfers.data?.items ?? []}
          rowKey={(r) => `${r.id}:${r.createdAt}`}
          loading={transfers.isLoading}
          empty="No internal transfers yet."
        />
      )}

      <CreateInternalTransferModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        warehouseId={warehouseId}
      />
    </div>
  );
}

function CreateInternalTransferModal({
  open,
  onClose,
  warehouseId,
}: {
  open: boolean;
  onClose: () => void;
  warehouseId: string;
}) {
  const { t } = useWmsTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const [companyId, setCompanyId] = useState('');
  const [productSearchCategory, setProductSearchCategory] = useState<ProductSearchCategory>('name');
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [sourceScan, setSourceScan] = useState('');
  const [destScan, setDestScan] = useState('');
  const [locCameraTarget, setLocCameraTarget] = useState<'from' | 'to' | null>(null);
  const [productId, setProductId] = useState('');
  const [lotId, setLotId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<TransferLocationTypeFilter>('');
  const [destTypeFilter, setDestTypeFilter] = useState<TransferLocationTypeFilter>('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (!open) return;
    setCompanyId('');
    setProductSearchCategory('name');
    setProductSearch('');
    setDebouncedProductSearch('');
    setProductId('');
    setLotId('');
    setFromLocationId('');
    setToLocationId('');
    setSourceTypeFilter('');
    setDestTypeFilter('');
    setQuantity('');
    setSourceScan('');
    setDestScan('');
    setLocCameraTarget(null);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const products = useQuery({
    queryKey: [
      ...QK.products,
      'internal-transfer-create',
      companyId,
      productSearchCategory,
      debouncedProductSearch,
    ],
    queryFn: () =>
      ProductsApi.list(
        productListQuery(companyId.trim() || undefined, productSearchCategory, debouncedProductSearch),
      ),
    enabled: open,
    staleTime: 60_000,
  });

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  );

  const stockCompanyId = productMeta?.companyId || companyId.trim();
  const lotTracked = productMeta?.trackingType === 'lot';

  useEffect(() => {
    if (productMeta?.companyId && productMeta.companyId !== companyId) {
      setCompanyId(productMeta.companyId);
    }
  }, [productMeta?.companyId]);

  useEffect(() => {
    setLotId('');
    setFromLocationId('');
    setToLocationId('');
  }, [productId]);

  useEffect(() => {
    setFromLocationId('');
    setToLocationId('');
  }, [lotId]);

  useEffect(() => {
    setFromLocationId('');
  }, [sourceTypeFilter]);

  useEffect(() => {
    setToLocationId('');
  }, [destTypeFilter]);

  const lots = useQuery({
    queryKey: [...QK.products, productId, 'lots', 'internal-transfer-create'],
    queryFn: () => ProductsApi.listLots(productId),
    enabled: !!productId && productMeta?.trackingType === 'lot' && open,
    staleTime: 60_000,
  });

  const stockByProduct = useQuery({
    queryKey: [...QK.inventoryStock, 'internal-transfer-create', warehouseId, stockCompanyId, productId],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId,
        companyId: stockCompanyId,
        productId,
        limit: 500,
      }),
    enabled: !!warehouseId && !!stockCompanyId && !!productId && open,
    staleTime: 30_000,
  });

  const stockLocationIds = useMemo(
    () => uniqueStockLocationIds(stockByProduct.data?.items ?? []),
    [stockByProduct.data?.items],
  );

  const { locationById } = useResolvedLocations(
    open && productId && stockByProduct.isFetched ? stockLocationIds : [],
  );

  const eligibleLocationIds = useMemo(
    () => new Set([...locationById.keys()]),
    [locationById],
  );

  const lotOptionsWithStock = useMemo(() => {
    if (!lotTracked || !productId) return [];

    const byLot = new Map<
      string,
      { id: string; lotNumber: string; expiryDate: string | null }
    >();

    for (const row of stockByProduct.data?.items ?? []) {
      if (!eligibleLocationIds.has(row.locationId)) continue;
      const id = row.lotId ?? row.lot?.id;
      if (!id) continue;
      const onHand = Number(row.quantityOnHand);
      if (!Number.isFinite(onHand) || onHand <= 0) continue;

      if (!byLot.has(id)) {
        const catalog = (lots.data ?? []).find((l) => l.id === id);
        byLot.set(id, {
          id,
          lotNumber: row.lot?.lotNumber ?? catalog?.lotNumber ?? id.slice(0, 8),
          expiryDate: row.lot?.expiryDate ?? catalog?.expiryDate ?? null,
        });
      }
    }

    return [...byLot.values()].sort((a, b) => a.lotNumber.localeCompare(b.lotNumber));
  }, [
    lotTracked,
    productId,
    eligibleLocationIds,
    stockByProduct.data?.items,
    lots.data,
  ]);

  const sourceLocationOptions = useMemo(
    () =>
      buildStockSourceLocationOptions({
        stockItems: stockByProduct.data?.items ?? [],
        locationById,
        productId,
        lotId,
        lotTracked,
        sourceTypeFilter: sourceTypeFilter || undefined,
        typeLabel: (type) => localizedLocationTypeLabel(type, t),
        availWord: t(['avail', 'متاح']),
      }),
    [
      stockByProduct.data?.items,
      locationById,
      productId,
      lotId,
      lotTracked,
      sourceTypeFilter,
      t,
    ],
  );

  const availableQty = useMemo(() => {
    if (!productId || !fromLocationId) return null;
    if (lotTracked && !lotId) return null;

    const items = stockByProduct.data?.items ?? [];
    let total = 0;
    for (const row of items) {
      if (row.productId !== productId || row.locationId !== fromLocationId) continue;
      const rowLot = row.lotId ?? row.lot?.id ?? null;
      if (lotTracked) {
        if (rowLot !== lotId) continue;
      } else if (rowLot) {
        continue;
      }
      total += transferableQtyAtRow(row);
    }
    return total > 0 ? total : null;
  }, [stockByProduct.data?.items, productId, fromLocationId, lotId, lotTracked]);

  const transferMut = useMutation({
    mutationFn: InventoryApi.internalTransfer,
    onSuccess: () => {
      toast.success('Internal transfer recorded.');
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      // Keep modal open for consecutive creates — clear product/lot/qty only.
      setQuantity('');
      setProductId('');
      setLotId('');
      setProductSearch('');
      setDebouncedProductSearch('');
      setProductSearchCategory('name');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function applyLocationScan(target: 'from' | 'to', code: string) {
    const trimmed = code.trim();
    if (!trimmed || !warehouseId) return;
    try {
      const hit = await resolveLocationByScan(warehouseId, trimmed);
      if (!hit) {
        toast.error('No location matches this barcode.');
        return;
      }
      if (target === 'from') {
        setFromLocationId(hit.id);
        setSourceScan('');
        toast.success(`Source: ${hit.fullPath || hit.name}`);
      } else {
        setToLocationId(hit.id);
        setDestScan('');
        toast.success(`Destination: ${hit.fullPath || hit.name}`);
      }
      setLocCameraTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Location scan failed.');
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!productMeta || !warehouseId) return;
    const transferCompanyId = productMeta.companyId;

    const qtyNum = Number(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error('Enter a positive quantity.');
      return;
    }
    if (fromLocationId === toLocationId) {
      toast.error('Destination must differ from source.');
      return;
    }
    if (productMeta.trackingType === 'lot' && !lotId) {
      toast.error('Select a lot for this product.');
      return;
    }
    if (availableQty != null && qtyNum > availableQty) {
      toast.error('Quantity exceeds available stock at the source location.');
      return;
    }

    transferMut.mutate({
      companyId: transferCompanyId,
      productId,
      fromLocationId,
      toLocationId,
      quantity: qtyNum,
      ...(productMeta.trackingType === 'lot' && lotId ? { lotId } : {}),
    });
  };

  const formReady =
    !!productMeta &&
    !!productId &&
    !!fromLocationId &&
    !!toLocationId &&
    !!quantity.trim() &&
    (!lotTracked || !!lotId);

  return (
    <>
      <Modal
        open={open}
        onClose={() => !transferMut.isPending && onClose()}
        title="Create internal transfer"
        widthClass="max-w-3xl"
        footer={
          <>
            <Button
              type="button"
              variant="danger"
              className={ADJUSTMENT_CANCEL_BUTTON_CLASS}
              onClick={onClose}
              disabled={transferMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="internal-transfer-form"
              variant="brand"
              loading={transferMut.isPending}
              disabled={!formReady}
            >
              Create transfer
            </Button>
          </>
        }
      >
        <form
          id="internal-transfer-form"
          onSubmit={submit}
          className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto pr-1"
        >
          <Combobox
            label="Client (optional)"
            value={companyId}
            onChange={(v) => {
              setCompanyId(v);
              setProductId('');
            }}
            options={[
              { value: '', label: 'All clients' },
              ...(companies.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            placeholder={companies.isLoading ? 'Loading...' : 'All clients'}
            clearable
          />

          <div className="space-y-2 border-t border-border-subtle pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Find product
            </div>
            <div className="grid w-full grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8.75rem,11rem)_auto]">
              <TextField
                label="Search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Contains…"
                className={`min-w-0 ${productSearchCategory !== 'name' ? 'font-mono' : ''}`}
              />
              <SelectField
                label="Search by"
                name="internalTransferProductSearchCategory"
                value={productSearchCategory}
                onChange={(e) =>
                  setProductSearchCategory(e.target.value as ProductSearchCategory)
                }
                options={[
                  { value: 'name', label: 'Product name' },
                  { value: 'sku', label: 'SKU' },
                  { value: 'barcode', label: 'Barcode' },
                ]}
                className="min-w-0 w-full"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-[34px] w-full shrink-0 px-2.5 sm:w-auto"
                title="Scan a barcode with the device camera"
                aria-label="Scan barcode"
                onClick={() => setScanOpen(true)}
              >
                <BarcodeScanIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <Combobox
            label="Product"
            required
            value={productId}
            onChange={setProductId}
            options={(products.data?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.sku} - ${p.name}`,
              hint: p.company?.name ?? undefined,
            }))}
            placeholder={products.isLoading ? 'Loading...' : 'Select product...'}
            emptyMessage="No products match the filters."
          />

          {productMeta?.trackingType === 'lot' ? (
            <Combobox
              label="Lot"
              required
              value={lotId}
              onChange={setLotId}
              options={lotOptionsWithStock.map((lot) => ({
                value: lot.id,
                label: lot.lotNumber,
                hint: lot.expiryDate ? `Exp ${lot.expiryDate.slice(0, 10)}` : undefined,
              }))}
              placeholder={stockByProduct.isPending ? 'Loading stock...' : 'Select lot...'}
              disabled={!productId || stockByProduct.isPending}
              emptyMessage={
                stockByProduct.isPending
                  ? 'Loading stock...'
                  : 'No lots with on-hand stock in eligible locations.'
              }
            />
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Source location type"
              name="internalTransferSourceType"
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value as TransferLocationTypeFilter)}
              options={TRANSFER_LOCATION_TYPE_OPTIONS}
            />
            <SelectField
              label="Destination location type"
              name="internalTransferDestType"
              value={destTypeFilter}
              onChange={(e) => setDestTypeFilter(e.target.value as TransferLocationTypeFilter)}
              options={TRANSFER_LOCATION_TYPE_OPTIONS}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Combobox
                label="Source location"
                required
                value={fromLocationId}
                onChange={setFromLocationId}
                disabled={!productId || stockByProduct.isPending || (lotTracked && !lotId)}
                options={sourceLocationOptions.map((o) => ({
                  value: o.id,
                  label: o.label,
                  hint: o.hint,
                }))}
                placeholder={
                  !productId
                    ? 'Select product...'
                    : lotTracked && !lotId
                      ? 'Select lot first...'
                      : stockByProduct.isPending
                        ? 'Loading stock...'
                        : 'Where stock is now...'
                }
                emptyMessage={
                  lotTracked && !lotId
                    ? 'Select a lot first.'
                    : sourceTypeFilter
                      ? 'No on-hand stock in an eligible bin for this type filter.'
                      : 'No on-hand stock in an eligible bin for this product.'
                }
              />
              <WedgeScanField
                label="Scan source location"
                value={sourceScan}
                onChange={setSourceScan}
                onScan={(code) => void applyLocationScan('from', code)}
                onCameraClick={() => setLocCameraTarget('from')}
                placeholder="Location barcode + Enter"
                autoFocus={false}
                disabled={!warehouseId}
                hint="Gun / keyboard wedge sets the source bin."
              />
            </div>
            <div className="space-y-2">
              <AdjustmentStockLocationPicker
                label="Destination location"
                required
                warehouseId={warehouseId}
                value={toLocationId}
                onChange={setToLocationId}
                typeFilter={destTypeFilter || ''}
                excludeId={fromLocationId}
                disabled={!warehouseId || !fromLocationId}
                placeholder={
                  !fromLocationId ? 'Pick source first...' : 'Search destination bin...'
                }
                emptyMessage="No matching destination bins. Try another search or type filter."
              />
              <WedgeScanField
                label="Scan destination location"
                value={destScan}
                onChange={setDestScan}
                onScan={(code) => void applyLocationScan('to', code)}
                onCameraClick={() => setLocCameraTarget('to')}
                placeholder="Location barcode + Enter"
                autoFocus={false}
                disabled={!warehouseId}
                hint="Gun / keyboard wedge sets the destination bin."
              />
            </div>
          </div>

          {fromLocationId && productId && (!lotTracked || !!lotId) ? (
            <div className="rounded-md border border-border bg-surface-card-muted px-3 py-2 text-xs text-text-body">
              <span className="font-medium text-text-body">Available at source:</span>{' '}
              {stockByProduct.isPending ? (
                <span className="text-text-muted">...</span>
              ) : availableQty != null ? (
                <span className="font-mono font-semibold">{availableQty.toLocaleString()}</span>
              ) : (
                <span className="text-text-muted">-</span>
              )}
            </div>
          ) : null}

          <TextField
            label="Quantity to transfer"
            type="number"
            min={0.0001}
            step={0.0001}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </form>
      </Modal>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          setProductSearchCategory('barcode');
          setProductSearch(text.trim());
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
      <BarcodeScanModal
        open={locCameraTarget != null}
        onClose={() => setLocCameraTarget(null)}
        onScan={(text) => {
          if (locCameraTarget) void applyLocationScan(locCameraTarget, text);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </>
  );
}
