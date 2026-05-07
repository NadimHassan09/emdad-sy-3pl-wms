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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const INBOUND_OPEN = [
    client_1.InboundOrderStatus.draft,
    client_1.InboundOrderStatus.confirmed,
    client_1.InboundOrderStatus.in_progress,
    client_1.InboundOrderStatus.partially_received,
];
const OUTBOUND_OPEN = [
    client_1.OutboundOrderStatus.draft,
    client_1.OutboundOrderStatus.pending_stock,
    client_1.OutboundOrderStatus.confirmed,
    client_1.OutboundOrderStatus.picking,
    client_1.OutboundOrderStatus.packing,
    client_1.OutboundOrderStatus.ready_to_ship,
];
const OPEN_TASK_STATUSES = [
    client_1.WarehouseTaskStatus.pending,
    client_1.WarehouseTaskStatus.assigned,
    client_1.WarehouseTaskStatus.in_progress,
    client_1.WarehouseTaskStatus.blocked,
    client_1.WarehouseTaskStatus.retry_pending,
];
const TASK_CARD_MAP = [
    { key: 'receiving', label: 'Receive' },
    { key: 'putaway', label: 'Putaway' },
    { key: 'pick', label: 'Pick' },
    { key: 'pack', label: 'Pack' },
    { key: 'dispatch', label: 'Delivery' },
    { key: 'routing', label: 'Internal' },
];
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async openOrdersCharts(user) {
        const companyWhereInbound = user.companyId
            ? { companyId: user.companyId }
            : {};
        const companyWhereOutbound = user.companyId
            ? { companyId: user.companyId }
            : {};
        const [inboundGroups, outboundGroups] = await Promise.all([
            this.prisma.inboundOrder.groupBy({
                by: ['status'],
                where: {
                    ...companyWhereInbound,
                    status: { in: INBOUND_OPEN },
                },
                _count: { _all: true },
            }),
            this.prisma.outboundOrder.groupBy({
                by: ['status'],
                where: {
                    ...companyWhereOutbound,
                    status: { in: OUTBOUND_OPEN },
                },
                _count: { _all: true },
            }),
        ]);
        const inCount = (s) => inboundGroups.find((g) => g.status === s)?._count._all ?? 0;
        const inbound = [
            {
                key: 'new',
                label: 'New',
                count: inCount(client_1.InboundOrderStatus.draft) + inCount(client_1.InboundOrderStatus.confirmed),
            },
            {
                key: 'receive',
                label: 'Receive',
                count: inCount(client_1.InboundOrderStatus.in_progress),
            },
            {
                key: 'putaway',
                label: 'Putaway',
                count: inCount(client_1.InboundOrderStatus.partially_received),
            },
        ];
        const outCount = (s) => outboundGroups.find((g) => g.status === s)?._count._all ?? 0;
        const outbound = [
            {
                key: 'picking',
                label: 'Picking',
                count: outCount(client_1.OutboundOrderStatus.draft) +
                    outCount(client_1.OutboundOrderStatus.pending_stock) +
                    outCount(client_1.OutboundOrderStatus.confirmed) +
                    outCount(client_1.OutboundOrderStatus.picking),
            },
            {
                key: 'packing',
                label: 'Packing',
                count: outCount(client_1.OutboundOrderStatus.packing),
            },
            {
                key: 'shipping',
                label: 'Shipping',
                count: outCount(client_1.OutboundOrderStatus.ready_to_ship),
            },
        ];
        return { inbound, outbound };
    }
    async overview(user) {
        const companyId = user.companyId ?? undefined;
        const companyFilter = companyId ? { companyId } : {};
        const now = new Date();
        const sixMonthsFromNow = new Date(now);
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        const [stockAgg, productsCount, companiesCount, openInboundCount, openOutboundCount, openTasksGrouped, occupiedLocationsCount, totalStorageLocationsCount, soonExpiryRows, recentInbound, recentOutbound,] = await Promise.all([
            this.prisma.currentStock.aggregate({
                where: { ...companyFilter },
                _sum: { quantityOnHand: true },
            }),
            this.prisma.product.count({ where: { ...companyFilter } }),
            this.prisma.company.count(companyId ? { where: { id: companyId } } : undefined),
            this.prisma.inboundOrder.count({
                where: { ...companyFilter, status: { in: INBOUND_OPEN } },
            }),
            this.prisma.outboundOrder.count({
                where: { ...companyFilter, status: { in: OUTBOUND_OPEN } },
            }),
            this.prisma.warehouseTask.groupBy({
                by: ['taskType'],
                where: {
                    status: { in: OPEN_TASK_STATUSES },
                    workflowInstance: companyId ? { companyId } : undefined,
                },
                _count: true,
            }),
            this.prisma.location.count({
                where: {
                    type: { in: ['internal', 'fridge', 'quarantine'] },
                    status: 'active',
                    currentStock: {
                        some: {
                            quantityOnHand: { gt: 0 },
                            ...(companyId ? { companyId } : {}),
                        },
                    },
                },
            }),
            this.prisma.location.count({
                where: {
                    type: { in: ['internal', 'fridge', 'quarantine'] },
                    status: 'active',
                },
            }),
            this.prisma.currentStock.findMany({
                where: {
                    ...companyFilter,
                    quantityOnHand: { gt: 0 },
                    lot: {
                        is: {
                            expiryDate: {
                                gte: now,
                                lte: sixMonthsFromNow,
                            },
                        },
                    },
                },
                select: {
                    lotId: true,
                    quantityOnHand: true,
                    lot: { select: { id: true, lotNumber: true, expiryDate: true } },
                    product: { select: { id: true, name: true } },
                    location: { select: { id: true, name: true } },
                },
                orderBy: [{ lot: { expiryDate: 'asc' } }],
                take: 200,
            }),
            this.prisma.inboundOrder.findMany({
                where: { ...companyFilter, status: { in: INBOUND_OPEN } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    createdAt: true,
                    company: { select: { name: true } },
                },
            }),
            this.prisma.outboundOrder.findMany({
                where: { ...companyFilter, status: { in: OUTBOUND_OPEN } },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    createdAt: true,
                    company: { select: { name: true } },
                },
            }),
        ]);
        const taskCounts = new Map(openTasksGrouped.map((r) => [r.taskType, Number(r._count)]));
        const openTasksByType = TASK_CARD_MAP.map((t) => ({
            key: t.key,
            label: t.label,
            count: taskCounts.get(t.key) ?? 0,
        }));
        const productIds = Array.from(new Set(soonExpiryRows.map((r) => r.product.id)));
        const totalsByProduct = await this.prisma.currentStock.groupBy({
            by: ['productId'],
            where: {
                ...companyFilter,
                productId: { in: productIds },
            },
            _sum: { quantityOnHand: true },
        });
        const productTotalMap = new Map(totalsByProduct.map((r) => [r.productId, Number(r._sum.quantityOnHand ?? 0)]));
        const byLot = new Map();
        for (const row of soonExpiryRows) {
            if (!row.lot)
                continue;
            const cur = byLot.get(row.lot.id);
            if (cur) {
                cur.lotQuantity += Number(row.quantityOnHand);
            }
            else {
                byLot.set(row.lot.id, {
                    lotId: row.lot.id,
                    lotNumber: row.lot.lotNumber,
                    expiryDate: row.lot.expiryDate?.toISOString() ?? null,
                    productId: row.product.id,
                    productName: row.product.name,
                    productTotalQuantity: productTotalMap.get(row.product.id) ?? 0,
                    locationId: row.location.id,
                    locationName: row.location.name,
                    lotQuantity: Number(row.quantityOnHand),
                });
            }
        }
        const soonExpiryLots = Array.from(byLot.values())
            .sort((a, b) => {
            const da = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
            const db = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
            return da - db;
        })
            .slice(0, 10);
        const consumedPercent = totalStorageLocationsCount > 0
            ? Math.round((occupiedLocationsCount / totalStorageLocationsCount) * 100)
            : 0;
        return {
            counters: {
                totalItemsInStock: Number(stockAgg._sum.quantityOnHand ?? 0),
                itemsInCatalog: productsCount,
                totalCustomers: companiesCount,
            },
            openOrders: {
                inbound: openInboundCount,
                outbound: openOutboundCount,
            },
            openTasksByType,
            capacity: {
                occupiedLocations: occupiedLocationsCount,
                totalStorageLocations: totalStorageLocationsCount,
                consumedPercent,
            },
            soonExpiryLots,
            recentOrders: {
                inbound: recentInbound.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    companyName: o.company.name,
                    createdAt: o.createdAt.toISOString(),
                })),
                outbound: recentOutbound.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    companyName: o.company.name,
                    createdAt: o.createdAt.toISOString(),
                })),
            },
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map