import type { OutboundOrderLine } from '../../../api/outbound';
import type { Location } from '../../../api/locations';
import {
  matchesTaskLineSearch,
  type TaskLineFilters,
} from '../../../lib/task-line-filters';

import type {
  DispatchExecutionDraft,
  DispatchLineDraft,
  DispatchPackageDraft,
  DispatchReadiness,
  DispatchScanStep,
  DispatchSummary,
} from './dispatch-types';
import { locationDisplay, matchLocationByScan, parseQty } from '../putaway/putaway-utils';

export function readDispatchDraft(raw: unknown): DispatchExecutionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const d = r.dispatch_draft ?? r.dispatchDraft;
  if (!d || typeof d !== 'object') return null;
  return d as DispatchExecutionDraft;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Pick task drop-off (packing or delivery area) stored on `pick_draft.packingDestinationId`. */
export function readPickDraftPackingDestinationId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const d = raw.pick_draft ?? raw.pickDraft;
  if (!isRecord(d)) return null;
  const id = d.packingDestinationId ?? d.packing_destination_id;
  return typeof id === 'string' && id.trim() ? id : null;
}

export function findLocationById(
  locations: Location[],
  locationId: string | null | undefined,
): Location | undefined {
  if (!locationId?.trim()) return undefined;
  return locations.find((l) => l.id === locationId);
}

function isKnownLocationId(locations: Location[], locationId: string | null | undefined): boolean {
  return !!findLocationById(locations, locationId);
}

function isSelectableLocation(loc: Location): boolean {
  return loc.status !== 'blocked' && loc.status !== 'archived';
}

/** Read `execution_state` from a task row (timeline detail, GET /tasks/:id, etc.). */
export function readTaskExecutionState(task: unknown): unknown {
  if (!isRecord(task)) return undefined;
  return task.executionState ?? task.execution_state;
}

export function findWorkflowTimelineTask(
  tasks: unknown[] | undefined,
  taskType: string,
  preferStatuses: string[] = ['completed', 'in_progress'],
): unknown {
  if (!tasks?.length) return undefined;
  for (const status of preferStatuses) {
    const hit = tasks.find((t) => {
      if (!isRecord(t)) return false;
      return t.taskType === taskType && t.status === status;
    });
    if (hit) return hit;
  }
  return tasks.find((t) => isRecord(t) && t.taskType === taskType);
}

/** Pack task packing station when recorded on `pack_draft.packingStationId`. */
export function readPackDraftPackingStationId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const d = raw.pack_draft ?? raw.packDraft;
  if (!isRecord(d)) return null;
  const id = d.packingStationId ?? d.packing_station_id;
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Dispatch source = pack task station when packing applies, otherwise pick drop-off.
 * Falls back to pick drop-off when pack station was not saved.
 */
export function resolveDispatchSourceLocationId(
  requiresPacking: boolean,
  packExecutionState: unknown,
  pickExecutionState: unknown,
  allLocations: Location[],
  savedSourceId?: string | null,
): string | null {
  if (isKnownLocationId(allLocations, savedSourceId)) return savedSourceId!.trim();

  const pickDest = readPickDraftPackingDestinationId(pickExecutionState);
  const packStation = readPackDraftPackingStationId(packExecutionState);

  if (requiresPacking) {
    if (isKnownLocationId(allLocations, packStation)) return packStation!.trim();
    if (isKnownLocationId(allLocations, pickDest)) return pickDest!.trim();
    const packingLocs = allLocations.filter((l) => l.type === 'packing' && isSelectableLocation(l));
    if (packingLocs.length === 1) return packingLocs[0]!.id;
    return null;
  }
  if (isKnownLocationId(allLocations, pickDest)) return pickDest!.trim();
  const deliveryLocs = eligibleDispatchDockLocations(allLocations);
  if (deliveryLocs.length === 1) return deliveryLocs[0]!.id;
  return null;
}

export function dispatchSourceLocationHint(requiresPacking: boolean): string {
  return requiresPacking
    ? 'Selected by the system from the pack task (or pick drop-off if no pack station was recorded).'
    : 'Selected by the system from the pick task drop-off location.';
}

