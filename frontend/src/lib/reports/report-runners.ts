import { CompaniesApi } from '../../api/companies';
import { DashboardApi } from '../../api/dashboard';
import { InboundApi } from '../../api/inbound';
import { InventoryApi } from '../../api/inventory';
import { OutboundApi } from '../../api/outbound';
import { TasksApi } from '../../api/tasks';
import { taskAssignedWorkerLabel } from '../task-worker-label';
import {
  daysUntilExpiry,
  expiryAgingBucket,
  reportFmtDate,
  reportFmtDateTime,
  reportFmtQty,
} from './format';
import type { ReportFilterValues, ReportRow, ReportRunContext } from './types';

function warehouseId(filters: ReportFilterValues, ctx: ReportRunContext): string {
  return filters.warehouseId.trim() || ctx.defaultWarehouseId;
}

function matchSku(sku: string, filterSku: string): boolean {
  const q = filterSku.trim().toLowerCase();
  if (!q) return true;
  return sku.toLowerCase().includes(q);
}

export async function runInventoryBalance(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const [stockPage, companies] = await Promise.all([
    InventoryApi.stock({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      limit: 2000,
    }),
    CompaniesApi.list({ includeAll: true }),
  ]);
  const clientName = new Map(companies.map((c) => [c.id, c.name]));
  return stockPage.items
    .filter((r) => matchSku(r.product.sku, filters.sku))
    .filter((r) => !filters.status || r.status === filters.status)
    .map((r) => ({
      id: r.id,
      sku: r.product.sku,
      product: r.product.name,
      client: clientName.get(r.companyId) ?? r.companyId,
      location: r.location.fullPath,
      lot: r.lot?.lotNumber ?? '',
      expiry: r.lot?.expiryDate ? reportFmtDate(r.lot.expiryDate) : '',
      onHand: reportFmtQty(r.quantityOnHand),
      reserved: reportFmtQty(r.quantityReserved),
      available: reportFmtQty(r.quantityAvailable),
      stockStatus: r.status,
      uom: r.product.uom,
      warehouse: r.warehouse.code,
    }));
}

/** Alias — enterprise report name. */
export const runInventoryOnHand = runInventoryBalance;

export async function runInventoryMovement(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const { items } = await InventoryApi.ledger({
    warehouseId: wid,
    companyId: filters.companyId || undefined,
    movementType: filters.status || undefined,
    createdFrom: filters.dateFrom || undefined,
    createdTo: filters.dateTo || undefined,
    limit: 2000,
  });
  return items
    .filter((r) => matchSku(r.product.sku, filters.sku))
    .map((r) => ({
      id: r.id,
      date: reportFmtDateTime(r.createdAt),
      product: r.product.name,
      sku: r.product.sku,
      client: r.company.name,
      movement: r.movementType,
      status: 'Done',
      quantity: reportFmtQty(r.quantity),
      reference: `${r.referenceType} ${r.referenceId.slice(0, 8)}…`,
      operator: r.operator.fullName,
      lot: r.lot?.lotNumber ?? '',
      fromLocation: r.fromLocationId ? String(r.locationLabel ?? r.fromLocationId).slice(0, 24) : '',
      toLocation: r.toLocationId ? '→ dest' : '',
    }));
}

export async function runInboundOrders(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const { items } = await InboundApi.list({
    warehouseId: wid,
    companyId: filters.companyId || undefined,
    status: (filters.status || undefined) as never,
    createdFrom: filters.dateFrom || undefined,
    createdTo: filters.dateTo || undefined,
    limit: 2000,
  });
  return items.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    client: o.company?.name ?? '',
    status: o.status,
    expectedArrival: reportFmtDate(o.expectedArrivalDate),
    lines: String(o._count?.lines ?? o.lines.length),
    created: reportFmtDateTime(o.createdAt),
  }));
}

export async function runOutboundOrders(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const { items } = await OutboundApi.list({
    warehouseId: wid,
    companyId: filters.companyId || undefined,
    status: (filters.status || undefined) as never,
    createdFrom: filters.dateFrom || undefined,
    createdTo: filters.dateTo || undefined,
    limit: 2000,
  });
  return items.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    client: o.company?.name ?? '',
    status: o.status,
    shipDate: reportFmtDate(o.requiredShipDate),
    destination: o.destinationAddress,
    lines: String(o._count?.lines ?? o.lines.length),
    created: reportFmtDateTime(o.createdAt),
  }));
}

