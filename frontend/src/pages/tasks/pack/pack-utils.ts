import type { OutboundOrderLine } from '../../../api/outbound';
import {
  matchesTaskLineSearch,
  type TaskLineFilters,
} from '../../../lib/task-line-filters';

import type {
  PackExecutionDraft,
  PackLineDraft,
  PackLineStatus,
  PackPackageDraft,
  PackSummary,
  PackScanStep,
} from './pack-types';
import { parseQty } from '../putaway/putaway-utils';

export const PACKAGE_TYPE_OPTIONS: Array<{ value: PackPackageDraft['packageType']; label: string }> = [
  { value: 'box', label: 'Box' },
  { value: 'carton', label: 'Carton' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'envelope', label: 'Envelope' },
  { value: 'other', label: 'Other' },
];

export function readPackDraft(raw: unknown): PackExecutionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const d = r.pack_draft ?? r.packDraft;
  if (!d || typeof d !== 'object') return null;
  return d as PackExecutionDraft;
}

export function newPackageLabel(existing: PackPackageDraft[]): string {
  const n = existing.length + 1;
  return `PKG-${String(n).padStart(3, '0')}`;
}

export function createEmptyPackage(existing: PackPackageDraft[]): PackPackageDraft {
  const label = newPackageLabel(existing);
  return {
    id: `pkg-${Date.now()}`,
    label,
    packageType: 'box',
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    status: 'open',
    items: [],
  };
}

export function initialPackLines(
  lineIds: string[],
  lineMeta: Map<string, OutboundOrderLine>,
  saved?: PackLineDraft[],
): PackLineDraft[] {
  const byId = new Map((saved ?? []).map((l) => [l.outboundOrderLineId, l]));
  return lineIds.map((lid) => {
    const ol = lineMeta.get(lid);
    const picked = ol?.pickedQuantity ?? '0';
    return (
      byId.get(lid) ?? {
        outboundOrderLineId: lid,
        pickedQty: picked,
        packedQty: '0',
        damagedQty: '0',
        verified: false,
        productVerified: false,
        notes: '',
        exceptionType: 'none',
      }
    );
  });
}

export function sumPackedForLine(packages: PackPackageDraft[], lineId: string): number {
  let sum = 0;
  for (const pkg of packages) {
    for (const item of pkg.items) {
      if (item.outboundOrderLineId === lineId) {
        sum += parseQty(item.quantity);
      }
    }
  }
  return sum;
}

export function syncLinePackedQty(lines: PackLineDraft[], packages: PackPackageDraft[]): PackLineDraft[] {
  return lines.map((l) => ({
    ...l,
    packedQty: String(sumPackedForLine(packages, l.outboundOrderLineId)),
  }));
}

export function primaryPackageLabelForLine(
  packages: PackPackageDraft[],
  lineId: string,
): string | undefined {
  let best: { label: string; qty: number } | null = null;
  for (const pkg of packages) {
    for (const item of pkg.items) {
      if (item.outboundOrderLineId !== lineId) continue;
      const q = parseQty(item.quantity);
      if (!best || q > best.qty) best = { label: pkg.label, qty: q };
    }
  }
  return best?.label;
}

export function buildPackCompletePayload(
  lineIds: string[],
  lines: PackLineDraft[],
  packages: PackPackageDraft[],
): {
  task_type: 'pack';
  lines: Array<{
    outbound_order_line_id: string;
    packed_qty: string;
    package_label?: string;
  }>;
} {
  const byId = new Map(lines.map((l) => [l.outboundOrderLineId, l]));
  return {
    task_type: 'pack',
    lines: lineIds.map((lid) => {
      const d = byId.get(lid);
      const packed = parseQty(d?.packedQty);
      const label = primaryPackageLabelForLine(packages, lid);
      return {
        outbound_order_line_id: lid,
        packed_qty: String(packed),
        ...(label ? { package_label: label } : {}),
      };
    }),
  };
}

export function computePackLineStatus(line: PackLineDraft): PackLineStatus {
  const picked = parseQty(line.pickedQty);
  const packed = parseQty(line.packedQty);
  const damaged = parseQty(line.damagedQty);
  if (line.exceptionType === 'overpack' || packed > picked + 1e-6) return 'overpack';
  if (line.exceptionType === 'missing' || (picked > 0 && packed + damaged < picked - 1e-6 && line.verified)) {
    return 'short';
  }
  if (packed >= picked - 1e-6 && picked > 0 && line.verified) return 'complete';
  if (packed > 0) return 'packing';
  if (line.verified || line.productVerified) return 'verifying';
  return 'pending';
}

