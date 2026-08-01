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
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const whereBase = {
                ...(companyFilter ? { companyId: companyFilter } : {}),
            };
            const [totalOrders, ordersToday, pendingApproval, approved, picking, packing, outForDelivery, deliveredToday, cancelled, returns, codPending, codCollected, revenueToday, byStatus, byChannel, recentOrders, ordersPerDay,] = await Promise.all([
                tx.omsOrder.count({ where: whereBase }),
                tx.omsOrder.count({
                    where: { ...whereBase, createdAt: { gte: todayStart } },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.pending_approval },
                }),
                tx.omsOrder.count({
                    where: {
                        ...whereBase,
                        status: {
                            in: [
                                client_1.OmsOrderStatus.approved,
                                client_1.OmsOrderStatus.confirmed,
                                client_1.OmsOrderStatus.allocated,
                            ],
                        },
                    },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.picking },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.packing },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.out_for_delivery },
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
                    where: { ...whereBase, status: client_1.OmsOrderStatus.cancelled },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, status: client_1.OmsOrderStatus.returned },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, codStatus: 'pending' },
                }),
                tx.omsOrder.count({
                    where: { ...whereBase, codStatus: 'collected' },
                }),
                tx.omsOrder.aggregate({
                    where: {
                        ...whereBase,
                        createdAt: { gte: todayStart },
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
                        subtotal: true,
                        currency: true,
                        createdAt: true,
                    },
                }),
                tx.omsOrder.findMany({
                    where: {
                        ...whereBase,
                        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
                    },
                    select: { createdAt: true },
                }),
            ]);
            const perDayMap = new Map();
            for (const row of ordersPerDay) {
                const day = row.createdAt.toISOString().slice(0, 10);
                perDayMap.set(day, (perDayMap.get(day) ?? 0) + 1);
            }
            return {
                totalOrders,
                ordersToday,
                pendingOrders: pendingApproval,
                pendingApproval,
                approved,
                allocatedOrders: approved,
                picking,
                packing,
                outForDelivery,
                deliveredToday,
                cancelled,
                returns,
                codPending,
                codCollected,
                codSettled: 0,
                todaysRevenue: revenueToday._sum.subtotal?.toString() ?? '0',
                ordersByStatus: byStatus.map((r) => ({
                    status: r.status,
                    count: r._count.id,
                })),
                ordersByChannel: byChannel.map((r) => ({
                    channel: r.storeChannel ?? '—',
                    count: r._count.id,
                })),
                ordersPerDay: Array.from(perDayMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, count]) => ({ day, count })),
                recentOrders: recentOrders.map((o) => ({
                    ...o,
                    subtotal: o.subtotal?.toString() ?? null,
                })),
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