import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, ComponentPropsWithoutRef, useEffect, useMemo, useRef, useState } from 'react';

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

/** Rounded-square icon styling per location type (matches pill semantics). */
function locationTypeIconBoxClass(type: string): string {
  switch (type) {
    case 'iss':
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80';
    case 'internal':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80';
    case 'fridge':
      return 'bg-sky-100 text-sky-800 ring-1 ring-sky-200/80';
    case 'packing':
      return 'bg-violet-100 text-violet-800 ring-1 ring-violet-200/80';
    case 'output':
      return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200/80';
    case 'quarantine':
      return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80';
    case 'scrap':
      return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200/80';
    default:
      return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/80';
  }
}

function LocationTypeGlyph({ type }: { type: string }) {
  switch (type) {
    case 'iss':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 14V6l6-3 6 3v8l-6 3-6-3Z" />
          <path d="M10 11V3.5M4 6v8M16 6v8" />
        </svg>
      );
    case 'internal':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 7h12v10H4V7ZM7 7V5a3 3 0 016 0v2" />
        </svg>
      );
    case 'fridge':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M7 4h8v13H7V4Z" />
          <path d="M9 7v8M13 9v5" />
        </svg>
      );
    case 'packing':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 10l8 4 8-4M7 14l5 3 5-3" strokeLinecap="round" />
        </svg>
      );
    case 'output':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M13 17H4V7h12v5" />
          <path d="M15 13h4l-4-4v8l4-4h-4" />
        </svg>
      );
    case 'quarantine':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M10 4 4 17h12L10 4Z" />
          <path d="M10 9v5M10 15h0" strokeLinecap="round" />
        </svg>
      );
    case 'scrap':
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M8 8V6h4v2" />
          <path d="M6 8h8l1 11H5L6 8Z" />
          <path d="M7 11h6M10 13v5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M10 4a6 6 0 0 1 6 6c0 4-6 8-6 8S4 14 4 10a6 6 0 0 1 6-6Z" />
          <circle cx="10" cy="10" r="2.25" />
        </svg>
      );
  }
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
          <ul className="space-y-2">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
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

function LocationRowMenuItem({
  className = '',
  danger,
  ...rest
}: ComponentPropsWithoutRef<'button'> & { danger?: boolean }) {
  const base =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const dc = danger ? 'text-rose-800 hover:bg-rose-50' : '';
  return <button type="button" className={`${base} ${dc} ${className}`.trim()} {...rest} />;
}

function TreeNode({
  node,
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

  const typeIconTitle = `${locationTypeLabel(node.type)} · ${typeHint}`;

  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <li className="list-none">
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-2 shadow-sm sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* Expand / spacer */}
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse branch' : 'Expand branch'}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
              onClick={() => onToggleBranch(node.id)}
            >
              <svg
                viewBox="0 0 20 20"
                className={`h-5 w-5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 4 13 10 7 16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div className="w-9 shrink-0" aria-hidden />
          )}

          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${locationTypeIconBoxClass(node.type)}`}
            title={typeIconTitle}
          >
            <LocationTypeGlyph type={node.type} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate text-base font-semibold text-slate-900">{node.name}</span>
              {full?.status === 'blocked' ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 ring-1 ring-amber-200">
                  Suspended
                </span>
              ) : null}
            </div>
            <div className="truncate font-mono text-[11px] text-slate-500" title={`${node.fullPath} · ${node.barcode}`}>
              <span className="text-slate-400">{node.fullPath}</span>
              <span className="text-slate-300"> · </span>
              <span>{node.barcode}</span>
            </div>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Location actions"
              disabled={actionBusy}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40`}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <circle cx="10" cy="4" r="1.85" />
                <circle cx="10" cy="10" r="1.85" />
                <circle cx="10" cy="16" r="1.85" />
              </svg>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[13.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                <LocationRowMenuItem
                  role="menuitem"
                  className="bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100"
                  disabled={actionBusy}
                  onClick={() => {
                    closeMenu();
                    onBarcodeClick(node.barcode, node.fullPath);
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-200/80 text-indigo-950">
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 14V6l2 .5 2-.5 2 .5 2-.5 2 .5 2-.5v8l-2-.5-2 .5-2-.5-2 .5-2-.5L4 14Z" />
                      <path d="M9 17V3M13 17V7" strokeLinecap="round" />
                    </svg>
                  </span>
                  Barcode image
                </LocationRowMenuItem>

                {stockInteractive ? (
                  <LocationRowMenuItem
                    role="menuitem"
                    className="bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100"
                    disabled={actionBusy}
                    onClick={() => {
                      closeMenu();
                      onStockTypeClick(node);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-200/80 text-emerald-950">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M10 15V5m-6 9V6l6-4 6 4v8" />
                        <path d="M4 13l6 3 6-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Current stock
                  </LocationRowMenuItem>
                ) : null}

                {full ? (
                  <LocationRowMenuItem
                    role="menuitem"
                    className="bg-sky-50/85 text-sky-950 hover:bg-sky-100"
                    disabled={actionBusy}
                    onClick={() => {
                      closeMenu();
                      onEdit(full);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-200/80 text-sky-950">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.85">
                        <path d="M14 5 15 15H5m7-13H7a2 2 0 0 0-2 2v9" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="m11 3 6 6" strokeLinecap="round" />
                      </svg>
                    </span>
                    Edit location
                  </LocationRowMenuItem>
                ) : null}

                {(full?.status === 'active' ||
                  full?.status === 'blocked' ||
                  canPermanentDelete) && (
                  <div className="my-1 border-t border-slate-100" role="presentation" />
                )}

                {full?.status === 'active' ? (
                  <LocationRowMenuItem
                    role="menuitem"
                    className="bg-amber-50/80 text-amber-950 hover:bg-amber-100"
                    disabled={actionBusy}
                    onClick={() => {
                      closeMenu();
                      onSuspend(full.id);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-200/80 text-amber-950">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                        <rect x="5" y="4" width="3.5" height="12" rx="1" />
                        <rect x="11.5" y="4" width="3.5" height="12" rx="1" />
                      </svg>
                    </span>
                    Suspend
                  </LocationRowMenuItem>
                ) : null}

                {full?.status === 'blocked' ? (
                  <LocationRowMenuItem
                    role="menuitem"
                    className="bg-teal-50/85 text-teal-950 hover:bg-teal-100"
                    disabled={actionBusy}
                    onClick={() => {
                      closeMenu();
                      onUnsuspend(full.id);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-200/80 text-teal-950">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                        <path d="M9 14V6l8 4-8 4Z" />
                      </svg>
                    </span>
                    Unsuspend
                  </LocationRowMenuItem>
                ) : null}

                {canPermanentDelete ? (
                  <LocationRowMenuItem
                    danger
                    role="menuitem"
                    className="text-rose-800 hover:bg-rose-50"
                    disabled={actionBusy}
                    title="Permanently delete this location and all descendants"
                    onClick={() => {
                      closeMenu();
                      onRequestPermanentDelete(node.id, node.fullPath, subtreeIds.length);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-200/85 text-rose-950">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.85">
                        <path d="M8 9v5m4-5v5M6 16h8l1-13H5l1 13Z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Delete permanently
                  </LocationRowMenuItem>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasChildren && expanded ? (
        <ul className="mt-2 space-y-2 border-l border-slate-200/90 pl-2 sm:mt-3 sm:space-y-3 sm:border-l-2 sm:pl-4">
          {children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
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
