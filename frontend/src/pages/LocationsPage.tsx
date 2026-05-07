import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { InventoryApi, StockRow } from '../api/inventory';
import { CreateLocationInput, Location, LocationTreeNode, LocationsApi, LocationType } from '../api/locations';
import { BarcodeImageModal } from '../components/BarcodeImageModal';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { FilterActions } from '../components/FilterActions';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { useFilters } from '../hooks/useFilters';
import {
  LOCATION_TYPE_OPTIONS,
  locationTypeLabel,
  locationTypePillClass,
  locationTypeShowsStockContents,
  locationTypeSupportsCapacityFields,
  managedTypeOptionsForEdit,
} from '../lib/location-types';

const TYPE_COMBO_OPTIONS = LOCATION_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  hint: o.hint,
}));

function parseOptionalPositiveDecimal(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function fmtQty(s: string) {
  return Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function collectSubtreeIdsFromFlat(flat: Location[], rootId: string): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const l of flat) {
    const p = l.parentId;
    const arr = byParent.get(p) ?? [];
    arr.push(l.id);
    byParent.set(p, arr);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of byParent.get(id) ?? []) stack.push(c);
  }
  return out;
}

function subtreeTouchesBlocker(flat: Location[], rootId: string, block: Set<string>): boolean {
  if (!flat.length) return false;
  return collectSubtreeIdsFromFlat(flat, rootId).some((id) => block.has(id));
}

function pruneLocationTree(nodes: LocationTreeNode[], nameQ: string, barcodeQ: string): LocationTreeNode[] {
  const nq = nameQ.trim().toLowerCase();
  const bq = barcodeQ.trim().toLowerCase();
  if (!nq && !bq) return nodes;

  const nodeMatches = (node: LocationTreeNode) =>
    (!nq || node.name.toLowerCase().includes(nq) || node.fullPath.toLowerCase().includes(nq)) &&
    (!bq || node.barcode.toLowerCase().includes(bq));

  const walk = (node: LocationTreeNode): LocationTreeNode | null => {
    if (nodeMatches(node)) {
      return { ...node, children: node.children };
    }
    const kids = node.children.map(walk).filter(Boolean) as LocationTreeNode[];
    if (kids.length) {
      return { ...node, children: kids };
    }
    return null;
  };
  return nodes.map(walk).filter(Boolean) as LocationTreeNode[];
}

type LocationDraftFilters = { name: string; barcode: string };

