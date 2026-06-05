/** Minimal list/detail payloads for operational WS events (returns, cycle count, adjustments, transfers). */

import { buildReturnListSummary } from '../returns/return-line-integrity.util';

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : d;
}

function dec(v: unknown): string {
  return String(v ?? '0');
}

type ReturnLineSlice = {
  expectedQuantity: unknown;
  receivedQuantity: unknown;
  postedQuantity?: unknown;
  disposition: string | null;
  product: { sku: string };
};

export function returnListItemPayload(order: {
  id: string;
  companyId: string;
  orderNumber: string;
  status: string;
  clientReference: string | null;
  shipmentReference: string | null;
  createdAt: Date;
  completedAt: Date | null;
  company: { id: string; name: string };
  originalOutbound?: { id: string; orderNumber: string; status: string } | null;
  _count?: { lines: number };
  lines?: ReturnLineSlice[];
}) {
  const lines = order.lines ?? [];
  return {
    id: order.id,
    companyId: order.companyId,
    orderNumber: order.orderNumber,
    status: order.status,
    clientReference: order.clientReference,
    shipmentReference: order.shipmentReference,
    createdAt: iso(order.createdAt)!,
    completedAt: iso(order.completedAt),
    company: order.company,
    originalOutbound: order.originalOutbound ?? null,
    _count: order._count ?? { lines: lines.length },
    summary: buildReturnListSummary(
      lines.map((l) => ({
        expectedQuantity: l.expectedQuantity as import('@prisma/client').Prisma.Decimal,
        receivedQuantity: l.receivedQuantity as import('@prisma/client').Prisma.Decimal,
        disposition: l.disposition as import('@prisma/client').ReturnItemDisposition | null,
        product: l.product,
      })),
    ),
  };
}

export function returnDetailPayload(order: Record<string, unknown>) {
  const lines = (order.lines as Array<Record<string, unknown>>) ?? [];
  const list = returnListItemPayload({
    ...(order as Parameters<typeof returnListItemPayload>[0]),
    lines: lines as ReturnLineSlice[],
  });
  return {
    ...list,
    warehouseId: order.warehouseId ?? null,
    notes: order.notes ?? null,
    confirmedAt: iso(order.confirmedAt as Date | null),
    receivingStartedAt: iso(order.receivingStartedAt as Date | null),
    inspectingStartedAt: iso(order.inspectingStartedAt as Date | null),
    cancelledAt: iso(order.cancelledAt as Date | null),
    warehouse: order.warehouse ?? null,
    package: order.package ?? null,
    lines: lines.map((l) => ({
      id: l.id,
      returnOrderId: l.returnOrderId ?? order.id,
      productId: l.productId,
      outboundOrderLineId: l.outboundOrderLineId ?? null,
      packageId: l.packageId ?? null,
      lotId: l.lotId ?? null,
      expectedQuantity: dec(l.expectedQuantity),
      receivedQuantity: dec(l.receivedQuantity),
      postedQuantity: dec(l.postedQuantity),
      lineStatus: l.lineStatus,
      condition: l.condition ?? null,
      disposition: l.disposition ?? null,
      targetLocationId: l.targetLocationId ?? null,
      inspectionNotes: l.inspectionNotes ?? null,
      inspectedAt: iso(l.inspectedAt as Date | null),
      postedAt: iso(l.postedAt as Date | null),
      lineNumber: l.lineNumber,
      product: l.product,
      lot: l.lot ?? null,
      outboundOrderLine: l.outboundOrderLine ?? null,
      package: l.package ?? null,
      targetLocation: l.targetLocation ?? null,
    })),
  };
}

export function cycleCountListItemPayload(count: {
  id: string;
  companyId: string;
  warehouseId: string;
  status: string;
  source: string;
  snapshotAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  company: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
  assignedWorker?: { id: string; displayName: string } | null;
  schedule?: { id: string; intervalDays: number } | null;
  _count?: { lines: number };
  lines?: unknown[];
}) {
  return {
    id: count.id,
    companyId: count.companyId,
    warehouseId: count.warehouseId,
    status: count.status,
    source: count.source,
    snapshotAt: iso(count.snapshotAt),
    startedAt: iso(count.startedAt),
    completedAt: iso(count.completedAt),
    createdAt: iso(count.createdAt)!,
    company: count.company,
    warehouse: count.warehouse,
    assignedWorker: count.assignedWorker ?? null,
    schedule: count.schedule ?? null,
    _count: count._count ?? { lines: count.lines?.length ?? 0 },
  };
}

export function cycleCountDetailPayload(count: Record<string, unknown>) {
  const lines = (count.lines as Array<Record<string, unknown>>) ?? [];
  const list = cycleCountListItemPayload({
    ...(count as Parameters<typeof cycleCountListItemPayload>[0]),
    lines,
  });
  return {
    ...list,
    blindCount: count.blindCount ?? false,
    notes: count.notes ?? null,
    creator: count.creator,
    lines: lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      locationId: l.locationId,
      lotId: l.lotId ?? null,
      expectedQuantity: dec(l.expectedQuantity),
      actualQuantity: l.actualQuantity != null ? dec(l.actualQuantity) : null,
      discrepancyQuantity:
        l.discrepancyQuantity != null ? dec(l.discrepancyQuantity) : null,
      status: l.status,
      assignedWorkerId: l.assignedWorkerId ?? null,
      countedAt: iso(l.countedAt as Date | null),
      countNotes: l.countNotes ?? null,
      product: l.product,
      location: l.location,
      lot: l.lot ?? null,
      assignedWorker: l.assignedWorker ?? null,
      counter: l.counter ?? null,
    })),
    variancesDetected: count.variancesDetected,
  };
}

export function adjustmentPayload(adj: Record<string, unknown>) {
  const lines = (adj.lines as Array<Record<string, unknown>>) ?? [];
  return {
    id: adj.id,
    companyId: adj.companyId,
    warehouseId: adj.warehouseId,
    reason: adj.reason,
    status: adj.status,
    approvedBy: adj.approvedBy ?? null,
    approvedAt: iso(adj.approvedAt as Date | null),
    createdBy: adj.createdBy,
    createdAt: iso(adj.createdAt as Date)!,
    updatedAt: iso(adj.updatedAt as Date)!,
    company: adj.company,
    warehouse: adj.warehouse,
    creator: adj.creator,
    approver: adj.approver ?? null,
    lines: lines.map((l) => ({
      id: l.id,
      adjustmentId: l.adjustmentId ?? adj.id,
      productId: l.productId,
      locationId: l.locationId,
      lotId: l.lotId ?? null,
      quantityBefore: dec(l.quantityBefore),
      quantityAfter: dec(l.quantityAfter),
      reasonNote: l.reasonNote ?? null,
      product: l.product,
      location: l.location,
      lot: l.lot ?? null,
    })),
  };
}

export function transferPayload(input: {
  referenceId: string;
  companyId: string;
  warehouseId: string;
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  lotId: string | null;
  quantity: string;
  status: 'pending' | 'completed';
  ledger?: Record<string, unknown>;
}) {
  return {
    referenceId: input.referenceId,
    companyId: input.companyId,
    warehouseId: input.warehouseId,
    productId: input.productId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    lotId: input.lotId,
    quantity: input.quantity,
    status: input.status,
    ledger: input.ledger,
  };
}
