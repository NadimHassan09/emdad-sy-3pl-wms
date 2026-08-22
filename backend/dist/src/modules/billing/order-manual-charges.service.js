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
exports.OrderManualChargesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
const CHARGE_SELECT = {
    id: true,
    companyId: true,
    referenceType: true,
    referenceId: true,
    description: true,
    quantity: true,
    unitPrice: true,
    totalPrice: true,
    createdBy: true,
    createdAt: true,
};
let OrderManualChargesService = class OrderManualChargesService {
    prisma;
    companyAccess;
    invoiceCalc;
    constructor(prisma, companyAccess, invoiceCalc) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.invoiceCalc = invoiceCalc;
    }
    async listForReference(user, referenceType, referenceId) {
        const companyId = await this.resolveReferenceCompanyId(referenceType, referenceId);
        this.companyAccess.assertCompanyAccess(user, companyId);
        return this.prisma.orderManualCharge.findMany({
            where: { referenceType, referenceId },
            orderBy: { createdAt: 'asc' },
            select: CHARGE_SELECT,
        });
    }
    async create(user, dto) {
        const companyId = await this.resolveReferenceCompanyId(dto.referenceType, dto.referenceId);
        this.companyAccess.assertCompanyAccess(user, companyId);
        const quantity = new client_1.Prisma.Decimal(dto.quantity);
        const unitPrice = new client_1.Prisma.Decimal(dto.unitPrice);
        const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
        const charge = await this.prisma.orderManualCharge.create({
            data: {
                companyId,
                referenceType: dto.referenceType,
                referenceId: dto.referenceId,
                description: dto.description.trim(),
                quantity,
                unitPrice,
                totalPrice,
                createdBy: user.id,
            },
            select: CHARGE_SELECT,
        });
        void this.invoiceCalc.recalculateForCompany(companyId, 'order_manual_charge');
        return charge;
    }
    async update(user, id, dto) {
        const existing = await this.prisma.orderManualCharge.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Order manual charge not found.');
        this.companyAccess.assertCompanyAccess(user, existing.companyId);
        const quantity = dto.quantity != null ? new client_1.Prisma.Decimal(dto.quantity) : existing.quantity;
        const unitPrice = dto.unitPrice != null ? new client_1.Prisma.Decimal(dto.unitPrice) : existing.unitPrice;
        const totalPrice = quantity.mul(unitPrice).toDecimalPlaces(2);
        const charge = await this.prisma.orderManualCharge.update({
            where: { id },
            data: {
                description: dto.description?.trim(),
                quantity,
                unitPrice,
                totalPrice,
            },
            select: CHARGE_SELECT,
        });
        void this.invoiceCalc.recalculateForCompany(existing.companyId, 'order_manual_charge');
        return charge;
    }
    async remove(user, id) {
        const existing = await this.prisma.orderManualCharge.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Order manual charge not found.');
        this.companyAccess.assertCompanyAccess(user, existing.companyId);
        await this.prisma.orderManualCharge.delete({ where: { id } });
        void this.invoiceCalc.recalculateForCompany(existing.companyId, 'order_manual_charge');
        return { ok: true };
    }
    async resolveReferenceCompanyId(referenceType, referenceId) {
        if (referenceType === 'inbound_order') {
            const order = await this.prisma.inboundOrder.findUnique({
                where: { id: referenceId },
                select: { companyId: true },
            });
            if (!order)
                throw new common_1.NotFoundException('Inbound order not found.');
            return order.companyId;
        }
        if (referenceType === 'outbound_order') {
            const order = await this.prisma.outboundOrder.findUnique({
                where: { id: referenceId },
                select: { companyId: true },
            });
            if (!order)
                throw new common_1.NotFoundException('Outbound order not found.');
            return order.companyId;
        }
        throw new common_1.BadRequestException('referenceType must be inbound_order or outbound_order.');
    }
};
exports.OrderManualChargesService = OrderManualChargesService;
exports.OrderManualChargesService = OrderManualChargesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService])
], OrderManualChargesService);
//# sourceMappingURL=order-manual-charges.service.js.map