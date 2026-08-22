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
exports.OmsReportsRunner = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const SAMPLE_CAP = 2000;
function paginate(rows, limit, offset) {
    return {
        items: rows.slice(offset, offset + limit),
        total: rows.length,
    };
}
function fmtDate(iso) {
    if (!iso)
        return '';
    return typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
}
function fmtDateTime(iso) {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toISOString().replace('T', ' ').slice(0, 19);
}
function dec(v) {
    if (v == null)
        return '0';
    return v.toString();
}
let OmsReportsRunner = class OmsReportsRunner {
    prisma;
    companyAccess;
    constructor(prisma, companyAccess) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
    }
    async run(user, reportId, query) {
        switch (reportId) {
            case 'cod-report':
                return this.codReport(user, query);
            case 'merchant-orders':
                return this.merchantOrders(user, query);
            case 'sales-report':
                return this.salesReport(user, query);
            case 'returns-report':
                return this.returnsReport(user, query);
            case 'delivery-report':
                return this.deliveryReport(user, query);
            case 'allocation-report':
                return this.allocationReport(user, query);
            case 'inventory-reserved':
                return this.inventoryReserved(user, query);
            default:
                return { items: [], total: 0 };
        }
    }
    companyFilter(user, query) {
        return (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
    }
    dateFilter(query) {
        if (!query.dateFrom && !query.dateTo)
            return undefined;
        const createdAt = {};
        if (query.dateFrom)
            createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
        if (query.dateTo)
            createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
        return createdAt;
    }
    async codReport(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            paymentMethod: 'COD',
            ...(companyId ? { companyId } : {}),
            ...(query.status && Object.values(client_1.OmsCodStatus).includes(query.status)
                ? { codStatus: query.status }
                : {}),
        };
        const date = this.dateFilter(query);
        if (date)
            where.createdAt = date;
        const orders = await this.prisma.outboundOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: SAMPLE_CAP,
            include: { company: { select: { name: true } } },
        });
        const rows = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            client: o.company?.name ?? '',
            recipient: o.recipientName ?? '',
            codAmount: dec(o.codAmount),
            codStatus: o.codStatus ?? '',
            currency: o.currency ?? '',
            collectedAt: fmtDateTime(o.codCollectedAt),
            remittedAt: fmtDateTime(o.codRemittedAt),
            orderStatus: o.status,
            createdAt: fmtDateTime(o.createdAt),
        }));
        return paginate(rows, query.limit, query.offset);
    }
    async merchantOrders(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            ...(companyId ? { companyId } : {}),
            ...(query.status ? { status: query.status } : {}),
        };
        const date = this.dateFilter(query);
        if (date)
            where.createdAt = date;
        const orders = await this.prisma.outboundOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: SAMPLE_CAP,
            include: {
                company: { select: { name: true } },
                _count: { select: { lines: true } },
            },
        });
        const rows = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            client: o.company?.name ?? '',
            status: o.status,
            recipient: o.recipientName ?? '',
            city: o.city ?? '',
            paymentMethod: o.paymentMethod ?? '',
            allocationStatus: o.allocationStatus ?? '',
            lineCount: o._count.lines,
            createdAt: fmtDateTime(o.createdAt),
        }));
        return paginate(rows, query.limit, query.offset);
    }
    async salesReport(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            ...(companyId ? { companyId } : {}),
            status: {
                in: [
                    client_1.OutboundOrderStatus.delivered,
                    client_1.OutboundOrderStatus.shipped,
                    client_1.OutboundOrderStatus.out_for_delivery,
                ],
            },
        };
        const date = this.dateFilter(query);
        if (date)
            where.createdAt = date;
        const orders = await this.prisma.outboundOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: SAMPLE_CAP,
            include: {
                company: { select: { name: true } },
                lines: { select: { lineTotal: true, unitPrice: true, requestedQuantity: true } },
            },
        });
        const rows = orders.map((o) => {
            const lineTotal = o.lines.reduce((sum, l) => sum + Number(l.lineTotal ?? 0), 0);
            const subtotal = o.subtotal ? Number(o.subtotal) : lineTotal;
            const shipping = o.shippingFee ? Number(o.shippingFee) : 0;
            return {
                id: o.id,
                orderNumber: o.orderNumber,
                client: o.company?.name ?? '',
                subtotal: dec(o.subtotal) || String(subtotal),
                shippingFee: dec(o.shippingFee) || String(shipping),
                total: String(subtotal + shipping),
                currency: o.currency ?? '',
                paymentMethod: o.paymentMethod ?? '',
                deliveredAt: fmtDateTime(o.deliveredAt ?? o.shippedAt),
            };
        });
        return paginate(rows, query.limit, query.offset);
    }
    async returnsReport(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            status: client_1.OutboundOrderStatus.returned,
            ...(companyId ? { companyId } : {}),
        };
        const date = this.dateFilter(query);
        if (date)
            where.returnedAt = date;
        const orders = await this.prisma.outboundOrder.findMany({
            where,
            orderBy: { returnedAt: 'desc' },
            take: SAMPLE_CAP,
            include: { company: { select: { name: true } } },
        });
        const rows = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            client: o.company?.name ?? '',
            recipient: o.recipientName ?? '',
            returnedAt: fmtDateTime(o.returnedAt),
            codAmount: dec(o.codAmount),
            paymentMethod: o.paymentMethod ?? '',
        }));
        return paginate(rows, query.limit, query.offset);
    }
    async deliveryReport(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            ...(companyId ? { companyId } : {}),
            status: {
                in: [
                    client_1.OutboundOrderStatus.out_for_delivery,
                    client_1.OutboundOrderStatus.delivered,
                    client_1.OutboundOrderStatus.shipped,
                ],
            },
        };
        const date = this.dateFilter(query);
        if (date) {
            where.OR = [
                { outForDeliveryAt: date },
                { deliveredAt: date },
                { shippedAt: date },
            ];
        }
        const orders = await this.prisma.outboundOrder.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: SAMPLE_CAP,
            include: { company: { select: { name: true } } },
        });
        const rows = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            client: o.company?.name ?? '',
            status: o.status,
            carrier: o.carrier ?? '',
            trackingNumber: o.trackingNumber ?? '',
            city: o.city ?? '',
            outForDeliveryAt: fmtDateTime(o.outForDeliveryAt),
            deliveredAt: fmtDateTime(o.deliveredAt ?? o.shippedAt),
        }));
        return paginate(rows, query.limit, query.offset);
    }
    async allocationReport(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            ...(companyId ? { companyId } : {}),
            allocationStatus: query.status && Object.values(client_1.OmsAllocationStatus).includes(query.status)
                ? query.status
                : { in: [client_1.OmsAllocationStatus.allocated, client_1.OmsAllocationStatus.released, client_1.OmsAllocationStatus.fulfilled] },
        };
        const date = this.dateFilter(query);
        if (date)
            where.createdAt = date;
        const orders = await this.prisma.outboundOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: SAMPLE_CAP,
            include: {
                company: { select: { name: true } },
                _count: { select: { stockReservations: true } },
            },
        });
        const rows = orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            client: o.company?.name ?? '',
            orderStatus: o.status,
            allocationStatus: o.allocationStatus ?? '',
            reservationCount: o._count.stockReservations,
            allocatedAt: fmtDateTime(o.allocatedAt),
        }));
        return paginate(rows, query.limit, query.offset);
    }
    async inventoryReserved(user, query) {
        const companyId = this.companyFilter(user, query);
        const where = {
            status: client_1.ReservationStatus.active,
            ...(companyId ? { companyId } : {}),
        };
        const reservations = await this.prisma.stockReservation.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: SAMPLE_CAP,
            include: {
                product: { select: { sku: true, name: true } },
                company: { select: { name: true } },
                outboundOrder: { select: { orderNumber: true } },
                location: { select: { fullPath: true } },
                lot: { select: { lotNumber: true } },
            },
        });
        const rows = reservations.map((r) => ({
            id: r.id,
            orderNumber: r.outboundOrder?.orderNumber ?? '',
            client: r.company?.name ?? '',
            sku: r.product?.sku ?? '',
            product: r.product?.name ?? '',
            location: r.location?.fullPath ?? '',
            lot: r.lot?.lotNumber ?? '',
            quantity: r.quantity.toString(),
            status: r.status,
            createdAt: fmtDateTime(r.createdAt),
        }));
        return paginate(rows, query.limit, query.offset);
    }
};
exports.OmsReportsRunner = OmsReportsRunner;
exports.OmsReportsRunner = OmsReportsRunner = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService])
], OmsReportsRunner);
//# sourceMappingURL=oms-reports.runner.js.map