export function packLineStatusLabel(status: PackLineStatus): string {
  const m: Record<PackLineStatus, string> = {
    pending: 'Pending',
    verifying: 'Verify',
    packing: 'Packing',
    complete: 'Complete',
    short: 'Short',
    overpack: 'Over',
  };
  return m[status];
}

export function packLineStatusClass(status: PackLineStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-100 text-emerald-800';
    case 'packing':
    case 'verifying':
      return 'bg-sky-100 text-sky-800';
    case 'short':
    case 'overpack':
      return 'bg-rose-100 text-rose-900';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function packLineStatusFilterOptions(): Array<{ value: PackLineStatus | ''; label: string }> {
  return [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: packLineStatusLabel('pending') },
    { value: 'verifying', label: packLineStatusLabel('verifying') },
    { value: 'packing', label: packLineStatusLabel('packing') },
    { value: 'complete', label: packLineStatusLabel('complete') },
    { value: 'short', label: packLineStatusLabel('short') },
    { value: 'overpack', label: packLineStatusLabel('overpack') },
  ];
}

export function filterPackLines(
  lines: PackLineDraft[],
  filters: TaskLineFilters,
  lineMeta: Map<string, OutboundOrderLine>,
): PackLineDraft[] {
  return lines.filter((l) => {
    const status = computePackLineStatus(l);
    if (filters.status && status !== filters.status) return false;
    const ol = lineMeta.get(l.outboundOrderLineId);
    return matchesTaskLineSearch(filters.search, {
      sku: ol?.product?.sku,
      name: ol?.product?.name,
      barcode: ol?.product?.barcode,
    });
  });
}

export function computePackSummary(
  lines: PackLineDraft[],
  packages: PackPackageDraft[],
): PackSummary {
  let totalPickedUnits = 0;
  let packedUnits = 0;
  for (const l of lines) {
    totalPickedUnits += parseQty(l.pickedQty);
    packedUnits += parseQty(l.packedQty);
  }
  const remainingUnits = Math.max(0, totalPickedUnits - packedUnits);
  const completeLines = lines.filter((l) => computePackLineStatus(l) === 'complete').length;
  const completionPct =
    lines.length > 0 ? Math.min(100, Math.round((completeLines / lines.length) * 100)) : 0;
  return {
    totalSkus: lines.length,
    totalPickedUnits,
    packedUnits,
    remainingUnits,
    packageCount: packages.length,
    completionPct,
  };
}

export function packScanStepLabel(step: PackScanStep): string {
  return step === 'product' ? 'Scan product to pack' : 'Scan package label';
}

export function matchOutboundLineProductScan(
  code: string,
  lineMeta: Map<string, OutboundOrderLine>,
  lineId: string,
): boolean {
  const ol = lineMeta.get(lineId);
  if (!ol?.product) return false;
  const c = code.trim().toLowerCase();
  const sku = ol.product.sku?.trim().toLowerCase();
  const bc = ol.product.barcode?.trim().toLowerCase();
  return (!!sku && sku === c) || (!!bc && bc === c);
}

export function findLineByProductScan(
  code: string,
  lineIds: string[],
  lineMeta: Map<string, OutboundOrderLine>,
): string | undefined {
  for (const lid of lineIds) {
    if (matchOutboundLineProductScan(code, lineMeta, lid)) return lid;
  }
  return undefined;
}

export function matchesPackProductFilter(query: string, ol?: OutboundOrderLine): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const p = ol?.product;
  if (!p) return false;
  const sku = p.sku?.trim().toLowerCase() ?? '';
  const name = p.name?.trim().toLowerCase() ?? '';
  const bc = p.barcode?.trim().toLowerCase() ?? '';
  return sku.includes(q) || name.includes(q) || bc.includes(q);
}

export function filterPackLineIdsByProduct(
  lineIds: string[],
  lineMeta: Map<string, OutboundOrderLine>,
  productFilter: string,
): string[] {
  return lineIds.filter((lid) => matchesPackProductFilter(productFilter, lineMeta.get(lid)));
}

export function qtyInPackage(pkg: PackPackageDraft, lineId: string): number {
  const item = pkg.items.find((i) => i.outboundOrderLineId === lineId);
  return item ? parseQty(item.quantity) : 0;
}

/** Picked minus total packed across all packages. */
export function remainingPackableQty(line: PackLineDraft, packages: PackPackageDraft[]): number {
  const picked = parseQty(line.pickedQty);
  const packed = sumPackedForLine(packages, line.outboundOrderLineId);
  return Math.max(0, picked - packed);
}

export function findPackageByLabelScan(
  code: string,
  packages: PackPackageDraft[],
): PackPackageDraft | undefined {
  const c = code.trim().toLowerCase();
  return packages.find((p) => p.label.trim().toLowerCase() === c || p.id === code.trim());
}

export { parseQty };
