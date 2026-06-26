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
exports.ClientBillingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_auth_principal_1 = require("../../../common/auth/client-auth-principal");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const billing_access_service_1 = require("../../billing/billing-access.service");
const billing_cycles_service_1 = require("../../billing/billing-cycles.service");
const billing_invoices_service_1 = require("../../billing/billing-invoices.service");
const billing_plans_service_1 = require("../../billing/billing-plans.service");
const MS_PER_DAY = 86_400_000;
function pickCurrentCycle(cycles, asOf = new Date()) {
    const current = cycles.filter((c) => (c.status === 'active' || c.status === 'renewed') &&
        c.startsAt <= asOf &&
        c.endsAt > asOf);
    if (!current.length)
        return null;
    return current.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
}
function daysRemainingFromEnd(endsAt, asOf = new Date()) {
    return Math.ceil((endsAt.getTime() - asOf.getTime()) / MS_PER_DAY);
}
function deriveAccountStatus(companyStatus, currentCycle) {
    if (companyStatus === 'restricted')
        return 'restricted';
    if (currentCycle) {
        const days = daysRemainingFromEnd(currentCycle.endsAt);
        if (days <= 7)
            return 'expiring';
    }
    return 'active';
}
let ClientBillingService = class ClientBillingService {
    prisma;
    plans;
    cycles;
    invoices;
    access;
    constructor(prisma, plans, cycles, invoices, access) {
        this.prisma = prisma;
        this.plans = plans;
        this.cycles = cycles;
        this.invoices = invoices;
        this.access = access;
    }
    getAccess(client) {
        return this.access.getOperationalAccess(client.companyId);
    }
    assertBillingAccess(client) {
        if (client.role !== client_1.UserRole.client_admin) {
            throw new common_1.ForbiddenException('Only client administrators can access billing.');
        }
    }
    async getSummary(client) {
        this.assertBillingAccess(client);
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        const companyId = client.companyId;
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, name: true, status: true },
        });
        const [planRows, cycleRows, invoiceRows] = await Promise.all([
            this.plans.list(user, companyId),
            this.cycles.list(user, companyId),
            this.invoices.list(user, companyId),
        ]);
        const plan = planRows.find((p) => p.active) ?? planRows[0] ?? null;
        const currentCycle = pickCurrentCycle(cycleRows);
        const daysRemaining = currentCycle ? daysRemainingFromEnd(currentCycle.endsAt) : null;
        const accountStatus = deriveAccountStatus(company?.status ?? 'active', currentCycle);
        const currentInvoice = currentCycle
            ? invoiceRows.find((inv) => inv.billingCycleId === currentCycle.id) ?? null
            : null;
        return {
            accountStatus,
            company: company ?? { id: companyId, name: '', status: 'active' },
            plan,
            currentCycle,
            daysRemaining,
            reservedVolume: plan?.reservedVolume ?? null,
            reservedWeight: plan?.reservedWeight ?? null,
            currentInvoice,
        };
    }
    async listInvoicesPage(client, params) {
        this.assertBillingAccess(client);
        const companyId = client.companyId;
        const limit = Math.min(Math.max(params.limit, 1), 200);
        const offset = Math.max(params.offset, 0);
        const allowedStatuses = ['draft', 'open', 'paid', 'cancelled'];
        const statusFilter = params.status && allowedStatuses.includes(params.status)
            ? params.status
            : undefined;
        const where = { companyId, ...(statusFilter ? { status: statusFilter } : {}) };
        const [items, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
                select: {
                    id: true,
                    companyId: true,
                    billingCycleId: true,
                    invoiceNumber: true,
                    status: true,
                    totalAmount: true,
                    issuedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    billingCycle: {
                        select: {
                            id: true,
                            startsAt: true,
                            endsAt: true,
                            status: true,
                            rateSnapshot: true,
                            billingPlanId: true,
                        },
                    },
                },
            }),
            this.prisma.invoice.count({ where }),
        ]);
        return { items, total, limit, offset };
    }
    async listInvoices(client) {
        this.assertBillingAccess(client);
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.invoices.list(user, client.companyId);
    }
    async getInvoice(client, id) {
        this.assertBillingAccess(client);
        const user = (0, client_auth_principal_1.clientAuthPrincipal)(client);
        return this.invoices.findById(user, id);
    }
};
exports.ClientBillingService = ClientBillingService;
exports.ClientBillingService = ClientBillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_plans_service_1.BillingPlansService,
        billing_cycles_service_1.BillingCyclesService,
        billing_invoices_service_1.BillingInvoicesService,
        billing_access_service_1.BillingAccessService])
], ClientBillingService);
//# sourceMappingURL=client-billing.service.js.map