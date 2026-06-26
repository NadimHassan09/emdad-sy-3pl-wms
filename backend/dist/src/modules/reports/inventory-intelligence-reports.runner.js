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
exports.InventoryIntelligenceReportsRunner = void 0;
exports.expiryAgingBucket = expiryAgingBucket;
exports.stockMovementAgingBucket = stockMovementAgingBucket;
const common_1 = require("@nestjs/common");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const inventory_service_1 = require("../inventory/inventory.service");
const outbound_service_1 = require("../outbound/outbound.service");
const SAMPLE_CAP = 2000;
const STORAGE_LOCATION_TYPES = ['internal', 'fridge', 'quarantine'];
function fmtQty(n) {
    const v = Number(n);
    if (!Number.isFinite(v))
        return '0';
    return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
}
function fmtDate(iso) {
    if (!iso)
        return '';
    return typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
}
function fmtPct(value) {
    if (!Number.isFinite(value))
        return '—';
    return `${Math.round(value)}%`;
}
function paginate(rows, limit, offset) {
    return {
        items: rows.slice(offset, offset + limit),
        total: rows.length,
    };
}
function daysUntilExpiry(expiryDate) {
    if (!expiryDate)
        return null;
    const exp = new Date(expiryDate);
    if (Number.isNaN(exp.getTime()))
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    return Math.round((exp.getTime() - today.getTime()) / 86_400_000);
}
function expiryAgingBucket(days) {
    if (days === null)
        return 'No expiry';
    if (days < 0)
        return 'Expired';
    if (days <= 30)
        return '0–30 days';
    if (days <= 90)
        return '31–90 days';
    if (days <= 180)
        return '91–180 days';
    return '180+ days';
}
function daysSinceMovement(lastMovementAt) {
    if (!lastMovementAt)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mov = new Date(lastMovementAt);
    mov.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - mov.getTime()) / 86_400_000);
}
function stockMovementAgingBucket(days) {
    if (days === null)
        return 'No movement';
    if (days <= 30)
        return '0–30 days';
    if (days <= 90)
        return '31–90 days';
    if (days <= 180)
        return '91–180 days';
    return '180+ days';
}
let InventoryIntelligenceReportsRunner = class InventoryIntelligenceReportsRunner {
    prisma;
    inventory;
    outbound;
    companyAccess;
    constructor(prisma, inventory, outbound, companyAccess) {
        this.prisma = prisma;
        this.inventory = inventory;
        this.outbound = outbound;
        this.companyAccess = companyAccess;
    }
    async run(user, reportId, query) {
        switch (reportId) {
            case 'stock-aging':
                return this.stockAging(user, query);
            case 'lot-expiry':
                return this.lotExpiry(user, query);
            case 'capacity-utilization':
                return this.capacityUtilization(user, query);
            case 'return-rate':
                return this.returnRate(user, query);
            default:
                return { items: [], total: 0 };
        }
    }
    stockQuery(query) {
        return {
            warehouseId: query.warehouseId,
            companyId: query.companyId,
            sku: query.sku?.trim() || undefined,
            limit: SAMPLE_CAP,
            offset: 0,
        };
    }
    async stockAging(user, query) {
        const { items } = await this.inventory.stock(user, this.stockQuery(query));
        const statusFilter = query.status?.trim();
        const rows = items
            .map((row) => {
            const days = daysSinceMovement(row.lastMovementAt);
            const agingBucket = stockMovementAgingBucket(days);
            return {
                id: row.id,
                sku: row.product.sku,
                product: row.product.name,
                client: row.companyId,
                location: row.location.fullPath,
                lastMovement: fmtDate(row.lastMovementAt),
                daysSinceMovement: days === null ? '' : String(days),
                agingBucket,
                onHand: fmtQty(row.quantityOnHand),
                stagnant: agingBucket === '180+ days' || agingBucket === 'No movement' ? 'yes' : 'no',
            };
        })
            .filter((r) => !statusFilter || r.agingBucket === statusFilter)
            .sort((a, b) => Number(a.daysSinceMovement || 9999) - Number(b.daysSinceMovement || 9999));
        const companyIds = [...new Set(rows.map((r) => r.client).filter(Boolean))];
        const companies = companyIds.length > 0
            ? await this.prisma.company.findMany({
                where: { id: { in: companyIds } },
                select: { id: true, name: true },
            })
            : [];
        const companyNames = new Map(companies.map((c) => [c.id, c.name]));
        for (const row of rows) {
            row.client = companyNames.get(String(row.client)) ?? String(row.client ?? '');
        }
        return paginate(rows, query.limit, query.offset);
    }
    async lotExpiry(user, query) {
        const { items } = await this.inventory.stock(user, this.stockQuery(query));
        const statusFilter = query.status?.trim();
        const rows = items
            .filter((row) => row.lot)
            .map((row) => {
            const days = daysUntilExpiry(row.lot?.expiryDate);
            const agingBucket = expiryAgingBucket(days);
            return {
                id: row.id,
                sku: row.product.sku,
                product: row.product.name,
                lot: row.lot?.lotNumber ?? '',
                expiry: fmtDate(row.lot?.expiryDate),
                daysUntil: days === null ? '' : String(days),
                agingBucket,
                location: row.location.fullPath,
                quantity: fmtQty(row.quantityOnHand),
            };
        })
            .filter((r) => !statusFilter || r.agingBucket === statusFilter)
            .sort((a, b) => Number(a.daysUntil || 9999) - Number(b.daysUntil || 9999));
        return paginate(rows, query.limit, query.offset);
    }
    async capacityUtilization(user, query) {
        const warehouseId = query.warehouseId?.trim();
        if (!warehouseId)
            return { items: [], total: 0 };
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        const stockWhere = {
            warehouseId,
            quantityOnHand: { gt: 0 },
            ...(companyId ? { companyId } : {}),
        };
        const [totalLocations, occupiedLocations, stockRows] = await Promise.all([
            this.prisma.location.count({
                where: {
                    warehouseId,
                    type: { in: STORAGE_LOCATION_TYPES },
                    status: 'active',
                },
            }),
            this.prisma.location.count({
                where: {
                    warehouseId,
                    type: { in: STORAGE_LOCATION_TYPES },
                    status: 'active',
                    currentStock: { some: { quantityOnHand: { gt: 0 } } },
                },
            }),
            this.prisma.currentStock.findMany({
                where: stockWhere,
                select: {
                    locationId: true,
                    productId: true,
                    quantityOnHand: true,
                    location: { select: { fullPath: true, name: true } },
                },
                take: SAMPLE_CAP,
            }),
        ]);
        const consumedPercent = totalLocations > 0 ? Math.round((occupiedLocations / totalLocations) * 100) : 0;
        const summary = {
            id: 'summary',
            location: '— Warehouse summary —',
            type: '—',
            skuCount: '',
            totalQty: '',
            utilization: `${consumedPercent}% (${occupiedLocations} / ${totalLocations} locations)`,
        };
        const byLocation = new Map();
        for (const row of stockRows) {
            const cur = byLocation.get(row.locationId) ?? {
                path: row.location.fullPath,
                type: row.location.name,
                skuSet: new Set(),
                qty: 0,
            };
            cur.skuSet.add(row.productId);
            cur.qty += Number(row.quantityOnHand);
            byLocation.set(row.locationId, cur);
        }
        const locationRows = [...byLocation.entries()]
            .map(([id, v]) => ({
            id,
            location: v.path,
            type: v.type,
            skuCount: String(v.skuSet.size),
            totalQty: fmtQty(v.qty),
            utilization: totalLocations
                ? `${Math.round((byLocation.size / totalLocations) * 100)}% active slots`
                : '—',
        }))
            .sort((a, b) => String(a.location).localeCompare(String(b.location)));
        return paginate([summary, ...locationRows], query.limit, query.offset);
    }
    async returnRate(user, query) {
        const warehouseId = query.warehouseId?.trim();
        if (!warehouseId)
            return { items: [], total: 0 };
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        const listParams = {
            warehouseId,
            companyId,
            createdFrom: query.dateFrom,
            createdTo: query.dateTo,
            limit: SAMPLE_CAP,
            offset: 0,
        };
        const returnWhere = {
            ...(companyId ? { companyId } : {}),
            warehouseId,
        };
        if (query.dateFrom || query.dateTo) {
            const createdAt = {};
            if (query.dateFrom)
                createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
            if (query.dateTo)
                createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
            returnWhere.createdAt = createdAt;
        }
        const [outboundPage, returnRows] = await Promise.all([
            this.outbound.list(user, listParams),
            this.prisma.returnOrder.findMany({
                where: returnWhere,
                select: {
                    id: true,
                    companyId: true,
                    company: { select: { name: true } },
                },
                take: SAMPLE_CAP,
            }),
        ]);
        const outboundByCo = new Map();
        for (const order of outboundPage.items) {
            const cur = outboundByCo.get(order.companyId) ?? {
                name: order.company?.name ?? order.companyId,
                count: 0,
            };
            cur.count += 1;
            outboundByCo.set(order.companyId, cur);
        }
        const returnsByCo = new Map();
        for (const ret of returnRows) {
            const cur = returnsByCo.get(ret.companyId) ?? {
                name: ret.company.name,
                count: 0,
            };
            cur.count += 1;
            returnsByCo.set(ret.companyId, cur);
        }
        const allCompanyIds = new Set([...outboundByCo.keys(), ...returnsByCo.keys()]);
        const rows = [...allCompanyIds]
            .map((id) => {
            const outbound = outboundByCo.get(id)?.count ?? 0;
            const returns = returnsByCo.get(id)?.count ?? 0;
            const name = outboundByCo.get(id)?.name ?? returnsByCo.get(id)?.name ?? id;
            const rate = outbound > 0 ? (returns / outbound) * 100 : returns > 0 ? 100 : 0;
            return {
                id,
                client: name,
                outboundOrders: outbound,
                returnOrders: returns,
                returnRatePercent: fmtPct(rate),
            };
        })
            .filter((r) => Number(r.outboundOrders) > 0 || Number(r.returnOrders) > 0)
            .sort((a, b) => Number(b.returnOrders) - Number(a.returnOrders));
        return paginate(rows, query.limit, query.offset);
    }
};
exports.InventoryIntelligenceReportsRunner = InventoryIntelligenceReportsRunner;
exports.InventoryIntelligenceReportsRunner = InventoryIntelligenceReportsRunner = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_service_1.InventoryService,
        outbound_service_1.OutboundService,
        company_access_service_1.CompanyAccessService])
], InventoryIntelligenceReportsRunner);
//# sourceMappingURL=inventory-intelligence-reports.runner.js.map