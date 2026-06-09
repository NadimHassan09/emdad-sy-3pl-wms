import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompaniesService } from '../companies/companies.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { InboundService } from '../inbound/inbound.service';
import { InventoryService } from '../inventory/inventory.service';
import { OutboundService } from '../outbound/outbound.service';
import { AggregateReportQueryDto, ExportReportQueryDto, RunReportQueryDto } from './dto/run-report-query.dto';
import { reportRowsToCsv, reportRowsToXls, type ReportExportColumn } from './reports-export.util';
import { BillingReportsRunner } from './billing-reports.runner';
import { ReportsCacheService } from './reports-cache.service';
import { ReportsPolicyConfig } from './reports-policy.config';

export type ReportRowDto = Record<string, string | number | boolean | null | undefined> & {
  id?: string;
};

export type ReportRunResult = {
  items: ReportRowDto[];
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
  cached: boolean;
};

export type ReportKpiDto = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type ReportExportResult = {
  format: 'csv' | 'xls';
  rowCount: number;
  truncated: boolean;
  body: string;
  filename: string;
};

const INVENTORY_COLUMNS: ReportExportColumn[] = [
  { id: 'sku', header: 'SKU' },
  { id: 'product', header: 'Product' },
  { id: 'client', header: 'Client' },
  { id: 'location', header: 'Location' },
  { id: 'lot', header: 'Lot' },
  { id: 'expiry', header: 'Expiry' },
  { id: 'onHand', header: 'On hand' },
  { id: 'reserved', header: 'Reserved' },
  { id: 'available', header: 'Available' },
  { id: 'stockStatus', header: 'Status' },
  { id: 'uom', header: 'UoM' },
  { id: 'warehouse', header: 'Warehouse' },
];

const MOVES_COLUMNS: ReportExportColumn[] = [
  { id: 'date', header: 'Date' },
  { id: 'product', header: 'Product' },
  { id: 'sku', header: 'SKU' },
  { id: 'client', header: 'Client' },
  { id: 'movement', header: 'Movement' },
  { id: 'status', header: 'Status' },
  { id: 'quantity', header: 'Qty' },
  { id: 'reference', header: 'Reference' },
  { id: 'operator', header: 'Operator' },
  { id: 'lot', header: 'Lot' },
  { id: 'fromLocation', header: 'From' },
  { id: 'toLocation', header: 'To' },
];

const WAREHOUSE_COLUMNS: ReportExportColumn[] = [
  { id: 'week', header: 'Week' },
  { id: 'inboundCount', header: 'Inbound' },
  { id: 'outboundCount', header: 'Outbound' },
  { id: 'totalCount', header: 'Total' },
];

const BILLING_REVENUE_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'invoiceCount', header: 'Invoices' },
  { id: 'revenue', header: 'Revenue' },
];

const BILLING_OUTSTANDING_COLUMNS: ReportExportColumn[] = [
  { id: 'invoiceNumber', header: 'Invoice #' },
  { id: 'client', header: 'Client' },
  { id: 'status', header: 'Status' },
  { id: 'amount', header: 'Amount' },
  { id: 'issuedAt', header: 'Issued' },
];

const BILLING_EXPIRING_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'daysRemaining', header: 'Days remaining' },
  { id: 'cycleEnd', header: 'Cycle end' },
];

const BILLING_SUSPENDED_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'suspendedSince', header: 'Suspended since' },
];

const BILLING_CAPACITY_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'allocatedVolumeCbm', header: 'Allocated CBM' },
  { id: 'allocatedWeightKg', header: 'Allocated kg' },
];

function fmtQty(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
  return d;
}