/** Active shipping docks (`output`) available for the dispatch location queue. */
export function eligibleDispatchDockLocations(locations: Location[]): Location[] {
  return locations
    .filter((l) => l.type === 'output' && isSelectableLocation(l))
    .sort((a, b) => a.fullPath.localeCompare(b.fullPath) || a.name.localeCompare(b.name));
}

export function readDispatchDraftDestinationId(raw: unknown): string | null {
  const draft = readDispatchDraft(raw);
  const id = draft?.destinationLocationId;
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Assign a dispatch dock from the warehouse queue: round-robin across eligible output
 * locations using this task's position among active dispatch tasks.
 */
export function resolveDispatchDestinationFromQueue(
  allLocations: Location[],
  taskId: string,
  activeDispatchTaskIds: string[],
  savedDestinationId?: string | null,
): string | null {
  const docks = eligibleDispatchDockLocations(allLocations);
  if (docks.length === 0) return null;
  if (savedDestinationId && docks.some((d) => d.id === savedDestinationId)) {
    return savedDestinationId;
  }
  const sortedTasks = [...new Set([...activeDispatchTaskIds, taskId])].sort();
  const queueIndex = sortedTasks.indexOf(taskId);
  return docks[queueIndex >= 0 ? queueIndex % docks.length : 0]!.id;
}

export function dispatchDestinationLocationHint(): string {
  return 'Selected by the system from the dispatch dock queue (round-robin across shipping docks).';
}

export function readPackDraftPackages(raw: unknown): DispatchPackageDraft[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const d = r.pack_draft ?? r.packDraft;
  if (!d || typeof d !== 'object') return null;
  const p = d as { packages?: Array<{ id: string; label: string; weightKg?: string; items?: unknown[] }> };
  if (!Array.isArray(p.packages) || p.packages.length === 0) return null;
  return p.packages.map((pkg) => ({
    id: pkg.id,
    label: pkg.label,
    weightKg: pkg.weightKg ?? '',
    itemCount: Array.isArray(pkg.items)
      ? pkg.items.reduce<number>((sum, item) => {
          const q = (item as { quantity?: string }).quantity;
          return sum + parseQty(q);
        }, 0)
      : 0,
    scanned: false,
    ready: false,
  }));
}

export function initialDispatchLines(
  lineIds: string[],
  lineMeta: Map<string, OutboundOrderLine>,
  saved?: DispatchLineDraft[],
): DispatchLineDraft[] {
  const byId = new Map((saved ?? []).map((l) => [l.outboundOrderLineId, l]));
  return lineIds.map((lid) => {
    const ol = lineMeta.get(lid);
    const picked = ol?.pickedQuantity ?? '0';
    return (
      byId.get(lid) ?? {
        outboundOrderLineId: lid,
        pickedQty: picked,
        shipQty: picked,
        verified: false,
        notes: '',
      }
    );
  });
}

export function defaultPackages(saved?: DispatchPackageDraft[]): DispatchPackageDraft[] {
  if (saved?.length) return saved;
  return [
    {
      id: `pkg-${Date.now()}`,
      label: 'PKG-001',
      weightKg: '',
      itemCount: 0,
      scanned: false,
      ready: false,
    },
  ];
}

export function newPackageLabel(existing: DispatchPackageDraft[]): string {
  return `PKG-${String(existing.length + 1).padStart(3, '0')}`;
}

export function buildDispatchCompletePayload(
  lines: DispatchLineDraft[],
  carrier: string,
  tracking: string,
): {
  task_type: 'dispatch';
  lines: Array<{ outbound_order_line_id: string; ship_qty: string }>;
  carrier?: string;
  tracking?: string;
} {
  return {
    task_type: 'dispatch',
    lines: lines.map((l) => ({
      outbound_order_line_id: l.outboundOrderLineId,
      ship_qty: (l.shipQty ?? '0').trim() || '0',
    })),
    ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
    ...(tracking.trim() ? { tracking: tracking.trim() } : {}),
  };
}

export type DispatchLineFilterStatus = 'pending' | 'complete';

export function computeDispatchLineFilterStatus(
  line: DispatchLineDraft,
): DispatchLineFilterStatus {
  return line.verified ? 'complete' : 'pending';
}

export function dispatchLineStatusFilterOptions(): Array<{
  value: DispatchLineFilterStatus | '';
  label: string;
}> {
  return [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'complete', label: 'Verified' },
  ];
}