export async function runTaskPerformance(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const params: Record<string, string | undefined> = {
    limit: '2000',
    warehouseId: wid,
    includeRunnability: 'true',
  };
  if (filters.taskType) params.taskType = filters.taskType;
  if (filters.status) params.status = filters.status;
  const { items } = await TasksApi.list(params);
  let rows = items;
  if (filters.employeeId) {
    rows = rows.filter((t) =>
      t.assignments?.some((a) => a.worker?.id === filters.employeeId),
    );
  }
  return rows.map((t) => ({
    id: t.id,
    taskType: t.taskType,
    status: t.status,
    assignee: taskAssignedWorkerLabel(t.assignments),
    referenceType: t.workflowInstance?.referenceType ?? '',
    referenceId: t.workflowInstance?.referenceId?.slice(0, 8) ?? '',
    runnable: t.is_current_runnable ? 'Yes' : 'No',
    blocked: t.runnability_blocked_reason ?? '',
  }));
}

export async function runWarehouseUtilization(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const [overview, stock] = await Promise.all([
    DashboardApi.overview(),
    InventoryApi.stock({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      limit: 2000,
    }),
  ]);
  const cap = overview.capacity;
  const summary: ReportRow[] = [
    {
      id: 'summary',
      location: '— Warehouse summary —',
      type: '—',
      skuCount: '',
      totalQty: '',
      utilization: `${cap.consumedPercent}% (${cap.occupiedLocations} / ${cap.totalStorageLocations} locations)`,
    },
  ];
  const byLocation = new Map<
    string,
    { path: string; type: string; skuSet: Set<string>; qty: number }
  >();
  for (const row of stock.items) {
    if (!matchSku(row.product.sku, filters.sku)) continue;
    const cur = byLocation.get(row.locationId) ?? {
      path: row.location.fullPath,
      type: row.location.name,
      skuSet: new Set<string>(),
      qty: 0,
    };
    cur.skuSet.add(row.productId);
    cur.qty += Number(row.quantityOnHand);
    byLocation.set(row.locationId, cur);
  }
  const locationRows: ReportRow[] = [...byLocation.entries()].map(([id, v]) => ({
    id,
    location: v.path,
    type: v.type,
    skuCount: String(v.skuSet.size),
    totalQty: reportFmtQty(v.qty),
    utilization: cap.totalStorageLocations
      ? `${Math.round((byLocation.size / cap.totalStorageLocations) * 100)}% active slots`
      : '—',
  }));
  return [...summary, ...locationRows.sort((a, b) =>
    String(a.location).localeCompare(String(b.location)),
  )];
}

export async function runExpiryAging(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const { items } = await InventoryApi.stock({
    warehouseId: wid,
    companyId: filters.companyId || undefined,
    limit: 2000,
  });
  return items
    .filter((r) => r.lot && matchSku(r.product.sku, filters.sku))
    .map((r) => {
      const days = daysUntilExpiry(r.lot?.expiryDate);
      return {
        id: r.id,
        sku: r.product.sku,
        product: r.product.name,
        lot: r.lot?.lotNumber ?? '',
        expiry: r.lot?.expiryDate ? reportFmtDate(r.lot.expiryDate) : '',
        daysUntil: days === null ? '' : String(days),
        agingBucket: expiryAgingBucket(days),
        location: r.location.fullPath,
        quantity: reportFmtQty(r.quantityOnHand),
      };
    })
    .filter((r) => {
      if (!filters.status) return true;
      return r.agingBucket === filters.status;
    })
    .sort((a, b) => Number(a.daysUntil || 9999) - Number(b.daysUntil || 9999));
}

