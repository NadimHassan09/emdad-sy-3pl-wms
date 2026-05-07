import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ADJUSTMENT_REASON_PENDING,
  AdjustmentsApi,
  CreateAdjustmentInput,
  StockAdjustment,
  StockAdjustmentLine,
} from '../api/adjustments';
import { CompaniesApi } from '../api/companies';
import { InventoryApi, StockRow } from '../api/inventory';
import { LocationsApi } from '../api/locations';
import { ProductsApi } from '../api/products';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Column, DataTable } from '../components/DataTable';
import { FilterActions } from '../components/FilterActions';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import { isAdjustmentStockLocationType } from '../lib/location-types';

type AdjListDraft = {
  adjustmentId: string;
  productId: string;
  clientId: string;
  lotId: string;
  createdFrom: string;
  createdTo: string;
};

type AdjustmentDrawerState =
  | { mode: 'new' }
  | { mode: 'edit'; adjustment: StockAdjustment };

export function AdjustmentsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [adjDrawer, setAdjDrawer] = useState<AdjustmentDrawerState | null>(null);
  const [draftDeleteTarget, setDraftDeleteTarget] = useState<StockAdjustment | null>(null);
  const [detailAdjustment, setDetailAdjustment] = useState<StockAdjustment | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-adjustment-action-trigger="true"]') ||
        target.closest('[data-adjustment-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);


  const { warehouseId: wid } = useDefaultWarehouseId();

  const initialAdj = useMemo<AdjListDraft>(
    () => ({
      adjustmentId: '',
      productId: '',
      clientId: '',
      lotId: '',
      createdFrom: '',
      createdTo: '',
    }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialAdj);

  const listParams = useMemo(
    () => ({
      warehouseId: wid || undefined,
      companyId: appliedFilters.clientId || undefined,
      adjustmentId: appliedFilters.adjustmentId.trim() || undefined,
      productId: appliedFilters.productId || undefined,
      lotId: appliedFilters.lotId.trim() || undefined,
      createdFrom: appliedFilters.createdFrom.trim() || undefined,
      createdTo: appliedFilters.createdTo.trim() || undefined,
      limit: 100,
    }),
    [appliedFilters, wid],
  );

  const list = useQuery({
    queryKey: [...QK.adjustments, listParams],
    queryFn: () => AdjustmentsApi.list(listParams),
    enabled: !!wid,
  });

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const productDraftOptions = useQuery({
    queryKey: [...QK.products, 'adjustments-draft-products', draftFilters.clientId],
    queryFn: () =>
      ProductsApi.list({
        companyId: draftFilters.clientId || undefined,
        limit: 300,
      }),
    enabled: !!draftFilters.clientId,
    staleTime: 5 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: AdjustmentsApi.create,
    onSuccess: (adj) => {
      toast.success('Adjustment draft created.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      setAdjDrawer({ mode: 'edit', adjustment: adj });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardDraftMut = useMutation({
    mutationFn: AdjustmentsApi.cancel,
    onSuccess: (_data, deletedId: string) => {
      toast.success('Draft deleted.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      setAdjDrawer((cur) =>
        cur?.mode === 'edit' && cur.adjustment.id === deletedId ? null : cur,
      );
      setDraftDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustmentCols: Column<StockAdjustment>[] = useMemo(
    () => [
      { header: 'Client name', accessor: (a) => a.company?.name ?? '—', width: '160px' },
      {
        header: 'Status',
        accessor: (a) => <StatusBadge status={a.status} />,
        width: '120px',
      },
      {
        header: 'Adjustment id',
        accessor: (a) => <span className="font-mono text-[11px]">{a.id}</span>,
        width: '280px',
      },
      {
        header: 'Lines',
        accessor: (a) => <span className="font-mono text-xs">{a.lines?.length ?? 0}</span>,
        width: '72px',
        className: 'text-right',
      },
      {
        header: 'Date',
        accessor: (a) => new Date(a.createdAt).toLocaleString(),
        width: '168px',
      },
      {
        header: 'Actions',
        accessor: (a) => (
          <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              data-adjustment-action-trigger="true"
              onClick={() => setOpenActionId((cur) => (cur === a.id ? null : a.id))}
              aria-label="Open actions"
              aria-expanded={openActionId === a.id}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
              </svg>
            </button>
            {openActionId === a.id ? (
              <div className="absolute right-0 top-9 z-10 min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  data-adjustment-action-menu-button="true"
                  onClick={() => {
                    setOpenActionId(null);
                    setAdjDrawer({ mode: 'edit', adjustment: a });
                  }}
                >
                  {a.status === 'draft' ? 'Edit' : 'Open'}
                </button>
                {a.status === 'draft' ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                    data-adjustment-action-menu-button="true"
                    onClick={() => {
                      setOpenActionId(null);
                      setDraftDeleteTarget(a);
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ),
        width: '120px',
      },
    ],
    [],
  );

  const adjustmentLineDetailCols: Column<StockAdjustmentLine>[] = useMemo(
    () => [
      { header: 'Product name', accessor: (l) => l.product.name, width: '200px' },
      {
        header: 'SKU',
        accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span>,
        width: '120px',
      },
      {
        header: 'Barcode',
        accessor: (l) =>
          !l.product.barcode?.trim() ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className="font-mono text-[11px]">{l.product.barcode}</span>
          ),
        width: '130px',
      },
      {
        header: 'Lot id',
        accessor: (l) => (
          <span className="font-mono text-[10px]">{l.lot?.id ?? l.lotId ?? '—'}</span>
        ),
        width: '200px',
      },
      {
        header: 'Before',
        accessor: (l) => (
          <span className="font-mono text-xs">
            {Number(l.quantityBefore).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '100px',
        className: 'text-right',
      },
      {
        header: 'After',
        accessor: (l) => (
          <span className="font-mono text-xs">
            {Number(l.quantityAfter).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
        ),
        width: '100px',
        className: 'text-right',
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Stock adjustments"
        description="One row per adjustment — click a row to see line details (product, quantities, lot). Same warehouse scope as before."
        actions={
          <Button
            disabled={!wid}
            onClick={() => wid && setAdjDrawer({ mode: 'new' })}
            className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
          >
            + New adjustment
          </Button>
        }
      />

      {!wid ? (
        <p className="mb-3 text-sm text-slate-600">Resolve warehouse configuration…</p>
      ) : null}

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Adjustment id (uuid)"
          value={draftFilters.adjustmentId}
          onChange={(e) => setDraft({ adjustmentId: e.target.value })}
          className="font-mono text-xs"
        />
        <Combobox
          label="Client"
          value={draftFilters.clientId}
          onChange={(v) => setDraft({ clientId: v })}
          options={(companies.data ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          placeholder="All clients"
        />
        <Combobox
          label="Product"
          value={draftFilters.productId}
          onChange={(v) => setDraft({ productId: v })}
          options={(productDraftOptions.data?.items ?? []).map((p) => ({
            value: p.id,
            label: `${p.sku} — ${p.name}`,
          }))}
          placeholder={draftFilters.clientId ? 'Pick product…' : 'Pick client first'}
          hint="Product list scopes to draft client selection."
          disabled={!draftFilters.clientId}
        />
        <TextField
          label="Lot id (uuid)"
          value={draftFilters.lotId}
          onChange={(e) => setDraft({ lotId: e.target.value })}
          className="font-mono text-xs"
        />
        <TextField
          label="Created from"
          type="date"
          value={draftFilters.createdFrom}
          onChange={(e) => setDraft({ createdFrom: e.target.value })}
        />
        <TextField
          label="Created to"
          type="date"
          value={draftFilters.createdTo}
          onChange={(e) => setDraft({ createdTo: e.target.value })}
        />
      </div>
      <FilterActions onApply={applyFilters} onReset={resetFilters} loading={list.isFetching} />

      <DataTable
        columns={adjustmentCols}
        rows={list.data?.items ?? []}
        rowKey={(a) => a.id}
        loading={list.isLoading || !wid}
        empty={wid ? 'No adjustments match the filters.' : 'Warehouse not resolved yet.'}
        onRowClick={(a) => setDetailAdjustment(a)}
      />

      <Modal
        open={!!detailAdjustment}
        onClose={() => setDetailAdjustment(null)}
        title={detailAdjustment ? `Lines · ${detailAdjustment.id.slice(0, 8)}…` : 'Lines'}
        widthClass="max-w-5xl"
        footer={
          <Button type="button" variant="secondary" onClick={() => setDetailAdjustment(null)}>
            Close
          </Button>
        }
      >
        {detailAdjustment ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
              <div>
                <span className="text-slate-500">Client:</span> {detailAdjustment.company?.name ?? '—'}
              </div>
              <div className="mt-1">
                <span className="text-slate-500">Status:</span> <StatusBadge status={detailAdjustment.status} />
              </div>
              <div className="mt-1 max-w-full truncate text-xs" title={detailAdjustment.reason}>
                <span className="text-slate-500">Reason:</span>{' '}
                {detailAdjustment.reason === ADJUSTMENT_REASON_PENDING ? (
                  <span className="text-slate-400 italic">(pending)</span>
                ) : (
                  detailAdjustment.reason
                )}
              </div>
            </div>
            <DataTable
              columns={adjustmentLineDetailCols}
              rows={detailAdjustment.lines ?? []}
              rowKey={(l) => l.id}
              empty="No lines on this adjustment."
            />
          </div>
        ) : null}
      </Modal>

      {adjDrawer && wid ? (
        <AdjustmentDetailDrawer
          key={adjDrawer.mode === 'new' ? 'new' : adjDrawer.adjustment.id}
          drawerState={adjDrawer}
          warehouseId={wid}
          onClose={() => setAdjDrawer(null)}
          onCreateDraft={(input) => createMut.mutate(input)}
          createDraftPending={createMut.isPending}
        />
      ) : null}

      <ConfirmModal
        open={!!draftDeleteTarget}
        title="Delete this draft?"
        confirmLabel="Delete"
        danger
        loading={discardDraftMut.isPending}
        onClose={() => !discardDraftMut.isPending && setDraftDeleteTarget(null)}
        onConfirm={() => {
          if (draftDeleteTarget) discardDraftMut.mutate(draftDeleteTarget.id);
        }}
      >
        <p className="text-sm">
          This removes draft <strong>{draftDeleteTarget?.id.slice(0, 8)}</strong> and its lines. This
          cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

function AdjustmentDetailDrawer({
  drawerState,
  warehouseId,
  onClose,
  onCreateDraft,
  createDraftPending,
}: {
  drawerState: AdjustmentDrawerState;
  warehouseId: string;
  onClose: () => void;
  onCreateDraft: (input: CreateAdjustmentInput) => void;
  createDraftPending: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = drawerState.mode === 'new';
  const id = isNew ? '' : drawerState.adjustment.id;

  const [newCompanyId, setNewCompanyId] = useState('');
  const companiesForNew = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: isNew,
    staleTime: 10 * 60_000,
  });

  const detail = useQuery({
    queryKey: [...QK.adjustments, id],
    queryFn: () => AdjustmentsApi.get(id),
    enabled: !isNew && !!id && id.length === 36,
  });

  const adj = isNew ? null : (detail.data ?? drawerState.adjustment);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    setCancelConfirmOpen(false);
  }, [drawerState]);

  const addLineMut = useMutation({
    mutationFn: ({
      adjustmentId,
      body,
    }: {
      adjustmentId: string;
      body: Parameters<typeof AdjustmentsApi.addLine>[1];
    }) => AdjustmentsApi.addLine(adjustmentId, body),
    onSuccess: () => {
      toast.success('Line added.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: AdjustmentsApi.approve,
    onSuccess: () => {
      toast.success('Adjustment approved; stock updated.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: [...QK.adjustments, id] });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: AdjustmentsApi.cancel,
    onSuccess: () => {
      toast.success('Draft deleted.');
      qc.invalidateQueries({ queryKey: QK.adjustments });
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
      qc.invalidateQueries({ queryKey: QK.ledger });
      setCancelConfirmOpen(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchReasonMut = useMutation({
    mutationFn: (reason: string) => AdjustmentsApi.patch(id, { reason }),
    onSuccess: (updated) => {
      toast.success('Reason saved.');
      qc.setQueryData([...QK.adjustments, id], updated);
      qc.invalidateQueries({ queryKey: QK.adjustments });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createDraftSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !newCompanyId.trim()) return;
    onCreateDraft({ warehouseId, companyId: newCompanyId.trim() });
  };

  if (isNew) {
    return (
      <Modal
        open
        onClose={() => !createDraftPending && onClose()}
        title="Adjustment · draft"
        widthClass="max-w-lg"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={createDraftPending}>
              Close
            </Button>
            <Button
              type="submit"
              form="adj-new-draft"
              loading={createDraftPending}
              disabled={!warehouseId || !newCompanyId.trim()}
              className="border border-[#1a7a44] bg-[#1a7a44] text-white hover:bg-[#146135]"
            >
              Create draft
            </Button>
          </div>
        }
      >
        <form
          id="adj-new-draft"
          onSubmit={createDraftSubmit}
          className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-1 text-sm"
        >
          {!warehouseId ? (
            <p className="text-sm text-rose-600">Cannot create — default warehouse not resolved.</p>
          ) : (
            <p className="text-xs text-slate-600">
              Warehouse is fixed to the default for this UI. Choose the client, then add the reason and
              lines in this same form after the draft is created.
            </p>
          )}
          <Combobox
            label="Client"
            required
            value={newCompanyId}
            onChange={setNewCompanyId}
            options={(companiesForNew.data ?? []).map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            placeholder="Select client…"
          />
        </form>
      </Modal>
    );
  }

  if (!adj) return null;

  const linesForTable = adj.lines ?? [];

  const lineCols: Column<StockAdjustmentLine>[] = [
    { header: 'SKU', accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span> },
    { header: 'Location', accessor: (l) => l.location.fullPath, width: '200px' },
    {
      header: 'Lot',
      accessor: (l) => (l.lot ? <span className="font-mono text-xs">{l.lot.lotNumber}</span> : '—'),
      width: '120px',
    },
    {
      header: 'Before → After',
      accessor: (l) => (
        <span className="font-mono text-xs">
          {Number(l.quantityBefore).toLocaleString()} → {Number(l.quantityAfter).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Adjustment · ${adj.status}`}
        widthClass="max-w-3xl"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {adj.status === 'draft' && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={cancelMut.isPending}
                >
                  Delete draft
                </Button>
                <Button
                  type="button"
                  loading={approveMut.isPending}
                  onClick={() => {
                    const r = adj.reason?.trim() ?? '';
                    if (!r || r === ADJUSTMENT_REASON_PENDING) {
                      toast.error('Enter and save an adjustment reason before approving.');
                      return;
                    }
                    approveMut.mutate(adj.id);
                  }}
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-md bg-slate-50 p-3 text-slate-700">
            <div>
              <span className="text-slate-500">Warehouse:</span> {adj.warehouse.code} —{' '}
              {adj.warehouse.name}
            </div>
            <div className="mt-1">
              <span className="text-slate-500">Client:</span> {adj.company.name}
            </div>
          </div>

          <DataTable
            columns={lineCols}
            rows={linesForTable}
            rowKey={(l) => l.id}
            empty="No lines — add targets below."
          />

          {adj.status === 'draft' && (
            <AddAdjustmentLineForm
              adjustment={adj}
              loading={addLineMut.isPending}
              patchReasonLoading={patchReasonMut.isPending}
              onSubmit={(body) => addLineMut.mutate({ adjustmentId: adj.id, body })}
              onSaveReason={(reason) => patchReasonMut.mutate(reason)}
            />
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={cancelConfirmOpen}
        title="Delete this draft?"
        confirmLabel="Delete"
        danger
        loading={cancelMut.isPending}
        onClose={() => !cancelMut.isPending && setCancelConfirmOpen(false)}
        onConfirm={() => adj.status === 'draft' && cancelMut.mutate(adj.id)}
      >
        <p className="text-sm">
          This removes draft <strong>{adj.id.slice(0, 8)}</strong> and its lines. This cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

function AddAdjustmentLineForm({
  adjustment,
  loading,
  patchReasonLoading,
  onSubmit,
  onSaveReason,
}: {
  adjustment: StockAdjustment;
  loading: boolean;
  patchReasonLoading: boolean;
  onSubmit: (b: Parameters<typeof AdjustmentsApi.addLine>[1]) => void;
  onSaveReason: (reason: string) => void;
}) {
  const toast = useToast();
  const [reasonDraft, setReasonDraft] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lotId, setLotId] = useState('');
  const [qtyAfter, setQtyAfter] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [productSearch]);

  useEffect(() => {
    setReasonDraft(
      adjustment.reason === ADJUSTMENT_REASON_PENDING ? '' : adjustment.reason,
    );
  }, [adjustment.id, adjustment.reason]);

  const products = useQuery({
    queryKey: [...QK.products, adjustment.companyId, 'adj-form', debouncedProductSearch],
    queryFn: () =>
      ProductsApi.list({
        companyId: adjustment.companyId,
        limit: 200,
        ...(debouncedProductSearch ? { search: debouncedProductSearch } : {}),
      }),
    enabled: !!adjustment.companyId,
    staleTime: 60_000,
  });

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  );

  useEffect(() => {
    setLotId('');
    setLocationId('');
  }, [productId]);

  useEffect(() => {
    setLotId('');
  }, [locationId]);

  const lots = useQuery({
    queryKey: [...QK.products, productId, 'lots'],
    queryFn: () => ProductsApi.listLots(productId),
    enabled: !!productId && productMeta?.trackingType === 'lot',
    staleTime: 60_000,
  });

  const locs = useQuery({
    queryKey: QK.locationsFlat(adjustment.warehouseId, false),
    queryFn: () => LocationsApi.list(adjustment.warehouseId),
    staleTime: 5 * 60_000,
  });

  const adjustmentLocations = useMemo(
    () => (locs.data ?? []).filter((l) => isAdjustmentStockLocationType(l.type)),
    [locs.data],
  );

  /** All buckets for this product in the warehouse (on-hand &gt; 0 on server). Used for location list + preview. */
  const stockByProduct = useQuery({
    queryKey: [
      ...QK.inventoryStock,
      'adj-line-form-stock',
      adjustment.warehouseId,
      adjustment.companyId,
      productId,
    ],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId: adjustment.warehouseId,
        companyId: adjustment.companyId,
        productId,
        limit: 500,
        offset: 0,
      }),
    enabled: !!productId,
    staleTime: 30_000,
  });

  const adjustmentLocationsWithProduct = useMemo(() => {
    const ids = new Set((stockByProduct.data?.items ?? []).map((r) => r.locationId));
    return adjustmentLocations.filter((l) => ids.has(l.id));
  }, [adjustmentLocations, stockByProduct.data?.items]);

  const validProductLocationIds = useMemo(
    () => new Set(adjustmentLocationsWithProduct.map((l) => l.id)),
    [adjustmentLocationsWithProduct],
  );

  useEffect(() => {
    if (!productId || !locationId) return;
    if (!stockByProduct.isFetched) return;
    if (!validProductLocationIds.has(locationId)) setLocationId('');
  }, [productId, locationId, stockByProduct.isFetched, validProductLocationIds]);

  const stockRow = useMemo((): StockRow | null => {
    const items = stockByProduct.data?.items ?? [];
    if (!productId || !locationId) return null;

    if (productMeta?.trackingType === 'lot') {
      if (!lotId) return null;
      return (
        items.find(
          (r) =>
            r.productId === productId &&
            r.locationId === locationId &&
            (r.lotId === lotId || r.lot?.id === lotId),
        ) ?? null
      );
    }

    return (
      items.find(
        (r) =>
          r.productId === productId &&
          r.locationId === locationId &&
          !(r.lotId ?? r.lot?.id),
      ) ??
      items.find((r) => r.productId === productId && r.locationId === locationId) ??
      null
    );
  }, [stockByProduct.data?.items, productId, locationId, lotId, productMeta?.trackingType]);

  const isLotTracked = productMeta?.trackingType === 'lot';
  const showOnHandPanel =
    !!productId && !!locationId && (!isLotTracked || !!lotId);
  const stockQtyPending = !!productId && stockByProduct.isPending;

  const quantityUom = productMeta?.uom ?? stockRow?.product?.uom ?? '—';

  const saveReason = () => {
    const r = reasonDraft.trim();
    if (r.length < 1) {
      toast.error('Reason is required before approve (min 1 character).');
      return;
    }
    if (r.length > 500) {
      toast.error('Reason must be at most 500 characters.');
      return;
    }
    onSaveReason(r);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!productMeta) return;

    const qty = Number(qtyAfter);
    const body: Parameters<typeof AdjustmentsApi.addLine>[1] = {
      productId,
      locationId,
      quantityAfter: qty,
    };

    if (productMeta.trackingType === 'lot') {
      if (!lotId) {
        toast.error('Select an existing lot (lot-tracked product).');
        return;
      }
      body.lotId = lotId;
    }

    onSubmit(body);
    setQtyAfter('');
    setLotId('');
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Adjustment details & add line
      </div>

      <div className="rounded-md bg-slate-50/80 p-3">
        <TextField
          label="Client"
          value={adjustment.company.name}
          readOnly
          disabled
          className="bg-white text-slate-700"
        />
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <TextField
            label="Reason"
            required
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            placeholder="Why is inventory changing?"
            className="min-w-[240px] flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={patchReasonLoading}
            onClick={saveReason}
          >
            Save reason
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Save a real reason before approving (drafts start with a placeholder).
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add line</div>
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Search product (name, SKU, barcode)"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Type to filter…"
            className="min-w-[200px] flex-1"
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
            Scan barcode
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Combobox
            label="Product"
            required
            value={productId}
            onChange={setProductId}
            options={(products.data?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.sku} — ${p.name}`,
              hint: p.barcode ?? undefined,
            }))}
            placeholder={products.isLoading ? 'Loading…' : 'Select product…'}
            emptyMessage="No products for this client match the search."
          />
          <Combobox
            label="Location (storage, fridge, quarantine, scrap)"
            required
            value={locationId}
            onChange={setLocationId}
            disabled={!productId || stockByProduct.isPending}
            options={adjustmentLocationsWithProduct.map((l) => ({
              value: l.id,
              label: l.fullPath,
              hint: `${l.type} · ${l.barcode}`,
            }))}
            placeholder={
              !productId
                ? 'Select product first…'
                : stockByProduct.isPending
                  ? 'Loading locations…'
                  : 'Pick location…'
            }
            emptyMessage={
              !productId
                ? 'Choose a product to see locations.'
                : 'No eligible locations hold this product (on-hand > 0). Receive stock first or pick another product.'
            }
          />
        </div>
        {productMeta?.trackingType === 'lot' && (
          <Combobox
            label="Lot (required)"
            required
            value={lotId}
            onChange={setLotId}
            options={(lots.data ?? []).map((lot) => ({
              value: lot.id,
              label: lot.lotNumber,
              hint: lot.expiryDate ? `Exp ${lot.expiryDate.slice(0, 10)}` : undefined,
            }))}
            placeholder={lots.isLoading ? 'Loading lots…' : 'Pick lot by number'}
            disabled={lots.isLoading}
            emptyMessage="No lots for this product yet — receive or create inventory first."
          />
        )}

        {showOnHandPanel ? (
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="font-medium text-slate-600">Quantity:</span>{' '}
            {stockQtyPending ? (
              <span className="text-slate-400">…</span>
            ) : stockRow ? (
              <span className="font-mono font-semibold text-slate-900">
                {(() => {
                  const n = Number(stockRow.quantityOnHand);
                  return Number.isFinite(n)
                    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : String(stockRow.quantityOnHand);
                })()}
              </span>
            ) : (
              <span className="font-mono text-slate-500">—</span>
            )}
            <span className="text-slate-500"> · </span>
            <span className="font-medium text-slate-600">UOM:</span>{' '}
            <span className="uppercase text-slate-800">{quantityUom}</span>
          </div>
        ) : productId && locationId && isLotTracked && !lotId ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Select a lot to see current on-hand for this location.
          </div>
        ) : null}

        <TextField
          label="Qty after approve"
          type="number"
          min={0}
          step={0.0001}
          required
          value={qtyAfter}
          onChange={(e) => setQtyAfter(e.target.value)}
        />
        <Button type="submit" size="sm" loading={loading}>
          Add line
        </Button>
      </form>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          setProductSearch(text.trim());
          setScanOpen(false);
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </div>
  );
}