export function filterDispatchLines(
  lines: DispatchLineDraft[],
  filters: TaskLineFilters,
  lineMeta: Map<string, OutboundOrderLine>,
): DispatchLineDraft[] {
  return lines.filter((l) => {
    const status = computeDispatchLineFilterStatus(l);
    if (filters.status && status !== filters.status) return false;
    const ol = lineMeta.get(l.outboundOrderLineId);
    return matchesTaskLineSearch(filters.search, {
      sku: ol?.product?.sku,
      name: ol?.product?.name,
      barcode: ol?.product?.barcode,
    });
  });
}

export function computeDispatchReadiness(
  draft: Pick<DispatchExecutionDraft, 'destinationLocationId' | 'sourceLocationId'>,
  lines: DispatchLineDraft[],
): DispatchReadiness {
  if (!draft.sourceLocationId || !draft.destinationLocationId) return 'awaiting';
  const linesOk = lines.every((l) => {
    const picked = parseQty(l.pickedQty);
    const ship = parseQty(l.shipQty);
    return picked <= 0 || (ship <= picked + 1e-6 && l.verified);
  });
  const anyShipped = lines.some((l) => parseQty(l.shipQty) > 0 && l.verified);
  if (linesOk && anyShipped) return 'ready';
  if (draft.destinationLocationId) return 'partial';
  return 'blocked';
}

export function readinessLabel(r: DispatchReadiness): string {
  const m: Record<DispatchReadiness, string> = {
    awaiting: 'Awaiting dispatch',
    partial: 'Partially ready',
    ready: 'Ready to dispatch',
    blocked: 'Blocked',
  };
  return m[r];
}

export function readinessClass(r: DispatchReadiness): string {
  switch (r) {
    case 'ready':
      return 'bg-emerald-100 text-emerald-800';
    case 'partial':
      return 'bg-amber-100 text-amber-900';
    case 'blocked':
      return 'bg-rose-100 text-rose-900';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function computeDispatchSummary(
  lines: DispatchLineDraft[],
  draft: DispatchExecutionDraft,
): DispatchSummary {
  let totalUnits = 0;
  for (const l of lines) {
    totalUnits += parseQty(l.pickedQty);
  }
  const readiness = computeDispatchReadiness(draft, lines);
  const verified = lines.filter((l) => l.verified).length;
  const completionPct =
    lines.length > 0 ? Math.min(100, Math.round((verified / lines.length) * 100)) : 0;

  return {
    totalSkus: lines.length,
    totalUnits,
    packageCount: 0,
    packagesScanned: 0,
    totalWeightKg: 0,
    readiness,
    completionPct,
  };
}

export function findDispatchLineByProductScan(
  code: string,
  lineIds: string[],
  lineMeta: Map<string, OutboundOrderLine>,
): string | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  for (const lineId of lineIds) {
    const ol = lineMeta.get(lineId);
    const p = ol?.product;
    if (!p) continue;
    if (
      p.sku?.trim().toLowerCase() === c ||
      p.barcode?.trim().toLowerCase() === c ||
      p.name?.trim().toLowerCase() === c
    ) {
      return lineId;
    }
  }
  return undefined;
}

export function dispatchScanStepLabel(step: DispatchScanStep): string {
  switch (step) {
    case 'source':
      return 'Scan packing area (source)';
    case 'destination':
      return 'Scan dispatch dock (destination)';
    case 'package':
      return 'Scan package label';
  }
}

export function matchLocationIdByScan(code: string, locations: Location[]): string | undefined {
  return matchLocationByScan(code, locations)?.id;
}

export function findPackageByLabel(
  code: string,
  packages: DispatchPackageDraft[],
): DispatchPackageDraft | undefined {
  const c = code.trim().toLowerCase();
  return packages.find((p) => p.label.trim().toLowerCase() === c || p.id === code.trim());
}

export { locationDisplay, parseQty };
