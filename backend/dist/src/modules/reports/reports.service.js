"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const companies_service_1 = require("../companies/companies.service");
const dashboard_service_1 = require("../dashboard/dashboard.service");
const inbound_service_1 = require("../inbound/inbound.service");
const inventory_service_1 = require("../inventory/inventory.service");
const outbound_service_1 = require("../outbound/outbound.service");
const report_export_service_1 = require("./framework/report-export.service");
const reports_framework_service_1 = require("./framework/reports-framework.service");
const finance_reports_runner_1 = require("./finance-reports.runner");
const inventory_intelligence_reports_runner_1 = require("./inventory-intelligence-reports.runner");
const operational_reports_runner_1 = require("./operational-reports.runner");
const reports_policy_config_1 = require("./reports-policy.config");
function fmtQty(n) {
    const v = Number(n);
    if (!Number.isFinite(v))
        return '0';
    return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}
function fmtDate(iso) {
    if (!iso)
        return '';
    const d = typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
    return d;
}
function fmtDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toISOString().replace('T', ' ').slice(0, 19);
}
function isoWeekKey(isoDate) {
    const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime()))
        return isoDate.slice(0, 10);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function weekLabel(key) {
    const m = key.match(/^(\d{4})-W(\d{2})$/);
    if (!m)
        return key;
    return `W${m[2]} ${m[1]}`;
}
function daysBetween(start, end) {
    if (!start || !end)
        return null;
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a)
        return null;
    return (b - a) / 86_400_000;
}
let ReportsService = class ReportsService {
    inventory;
    inbound;
    outbound;
    dashboard;
    companies;
    policy;
    framework;
    exportService;
    operationalReports;
    inventoryIntelligenceReports;
    financeReports;
    constructor(inventory, inbound, outbound, dashboard, companies, policy, framework, exportService, operationalReports, inventoryIntelligenceReports, financeReports) {
        this.inventory = inventory;
        this.inbound = inbound;
        this.outbound = outbound;
        this.dashboard = dashboard;
        this.companies = companies;
        this.policy = policy;
        this.framework = framework;
        this.exportService = exportService;
        this.operationalReports = operationalReports;
        this.inventoryIntelligenceReports = inventoryIntelligenceReports;
        this.financeReports = financeReports;
    }
    getPolicy() {
        return this.policy.snapshot();
    }
    async run(user, reportId, query) {
        const prepared = this.framework.prepareQuery(user, reportId, query);
        return this.framework.runCached(user, reportId, prepared, 'run', () => this.executeRun(user, reportId, prepared));
    }
    async aggregate(user, reportId, query) {
        const def = this.framework.resolveDefinition(reportId);
        if (!def.supportsAggregate) {
            throw new common_1.BadRequestException('Aggregate view is not supported for this report.');
        }
        if (!query.groupBy?.trim()) {
            throw new common_1.BadRequestException('groupBy is required for aggregate view.');
        }
        const prepared = this.framework.prepareQuery(user, reportId, query);
        return this.framework.runCached(user, reportId, prepared, 'aggregate', async () => {
            const all = await this.executeRun(user, reportId, {
                ...prepared,
                limit: this.policy.aggregateMaxRows,
                offset: 0,
            });
            const grouped = this.groupRows(reportId, all.items, prepared.groupBy.trim());
            return {
                items: grouped.slice(0, this.policy.aggregateMaxRows),
                total: grouped.length,
                limit: this.policy.aggregateMaxRows,
                offset: 0,
                truncated: grouped.length > this.policy.aggregateMaxRows,
            };
        }, { mode: 'aggregate' });
    }
    async kpis(user, reportId, query) {
        const def = this.framework.resolveDefinition(reportId);
        if (!def.supportsKpis) {
            throw new common_1.BadRequestException('KPIs are not available for this report.');
        }
        const prepared = this.framework.prepareQuery(user, reportId, query);
        const cachePayload = { reportId, query: prepared, userId: user.id, mode: 'kpis' };
        const { value } = await this.framework.getOrSetCache('kpis', cachePayload, () => this.loadWarehouseKpis(user, prepared));
        return value;
    }
    async export(user, reportId, query) {
        const prepared = this.framework.prepareQuery(user, reportId, query);
        const format = query.format ?? 'csv';
        return this.exportService.buildExport(reportId, prepared, format, (offset, limit) => this.executeRun(user, reportId, { ...prepared, limit, offset }));
    }
    async executeRun(user, reportId, query) {
        switch (reportId) {
            case 'inventory':
                return this.runInventory(user, query);
            case 'product-moves':
                return this.runProductMoves(user, query);
            case 'warehouse-analysis':
                return this.runWarehouseAnalysis(user, query);
            case 'worker-productivity':
            case 'order-cycle-time':
            case 'inbound-accuracy':
            case 'outbound-fill-rate':
            case 'sla-compliance':
                return this.runOperationalReport(user, reportId, query);
            case 'stock-aging':
            case 'lot-expiry':
            case 'capacity-utilization':
            case 'return-rate':
                return this.runInventoryIntelligenceReport(user, reportId, query);
            case 'revenue-by-client':
            case 'receivables-aging':
                return this.runFinanceReport(user, reportId, query);
            default:
                throw new common_1.NotFoundException('Unknown report.');
        }
    }
    async runOperationalReport(user, reportId, query) {
        const page = await this.operationalReports.run(user, reportId, query);
        return {
            items: page.items,
            total: page.total,
            limit: query.limit,
            offset: query.offset,
            truncated: query.offset + page.items.length < page.total,
        };
    }
    async runInventoryIntelligenceReport(user, reportId, query) {
        const page = await this.inventoryIntelligenceReports.run(user, reportId, query);
        return {
            items: page.items,
            total: page.total,
            limit: query.limit,
            offset: query.offset,
            truncated: query.offset + page.items.length < page.total,
        };
    }
    async runFinanceReport(user, reportId, query) {
        const page = await this.financeReports.run(user, reportId, query);
        return {
            items: page.items,
            total: page.total,
            limit: query.limit,
            offset: query.offset,
            truncated: query.offset + page.items.length < page.total,
        };
    }
    async runInventory(user, query) {
        if (!query.warehouseId?.trim()) {
            throw new common_1.BadRequestException('warehouseId is required.');
        }
        const stockQuery = {
            warehouseId: query.warehouseId,
            companyId: query.companyId,
            sku: query.sku?.trim() || undefined,
            status: (query.status?.trim() || undefined),
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
    async runProductMoves(user, query) {
        if (!query.warehouseId?.trim()) {
            throw new common_1.BadRequestException('warehouseId is required.');
        }
        const page = await this.inventory.ledger(user, {
            warehouseId: query.warehouseId,
            companyId: query.companyId,
            sku: query.sku?.trim() || undefined,
            movementType: (query.status || undefined),
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
    async runWarehouseAnalysis(user, query) {
        if (!query.warehouseId?.trim()) {
            throw new common_1.BadRequestException('warehouseId is required.');
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
        const byWeek = new Map();
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
    async loadWarehouseKpis(user, query) {
        const listParams = {
            warehouseId: query.warehouseId,
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
        const openInbound = inbound.items.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
        const openOutbound = outbound.items.filter((o) => o.status !== 'shipped' && o.status !== 'cancelled').length;
        const openTasks = overview.openTasksByType.reduce((sum, row) => sum + row.openCount, 0);
        const cap = overview.capacity;
        const receiptCycles = inbound.items
            .map((o) => daysBetween(o.confirmedAt?.toISOString(), o.completedAt?.toISOString()))
            .filter((d) => d != null);
        const deliveryCycles = outbound.items
            .map((o) => daysBetween(o.confirmedAt?.toISOString(), o.shippedAt?.toISOString()))
            .filter((d) => d != null);
        const avgReceipt = receiptCycles.length > 0
            ? (receiptCycles.reduce((a, b) => a + b, 0) / receiptCycles.length).toFixed(2)
            : '—';
        const avgDelivery = deliveryCycles.length > 0
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
    aggregateNumericValue(reportId, row) {
        switch (reportId) {
            case 'inventory':
                return Number(row.onHand ?? 0);
            case 'product-moves':
                return Number(row.quantity ?? 0);
            case 'warehouse-analysis':
                return Number(row.totalCount ?? 0);
            case 'worker-productivity':
                return Number(row.completedTasks ?? 0);
            case 'order-cycle-time':
                return Number(row.cycleHours ?? 0);
            case 'inbound-accuracy':
                return Number(String(row.accuracyPercent ?? '0').replace('%', ''));
            case 'outbound-fill-rate':
                return Number(String(row.fillRatePercent ?? '0').replace('%', ''));
            case 'sla-compliance':
                return Number(String(row.compliancePercent ?? '0').replace('%', ''));
            case 'stock-aging':
                return Number(row.onHand ?? 0);
            case 'lot-expiry':
                return Number(row.quantity ?? 0);
            case 'capacity-utilization':
                return Number(row.totalQty ?? row.skuCount ?? 0);
            case 'return-rate':
                return Number(String(row.returnRatePercent ?? '0').replace('%', ''));
            case 'revenue-by-client':
                return Number(row.revenue ?? 0);
            case 'receivables-aging':
                return Number(row.amount ?? 0);
            default:
                return Number(row.totalCount ?? row.count ?? 0);
        }
    }
    groupRows(reportId, rows, groupBy) {
        const buckets = new Map();
        for (const row of rows) {
            const key = String(row[groupBy] ?? '(blank)');
            const cur = buckets.get(key) ?? { count: 0, sum: 0, label: key };
            cur.count += 1;
            const numeric = this.aggregateNumericValue(reportId, row);
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
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService,
        inbound_service_1.InboundService,
        outbound_service_1.OutboundService,
        dashboard_service_1.DashboardService,
        companies_service_1.CompaniesService,
        reports_policy_config_1.ReportsPolicyConfig,
        reports_framework_service_1.ReportsFrameworkService,
        report_export_service_1.ReportExportService,
        operational_reports_runner_1.OperationalReportsRunner,
        inventory_intelligence_reports_runner_1.InventoryIntelligenceReportsRunner,
        finance_reports_runner_1.FinanceReportsRunner])
], ReportsService);
//# sourceMappingURL=reports.service.js.map