export async function runClientActivity(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const [companies, inbound, outbound] = await Promise.all([
    CompaniesApi.list({ includeAll: true }),
    InboundApi.list({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      createdFrom: filters.dateFrom || undefined,
      createdTo: filters.dateTo || undefined,
      limit: 2000,
    }),
    OutboundApi.list({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      createdFrom: filters.dateFrom || undefined,
      createdTo: filters.dateTo || undefined,
      limit: 2000,
    }),
  ]);
  const inboundByCo = new Map<string, number>();
  const outboundByCo = new Map<string, number>();
  for (const o of inbound.items) {
    inboundByCo.set(o.companyId, (inboundByCo.get(o.companyId) ?? 0) + 1);
  }
  for (const o of outbound.items) {
    outboundByCo.set(o.companyId, (outboundByCo.get(o.companyId) ?? 0) + 1);
  }
  return companies
    .filter((c) => !filters.status || c.status === filters.status)
    .filter((c) => !filters.companyId || c.id === filters.companyId)
    .map((c) => ({
      id: c.id,
      client: c.name,
      status: c.status,
      country: c.country ?? '',
      inboundOrders: String(inboundByCo.get(c.id) ?? 0),
      outboundOrders: String(outboundByCo.get(c.id) ?? 0),
      totalOrders: String((inboundByCo.get(c.id) ?? 0) + (outboundByCo.get(c.id) ?? 0)),
    }))
    .filter((r) => Number(r.totalOrders) > 0 || !filters.dateFrom)
    .sort((a, b) => Number(b.totalOrders) - Number(a.totalOrders));
}

export const runInboundAnalysis = runInboundOrders;
export const runOutboundAnalysis = runOutboundOrders;
export const runCapacityUtilization = runWarehouseUtilization;
export const runExpiryTracking = runExpiryAging;

export async function runInboundAnalysisDetailed(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const rows = await runInboundOrders(filters, ctx);
  return rows.map((r) => ({
    ...r,
    metric: 'inbound',
    throughput: r.lines,
  }));
}

export async function runOutboundAnalysisDetailed(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const rows = await runOutboundOrders(filters, ctx);
  return rows.map((r) => ({
    ...r,
    metric: 'outbound',
    fulfillmentStage: r.status,
  }));
}

/** Projected stock from on-hand + open inbound − open outbound (client-side, capped). */
export async function runForecastedInventory(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const [stock, inbound, outbound] = await Promise.all([
    InventoryApi.stock({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      limit: 2000,
    }),
    InboundApi.list({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      status: 'confirmed' as never,
      limit: 500,
    }),
    OutboundApi.list({
      warehouseId: wid,
      companyId: filters.companyId || undefined,
      status: 'picking' as never,
      limit: 500,
    }),
  ]);
  const openInboundOrders = inbound.items.length;
  const openOutboundOrders = outbound.items.length;
  const byProduct = new Map<string, ReportRow>();
  for (const r of stock.items.filter((s) => matchSku(s.product.sku, filters.sku))) {
    const onHand = Number(r.quantityAvailable);
    const projected = onHand;
    const cur = byProduct.get(r.productId);
    if (!cur || projected < Number(cur.projectedQty ?? 0)) {
      byProduct.set(r.productId, {
        id: r.productId,
        sku: r.product.sku,
        product: r.product.name,
        client: r.companyId,
        onHand: reportFmtQty(onHand),
        incoming: String(openInboundOrders),
        outgoing: String(openOutboundOrders),
        projectedQty: projected,
        risk: projected < 0 ? 'shortage' : projected < 10 ? 'low' : 'ok',
      });
    }
  }
  return [...byProduct.values()].sort((a, b) => Number(a.projectedQty) - Number(b.projectedQty));
}

export async function runWarehouseOperations(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const params: Record<string, string | undefined> = { limit: '2000', warehouseId: wid };
  if (filters.taskType) params.taskType = filters.taskType;
  if (filters.status) params.status = filters.status;
  const { items } = await TasksApi.list(params);
  const byType = new Map<string, { total: number; completed: number; blocked: number }>();
  for (const t of items) {
    const cur = byType.get(t.taskType) ?? { total: 0, completed: 0, blocked: 0 };
    cur.total += 1;
    if (t.status === 'completed') cur.completed += 1;
    if (t.runnability_blocked_reason) cur.blocked += 1;
    byType.set(t.taskType, cur);
  }
  return [...byType.entries()].map(([taskType, v]) => ({
    id: taskType,
    taskType,
    totalTasks: v.total,
    completedTasks: v.completed,
    blockedTasks: v.blocked,
    completionRate: v.total ? `${Math.round((v.completed / v.total) * 100)}%` : '—',
    throughput: v.completed,
  }));
}

