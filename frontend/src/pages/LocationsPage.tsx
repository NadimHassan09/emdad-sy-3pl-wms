import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { InventoryApi, StockRow } from '../api/inventory';
import { CreateLocationInput, Location, LocationTreeNode, LocationsApi, LocationType } from '../api/locations';
import { BarcodeImageModal } from '../components/BarcodeImageModal';
import { BarcodeScanIcon } from '../components/BarcodeScanIcon';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { FilterPanel } from '../components/FilterPanel';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';
import { MODAL_CANCEL_BUTTON_CLASS } from '../lib/modal-button-styles';
import { useFilters } from '../hooks/useFilters';
import { LocationsTreeTable } from '../components/locations/LocationsTreeTable';
import {
  LOCATION_TYPE_OPTIONS,
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

function locationMatchesTypeFilter(nodeType: string, typeQ: string): boolean {
  if (!typeQ) return true;
  if (nodeType === typeQ) return true;
  return typeQ === 'quarantine' && nodeType === 'qc';
}

function pruneLocationTree(
  nodes: LocationTreeNode[],
  nameQ: string,
  barcodeQ: string,
  typeQ: string,
): LocationTreeNode[] {
  const nq = nameQ.trim().toLowerCase();
  const bq = barcodeQ.trim().toLowerCase();
  const tq = typeQ.trim();
  if (!nq && !bq && !tq) return nodes;

  const nodeMatches = (node: LocationTreeNode) =>
    locationMatchesTypeFilter(node.type, tq) &&
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

type LocationDraftFilters = { name: string; barcode: string; locationType: string };

const INCLUDE_ARCHIVED_LOCATIONS = true;

export function LocationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { warehouseId } = useDefaultWarehouseId();
  const initialLocFilters = useMemo<LocationDraftFilters>(
    () => ({ name: '', barcode: '', locationType: '' }),
    [],
  );
  const { draftFilters, appliedFilters, setDraft, applyFilters, applyPatch, resetFilters } =
    useFilters(initialLocFilters);
  const [open, setOpen] = useState(false);
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
    queryKey: QK.locationsFlat(warehouseId, INCLUDE_ARCHIVED_LOCATIONS),
    queryFn: () => LocationsApi.list(warehouseId, INCLUDE_ARCHIVED_LOCATIONS),
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
    return pruneLocationTree(
      raw,
      appliedFilters.name,
      appliedFilters.barcode,
      appliedFilters.locationType,
    );
  }, [tree.data, appliedFilters.name, appliedFilters.barcode, appliedFilters.locationType]);

  const invalidateLocationQueries = () => {
    if (!warehouseId) return;
    qc.invalidateQueries({ queryKey: QK.locationsTree(warehouseId) });
    qc.invalidateQueries({ queryKey: QK.locationsFlat(warehouseId, INCLUDE_ARCHIVED_LOCATIONS) });
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
        actions={
          <Button variant="brand" disabled={!warehouseId} onClick={() => setOpen(true)}>
            + New location
          </Button>
        }
      />

      <FilterPanel
        title="Location filters"
        onApply={applyFilters}
        onReset={resetFilters}
        loading={tree.isFetching || flat.isFetching}
      >
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <TextField
          label="Location name"
          value={draftFilters.name}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder="Contains…"
          className="min-w-[12.5rem] flex-1 basis-40"
        />
        <TextField
          label="Barcode"
          value={draftFilters.barcode}
          onChange={(e) => setDraft({ barcode: e.target.value })}
          placeholder="Contains…"
          className="min-w-[10rem] flex-1 basis-32 font-mono"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-[34px] shrink-0 px-2.5"
          title="Scan a barcode with the device camera"
          aria-label="Scan barcode"
          onClick={() => setScanOpen(true)}
        >
          <BarcodeScanIcon className="h-5 w-5" />
        </Button>
        <div className="min-w-[11rem] max-w-[14rem] shrink-0">
          <SelectField
            label="Location type"
            name="locationTypeFilter"
            value={draftFilters.locationType}
            onChange={(e) => setDraft({ locationType: e.target.value })}
            options={[
              { value: '', label: 'All types' },
              ...LOCATION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
        </div>
      </div>
      </FilterPanel>

      {!warehouseId ? (
        <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Default warehouse required to load the location tree.
        </p>
      ) : tree.isLoading ? (
        <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Loading…
        </p>
      ) : filteredTree.length ? (
        <LocationsTreeTable
          roots={filteredTree}
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
      ) : tree.data?.length ? (
        <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-sm">
          No locations match the current filters.
        </p>
      ) : (
        <p className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
          No locations in this warehouse yet.
        </p>
      )}

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
  const [maxWeightKg, setMaxWeightKg] = useState('');
  const [maxCbm, setMaxCbm] = useState('');

  const reset = () => {
    setName('');
    setType('internal');
    setParentId('');
    setBarcode('');
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
      barcode: barcode.trim() || undefined,
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
          <Button
            type="button"
            variant="danger"
            className={MODAL_CANCEL_BUTTON_CLASS}
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            form="create-loc"
            type="submit"
            variant="brand"
            loading={loading}
          >
            Create
          </Button>
        </>
      }
    >
      <form id="create-loc" onSubmit={submit} className="space-y-3 pb-2">
        <Combobox
          label="Parent (optional)"
          value={parentId}
          onChange={setParentId}
          options={flatLocations.map((l) => ({ value: l.id, label: l.fullPath }))}
          placeholder="No parent (top-level)"
        />
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Combobox
          label="Type"
          required
          value={type}
          onChange={(v) => setType(v as LocationType)}
          options={TYPE_COMBO_OPTIONS}
          placeholder="Pick type…"
          dropdownInFlow
        />
        {typeHint ? <p className="text-xs text-slate-600">{typeHint}</p> : null}
        <TextField
          label="Barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="font-mono"
          hint="Leave empty to auto-generate a barcode."
        />
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
          <Button
            type="button"
            variant="danger"
            className={MODAL_CANCEL_BUTTON_CLASS}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-loc"
            variant="brand"
            loading={loading}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="edit-loc" onSubmit={submit} className="space-y-3 pb-2">
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Combobox
          label="Type"
          required
          value={type}
          onChange={(v) => setType(v as LocationType)}
          options={typeOptions}
          placeholder="Pick type…"
          dropdownInFlow
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
