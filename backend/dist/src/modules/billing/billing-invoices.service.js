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
exports.BillingInvoicesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_audit_service_1 = require("./billing-audit.service");
const INVOICE_SELECT = {
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
    lines: {
        select: {
            id: true,
            type: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
        },
    },
};
let BillingInvoicesService = class BillingInvoicesService {
    prisma;
    companyAccess;
    billingAudit;
    constructor(prisma, companyAccess, billingAudit) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.billingAudit = billingAudit;
    }
    async updateStatus(user, id, status) {
        const invoice = await this.findById(user, id);
        const allowed = {
            paid: [client_1.BillingInvoiceStatus.open, client_1.BillingInvoiceStatus.overdue],
            cancelled: [
                client_1.BillingInvoiceStatus.draft,
                client_1.BillingInvoiceStatus.open,
                client_1.BillingInvoiceStatus.overdue,
            ],
            open: [client_1.BillingInvoiceStatus.paid, client_1.BillingInvoiceStatus.cancelled],
        };
        const from = invoice.status;
        if (!allowed[status]?.includes(from)) {
            throw new common_1.BadRequestException(`Cannot transition invoice from ${from} to ${status}.`);
        }
        const updated = await this.prisma.invoice.update({
            where: { id },
            data: { status: status },
            select: INVOICE_SELECT,
        });
        const action = status === 'paid'
            ? billing_audit_service_1.BILLING_AUDIT_ACTIONS.INVOICE_PAID
            : status === 'cancelled'
                ? billing_audit_service_1.BILLING_AUDIT_ACTIONS.INVOICE_CANCELLED
                : billing_audit_service_1.BILLING_AUDIT_ACTIONS.INVOICE_GENERATED;
        void this.billingAudit.fromUser(user, {
            action,
            resourceType: 'invoice',
            resourceId: id,
            companyId: invoice.companyId,
            previousState: { status: from },
            newState: { status },
        });
        return updated;
    }
    async listPage(user, query) {
        const where = this.buildInvoiceWhere(user, query);
        const orderBy = this.buildInvoiceOrderBy(query);
        const [items, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                orderBy,
                skip: query.offset,
                take: query.limit,
                select: INVOICE_SELECT,
            }),
            this.prisma.invoice.count({ where }),
        ]);
        return { items, total, limit: query.limit, offset: query.offset };
    }
    list(user, companyId) {
        const where = {};
        if (companyId) {
            this.companyAccess.assertCompanyAccess(user, companyId);
            where.companyId = companyId;
        }
        else if (user.tenantScope === 'restricted') {
            where.companyId = { in: user.authorizedCompanyIds };
        }
        return this.prisma.invoice.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: INVOICE_SELECT,
        });
    }
    async findById(user, id) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            select: INVOICE_SELECT,
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found.');
        this.companyAccess.assertCompanyAccess(user, invoice.companyId);
        return invoice;
    }
    async addLine(user, invoiceId, dto) {
        const invoice = await this.findById(user, invoiceId);
        if (invoice.status !== 'draft') {
            throw new common_1.BadRequestException('Lines can only be added to draft invoices.');
        }
        const quantity = new client_1.Prisma.Decimal(dto.quantity);
        const unitPrice = new client_1.Prisma.Decimal(dto.unitPrice);
        const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
        return this.prisma.$transaction(async (tx) => {
            const line = await tx.invoiceLine.create({
                data: {
                    invoiceId,
                    type: dto.type,
                    quantity,
                    unitPrice,
                    totalPrice,
                },
            });
            const agg = await tx.invoiceLine.aggregate({
                where: { invoiceId },
                _sum: { totalPrice: true },
            });
            await tx.invoice.update({
                where: { id: invoiceId },
                data: { totalAmount: agg._sum.totalPrice ?? new client_1.Prisma.Decimal(0) },
            });
            return line;
        });
    }
    buildInvoiceWhere(user, query) {
        const where = {};
        if (query.companyId) {
            this.companyAccess.assertCompanyAccess(user, query.companyId);
            where.companyId = query.companyId;
        }
        else if (user.tenantScope === 'restricted') {
            where.companyId = { in: user.authorizedCompanyIds };
        }
        if (query.status) {
            where.status = query.status;
        }
        if (query.search?.trim()) {
            const term = query.search.trim();
            where.invoiceNumber = { contains: term, mode: 'insensitive' };
        }
        if (query.createdFrom || query.createdTo) {
            where.createdAt = {};
            if (query.createdFrom) {
                where.createdAt.gte = new Date(query.createdFrom);
            }
            if (query.createdTo) {
                const to = new Date(query.createdTo);
                to.setUTCHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }
        const cycleWhere = {};
        if (query.cycleStatus) {
            cycleWhere.status = query.cycleStatus;
        }
        if (query.expiryFrom || query.expiryTo) {
            cycleWhere.endsAt = {};
            if (query.expiryFrom) {
                cycleWhere.endsAt.gte = new Date(query.expiryFrom);
            }
            if (query.expiryTo) {
                const to = new Date(query.expiryTo);
                to.setUTCHours(23, 59, 59, 999);
                cycleWhere.endsAt.lte = to;
            }
        }
        if (Object.keys(cycleWhere).length > 0) {
            where.billingCycle = cycleWhere;
        }
        return where;
    }
    buildInvoiceOrderBy(query) {
        const dir = query.sort_dir === 'asc' ? 'asc' : 'desc';
        switch (query.sort_by) {
            case 'invoiceNumber':
                return { invoiceNumber: dir };
            case 'totalAmount':
                return { totalAmount: dir };
            case 'status':
                return { status: dir };
            case 'issuedAt':
                return { issuedAt: dir };
            case 'createdAt':
            default:
                return { createdAt: dir };
        }
    }
};
exports.BillingInvoicesService = BillingInvoicesService;
exports.BillingInvoicesService = BillingInvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        billing_audit_service_1.BillingAuditService])
], BillingInvoicesService);
//# sourceMappingURL=billing-invoices.service.js.map