function fmtDateTime(iso: string | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function isoWeekKey(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekLabel(key: string): string {
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return key;
  return `W${m[2]} ${m[1]}`;
}

function daysBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return (b - a) / 86_400_000;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly inbound: InboundService,
    private readonly outbound: OutboundService,
    private readonly dashboard: DashboardService,
    private readonly companies: CompaniesService,
    private readonly cache: ReportsCacheService,
    private readonly policy: ReportsPolicyConfig,
    private readonly billingReports: BillingReportsRunner,
  ) {}

  getPolicy() {
    return this.policy.snapshot();
  }

  async run(user: AuthPrincipal, reportId: string, query: RunReportQueryDto): Promise<ReportRunResult> {
    this.assertReportId(reportId);
    this.validatePreviewQuery(query);

    const cachePayload = { reportId, query, userId: user.id };
    const cached = await this.cache.get<ReportRunResult>('run', cachePayload);
    if (cached) return { ...cached, cached: true };

    const result = await this.executeRun(user, reportId, query);
    await this.cache.set('run', cachePayload, result);
    return { ...result, cached: false };
  }

  async aggregate(
    user: AuthPrincipal,
    reportId: string,
    query: AggregateReportQueryDto,
  ): Promise<ReportRunResult> {
    this.assertReportId(reportId);
    if (!query.groupBy?.trim()) {
      throw new BadRequestException('groupBy is required for aggregate view.');
    }

    const cachePayload = { reportId, query, userId: user.id, mode: 'aggregate' };
    const cached = await this.cache.get<ReportRunResult>('aggregate', cachePayload);
    if (cached) return { ...cached, cached: true };

    const all = await this.executeRun(user, reportId, {
      ...query,
      limit: this.policy.aggregateMaxRows,
      offset: 0,
    });

    const grouped = this.groupRows(reportId, all.items, query.groupBy!.trim());
    const result: ReportRunResult = {
      items: grouped.slice(0, this.policy.aggregateMaxRows),
      total: grouped.length,
      limit: this.policy.aggregateMaxRows,
      offset: 0,
      truncated: grouped.length > this.policy.aggregateMaxRows,
      cached: false,
    };
    await this.cache.set('aggregate', cachePayload, result);
    return result;
  }

  async kpis(user: AuthPrincipal, reportId: string, query: RunReportQueryDto): Promise<ReportKpiDto[]> {
    if (reportId !== 'warehouse-analysis') {
      throw new BadRequestException('KPIs are only available for warehouse-analysis.');
    }
    if (!query.warehouseId?.trim()) {
      throw new BadRequestException('warehouseId is required.');
    }

    const cachePayload = { reportId, query, userId: user.id, mode: 'kpis' };
    const cached = await this.cache.get<ReportKpiDto[]>('kpis', cachePayload);
    if (cached) return cached;

    const kpis = await this.loadWarehouseKpis(user, query);
    await this.cache.set('kpis', cachePayload, kpis);
    return kpis;
  }

  async export(user: AuthPrincipal, reportId: string, query: ExportReportQueryDto): Promise<ReportExportResult> {
    this.assertReportId(reportId);
    const format = query.format ?? 'csv';
    const columns = this.columnsFor(reportId);
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `${reportId}-${stamp}`;

    const rows: ReportRowDto[] = [];
    let offset = 0;
    const pageSize = 500;
    let total = 0;
    let truncated = false;

    while (rows.length < this.policy.exportMaxRows) {
      const page = await this.executeRun(user, reportId, {
        ...query,
        limit: Math.min(pageSize, this.policy.exportMaxRows - rows.length),
        offset,
      });
      total = page.total;
      rows.push(...page.items);
      offset += page.items.length;
      if (page.items.length === 0 || rows.length >= total) break;
      if (rows.length >= this.policy.exportMaxRows) {
        truncated = total > this.policy.exportMaxRows;
        break;
      }
    }

    const body =
      format === 'xls'
        ? reportRowsToXls(columns, rows)
        : reportRowsToCsv(columns, rows);

    return {
      format,
      rowCount: rows.length,
      truncated,
      body,
      filename: format === 'xls' ? `${baseName}.xls` : `${baseName}.csv`,
    };
  }

  private async executeRun(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
  ): Promise<Omit<ReportRunResult, 'cached'>> {
    switch (reportId) {
      case 'inventory':
        return this.runInventory(user, query);
      case 'product-moves':
        return this.runProductMoves(user, query);
      case 'warehouse-analysis':
        return this.runWarehouseAnalysis(user, query);
      case 'billing-revenue':
      case 'billing-outstanding':
      case 'billing-expiring':
      case 'billing-suspended':
      case 'billing-capacity':
        return this.runBillingReport(user, reportId, query);
      default:
        throw new NotFoundException('Unknown report.');
    }
  }

  private async runBillingReport(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
  ): Promise<Omit<ReportRunResult, 'cached'>> {
    const page = await this.billingReports.run(user, reportId, {
      limit: query.limit,
      offset: query.offset,
      companyId: query.companyId,
    });
    return {
      items: page.items,
      total: page.total,
      limit: query.limit,
      offset: query.offset,
      truncated: query.offset + page.items.length < page.total,
    };
  }

  private async runInventory(
    user: AuthPrincipal,
    query: RunReportQueryDto,
  ): Promise<Omit<ReportRunResult, 'cached'>> {
    if (!query.warehouseId?.trim()) {
      throw new BadRequestException('warehouseId is required.');
    }

    const stockQuery = {
      warehouseId: query.warehouseId,
      companyId: query.companyId,
      sku: query.sku?.trim() || undefined,
      status: (query.status?.trim() || undefined) as 'available' | 'quarantined' | undefined,
      limit: query.limit,
      offset: query.offset,
    };

    const [stockPage, companies] = await Promise.all([
      this.inventory.stock(user, stockQuery),
      this.companies.list(user, { includeAll: true }),
    ]);

    const clientName = new Map(companies.map((c) => [c.id, c.name]));

    const items = stockPage.items.map((r) => ({
      id: r.id,
      sku: r.product.sku,
      product: r.product.name,
      client: clientName.get(r.companyId) ?? r.companyId,
      location: r.location.fullPath,
      lot: r.lot?.lotNumber ?? '',
      expiry: r.lot?.expiryDate ? fmtDate(r.lot.expiryDate) : '',
      onHand: fmtQty(r.quantityOnHand),
      reserved: fmtQty(r.quantityReserved),
      available: fmtQty(r.quantityAvailable),
      stockStatus: r.status,
      uom: r.product.uom,
      warehouse: r.warehouse.code,
    }));

    return {
      items,
      total: stockPage.total,
      limit: query.limit,
      offset: query.offset,
      truncated: query.offset + items.length < stockPage.total,
    };
  }

  private async runProductMoves(
    user: AuthPrincipal,
    query: RunReportQueryDto,
  ): Promise<Omit<ReportRunResult, 'cached'>> {
    if (!query.warehouseId?.trim()) {
      throw new BadRequestException('warehouseId is required.');
    }

    const page = await this.inventory.ledger(user, {
      warehouseId: query.warehouseId,
      companyId: query.companyId,
      sku: query.sku?.trim() || undefined,
      movementType: (query.status || undefined) as never,
      createdFrom: query.dateFrom,
      createdTo: query.dateTo,
      limit: query.limit,
      offset: query.offset,
    });

    const items = page.items.map((r) => ({
      id: r.id,
      date: fmtDateTime(r.createdAt),
      product: r.product.name,
      sku: r.product.sku,
      client: r.company.name,
      movement: r.movementType,
      status: 'Done',
      quantity: fmtQty(r.quantity),
      reference: `${r.referenceType} ${String(r.referenceId).slice(0, 8)}…`,
      operator: r.operator.fullName,
      lot: r.lot?.lotNumber ?? '',
      fromLocation: r.fromLocationId ? String(r.locationLabel ?? r.fromLocationId).slice(0, 24) : '',
      toLocation: r.toLocationId ? '→ dest' : '',
    }));

    return {
      items,
      total: page.total,
      limit: query.limit,
      offset: query.offset,
      truncated: query.offset + items.length < page.total,
    };
  }

  private async runWarehouseAnalysis(
    user: AuthPrincipal,
    query: RunReportQueryDto,
  ): Promise<Omit<ReportRunResult, 'cached'>> {
    if (!query.warehouseId?.trim()) {
      throw new BadRequestException('warehouseId is required.');
    }

    const listParams = {
      warehouseId: query.warehouseId,
      companyId: query.companyId,
      createdFrom: query.dateFrom,
      createdTo: query.dateTo,
      limit: 500,
      offset: 0,
    };

    const [inbound, outbound] = await Promise.all([
      this.inbound.list(user, listParams),
      this.outbound.list(user, listParams),
    ]);

    const byWeek = new Map<string, { inbound: number; outbound: number }>();
    for (const o of inbound.items) {
      const key = isoWeekKey(o.createdAt.toISOString());
      const cur = byWeek.get(key) ?? { inbound: 0, outbound: 0 };
      cur.inbound += 1;
      byWeek.set(key, cur);
    }
    for (const o of outbound.items) {
      const key = isoWeekKey(o.createdAt.toISOString());
      const cur = byWeek.get(key) ?? { inbound: 0, outbound: 0 };
      cur.outbound += 1;
      byWeek.set(key, cur);
    }

    const allRows = [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, counts]) => ({
        id: key,
        week: weekLabel(key),
        inboundCount: counts.inbound,
        outboundCount: counts.outbound,
        totalCount: counts.inbound + counts.outbound,
      }));

    const items = allRows.slice(query.offset, query.offset + query.limit);
    return {
      items,
      total: allRows.length,
      limit: query.limit,
      offset: query.offset,
      truncated: query.offset + items.length < allRows.length,
    };
  }

  private async loadWarehouseKpis(user: AuthPrincipal, query: RunReportQueryDto): Promise<ReportKpiDto[]> {
    const listParams = {
      warehouseId: query.warehouseId!,
      companyId: query.companyId,
      createdFrom: query.dateFrom,
      createdTo: query.dateTo,
      limit: 500,
      offset: 0,
    };

    const [overview, inbound, outbound] = await Promise.all([
      this.dashboard.overview(user),
      this.inbound.list(user, listParams),
      this.outbound.list(user, listParams),
    ]);

    const openInbound = inbound.items.filter(
      (o) => o.status !== 'completed' && o.status !== 'cancelled',
    ).length;
    const openOutbound = outbound.items.filter(
      (o) => o.status !== 'shipped' && o.status !== 'cancelled',
    ).length;
    const openTasks = overview.openTasksByType.reduce((sum, row) => sum + row.openCount, 0);
    const cap = overview.capacity;

    const receiptCycles = inbound.items
      .map((o) => daysBetween(o.confirmedAt?.toISOString(), o.completedAt?.toISOString()))
      .filter((d): d is number => d != null);
    const deliveryCycles = outbound.items
      .map((o) => daysBetween(o.confirmedAt?.toISOString(), o.shippedAt?.toISOString()))
      .filter((d): d is number => d != null);

    const avgReceipt =
      receiptCycles.length > 0
        ? (receiptCycles.reduce((a, b) => a + b, 0) / receiptCycles.length).toFixed(2)
        : '—';
    const avgDelivery =
      deliveryCycles.length > 0
        ? (deliveryCycles.reduce((a, b) => a + b, 0) / deliveryCycles.length).toFixed(2)
        : '—';

    return [
      { id: 'receipt-cycle', label: 'Receipts cycle time', value: `${avgReceipt} days`, hint: 'Confirmed → completed (inbound)' },
      { id: 'delivery-cycle', label: 'Deliveries cycle time', value: `${avgDelivery} days`, hint: 'Confirmed → shipped (outbound)' },
      { id: 'open-inbound', label: 'Open inbound', value: String(openInbound), hint: 'Orders not yet received' },
      { id: 'open-outbound', label: 'Open outbound', value: String(openOutbound), hint: 'Orders awaiting fulfillment' },
      { id: 'units-on-hand', label: 'Units on hand', value: fmtQty(overview.counters.totalItemsInStock), hint: 'Client-owned stock' },
      { id: 'open-tasks', label: 'Open tasks', value: String(openTasks), hint: 'Active warehouse tasks' },
      { id: 'capacity', label: 'Storage capacity', value: `${cap.consumedPercent}%`, hint: `${cap.occupiedLocations} / ${cap.totalStorageLocations} locations` },
      { id: 'clients', label: 'Active clients', value: String(overview.counters.totalCustomers), hint: 'Companies with WMS access' },
    ];
  }

  private groupRows(reportId: string, rows: ReportRowDto[], groupBy: string): ReportRowDto[] {
    const buckets = new Map<string, { count: number; sum: number; label: string }>();

    for (const row of rows) {
      const key = String(row[groupBy] ?? '(blank)');
      const cur = buckets.get(key) ?? { count: 0, sum: 0, label: key };
      cur.count += 1;
      const numeric =
        reportId === 'inventory'
          ? Number(row.onHand ?? 0)
          : reportId === 'product-moves'
            ? Number(row.quantity ?? 0)
            : Number(row.totalCount ?? 0);
      cur.sum += Number.isFinite(numeric) ? numeric : 0;
      buckets.set(key, cur);
    }

    return [...buckets.entries()]
      .sort((a, b) => b[1].sum - a[1].sum)
      .map(([key, v]) => ({
        id: key,
        group: v.label,
        count: v.count,
        total: fmtQty(v.sum),
      }));
  }

  private columnsFor(reportId: string): ReportExportColumn[] {
    switch (reportId) {
      case 'inventory':
        return INVENTORY_COLUMNS;
      case 'product-moves':
        return MOVES_COLUMNS;
      case 'warehouse-analysis':
        return WAREHOUSE_COLUMNS;
      case 'billing-revenue':
        return BILLING_REVENUE_COLUMNS;
      case 'billing-outstanding':
        return BILLING_OUTSTANDING_COLUMNS;
      case 'billing-expiring':
        return BILLING_EXPIRING_COLUMNS;
      case 'billing-suspended':
        return BILLING_SUSPENDED_COLUMNS;
      case 'billing-capacity':
        return BILLING_CAPACITY_COLUMNS;
      default:
        return [];
    }
  }

  private assertReportId(reportId: string) {
    if (!this.policy.snapshot().reportIds.includes(reportId as never)) {
      throw new NotFoundException(`Unknown report: ${reportId}`);
    }
  }

  private validatePreviewQuery(query: RunReportQueryDto) {
    if (query.limit > this.policy.previewMaxLimit) {
      throw new BadRequestException(`limit may not exceed ${this.policy.previewMaxLimit}.`);
    }
    if (query.offset > this.policy.previewMaxOffset) {
      throw new BadRequestException(`offset may not exceed ${this.policy.previewMaxOffset}.`);
    }
  }
}
