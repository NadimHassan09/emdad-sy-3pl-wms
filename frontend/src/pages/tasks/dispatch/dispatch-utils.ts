import type { OutboundOrderLine } from '../../../api/outbound';
import type { Location } from '../../../api/locations';

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

export function computeDispatchReadiness(
  draft: Pick<
    DispatchExecutionDraft,
    'sourceVerified' | 'destVerified' | 'sourceLocationId' | 'destinationLocationId'
  >,
  packages: DispatchPackageDraft[],
  lines: DispatchLineDraft[],
): DispatchReadiness {
  if (!draft.sourceLocationId || !draft.destinationLocationId) return 'awaiting';
  if (!draft.sourceVerified || !draft.destVerified) return 'partial';
  const pkgReady = packages.length > 0 && packages.every((p) => p.scanned && p.ready);
  const linesOk = lines.every((l) => {
    const picked = parseQty(l.pickedQty);
    const ship = parseQty(l.shipQty);
    return picked > 0 && Math.abs(ship - picked) < 1e-6 && l.verified;
  });
  if (pkgReady && linesOk) return 'ready';
  if (draft.sourceVerified && draft.destVerified) return 'partial';
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
  packages: DispatchPackageDraft[],
  draft: DispatchExecutionDraft,
): DispatchSummary {
  let totalUnits = 0;
  let shipped = 0;
  for (const l of lines) {
    totalUnits += parseQty(l.pickedQty);
    shipped += parseQty(l.shipQty);
  }
  const packagesScanned = packages.filter((p) => p.scanned).length;
  const totalWeightKg = packages.reduce((s, p) => s + parseQty(p.weightKg), 0);
  const readiness = computeDispatchReadiness(draft, packages, lines);
  const steps =
    (draft.sourceVerified ? 1 : 0) +
    (draft.destVerified ? 1 : 0) +
    packagesScanned +
    lines.filter((l) => l.verified).length;
  const totalSteps = 2 + packages.length + lines.length;
  const completionPct = totalSteps > 0 ? Math.min(100, Math.round((steps / totalSteps) * 100)) : 0;

  return {
    totalSkus: lines.length,
    totalUnits,
    packageCount: packages.length,
    packagesScanned,
    totalWeightKg,
    readiness,
    completionPct,
  };
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