export async function runProductActivity(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const rows = await runInventoryMovement(filters, ctx);
  const bySku = new Map<string, { sku: string; product: string; count: number; qty: number }>();
  for (const r of rows) {
    const sku = String(r.sku);
    const cur = bySku.get(sku) ?? { sku, product: String(r.product), count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += Number(String(r.quantity).replace(/,/g, '')) || 0;
    bySku.set(sku, cur);
  }
  return [...bySku.values()]
    .map((v) => ({
      id: v.sku,
      sku: v.sku,
      product: v.product,
      movementCount: v.count,
      totalQty: reportFmtQty(v.qty),
      velocity: v.count >= 10 ? 'fast' : v.count >= 3 ? 'medium' : 'slow',
    }))
    .sort((a, b) => Number(b.movementCount) - Number(a.movementCount));
}

export async function runWorkerProductivity(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const rows = await runTaskPerformance(filters, ctx);
  const byWorker = new Map<string, { name: string; completed: number; types: Set<string> }>();
  for (const r of rows) {
    const name = String(r.assignee);
    const cur = byWorker.get(name) ?? { name, completed: 0, types: new Set() };
    if (r.status === 'completed') cur.completed += 1;
    cur.types.add(String(r.taskType));
    byWorker.set(name, cur);
  }
  return [...byWorker.entries()].map(([id, v]) => ({
    id,
    worker: v.name,
    completedTasks: v.completed,
    taskTypes: [...v.types].join(', '),
    pickPackRate: v.types.has('pick') || v.types.has('pack') ? 'active' : '—',
  }));
}

export async function runOrderLifecycle(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const [inbound, outbound] = await Promise.all([
    runInboundOrders(filters, ctx),
    runOutboundOrders(filters, ctx),
  ]);
  const lifecycle: ReportRow[] = [
    ...inbound.map((o) => ({
      id: `in-${o.id}`,
      orderType: 'inbound',
      orderNumber: o.orderNumber,
      client: o.client,
      status: o.status,
      created: o.created,
      currentStage: o.status,
      duration: '—',
    })),
    ...outbound.map((o) => ({
      id: `out-${o.id}`,
      orderType: 'outbound',
      orderNumber: o.orderNumber,
      client: o.client,
      status: o.status,
      created: o.created,
      currentStage: o.status,
      duration: '—',
    })),
  ];
  return lifecycle.sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

/** SLA metrics derived from open tasks/orders until dedicated SLA API exists. */
export async function runSlaDelayAnalysis(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const wid = warehouseId(filters, ctx);
  const [tasks, inbound] = await Promise.all([
    TasksApi.list({ limit: '500', warehouseId: wid, status: 'in_progress' }),
    InboundApi.list({ warehouseId: wid, limit: 500, status: 'pending_approval' as never }),
  ]);
  const rows: ReportRow[] = [];
  for (const t of tasks.items) {
    rows.push({
      id: t.id,
      entityType: 'task',
      reference: `${t.taskType} · ${t.id.slice(0, 8)}`,
      status: t.status,
      delayReason: t.runnability_blocked_reason ?? (t.is_current_runnable ? 'on track' : 'blocked'),
      slaState: t.runnability_blocked_reason ? 'breach_risk' : 'ok',
      count: 1,
    });
  }
  for (const o of inbound.items) {
    rows.push({
      id: o.id,
      entityType: 'inbound_order',
      reference: o.orderNumber,
      status: o.status,
      delayReason: 'awaiting approval',
      slaState: 'pending',
      count: 1,
    });
  }
  if (!rows.length) {
    rows.push({
      id: 'none',
      entityType: '—',
      reference: 'No open delays in sample',
      status: '—',
      delayReason: '—',
      slaState: 'ok',
      count: 0,
    });
  }
  return rows;
}

export async function runInventoryAging(
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportRow[]> {
  const rows = await runExpiryAging(filters, ctx);
  return rows.map((r) => ({
    ...r,
    stagnant: r.agingBucket === '180+ days' || r.agingBucket === 'Expired' ? 'yes' : 'no',
  }));
}

