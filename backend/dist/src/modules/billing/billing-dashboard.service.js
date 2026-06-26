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
exports.BillingDashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const INVOICE_WIDGET_SELECT = {
    id: true,
    companyId: true,
    invoiceNumber: true,
    status: true,
    totalAmount: true,
    createdAt: true,
    company: { select: { id: true, name: true } },
};
let BillingDashboardService = class BillingDashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    tenantFilter(user) {
        if (user.tenantScope === 'restricted') {
            return { id: { in: user.authorizedCompanyIds } };
        }
        return undefined;
    }
    async listOverdueClients(user, limit = 5) {
        const take = Math.min(Math.max(limit, 1), 20);
        const tenant = this.tenantFilter(user);
        const companies = await this.prisma.company.findMany({
            where: {
                status: client_1.CompanyStatus.restricted,
                ...(tenant ? tenant : {}),
            },
            orderBy: { updatedAt: 'desc' },
            take,
            select: {
                id: true,
                name: true,
                status: true,
                updatedAt: true,
                billingCycles: {
                    where: { status: 'expired' },
                    orderBy: { endsAt: 'desc' },
                    take: 1,
                    select: { id: true, endsAt: true },
                },
            },
        });
        return companies.map((c) => ({
            companyId: c.id,
            companyName: c.name,
            status: c.status,
            lastCycleEndedAt: c.billingCycles[0]?.endsAt?.toISOString() ?? null,
            restrictedSince: c.updatedAt.toISOString(),
        }));
    }
    async listRecentInvoices(user, limit = 5) {
        const take = Math.min(Math.max(limit, 1), 20);
        const where = {
            status: { in: ['open', 'paid'] },
        };
        if (user.tenantScope === 'restricted') {
            where.companyId = { in: user.authorizedCompanyIds };
        }
        const rows = await this.prisma.invoice.findMany({
            where,
            orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
            take,
            select: INVOICE_WIDGET_SELECT,
        });
        return rows.map((row) => ({
            id: row.id,
            companyId: row.companyId,
            companyName: row.company.name,
            invoiceNumber: row.invoiceNumber,
            status: row.status,
            totalAmount: row.totalAmount.toString(),
            createdAt: row.createdAt.toISOString(),
        }));
    }
    async listExpiringBuckets(user) {
        const now = new Date();
        const thresholds = [30, 14, 7, 3];
        const tenantCompanyIds = user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;
        const cycles = await this.prisma.billingCycle.findMany({
            where: {
                status: { in: ['active', 'renewed'] },
                endsAt: { gt: now },
                ...(tenantCompanyIds ? { companyId: { in: tenantCompanyIds } } : {}),
            },
            select: {
                id: true,
                companyId: true,
                endsAt: true,
                company: { select: { id: true, name: true, status: true } },
            },
        });
        const buckets = {
            expiring30: [],
            expiring14: [],
            expiring7: [],
            expiring3: [],
            expired: [],
            suspended: [],
        };
        for (const cycle of cycles) {
            const days = Math.max(0, Math.ceil((cycle.endsAt.getTime() - now.getTime()) / 86_400_000));
            const row = {
                companyId: cycle.companyId,
                companyName: cycle.company.name,
                cycleId: cycle.id,
                daysRemaining: days,
                endsAt: cycle.endsAt.toISOString(),
            };
            if (days <= 3)
                buckets.expiring3.push(row);
            else if (days <= 7)
                buckets.expiring7.push(row);
            else if (days <= 14)
                buckets.expiring14.push(row);
            else if (days <= 30)
                buckets.expiring30.push(row);
        }
        const restricted = await this.prisma.company.findMany({
            where: {
                status: client_1.CompanyStatus.restricted,
                ...(tenantCompanyIds ? { id: { in: tenantCompanyIds } } : {}),
            },
            select: { id: true, name: true, updatedAt: true },
        });
        buckets.suspended = restricted.map((c) => ({
            companyId: c.id,
            companyName: c.name,
            cycleId: '',
            daysRemaining: 0,
            endsAt: c.updatedAt.toISOString(),
        }));
        return buckets;
    }
    async getSummary(user) {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const tenantCompanyIds = user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;
        const invoiceWhere = {
            ...(tenantCompanyIds ? { companyId: { in: tenantCompanyIds } } : {}),
        };
        const [outstanding, monthRevenue, openCount, overdueCount, suspendedCount] = await Promise.all([
            this.prisma.invoice.aggregate({
                where: { ...invoiceWhere, status: { in: ['open', 'overdue'] } },
                _sum: { totalAmount: true },
            }),
            this.prisma.invoice.aggregate({
                where: {
                    ...invoiceWhere,
                    status: 'paid',
                    updatedAt: { gte: monthStart },
                },
                _sum: { totalAmount: true },
            }),
            this.prisma.invoice.count({
                where: { ...invoiceWhere, status: 'open' },
            }),
            this.prisma.invoice.count({
                where: { ...invoiceWhere, status: 'overdue' },
            }),
            this.prisma.company.count({
                where: {
                    status: client_1.CompanyStatus.restricted,
                    ...(tenantCompanyIds ? { id: { in: tenantCompanyIds } } : {}),
                },
            }),
        ]);
        return {
            outstandingAmount: (outstanding._sum.totalAmount ?? new client_1.Prisma.Decimal(0)).toString(),
            currentMonthRevenue: (monthRevenue._sum.totalAmount ?? new client_1.Prisma.Decimal(0)).toString(),
            openInvoiceCount: openCount,
            overdueInvoiceCount: overdueCount,
            suspendedAccountCount: suspendedCount,
        };
    }
    async listSuspendedAccounts(user, limit = 5) {
        const take = Math.min(Math.max(limit, 1), 20);
        const tenant = this.tenantFilter(user);
        const companies = await this.prisma.company.findMany({
            where: {
                status: client_1.CompanyStatus.restricted,
                ...(tenant ? tenant : {}),
            },
            orderBy: { name: 'asc' },
            take,
            select: {
                id: true,
                name: true,
                status: true,
                updatedAt: true,
            },
        });
        return companies.map((c) => ({
            companyId: c.id,
            companyName: c.name,
            status: c.status,
            suspendedSince: c.updatedAt.toISOString(),
        }));
    }
};
exports.BillingDashboardService = BillingDashboardService;
exports.BillingDashboardService = BillingDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingDashboardService);
//# sourceMappingURL=billing-dashboard.service.js.map