export function LocationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { warehouseId, isLoading: whLoading } = useDefaultWarehouseId();
  const initialLocFilters = useMemo<LocationDraftFilters>(() => ({ name: '', barcode: '' }), []);
  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
    useFilters(initialLocFilters);
  const [open, setOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [barcodeModal, setBarcodeModal] = useState<{ value: string; contextLabel: string } | null>(null);
  const [branchExpanded, setBranchExpanded] = useState<Record<string, boolean>>({});
  const [stockModal, setStockModal] = useState<LocationTreeNode | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<{
    id: string;
    fullPath: string;
    subtreeSize: number;
  } | null>(null);

  const branchIsExpanded = (id: string) => branchExpanded[id] !== false;

  const toggleBranch = (id: string) => {
    setBranchExpanded((prev) => {
      const open = prev[id] !== false;
      return { ...prev, [id]: !open };
    });
  };

  const tree = useQuery({
    queryKey: QK.locationsTree(warehouseId),
    queryFn: () => LocationsApi.tree(warehouseId),
    enabled: !!warehouseId,
  });

  const flat = useQuery({
    queryKey: QK.locationsFlat(warehouseId, includeArchived),
    queryFn: () => LocationsApi.list(warehouseId, includeArchived),
    enabled: !!warehouseId,
  });

  const purgeCtx = useQuery({
    queryKey: warehouseId ? QK.locationsPurgeContext(warehouseId) : ['locations', 'purge-context', 'none'],
    queryFn: () => LocationsApi.purgeContext(warehouseId!),
    enabled: !!warehouseId,
  });

  const flatById = useMemo(() => new Map((flat.data ?? []).map((l) => [l.id, l])), [flat.data]);

  const blockDeleteSet = useMemo(() => {
    const s = new Set<string>();
    for (const id of purgeCtx.data?.locationIdsWithStock ?? []) s.add(id);
    for (const id of purgeCtx.data?.locationIdsOnAdjustments ?? []) s.add(id);
    return s;
  }, [purgeCtx.data]);

  const filteredTree = useMemo(() => {
    const raw = tree.data ?? [];
    return pruneLocationTree(raw, appliedFilters.name, appliedFilters.barcode);
  }, [tree.data, appliedFilters.name, appliedFilters.barcode]);

  const invalidateLocationQueries = () => {
    if (!warehouseId) return;
    qc.invalidateQueries({ queryKey: QK.locationsTree(warehouseId) });
    qc.invalidateQueries({ queryKey: QK.locationsFlat(warehouseId, includeArchived) });
    qc.invalidateQueries({ queryKey: QK.locationsFlatAll(false) });
    qc.invalidateQueries({ queryKey: QK.locationsFlatAll(true) });
    qc.invalidateQueries({ queryKey: QK.locationsPurgeContext(warehouseId) });
    qc.invalidateQueries({ queryKey: QK.inventoryStock });
    qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
  };

  const createMut = useMutation({
    mutationFn: LocationsApi.create,
    onSuccess: (loc) => {
      toast.success(`Location ${loc.barcode} created.`);
      invalidateLocationQueries();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof LocationsApi.update>[1] }) =>
      LocationsApi.update(id, patch),
    onSuccess: () => {
      toast.success('Location updated.');
      invalidateLocationQueries();
      setEditLoc(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suspendLocMut = useMutation({
    mutationFn: (id: string) => LocationsApi.update(id, { status: 'blocked' }),
    onSuccess: () => {
      toast.success('Location suspended — it cannot be used for inventory moves or tasks.');
      invalidateLocationQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unsuspendLocMut = useMutation({
    mutationFn: (id: string) => LocationsApi.update(id, { status: 'active' }),
    onSuccess: () => {
      toast.success('Location reactivated.');
      invalidateLocationQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const permanentDeleteMut = useMutation({
    mutationFn: LocationsApi.permanentDelete,
    onSuccess: (res) => {
      toast.success(`Deleted ${res.deletedIds.length} location(s).`);
      invalidateLocationQueries();
      setPendingPermanentDelete(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const locActionBusy =
    suspendLocMut.isPending ||
    unsuspendLocMut.isPending ||
    permanentDeleteMut.isPending ||
    updateMut.isPending;

  return (
    <>
      <PageHeader
        title="Locations"
        description="Hierarchy for this warehouse: aisles group bins; storage, fridge, quarantine, and scrap accept putaway (with optional max weight / volume where shown). Shipping docks support delivery; packing supports packing tasks."
        actions={
          <Button disabled={!warehouseId} onClick={() => setOpen(true)}>
            + New location
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="pb-2 text-sm text-slate-600">
            {whLoading
              ? 'Loading default warehouse…'
              : warehouseId
                ? 'Locations are scoped to your default warehouse.'
                : 'No warehouse available — seed data or set VITE_DEFAULT_WAREHOUSE_ID.'}
          </p>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include archived locations in flat list / tree hides archived paths
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            label="Location name"
            value={draftFilters.name}
            onChange={(e) => setDraft({ name: e.target.value })}
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
          loading={tree.isFetching || flat.isFetching}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        {!warehouseId ? (
          <p className="text-sm text-slate-500">Default warehouse required to load the location tree.</p>
        ) : tree.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : filteredTree.length ? (
          <ul className="space-y-0">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                flatList={flat.data ?? []}
                purgeReady={purgeCtx.isSuccess}
                blockDeleteSet={blockDeleteSet}
                branchIsExpanded={branchIsExpanded}
                onToggleBranch={toggleBranch}
                resolve={(id) => flatById.get(id)}
                onEdit={(loc) => setEditLoc(loc)}
                onBarcodeClick={(barcode, contextLabel) => setBarcodeModal({ value: barcode, contextLabel })}
                onStockTypeClick={(n) => setStockModal(n)}
                actionBusy={locActionBusy}
                onSuspend={(id) => suspendLocMut.mutate(id)}
                onUnsuspend={(id) => unsuspendLocMut.mutate(id)}
                onRequestPermanentDelete={(id, fullPath, subtreeSize) =>
                  setPendingPermanentDelete({ id, fullPath, subtreeSize })
                }
              />
            ))}
          </ul>
        ) : tree.data?.length ? (
          <p className="text-sm text-slate-600">No locations match the current filters.</p>
        ) : (
          <p className="text-sm text-slate-500">No locations in this warehouse yet.</p>
        )}
      </div>

      <BarcodeImageModal
        open={!!barcodeModal}
        onClose={() => setBarcodeModal(null)}
        value={barcodeModal?.value ?? ''}
        contextLabel={barcodeModal?.contextLabel}
      />

      <LocationStockModal
        open={!!stockModal}
        node={stockModal}
        warehouseId={warehouseId}
        onClose={() => setStockModal(null)}
      />

      <CreateLocationModal
        open={open}
        onClose={() => setOpen(false)}
        loading={createMut.isPending}
        warehouseId={warehouseId}
        flatLocations={flat.data ?? []}
        onSubmit={(input) => createMut.mutate(input)}
      />

      <EditLocationModal
        open={!!editLoc}
        location={editLoc}
        loading={updateMut.isPending}
        onClose={() => setEditLoc(null)}
        onSubmit={(patch) => editLoc && updateMut.mutate({ id: editLoc.id, patch })}
      />

      <ConfirmModal
        open={!!pendingPermanentDelete}
        title="Delete location subtree?"
        danger
        confirmLabel="Delete permanently"
        loading={permanentDeleteMut.isPending}
        onClose={() => !permanentDeleteMut.isPending && setPendingPermanentDelete(null)}
        onConfirm={() => {
          if (pendingPermanentDelete) {
            permanentDeleteMut.mutate(pendingPermanentDelete.id);
          }
        }}
      >
        {pendingPermanentDelete ? (
          <>
            <p>
              This will permanently remove <strong>{pendingPermanentDelete.fullPath}</strong> and{' '}
              <strong>{pendingPermanentDelete.subtreeSize}</strong> location record(s) in this subtree
              (children first). Stock rows must be empty and adjustment lines must not reference any of
              these locations.
            </p>
            <p className="mt-2">This cannot be undone.</p>
          </>
        ) : null}
      </ConfirmModal>

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

function TreeNode({
  node,
  depth,
  flatList,
  purgeReady,
  blockDeleteSet,
  branchIsExpanded,
  onToggleBranch,
  resolve,
  onEdit,
  onBarcodeClick,
  onStockTypeClick,
  actionBusy,
  onSuspend,
  onUnsuspend,
  onRequestPermanentDelete,
}: {
  node: LocationTreeNode;
  depth: number;
  flatList: Location[];
  purgeReady: boolean;
  blockDeleteSet: Set<string>;
  branchIsExpanded: (id: string) => boolean;
  onToggleBranch: (id: string) => void;
  resolve: (id: string) => Location | undefined;
  onEdit: (l: Location) => void;
  onBarcodeClick: (barcode: string, contextLabel: string) => void;
  onStockTypeClick: (n: LocationTreeNode) => void;
  actionBusy: boolean;
  onSuspend: (id: string) => void;
  onUnsuspend: (id: string) => void;
  onRequestPermanentDelete: (id: string, fullPath: string, subtreeSize: number) => void;
}) {
  const full = resolve(node.id);
  const children = node.children;
  const hasChildren = children.length > 0;
  const expanded = branchIsExpanded(node.id);
  const typeHint = LOCATION_TYPE_OPTIONS.find((o) => o.value === node.type)?.hint ?? node.type;
  const stockInteractive = locationTypeShowsStockContents(node.type);

  const subtreeIds = useMemo(() => collectSubtreeIdsFromFlat(flatList, node.id), [flatList, node.id]);
  const canPermanentDelete =
    purgeReady &&
    full &&
    full.status !== 'archived' &&
    flatList.length > 0 &&
    !subtreeTouchesBlocker(flatList, node.id, blockDeleteSet);

  const typePillClass = `inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${locationTypePillClass(node.type)}`;

  return (
    <li className="list-none">
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold text-slate-900">{node.name}</div>
              {full?.status === 'blocked' ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 ring-1 ring-amber-200">
                  Suspended
                </span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500">{node.fullPath}</div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {stockInteractive ? (
                <button
                  type="button"
                  className={`${typePillClass} cursor-pointer hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1`}
                  title={`${typeHint} — click to view stock`}
                  onClick={() => onStockTypeClick(node)}
                >
                  {locationTypeLabel(node.type)}
                </button>
              ) : (
                <span className={typePillClass} title={typeHint}>
                  {locationTypeLabel(node.type)}
                </span>
              )}
              <button
                type="button"
                className="max-w-full truncate rounded bg-white px-2 py-0.5 text-left font-mono text-xs text-primary-700 underline decoration-primary-300 underline-offset-2 ring-1 ring-slate-200 hover:bg-primary-50 hover:text-primary-900"
                title="View barcode image"
                onClick={() => onBarcodeClick(node.barcode, node.fullPath)}
              >
                {node.barcode}
              </button>
            </div>
            {hasChildren ? (
              <div className="pt-2">
                <button
                  type="button"
                  className="text-xs font-medium text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-900"
                  onClick={() => onToggleBranch(node.id)}
                >
                  {expanded ? 'Show less' : 'Show more'} ({children.length}{' '}
                  {children.length === 1 ? 'child' : 'children'})
                </button>
              </div>
            ) : null}
          </div>
          {full ? (
            <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
              <Button size="sm" variant="secondary" disabled={actionBusy} onClick={() => onEdit(full)}>
                Edit
              </Button>
              {full.status === 'active' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionBusy}
                  onClick={() => onSuspend(full.id)}
                >
                  Suspend
                </Button>
              ) : null}
              {full.status === 'blocked' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionBusy}
                  onClick={() => onUnsuspend(full.id)}
                >
                  Unsuspend
                </Button>
              ) : null}
              {canPermanentDelete ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-rose-700 ring-rose-200 hover:bg-rose-50"
                  disabled={actionBusy}
                  title="Permanently delete this location and all descendants"
                  onClick={() => onRequestPermanentDelete(node.id, node.fullPath, subtreeIds.length)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {hasChildren && expanded ? (
        <ul className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
          {children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              flatList={flatList}
              purgeReady={purgeReady}
              blockDeleteSet={blockDeleteSet}
              branchIsExpanded={branchIsExpanded}
              onToggleBranch={onToggleBranch}
              resolve={resolve}
              onEdit={onEdit}
              onBarcodeClick={onBarcodeClick}
              onStockTypeClick={onStockTypeClick}
              actionBusy={actionBusy}
              onSuspend={onSuspend}
              onUnsuspend={onUnsuspend}
              onRequestPermanentDelete={onRequestPermanentDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function LocationStockModal({
  open,
  onClose,
  warehouseId,
  node,
}: {
  open: boolean;
  onClose: () => void;
  warehouseId: string | undefined;
  node: LocationTreeNode | null;
}) {
  const stock = useQuery({
    queryKey: node && warehouseId ? QK.inventoryStockByLocation(node.id, warehouseId) : ['inventory', 'stock', 'location', 'none'],
    queryFn: () =>
      InventoryApi.stock({
        locationId: node!.id,
        warehouseId: warehouseId!,
        limit: 500,
      }),
    enabled: open && !!node && !!warehouseId,
  });

  const rows = stock.data?.items ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={node ? `Stock · ${node.fullPath}` : 'Stock'}
      widthClass="max-w-3xl"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!node || !warehouseId ? (
        <p className="text-sm text-slate-500">Missing warehouse or location.</p>
      ) : stock.isLoading ? (
        <p className="text-sm text-slate-500">Loading stock…</p>
      ) : stock.isError ? (
        <p className="text-sm text-rose-600">{(stock.error as Error)?.message ?? 'Could not load stock.'}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600">No stock rows at this location.</p>
      ) : (
        <div className="max-h-[min(60vh,28rem)] overflow-auto rounded border border-slate-200">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2">Product</th>
                <th className="border-b border-slate-200 px-3 py-2">SKU</th>
                <th className="border-b border-slate-200 px-3 py-2">Lot</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">Available</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: StockRow) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                  <td className="px-3 py-2 text-slate-900">{r.product.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.product.sku}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.lot?.lotNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {fmtQty(r.quantityAvailable)} <span className="text-slate-500">{r.product.uom}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {fmtQty(r.quantityOnHand)} <span className="text-slate-500">{r.product.uom}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

interface CreateLocationModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  warehouseId: string;
  flatLocations: { id: string; fullPath: string }[];
  onSubmit: (input: CreateLocationInput) => void;
}

function CreateLocationModal({
  open,
  onClose,
  loading,
  warehouseId,
  flatLocations,
  onSubmit,
}: CreateLocationModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('internal');
  const [parentId, setParentId] = useState('');
  const [barcode, setBarcode] = useState('');
  const [autoBarcode, setAutoBarcode] = useState(true);
  const [maxWeightKg, setMaxWeightKg] = useState('');
  const [maxCbm, setMaxCbm] = useState('');

  const reset = () => {
    setName('');
    setType('internal');
    setParentId('');
    setBarcode('');
    setAutoBarcode(true);
    setMaxWeightKg('');
    setMaxCbm('');
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cap = locationTypeSupportsCapacityFields(type);
    onSubmit({
      warehouseId,
      parentId: parentId || undefined,
      name,
      type,
      barcode: autoBarcode ? undefined : barcode.trim() || undefined,
      maxWeightKg: cap ? parseOptionalPositiveDecimal(maxWeightKg) : undefined,
      maxCbm: cap ? parseOptionalPositiveDecimal(maxCbm) : undefined,
    });
  };

  const typeHint = LOCATION_TYPE_OPTIONS.find((o) => o.value === type)?.hint;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New location"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button form="create-loc" type="submit" loading={loading}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-loc" onSubmit={submit} className="space-y-3">
        <Combobox
          label="Parent (optional)"
          value={parentId}
          onChange={setParentId}
          options={flatLocations.map((l) => ({ value: l.id, label: l.fullPath }))}
          placeholder="No parent (top-level)"
        />
        <TextField
          label="Receiving dock"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Display name for this node (aisle, bin, dock, etc.)."
        />
        <Combobox
          label="Type"
          required
          value={type}
          onChange={(v) => setType(v as LocationType)}
          options={TYPE_COMBO_OPTIONS}
          placeholder="Pick type…"
        />
        {typeHint ? <p className="text-xs text-slate-600">{typeHint}</p> : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoBarcode}
            onChange={(e) => setAutoBarcode(e.target.checked)}
          />
          Auto-generate barcode (recommended).
        </label>
        {!autoBarcode && (
          <TextField label="Barcode" required value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        )}
        {locationTypeSupportsCapacityFields(type) ? (
          <>
            <TextField
              label="Max weight (kg, optional)"
              value={maxWeightKg}
              onChange={(e) => setMaxWeightKg(e.target.value)}
              inputMode="decimal"
            />
            <TextField
              label="Max volume (CBM, optional)"
              hint="Cubic meters — overall size limit for this bin."
              value={maxCbm}
              onChange={(e) => setMaxCbm(e.target.value)}
              inputMode="decimal"
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}

function EditLocationModal({
  open,
  location,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  location: Location | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (patch: Parameters<typeof LocationsApi.update>[1]) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('internal');
  const [barcode, setBarcode] = useState('');
  const [maxWeightKg, setMaxWeightKg] = useState('');
  const [maxCbm, setMaxCbm] = useState('');

  useEffect(() => {
    if (location) {
      setName(location.name);
      setType((location.type === 'qc' ? 'quarantine' : location.type) as LocationType);
      setBarcode(location.barcode);
      setMaxWeightKg(
        location.maxWeightKg != null && location.maxWeightKg !== '' ? String(location.maxWeightKg) : '',
      );
      setMaxCbm(location.maxCbm != null && location.maxCbm !== '' ? String(location.maxCbm) : '');
    }
  }, [location]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cap = locationTypeSupportsCapacityFields(type);
    const w = cap ? parseOptionalPositiveDecimal(maxWeightKg) : undefined;
    const v = cap ? parseOptionalPositiveDecimal(maxCbm) : undefined;
    onSubmit({
      name,
      type,
      barcode: barcode.trim(),
      ...(cap ? { maxWeightKg: w, maxCbm: v } : {}),
    });
  };

  if (!location) return null;

  const typeOptions = managedTypeOptionsForEdit(location.type).map((o) => ({
    value: o.value,
    label: o.label,
    hint: o.hint,
  }));
  const typeHint = typeOptions.find((o) => o.value === type)?.hint;

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={`Edit ${location.fullPath}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="edit-loc" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-loc" onSubmit={submit} className="space-y-3">
        <TextField
          label="Receiving dock"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Display name for this node (aisle, bin, dock, etc.)."
        />
        <Combobox
          label="Type"
          required
          value={type}
          onChange={(v) => setType(v as LocationType)}
          options={typeOptions}
          placeholder="Pick type…"
        />
        {typeHint ? <p className="text-xs text-slate-600">{typeHint}</p> : null}
        <TextField label="Barcode" required value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        {locationTypeSupportsCapacityFields(type) ? (
          <>
            <TextField
              label="Max weight (kg, optional)"
              value={maxWeightKg}
              onChange={(e) => setMaxWeightKg(e.target.value)}
              inputMode="decimal"
            />
            <TextField
              label="Max volume (CBM, optional)"
              hint="Cubic meters — overall size limit for this bin."
              value={maxCbm}
              onChange={(e) => setMaxCbm(e.target.value)}
              inputMode="decimal"
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}
