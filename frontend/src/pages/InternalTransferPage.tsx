import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CompaniesApi } from '../api/companies';
import { InventoryApi, LedgerRow, StockRow } from '../api/inventory';
import { LocationsApi } from '../api/locations';
import { ProductsApi } from '../api/products';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { fmtLedgerQty } from '../lib/ledger-display';
import { isAdjustmentStockLocationType, locationTypeLabel } from '../lib/location-types';

/** Subset of `LocationType` allowed for internal transfers (matches backend adjustment-stock types). */
type TransferLocationTypeFilter = '' | 'internal' | 'fridge' | 'quarantine' | 'scrap';

const TRANSFER_LOCATION_TYPE_OPTIONS: { value: TransferLocationTypeFilter; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'internal', label: 'Storage' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'scrap', label: 'Scrap' },
];

type ProductListParams = {
  companyId: string;
  productName: string;
  sku: string;
  productBarcode: string;
};

export function InternalTransferPage() {
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
            <div className="font-medium text-slate-900">{r.product.name}</div>
            <div className="font-mono text-xs text-slate-500">{r.product.sku}</div>
          </div>
        ),
      },
      {
        header: 'Lot',
        accessor: (r) => (
          <span className="font-mono text-xs text-slate-600">{r.lot?.lotNumber ?? '—'}</span>
        ),
        width: '120px',
      },
      {
        header: 'Qty',
        accessor: (r) => <span className="font-mono text-slate-700">{fmtLedgerQty(r.quantity)}</span>,
        width: '100px',
        className: 'text-right',
      },
      {
        header: 'From -> To',
        accessor: (r) => {
          const from = r.fromLocationId?.slice(0, 8) ?? '—';
          const to = r.toLocationId?.slice(0, 8) ?? '—';
          return (
            <span className="font-mono text-xs text-slate-600">
              {from}... to {to}...
            </span>
          );
        },
        width: '220px',
      },
      {
        header: 'Ref',
        accessor: (r) => (
          <Link to={`/inventory/ledger/transfer/${r.referenceId}`} className="text-primary-700 underline">
            {r.referenceId.slice(0, 8)}...
          </Link>
        ),
        width: '120px',
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Internal transfer"
        description="View transfer history and create a new internal transfer."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            Create Internal Transfer
          </Button>
        }
      />

      {!warehouseId ? (
        <p className="text-sm text-slate-600">Resolve warehouse configuration first.</p>
      ) : (
        <DataTable
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
  const toast = useToast();
  const qc = useQueryClient();

  const [companyId, setCompanyId] = useState('');
  const [productName, setProductName] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [barcodeFilter, setBarcodeFilter] = useState('');
  const [debounced, setDebounced] = useState<ProductListParams>({
    companyId: '',
    productName: '',
    sku: '',
    productBarcode: '',
  });
  const [scanOpen, setScanOpen] = useState(false);
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
    setProductName('');
    setSkuFilter('');
    setBarcodeFilter('');
    setProductId('');
    setLotId('');
    setFromLocationId('');
    setToLocationId('');
    setSourceTypeFilter('');
    setDestTypeFilter('');
    setQuantity('');
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced({
        companyId,
        productName: productName.trim(),
        sku: skuFilter.trim(),
        productBarcode: barcodeFilter.trim(),
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [companyId, productName, skuFilter, barcodeFilter]);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const products = useQuery({
    queryKey: [...QK.products, 'internal-transfer-create', debounced],
    queryFn: () =>
      ProductsApi.list({
        companyId: debounced.companyId,
        limit: 200,
        ...(debounced.productName ? { productName: debounced.productName } : {}),
        ...(debounced.sku ? { sku: debounced.sku } : {}),
        ...(debounced.productBarcode ? { productBarcode: debounced.productBarcode } : {}),
      }),
    enabled: !!debounced.companyId && open,
    staleTime: 60_000,
  });

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  );

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

  const locs = useQuery({
    queryKey: QK.locationsFlat(warehouseId, false),
    queryFn: () => LocationsApi.list(warehouseId),
    enabled: !!warehouseId && open,
    staleTime: 5 * 60_000,
  });

  const adjustmentLocations = useMemo(
    () => (locs.data ?? []).filter((l) => isAdjustmentStockLocationType(l.type)),
    [locs.data],
  );

  const stockByProduct = useQuery({
    queryKey: [...QK.inventoryStock, 'internal-transfer-create', warehouseId, companyId, productId],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId,
        companyId: companyId || undefined,
        productId,
        limit: 500,
      }),
    enabled: !!warehouseId && !!companyId && !!productId && open,
    staleTime: 30_000,
  });

  const sourceLocationOptions = useMemo(() => {
    const items = stockByProduct.data?.items ?? [];
    const locMap = new Map(adjustmentLocations.map((l) => [l.id, l]));
    const seen = new Set<string>();
    const out: { id: string; label: string; hint?: string }[] = [];
    for (const row of items) {
      const loc = locMap.get(row.locationId);
      if (!loc) continue;
      if (sourceTypeFilter && loc.type !== sourceTypeFilter) continue;
      if (productMeta?.trackingType === 'lot') {
        if (!lotId) continue;
        const rowLot = row.lotId ?? row.lot?.id ?? null;
        if (rowLot !== lotId) continue;
      } else if (row.lotId || row.lot?.id) {
        continue;
      }
      const avail = Number(row.quantityAvailable ?? row.quantityOnHand);
      if (!Number.isFinite(avail) || avail <= 0 || seen.has(loc.id)) continue;
      seen.add(loc.id);
      out.push({
        id: loc.id,
        label: loc.fullPath,
        hint: `${locationTypeLabel(loc.type)} · avail ${avail.toLocaleString()}`,
      });
    }
    return out;
  }, [
    stockByProduct.data?.items,
    adjustmentLocations,
    productMeta?.trackingType,
    lotId,
    sourceTypeFilter,
  ]);

  const destLocationOptions = useMemo(
    () =>
      adjustmentLocations
        .filter((l) => l.id !== fromLocationId)
        .filter((l) => !destTypeFilter || l.type === destTypeFilter)
        .map((l) => ({
          id: l.id,
          label: l.fullPath,
          hint: `${locationTypeLabel(l.type)} · ${l.barcode}`,
        })),
    [adjustmentLocations, fromLocationId, destTypeFilter],
  );

  const stockRow: StockRow | null = useMemo(() => {
    const items = stockByProduct.data?.items ?? [];
    if (!productId || !fromLocationId) return null;
    if (productMeta?.trackingType === 'lot') {
      if (!lotId) return null;
      return (
        items.find(
          (r) =>
            r.productId === productId &&
            r.locationId === fromLocationId &&
            (r.lotId === lotId || r.lot?.id === lotId),
        ) ?? null
      );
    }
    return (
      items.find(
        (r) =>
          r.productId === productId &&
          r.locationId === fromLocationId &&
          !(r.lotId ?? r.lot?.id),
      ) ?? null
    );
  }, [stockByProduct.data?.items, productId, fromLocationId, lotId, productMeta?.trackingType]);

  const availableQty = useMemo(() => {
    if (!stockRow) return null;
    const n = Number(stockRow.quantityAvailable ?? stockRow.quantityOnHand);
    return Number.isFinite(n) ? n : null;
  }, [stockRow]);

  const transferMut = useMutation({
    mutationFn: InventoryApi.internalTransfer,
    onSuccess: () => {
      toast.success('Internal transfer recorded.');
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!companyId.trim() || !productMeta || !warehouseId) return;

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
      companyId: companyId.trim(),
      productId,
      fromLocationId,
      toLocationId,
      quantity: qtyNum,
      ...(productMeta.trackingType === 'lot' && lotId ? { lotId } : {}),
    });
  };

  const lotTracked = productMeta?.trackingType === 'lot';
  const formReady =
    !!companyId &&
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
              variant="secondary"
              onClick={onClose}
              disabled={transferMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="internal-transfer-form"
              loading={transferMut.isPending}
              disabled={!formReady}
              className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
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
            label="Client"
            required
            value={companyId}
            onChange={(v) => {
              setCompanyId(v);
              setProductId('');
            }}
            options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder={companies.isLoading ? 'Loading...' : 'Select client...'}
          />

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Find product
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <TextField
                label="Product name (contains)"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Filter by name..."
                disabled={!companyId}
              />
              <TextField
                label="SKU (contains)"
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                placeholder="Filter by SKU..."
                disabled={!companyId}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="Barcode (contains)"
                value={barcodeFilter}
                onChange={(e) => setBarcodeFilter(e.target.value)}
                placeholder="Product barcode..."
                className="min-w-[200px] flex-1"
                disabled={!companyId}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!companyId}
                onClick={() => setScanOpen(true)}
              >
                Scan barcode
              </Button>
            </div>
          </div>

          <Combobox
            label="Product"
            required
            value={productId}
            onChange={setProductId}
            disabled={!companyId}
            options={(products.data?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.sku} - ${p.name}`,
              hint: p.barcode ?? undefined,
            }))}
            placeholder={
              !companyId
                ? 'Select a client first...'
                : products.isLoading
                  ? 'Loading...'
                  : 'Select product...'
            }
            emptyMessage="No products match the filters."
          />

          {productMeta?.trackingType === 'lot' ? (
            <Combobox
              label="Lot"
              required
              value={lotId}
              onChange={setLotId}
              options={(lots.data ?? []).map((lot) => ({
                value: lot.id,
                label: lot.lotNumber,
                hint: lot.expiryDate ? `Exp ${lot.expiryDate.slice(0, 10)}` : undefined,
              }))}
              placeholder={lots.isLoading ? 'Loading lots...' : 'Select lot...'}
              disabled={!productId || lots.isLoading}
              emptyMessage="No lots for this product."
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
              emptyMessage="No on-hand stock in an eligible bin for this type filter."
            />
            <Combobox
              label="Destination location"
              required
              value={toLocationId}
              onChange={setToLocationId}
              disabled={!warehouseId || !fromLocationId}
              options={destLocationOptions.map((o) => ({
                value: o.id,
                label: o.label,
                hint: o.hint,
              }))}
              placeholder={!fromLocationId ? 'Pick source first...' : 'Where stock goes...'}
              emptyMessage="No other eligible bins in this warehouse."
            />
          </div>

          {fromLocationId && productId && (!lotTracked || !!lotId) ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-medium text-slate-600">Available at source:</span>{' '}
              {stockByProduct.isPending ? (
                <span className="text-slate-400">...</span>
              ) : availableQty != null ? (
                <span className="font-mono font-semibold">{availableQty.toLocaleString()}</span>
              ) : (
                <span className="text-slate-500">-</span>
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
          setBarcodeFilter(text.trim());
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </>
  );
}
