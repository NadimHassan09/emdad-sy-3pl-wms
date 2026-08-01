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
exports.BillingInvoicesService = exports.INVOICE_SELECT = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_audit_service_1 = require("./billing-audit.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
exports.INVOICE_SELECT = {
    id: true,
    companyId: true,
    billingCycleId: true,
    invoiceSource: true,
    invoiceNumber: true,
    status: true,
    subtotalAmount: true,
    discountType: true,
    discountValue: true,
    discountAmount: true,
    vatPercentage: true,
    vatAmount: true,
    grandTotal: true,
    totalAmount: true,
    issuedAt: true,
    dueDate: true,
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
            lineSource: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            orderChargeId: true,
            createdAt: true,
        },
        orderBy: [{ lineSource: 'asc' }, { createdAt: 'asc' }],
    },
};
let BillingInvoicesService = class BillingInvoicesService {
    prisma;
    companyAccess;
    billingAudit;
    invoiceCalc;
    constructor(prisma, companyAccess, billingAudit, invoiceCalc) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.billingAudit = billingAudit;
        this.invoiceCalc = invoiceCalc;
    }
    async updateStatus(user, id, status) {
        const invoice = await this.findById(user, id);
        const allowed = {
            paid: [client_1.BillingInvoiceStatus.unpaid, client_1.BillingInvoiceStatus.open, client_1.BillingInvoiceStatus.overdue],
            cancelled: [
                client_1.BillingInvoiceStatus.draft,
                client_1.BillingInvoiceStatus.unpaid,
                client_1.BillingInvoiceStatus.open,
                client_1.BillingInvoiceStatus.overdue,
            ],
            unpaid: [client_1.BillingInvoiceStatus.paid, client_1.BillingInvoiceStatus.cancelled],
        };
        const from = invoice.status;
        if (!allowed[status]?.includes(from)) {
            throw new common_1.BadRequestException(`Cannot transition invoice from ${from} to ${status}.`);
        }
        const data = { status: status };
        if (status === 'unpaid' && !invoice.issuedAt) {
            data.issuedAt = new Date();
        }
        const updated = await this.prisma.invoice.update({
            where: { id },
            data,
            select: exports.INVOICE_SELECT,
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
    async issueInvoice(user, id) {
        const invoice = await this.findById(user, id);
        if (invoice.status !== client_1.BillingInvoiceStatus.draft) {
            throw new common_1.BadRequestException('Only draft invoices can be issued.');
        }
        const now = new Date();
        const dueDate = invoice.dueDate ??
            (() => {
                const d = new Date(now);
                d.setUTCDate(d.getUTCDate() + 30);
                return d;
            })();
        return this.prisma.invoice.update({
            where: { id },
            data: {
                status: client_1.BillingInvoiceStatus.unpaid,
                issuedAt: now,
                dueDate,
            },
            select: exports.INVOICE_SELECT,
        });
    }
    async createAdHoc(user, dto) {
        this.companyAccess.assertCompanyAccess(user, dto.companyId);
        if (!dto.lines?.length) {
            throw new common_1.BadRequestException('At least one invoice line is required.');
        }
        return this.prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.create({
                data: {
                    companyId: dto.companyId,
                    invoiceSource: client_1.BillingInvoiceSource.ad_hoc,
                    status: client_1.BillingInvoiceStatus.draft,
                    issuedAt: new Date(dto.invoiceDate),
                    dueDate: new Date(dto.dueDate),
                },
            });
            for (const line of dto.lines) {
                await this.createManualLineTx(tx, invoice.id, line);
            }
            await this.invoiceCalc.applyInvoiceTotals(tx, invoice.id);
            return tx.invoice.findUniqueOrThrow({
                where: { id: invoice.id },
                select: exports.INVOICE_SELECT,
            });
        });
    }
    async updateInvoice(user, id, dto) {
        const invoice = await this.findById(user, id);
        if (invoice.status !== client_1.BillingInvoiceStatus.draft) {
            throw new common_1.BadRequestException('Only draft invoices can be edited.');
        }
        const data = {};
        if (dto.invoiceDate) {
            data.issuedAt = new Date(dto.invoiceDate);
        }
        if (dto.dueDate) {
            data.dueDate = new Date(dto.dueDate);
        }
        if (dto.discountType !== undefined) {
            data.discountType =
                dto.discountType === null ? null : dto.discountType;
        }
        if (dto.discountValue !== undefined) {
            data.discountValue =
                dto.discountValue == null ? null : new client_1.Prisma.Decimal(dto.discountValue);
        }
        if (dto.vatPercentage != null) {
            data.vatPercentage = new client_1.Prisma.Decimal(dto.vatPercentage);
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.invoice.update({ where: { id }, data });
            await this.invoiceCalc.applyInvoiceTotals(tx, id);
            return tx.invoice.findUniqueOrThrow({ where: { id }, select: exports.INVOICE_SELECT });
        });
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
                select: exports.INVOICE_SELECT,
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
            select: exports.INVOICE_SELECT,
        });
    }
    async findById(user, id) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            select: exports.INVOICE_SELECT,
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found.');
        this.companyAccess.assertCompanyAccess(user, invoice.companyId);
        return invoice;
    }
    async getForPdf(user, id) {
        const invoice = await this.findById(user, id);
        const company = await this.prisma.company.findUnique({
            where: { id: invoice.companyId },
            select: {
                name: true,
                tradeName: true,
                contactEmail: true,
                contactPhone: true,
                address: true,
                city: true,
                country: true,
            },
        });
        return { invoice, company };
    }
    async addLine(user, invoiceId, dto) {
        const invoice = await this.findById(user, invoiceId);
        if (invoice.status !== client_1.BillingInvoiceStatus.draft) {
            throw new common_1.BadRequestException('Lines can only be added to draft invoices.');
        }
        return this.prisma.$transaction(async (tx) => {
            const line = await this.createManualLineTx(tx, invoiceId, dto);
            await this.invoiceCalc.applyInvoiceTotals(tx, invoiceId);
            return line;
        });
    }
    async updateManualLine(user, invoiceId, lineId, dto) {
        const invoice = await this.findById(user, invoiceId);
        if (invoice.status !== client_1.BillingInvoiceStatus.draft) {
            throw new common_1.BadRequestException('Only draft invoices can be edited.');
        }
        const line = await this.prisma.invoiceLine.findFirst({
            where: { id: lineId, invoiceId, lineSource: client_1.BillingInvoiceLineSource.manual },
        });
        if (!line)
            throw new common_1.NotFoundException('Manual invoice line not found.');
        const quantity = dto.quantity != null ? new client_1.Prisma.Decimal(dto.quantity) : line.quantity;
        const unitPrice = dto.unitPrice != null ? new client_1.Prisma.Decimal(dto.unitPrice) : line.unitPrice;
        const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.invoiceLine.update({
                where: { id: lineId },
                data: {
                    description: dto.description?.trim(),
                    quantity,
                    unitPrice,
                    totalPrice,
                },
            });
            await this.invoiceCalc.applyInvoiceTotals(tx, invoiceId);
            return updated;
        });
    }
    async removeManualLine(user, invoiceId, lineId) {
        const invoice = await this.findById(user, invoiceId);
        if (invoice.status !== client_1.BillingInvoiceStatus.draft) {
            throw new common_1.BadRequestException('Only draft invoices can be edited.');
        }
        const line = await this.prisma.invoiceLine.findFirst({
            where: { id: lineId, invoiceId, lineSource: client_1.BillingInvoiceLineSource.manual },
        });
        if (!line)
            throw new common_1.NotFoundException('Manual invoice line not found.');
        return this.prisma.$transaction(async (tx) => {
            await tx.invoiceLine.delete({ where: { id: lineId } });
            await this.invoiceCalc.applyInvoiceTotals(tx, invoiceId);
            return { ok: true };
        });
    }
    async createManualLineTx(tx, invoiceId, dto) {
        const quantity = new client_1.Prisma.Decimal(dto.quantity);
        const unitPrice = new client_1.Prisma.Decimal(dto.unitPrice);
        const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
        return tx.invoiceLine.create({
            data: {
                invoiceId,
                type: client_1.BillingInvoiceLineType.manual,
                lineSource: client_1.BillingInvoiceLineSource.manual,
                description: dto.description.trim(),
                quantity,
                unitPrice,
                totalPrice,
            },
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
        billing_audit_service_1.BillingAuditService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService])
], BillingInvoicesService);
//# sourceMappingURL=billing-invoices.service.js.map