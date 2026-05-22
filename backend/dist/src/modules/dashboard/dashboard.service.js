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
const open_orders_chart_util_1 = require("./open-orders-chart.util");
const INBOUND_OPEN = [
    client_1.InboundOrderStatus.draft,
    client_1.InboundOrderStatus.pending_approval,
    client_1.InboundOrderStatus.confirmed,
    client_1.InboundOrderStatus.in_progress,
    client_1.InboundOrderStatus.partially_received,
];
const OUTBOUND_OPEN = [
    client_1.OutboundOrderStatus.draft,
    client_1.OutboundOrderStatus.pending_approval,
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
function startOfUtcDay(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addUtcMonths(day, months) {
    const x = new Date(day);
    x.setUTCMonth(x.getUTCMonth() + months);
    return x;
}
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async openOrdersCharts(_user) {
        const [openInbound, openOutbound] = await Promise.all([
            this.prisma.inboundOrder.findMany({
                where: { status: { in: INBOUND_OPEN } },
                select: { id: true },
            }),
            this.prisma.outboundOrder.findMany({
                where: { status: { in: OUTBOUND_OPEN } },
                select: { id: true },
            }),
        ]);
        const orderIds = [
            ...openInbound.map((o) => o.id),
            ...openOutbound.map((o) => o.id),
        ];
        const workflows = orderIds.length === 0
            ? []
            : await this.prisma.workflowInstance.findMany({
                where: {
                    referenceType: { in: ['inbound_order', 'outbound_order'] },
                    referenceId: { in: orderIds },
                },
                select: { id: true, referenceType: true, referenceId: true },
            });
        const instanceIds = workflows.map((w) => w.id);
        const tasks = instanceIds.length === 0
            ? []
            : await this.prisma.warehouseTask.findMany({
                where: { workflowInstanceId: { in: instanceIds } },
                select: { id: true, workflowInstanceId: true, taskType: true, status: true },
            });
        const inboundWorkflowByOrder = new Map();
        const outboundWorkflowByOrder = new Map();
        for (const wf of workflows) {
            if (wf.referenceType === 'inbound_order') {
                inboundWorkflowByOrder.set(wf.referenceId, wf.id);
            }
            else if (wf.referenceType === 'outbound_order') {
                outboundWorkflowByOrder.set(wf.referenceId, wf.id);
            }
        }
        const tasksByInstanceId = new Map();
        for (const task of tasks) {
            const cur = tasksByInstanceId.get(task.workflowInstanceId) ?? [];
            cur.push({
                id: task.id,
                taskType: task.taskType,
                status: task.status,
            });
            tasksByInstanceId.set(task.workflowInstanceId, cur);
        }
        const inbound = (0, open_orders_chart_util_1.buildInboundOpenOrdersChart)(openInbound, inboundWorkflowByOrder, tasksByInstanceId);
        const outbound = (0, open_orders_chart_util_1.buildOutboundOpenOrdersChart)(openOutbound, outboundWorkflowByOrder, tasksByInstanceId);
        return { inbound, outbound };
    }
    async overview(_user) {
        const today = startOfUtcDay(new Date());
        const sixMonthsEnd = addUtcMonths(today, 6);
        const [stockAgg, productsCount, companiesCount, openInboundCount, openOutboundCount, openTasksGrouped, taskPipelineGrouped, occupiedLocationsCount, totalStorageLocationsCount, soonExpiryRows, missingExpiryRows, recentInbound, recentOutbound,] = await Promise.all([
            this.prisma.currentStock.aggregate({
                where: {},
                _sum: { quantityOnHand: true },
            }),
            this.prisma.product.count(),
            this.prisma.company.count(),
            this.prisma.inboundOrder.count({
                where: { status: { in: INBOUND_OPEN } },
            }),
            this.prisma.outboundOrder.count({
                where: { status: { in: OUTBOUND_OPEN } },
            }),
            this.prisma.warehouseTask.groupBy({
                by: ['taskType'],
                where: {
                    status: { in: OPEN_TASK_STATUSES },
                },
                _count: true,
            }),
            this.prisma.warehouseTask.groupBy({
                by: ['taskType', 'status'],
                where: {
                    taskType: { in: TASK_CARD_MAP.map((t) => t.key) },
                    status: { in: [...OPEN_TASK_STATUSES, client_1.WarehouseTaskStatus.completed] },
                },
                _count: { _all: true },
            }),
            this.prisma.location.count({
                where: {
                    type: { in: ['internal', 'fridge', 'quarantine'] },
                    status: 'active',
                    currentStock: {
                        some: {
                            quantityOnHand: { gt: 0 },
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
                    quantityOnHand: { gt: 0 },
                    lotId: { not: null },
                    lot: {
                        expiryDate: { not: null, lte: sixMonthsEnd },
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
            this.prisma.currentStock.findMany({
                where: {
                    quantityOnHand: { gt: 0 },
                    lotId: { not: null },
                    product: { expiryTracking: true, trackingType: 'lot' },
                    lot: { expiryDate: null },
                },
                select: {
                    lotId: true,
                    quantityOnHand: true,
                    lot: { select: { id: true, lotNumber: true, expiryDate: true } },
                    product: { select: { id: true, name: true } },
                    location: { select: { id: true, name: true } },
                },
                orderBy: [{ product: { name: 'asc' } }],
                take: 100,
            }),
            this.prisma.inboundOrder.findMany({
                where: { status: { in: INBOUND_OPEN } },
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
                where: { status: { in: OUTBOUND_OPEN } },
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
        const openTaskCounts = new Map(openTasksGrouped.map((r) => [r.taskType, Number(r._count)]));
        const pipelineByType = new Map();
        for (const row of taskPipelineGrouped) {
            const cur = pipelineByType.get(row.taskType) ?? { open: 0, completed: 0 };
            const n = row._count._all;
            if (row.status === client_1.WarehouseTaskStatus.completed) {
                cur.completed += n;
            }
            else {
                cur.open += n;
            }
            pipelineByType.set(row.taskType, cur);
        }
        const openTasksByType = TASK_CARD_MAP.map((t) => {
            const pipe = pipelineByType.get(t.key);
            return {
                key: t.key,
                label: t.label,
                openCount: pipe?.open ?? openTaskCounts.get(t.key) ?? 0,
                completedCount: pipe?.completed ?? 0,
            };
        });
        const allExpiryAlertRows = [...missingExpiryRows, ...soonExpiryRows];
        const productIds = Array.from(new Set(allExpiryAlertRows.map((r) => r.product.id)));
        const totalsByProduct = await this.prisma.currentStock.groupBy({
            by: ['productId'],
            where: {
                productId: { in: productIds },
            },
            _sum: { quantityOnHand: true },
        });
        const productTotalMap = new Map(totalsByProduct.map((r) => [r.productId, Number(r._sum.quantityOnHand ?? 0)]));
        const byLot = new Map();
        for (const row of allExpiryAlertRows) {
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
        const todayMs = today.getTime();
        const soonExpiryLots = Array.from(byLot.values())
            .sort((a, b) => {
            const rank = (expiryDate) => {
                if (!expiryDate)
                    return 0;
                const ms = new Date(expiryDate).getTime();
                if (ms < todayMs)
                    return 1;
                return 2;
            };
            const ra = rank(a.expiryDate);
            const rb = rank(b.expiryDate);
            if (ra !== rb)
                return ra - rb;
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