import { ComponentPropsWithoutRef, useEffect, useMemo, useState } from 'react';

import type { Location, LocationTreeNode } from '../../api/locations';
import {
  LOCATION_TYPE_OPTIONS,
  locationTypeLabel,
  locationTypePillClass,
  locationTypeShowsStockContents,
} from '../../lib/location-types';
import { AnchoredDropdown } from '../AnchoredDropdown';

const COL_COUNT = 8;

const TH_CLASS =
  'whitespace-nowrap bg-slate-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const TD_CLASS = 'px-3 py-3 align-middle text-sm text-slate-700';

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

function LocationStatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : status === 'blocked'
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : status === 'archived'
          ? 'bg-slate-100 text-slate-600 ring-slate-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200';
  const label =
    status === 'blocked' ? 'Suspended' : status === 'archived' ? 'Archived' : status;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function LocationRowMenuItem({
  className = '',
  danger,
  ...rest
}: ComponentPropsWithoutRef<'button'> & { danger?: boolean }) {
  const base =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const dc = danger ? 'text-rose-800 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50';
  return <button type="button" className={`${base} ${dc} ${className}`.trim()} {...rest} />;
}

function LocationTableRow({
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
  openActionId,
  setOpenActionId,
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
  openActionId: string | null;
  setOpenActionId: (id: string | null) => void;
}) {
  const full = resolve(node.id);
  const children = node.children;
  const hasChildren = children.length > 0;
  const expanded = branchIsExpanded(node.id);
  const stockInteractive = locationTypeShowsStockContents(node.type);
  const menuOpen = openActionId === node.id;

  const subtreeIds = useMemo(() => collectSubtreeIdsFromFlat(flatList, node.id), [flatList, node.id]);
  const canPermanentDelete =
    purgeReady &&
    full &&
    full.status !== 'archived' &&
    flatList.length > 0 &&
    !subtreeTouchesBlocker(flatList, node.id, blockDeleteSet);

  const capacity =
    full && (full.maxWeightKg != null || full.maxCbm != null)
      ? [
          full.maxWeightKg != null && full.maxWeightKg !== '' ? `${full.maxWeightKg} kg` : null,
          full.maxCbm != null && full.maxCbm !== '' ? `${full.maxCbm} m³` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '—';

  return (
    <>
      <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/80">
        <td className={`${TD_CLASS} w-10`}>
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse branch' : 'Expand branch'}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
              onClick={() => onToggleBranch(node.id)}
            >
              <svg
                viewBox="0 0 20 20"
                className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 4 13 10 7 16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="inline-block h-8 w-8" aria-hidden />
          )}
        </td>
        <td className={`${TD_CLASS} min-w-[10rem] font-medium text-slate-900`}>{node.name}</td>
        <td className={TD_CLASS}>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${locationTypePillClass(node.type)}`}
            title={LOCATION_TYPE_OPTIONS.find((o) => o.value === node.type)?.hint}
          >
            {locationTypeLabel(node.type)}
          </span>
        </td>
        <td className={`${TD_CLASS} max-w-[14rem] truncate text-slate-600`} title={node.fullPath}>
          {node.fullPath}
        </td>
        <td className={`${TD_CLASS} font-mono text-xs text-slate-800`}>{node.barcode}</td>
        <td className={TD_CLASS}>
          {full ? <LocationStatusPill status={full.status} /> : <span className="text-slate-400">—</span>}
        </td>
        <td className={`${TD_CLASS} hidden text-xs text-slate-500 lg:table-cell`} title="Max weight / volume">
          {capacity}
        </td>
        <td className={`${TD_CLASS} w-[4.5rem] text-right`}>
          <div className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
            <AnchoredDropdown
              open={menuOpen}
              align="end"
              menuRootProps={{ 'data-location-action-menu': 'true' }}
              trigger={
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Location actions"
                  disabled={actionBusy}
                  data-location-action-trigger="true"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                  onClick={() => setOpenActionId(menuOpen ? null : node.id)}
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
                    <path d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 8.5 10ZM13 10a1.5 1.5 0 1 1 3.001 0A1.5 1.5 0 0 1 13 10Z" />
                  </svg>
                </button>
              }
            >
              <LocationRowMenuItem
                disabled={actionBusy}
                onClick={() => {
                  setOpenActionId(null);
                  onBarcodeClick(node.barcode, node.fullPath);
                }}
              >
                Barcode image
              </LocationRowMenuItem>
              {stockInteractive ? (
                <LocationRowMenuItem
                  disabled={actionBusy}
                  onClick={() => {
                    setOpenActionId(null);
                    onStockTypeClick(node);
                  }}
                >
                  Current stock
                </LocationRowMenuItem>
              ) : null}
              {full ? (
                <LocationRowMenuItem
                  disabled={actionBusy}
                  onClick={() => {
                    setOpenActionId(null);
                    onEdit(full);
                  }}
                >
                  Edit location
                </LocationRowMenuItem>
              ) : null}
              {full?.status === 'active' ? (
                <LocationRowMenuItem
                  disabled={actionBusy}
                  onClick={() => {
                    setOpenActionId(null);
                    onSuspend(full.id);
                  }}
                >
                  Suspend
                </LocationRowMenuItem>
              ) : null}
              {full?.status === 'blocked' ? (
                <LocationRowMenuItem
                  disabled={actionBusy}
                  onClick={() => {
                    setOpenActionId(null);
                    onUnsuspend(full.id);
                  }}
                >
                  Unsuspend
                </LocationRowMenuItem>
              ) : null}
              {canPermanentDelete ? (
                <LocationRowMenuItem
                  danger
                  disabled={actionBusy}
                  onClick={() => {
                    setOpenActionId(null);
                    onRequestPermanentDelete(node.id, node.fullPath, subtreeIds.length);
                  }}
                >
                  Delete permanently
                </LocationRowMenuItem>
              ) : null}
            </AnchoredDropdown>
          </div>
        </td>
      </tr>

      {hasChildren && expanded ? (
        <tr className="border-t border-slate-100 bg-slate-50/60">
          <td colSpan={COL_COUNT} className="p-0">
            <div className="border-t border-slate-100/80 px-2 py-2 sm:px-4 sm:py-3">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Child locations
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={`${TH_CLASS} w-10`} aria-hidden />
                      <th className={TH_CLASS}>Location</th>
                      <th className={TH_CLASS}>Type</th>
                      <th className={TH_CLASS}>Path</th>
                      <th className={TH_CLASS}>Barcode</th>
                      <th className={TH_CLASS}>Status</th>
                      <th className={`${TH_CLASS} hidden lg:table-cell`}>Capacity</th>
                      <th className={`${TH_CLASS} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((child) => (
                      <LocationTableRow
                        key={child.id}
                        node={child}
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
                        openActionId={openActionId}
                        setOpenActionId={setOpenActionId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function LocationsTreeTable({
  roots,
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
  roots: LocationTreeNode[];
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
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const totalRows = roots.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  useEffect(() => {
    setPage(1);
  }, [roots]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRoots = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return roots.slice(start, start + rowsPerPage);
  }, [roots, page, rowsPerPage]);

  const startDisplay = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endDisplay = totalRows === 0 ? 0 : Math.min(page * rowsPerPage, totalRows);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-location-action-trigger="true"]') ||
        target.closest('[data-location-action-menu="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  return (
    <div className="overflow-visible rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${TH_CLASS} w-10`} aria-hidden />
              <th className={TH_CLASS}>Location</th>
              <th className={TH_CLASS}>Type</th>
              <th className={TH_CLASS}>Path</th>
              <th className={TH_CLASS}>Barcode</th>
              <th className={TH_CLASS}>Status</th>
              <th className={`${TH_CLASS} hidden lg:table-cell`}>Capacity</th>
              <th className={`${TH_CLASS} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedRoots.map((node) => (
              <LocationTableRow
                key={node.id}
                node={node}
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
                openActionId={openActionId}
                setOpenActionId={setOpenActionId}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="relative z-0 flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <select
            aria-label="Rows per page"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-600">
            {startDisplay}-{endDisplay} of {totalRows} locations
          </span>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <button
            type="button"
            className="flex-1 rounded-md border border-[#10B981] bg-white px-3 py-1.5 text-sm font-medium text-[#10B981] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:flex-none"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || totalRows === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="flex-1 rounded-md border border-[#10B981] bg-[#10B981] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 sm:flex-none"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || totalRows === 0}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
