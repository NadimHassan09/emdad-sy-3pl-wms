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
exports.ClientDashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const billing_usage_service_1 = require("../../billing/billing-usage.service");
const client_billing_service_1 = require("../billing/client-billing.service");
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
const EXPIRY_HORIZON_DAYS = 90;
let ClientDashboardService = class ClientDashboardService {
    prisma;
    usage;
    billing;
    constructor(prisma, usage, billing) {
        this.prisma = prisma;
        this.usage = usage;
        this.billing = billing;
    }
    async getOverview(client) {
        const companyId = client.companyId;
        const isAdmin = client.role === client_1.UserRole.client_admin;
        const expiryBefore = new Date();
        expiryBefore.setUTCDate(expiryBefore.getUTCDate() + EXPIRY_HORIZON_DAYS);
        const [productsCount, openInboundOrders, openOutboundOrders, expiringProductsCount, usageTotals, billingSummary, recentInvoiceRows,] = await Promise.all([
            this.prisma.product.count({ where: { companyId, status: 'active' } }),
            this.prisma.inboundOrder.count({
                where: { companyId, status: { in: INBOUND_OPEN } },
            }),
            this.prisma.outboundOrder.count({
                where: { companyId, status: { in: OUTBOUND_OPEN } },
            }),
            this.countExpiringProducts(companyId, expiryBefore),
            this.usage.getCompanyUsage(companyId),
            isAdmin ? this.billing.getSummary(client).catch(() => null) : Promise.resolve(null),
            isAdmin
                ? this.prisma.invoice.findMany({
                    where: { companyId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        invoiceNumber: true,
                        status: true,
                        totalAmount: true,
                        issuedAt: true,
                        createdAt: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const reservedVolume = billingSummary?.reservedVolume ?? null;
        const reservedWeight = billingSummary?.reservedWeight ?? null;
        const usedVolume = usageTotals.volumeCbm;
        const usedWeight = usageTotals.weightKg;
        let storageUtilizationPercent = null;
        if (reservedVolume) {
            const reserved = Number(reservedVolume);
            const used = Number(usedVolume);
            if (Number.isFinite(reserved) && reserved > 0 && Number.isFinite(used)) {
                storageUtilizationPercent = Math.min(100, Math.round((used / reserved) * 1000) / 10);
            }
        }
        return {
            productsCount,
            openInboundOrders,
            openOutboundOrders,
            activeOrders: openInboundOrders + openOutboundOrders,
            expiringProductsCount,
            storage: {
                usedVolumeCbm: usedVolume.toString(),
                usedWeightKg: usedWeight.toString(),
                reservedVolumeCbm: reservedVolume,
                reservedWeightKg: reservedWeight,
                utilizationPercent: storageUtilizationPercent,
            },
            billing: billingSummary
                ? {
                    daysUntilExpiration: billingSummary.daysRemaining,
                    currentInvoiceAmount: billingSummary.currentInvoice?.totalAmount ?? null,
                    accountStatus: billingSummary.accountStatus,
                }
                : null,
            recentInvoices: isAdmin
                ? recentInvoiceRows.map((row) => ({
                    id: row.id,
                    invoiceNumber: row.invoiceNumber,
                    status: row.status,
                    totalAmount: row.totalAmount.toString(),
                    issuedAt: row.issuedAt?.toISOString() ?? null,
                    createdAt: row.createdAt.toISOString(),
                }))
                : [],
        };
    }
    async countExpiringProducts(companyId, expiryBefore) {
        const rows = await this.prisma.$queryRaw `
      SELECT COUNT(DISTINCT cs.product_id)::bigint AS count
      FROM current_stock cs
      INNER JOIN lots l ON l.id = cs.lot_id
      WHERE cs.company_id = ${companyId}::uuid
        AND cs.quantity_on_hand > 0
        AND l.expiry_date IS NOT NULL
        AND l.expiry_date <= ${expiryBefore}::date
    `;
        return Number(rows[0]?.count ?? 0);
    }
};
exports.ClientDashboardService = ClientDashboardService;
exports.ClientDashboardService = ClientDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_usage_service_1.BillingUsageService,
        client_billing_service_1.ClientBillingService])
], ClientDashboardService);
//# sourceMappingURL=client-dashboard.service.js.map