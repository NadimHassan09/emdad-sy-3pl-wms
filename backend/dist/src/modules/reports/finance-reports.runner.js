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
exports.FinanceReportsRunner = void 0;
exports.daysPastDue = daysPastDue;
exports.receivablesAgingBucket = receivablesAgingBucket;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const SAMPLE_CAP = 2000;
const REVENUE_STATUSES = ['open', 'paid', 'overdue'];
const RECEIVABLE_STATUSES = ['open', 'overdue'];
function fmtDate(iso) {
    if (!iso)
        return '';
    return typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
}
function paginate(rows, limit, offset) {
    return {
        items: rows.slice(offset, offset + limit),
        total: rows.length,
    };
}
function computeDueDate(issuedAt, paymentTermsDays) {
    const due = new Date(issuedAt);
    due.setUTCDate(due.getUTCDate() + paymentTermsDays);
    return due;
}
function daysPastDue(dueAt, now = new Date()) {
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const due = new Date(dueAt);
    due.setUTCHours(0, 0, 0, 0);
    return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}
function receivablesAgingBucket(daysOverdue) {
    if (daysOverdue <= 0)
        return 'Current';
    if (daysOverdue <= 30)
        return '1–30 days';
    if (daysOverdue <= 60)
        return '31–60 days';
    if (daysOverdue <= 90)
        return '61–90 days';
    return '90+ days';
}
let FinanceReportsRunner = class FinanceReportsRunner {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async run(user, reportId, query) {
        switch (reportId) {
            case 'revenue-by-client':
                return this.revenueByClient(user, query);
            case 'receivables-aging':
                return this.receivablesAging(user, query);
            default:
                return { items: [], total: 0 };
        }
    }
    tenantCompanyIds(user) {
        return user.tenantScope === 'restricted' ? user.authorizedCompanyIds : undefined;
    }
    invoiceDateFilter(query) {
        if (!query.dateFrom && !query.dateTo)
            return undefined;
        const issuedAt = {};
        if (query.dateFrom)
            issuedAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
        if (query.dateTo)
            issuedAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
        return issuedAt;
    }
    async revenueByClient(user, query) {
        const tenantIds = this.tenantCompanyIds(user);
        const statusFilter = query.status?.trim();
        const statuses = statusFilter && REVENUE_STATUSES.includes(statusFilter)
            ? [statusFilter]
            : REVENUE_STATUSES;
        const where = {
            status: { in: statuses },
            issuedAt: { not: null },
            ...(query.companyId ? { companyId: query.companyId } : {}),
            ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
        };
        const dateFilter = this.invoiceDateFilter(query);
        if (dateFilter)
            where.issuedAt = { ...dateFilter, not: null };
        const grouped = await this.prisma.invoice.groupBy({
            by: ['companyId'],
            where,
            _sum: { totalAmount: true },
            _count: { id: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
        });
        const companyIds = grouped.map((g) => g.companyId);
        const companies = await this.prisma.company.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, name: true },
        });
        const nameById = new Map(companies.map((c) => [c.id, c.name]));
        const rows = grouped.map((g) => ({
            id: g.companyId,
            client: nameById.get(g.companyId) ?? g.companyId,
            invoiceCount: g._count.id,
            revenue: g._sum.totalAmount?.toString() ?? '0',
        }));
        return paginate(rows, query.limit, query.offset);
    }
    async receivablesAging(user, query) {
        const tenantIds = this.tenantCompanyIds(user);
        const bucketFilter = query.status?.trim();
        const where = {
            status: { in: RECEIVABLE_STATUSES },
            issuedAt: { not: null },
            ...(query.companyId ? { companyId: query.companyId } : {}),
            ...(tenantIds ? { companyId: { in: tenantIds } } : {}),
        };
        const invoices = await this.prisma.invoice.findMany({
            where,
            orderBy: { issuedAt: 'asc' },
            take: SAMPLE_CAP,
            select: {
                id: true,
                invoiceNumber: true,
                status: true,
                totalAmount: true,
                issuedAt: true,
                company: { select: { name: true, paymentTermsDays: true } },
            },
        });
        const now = new Date();
        const rows = invoices
            .map((inv) => {
            const issuedAt = inv.issuedAt;
            const dueAt = computeDueDate(issuedAt, inv.company.paymentTermsDays ?? 30);
            const overdueDays = daysPastDue(dueAt, now);
            const agingBucket = receivablesAgingBucket(overdueDays);
            return {
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                client: inv.company.name,
                status: inv.status,
                amount: inv.totalAmount.toString(),
                issuedAt: fmtDate(issuedAt),
                dueDate: fmtDate(dueAt),
                daysPastDue: String(Math.max(0, overdueDays)),
                agingBucket,
            };
        })
            .filter((r) => !bucketFilter || r.agingBucket === bucketFilter)
            .sort((a, b) => Number(b.daysPastDue) - Number(a.daysPastDue));
        return paginate(rows, query.limit, query.offset);
    }
};
exports.FinanceReportsRunner = FinanceReportsRunner;
exports.FinanceReportsRunner = FinanceReportsRunner = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceReportsRunner);
//# sourceMappingURL=finance-reports.runner.js.map