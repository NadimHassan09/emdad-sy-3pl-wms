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
exports.OmsDashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const PENDING_FULFILLMENT = [
    client_1.OmsOrderStatus.pending,
    client_1.OmsOrderStatus.approved,
    client_1.OmsOrderStatus.confirmed,
    client_1.OmsOrderStatus.processing,
    client_1.OmsOrderStatus.allocated,
    client_1.OmsOrderStatus.picking,
    client_1.OmsOrderStatus.packing,
    client_1.OmsOrderStatus.ready_to_ship,
    client_1.OmsOrderStatus.shipped,
];
function startOfLocalDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function dayKey(d) {
    return d.toISOString().slice(0, 10);
}
let OmsDashboardService = class OmsDashboardService {
    prisma;
    companyAccess;
    constructor(prisma, companyAccess) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
    }
    async summary(user, companyId) {
        const companyFilter = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const todayStart = startOfLocalDay();
            const yesterdayStart = startOfLocalDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
            const weekStart = startOfLocalDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
            const whereBase = {
                ...(companyFilter ? { companyId: companyFilter } : {}),
            };
            const [totalOrders, ordersToday, ordersYesterday, pendingApproval, pendingApprovalYesterday, pendingFulfillment, pendingFulfillmentYesterday, deliveredToday, deliveredYesterday, returns, returnsYesterday, codPendingCount, codCollectedCount, codPendingSum, codCollectedSum, revenueToday, revenueYesterday, byStatus, byChannel, recentOrders, weekOrders, liveEvents,] = await Promise.all([
                tx.omsOrder.count({ where: whereBase }),
                tx.omsOrder.count({
                    where: { ...whereBase, createdAt: { gte: todayStart } },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        createdAt: { gte: yesterdayStart, lt: todayStart },
                    },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.pending_approval },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        status: client_1.OmsOrderStatus.pending_approval,
                        createdAt: { lt: todayStart },
                    },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: { in: PENDING_FULFILLMENT } },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        status: { in: PENDING_FULFILLMENT },
                        updatedAt: { lt: todayStart },
                    },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        status: {
                            in: [client_1.OmsOrderStatus.delivered, client_1.OmsOrderStatus.completed],
                        },
                        deliveredAt: { gte: todayStart },
                    },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        status: {
                            in: [client_1.OmsOrderStatus.delivered, client_1.OmsOrderStatus.completed],
                        },
                        deliveredAt: { gte: yesterdayStart, lt: todayStart },
                    },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.returned },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        status: client_1.OmsOrderStatus.returned,
                        updatedAt: { gte: yesterdayStart, lt: todayStart },
                    },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, codStatus: 'pending' },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, codStatus: 'collected' },
                }),
                tx.omsOrder.aggregate({
                    where: { ...whereBase, codStatus: 'pending' },
                    _sum: { codAmount: true },
                }),
                tx.omsOrder.aggregate({
                    where: { ...whereBase, codStatus: 'collected' },
                    _sum: { codAmount: true },
                }),
                tx.omsOrder.aggregate({
                    where: { ...whereBase, createdAt: { gte: todayStart } },
                    _sum: { subtotal: true },
                }),
                tx.omsOrder.aggregate({
                    where: {
                        ...whereBase,
                        createdAt: { gte: yesterdayStart, lt: todayStart },
                    },
                    _sum: { subtotal: true },
                }),
                tx.omsOrder.groupBy({
                    by: ['status'],
                    where: whereBase,
                    _count: { id: true },
                }),
                tx.omsOrder.groupBy({
                    by: ['storeChannel'],
                    where: whereBase,
                    _count: { id: true },
                }),
                tx.omsOrder.findMany({
                    where: whereBase,
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        recipientName: true,
                        storeChannel: true,
                        paymentMethod: true,
                        codAmount: true,
                        subtotal: true,
                        currency: true,
                        createdAt: true,
                        company: { select: { id: true, name: true } },
                    },
                }),
                tx.omsOrder.findMany({
                    where: { ...whereBase, createdAt: { gte: weekStart } },
                    select: {
                        createdAt: true,
                        subtotal: true,
                        codAmount: true,
                        codStatus: true,
                    },
                }),
                tx.omsOrderEvent.findMany({
                    where: companyFilter ? { companyId: companyFilter } : {},
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        creator: { select: { id: true, fullName: true } },
                        omsOrder: { select: { id: true, orderNumber: true } },
                    },
                }),
            ]);
            const pendingCommercial = byStatus.find((r) => r.status === client_1.OmsOrderStatus.pending)?._count.id ?? 0;
            const pendingLegacy = byStatus
                .filter((r) => [
                client_1.OmsOrderStatus.approved,
                client_1.OmsOrderStatus.confirmed,
                client_1.OmsOrderStatus.processing,
                client_1.OmsOrderStatus.allocated,
                client_1.OmsOrderStatus.picking,
                client_1.OmsOrderStatus.packing,
                client_1.OmsOrderStatus.ready_to_ship,
                client_1.OmsOrderStatus.shipped,
                client_1.OmsOrderStatus.failed_delivery,
            ].includes(r.status))
                .reduce((s, r) => s + r._count.id, 0);
            const pending = pendingCommercial + pendingLegacy;
            const outForDelivery = byStatus.find((r) => r.status === client_1.OmsOrderStatus.out_for_delivery)?._count
                .id ?? 0;
            const cancelled = (byStatus.find((r) => r.status === client_1.OmsOrderStatus.cancelled)?._count.id ??
                0) +
                (byStatus.find((r) => r.status === client_1.OmsOrderStatus.rejected)?._count.id ??
                    0);
            const perDay = new Map();
            for (let i = 6; i >= 0; i--) {
                const d = startOfLocalDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
                perDay.set(dayKey(d), {
                    orders: 0,
                    revenue: 0,
                    codPending: 0,
                    codCollected: 0,
                });
            }
            for (const row of weekOrders) {
                const key = dayKey(startOfLocalDay(row.createdAt));
                const bucket = perDay.get(key);
                if (!bucket)
                    continue;
                bucket.orders += 1;
                bucket.revenue += Number(row.subtotal ?? 0);
                if (row.codStatus === 'pending') {
                    bucket.codPending += Number(row.codAmount ?? 0);
                }
                if (row.codStatus === 'collected') {
                    bucket.codCollected += Number(row.codAmount ?? 0);
                }
            }
            const pctChange = (today, yesterday) => {
                if (yesterday === 0)
                    return today === 0 ? 0 : null;
                return Math.round(((today - yesterday) / yesterday) * 100);
            };
            const revToday = Number(revenueToday._sum.subtotal ?? 0);
            const revYest = Number(revenueYesterday._sum.subtotal ?? 0);
            return {
                totalOrders,
                ordersToday,
                pendingOrders: pendingApproval,
                pendingApproval,
                pendingFulfillment: pending,
                pending,
                approved: pending,
                allocatedOrders: pending,
                picking: 0,
                packing: 0,
                outForDelivery,
                deliveredToday,
                cancelled,
                returns,
                codPending: codPendingCount,
                codCollected: codCollectedCount,
                codSettled: 0,
                codPendingAmount: (codPendingSum._sum.codAmount ?? 0).toString(),
                codCollectedAmount: (codCollectedSum._sum.codAmount ?? 0).toString(),
                todaysRevenue: (revenueToday._sum.subtotal ?? 0).toString(),
                trends: {
                    ordersToday: pctChange(ordersToday, ordersYesterday),
                    pendingApproval: pctChange(pendingApproval, pendingApprovalYesterday),
                    pendingFulfillment: pctChange(pendingFulfillment, pendingFulfillmentYesterday),
                    deliveredToday: pctChange(deliveredToday, deliveredYesterday),
                    returns: pctChange(returns, returnsYesterday),
                    todaysRevenue: pctChange(revToday, revYest),
                },
                ordersByStatus: byStatus.map((r) => ({
                    status: r.status,
                    count: r._count.id,
                })),
                ordersByChannel: byChannel.map((r) => ({
                    channel: r.storeChannel ?? '—',
                    count: r._count.id,
                })),
                ordersPerDay: Array.from(perDay.entries()).map(([day, v]) => ({
                    day,
                    count: v.orders,
                    revenue: String(v.revenue),
                    codPending: String(v.codPending),
                    codCollected: String(v.codCollected),
                })),
                liveActivity: liveEvents.map((ev) => ({
                    id: ev.id,
                    eventType: ev.eventType,
                    createdAt: ev.createdAt,
                    orderId: ev.omsOrder?.id ?? null,
                    orderNumber: ev.omsOrder?.orderNumber ?? null,
                    actorName: ev.creator?.fullName ?? null,
                    payload: ev.payload,
                })),
                recentOrders: recentOrders.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    recipientName: o.recipientName,
                    storeChannel: o.storeChannel,
                    paymentMethod: o.paymentMethod,
                    codAmount: o.codAmount?.toString() ?? null,
                    subtotal: o.subtotal?.toString() ?? null,
                    currency: o.currency,
                    createdAt: o.createdAt,
                    companyName: o.company?.name ?? null,
                })),
                alerts: [
                    ...(pendingApproval > 0
                        ? [
                            {
                                kind: 'pending_approval',
                                message: `${pendingApproval} order${pendingApproval === 1 ? '' : 's'} pending approval`,
                                count: pendingApproval,
                            },
                        ]
                        : []),
                    ...(returns > 0
                        ? [
                            {
                                kind: 'returns',
                                message: `${returns} return${returns === 1 ? '' : 's'} on file`,
                                count: returns,
                            },
                        ]
                        : []),
                ],
            };
        });
    }
};
exports.OmsDashboardService = OmsDashboardService;
exports.OmsDashboardService = OmsDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService])
], OmsDashboardService);
//# sourceMappingURL=oms-dashboard.service.js.map