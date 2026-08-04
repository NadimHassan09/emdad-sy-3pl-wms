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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmsReturnsService = exports.ListOmsReturnsQueryDto = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const cod_records_service_1 = require("../cod/cod-records.service");
const realtime_service_1 = require("../realtime/realtime.service");
const returns_service_1 = require("../returns/returns.service");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const query_transform_1 = require("../../common/transformers/query-transform");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../common/validators/is-uuid-loose");
class ListOmsReturnsQueryDto extends pagination_dto_1.PaginationDto {
    companyId;
    omsOrderId;
    status;
}
exports.ListOmsReturnsQueryDto = ListOmsReturnsQueryDto;
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListOmsReturnsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, is_uuid_loose_1.IsUuidLoose)(),
    __metadata("design:type", String)
], ListOmsReturnsQueryDto.prototype, "omsOrderId", void 0);
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OmsReturnStatus),
    __metadata("design:type", String)
], ListOmsReturnsQueryDto.prototype, "status", void 0);
const INCLUDE = {
    company: { select: { id: true, name: true } },
    omsOrder: {
        select: {
            id: true,
            orderNumber: true,
            status: true,
            outboundOrderId: true,
        },
    },
    warehouseReturn: {
        select: { id: true, orderNumber: true, status: true },
    },
    lines: {
        orderBy: { lineNumber: 'asc' },
        include: {
            product: {
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    uom: true,
                    trackingType: true,
                },
            },
        },
    },
};
function serialize(row) {
    return {
        ...row,
        lines: row.lines.map((l) => ({
            ...l,
            quantity: l.quantity.toString(),
            unitPrice: l.unitPrice?.toString() ?? null,
            lineTotal: l.lineTotal?.toString() ?? null,
        })),
    };
}
let OmsReturnsService = class OmsReturnsService {
    prisma;
    companyAccess;
    warehouseReturns;
    cod;
    realtime;
    constructor(prisma, companyAccess, warehouseReturns, cod, realtime) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.warehouseReturns = warehouseReturns;
        this.cod = cod;
        this.realtime = realtime;
    }
    emitReturn(companyId, returnId, status, event, omsOrderId) {
        this.realtime.emitOmsReturnEvent(companyId, {
            returnId,
            status,
            event,
            omsOrderId,
        });
    }
    async list(user, query) {
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        if (companyId)
            where.companyId = companyId;
        if (query.omsOrderId)
            where.omsOrderId = query.omsOrderId;
        if (query.status)
            where.status = query.status;
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total] = await Promise.all([
                tx.omsReturn.findMany({
                    where,
                    include: INCLUDE,
                    orderBy: { createdAt: 'desc' },
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.omsReturn.count({ where }),
            ]);
            return {
                items: items.map(serialize),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async findById(id, user) {
        const row = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.omsReturn.findUnique({ where: { id }, include: INCLUDE }));
        if (!row)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, row);
        return serialize(row);
    }
    async create(user, dto) {
        const order = await this.prisma.omsOrder.findUnique({
            where: { id: dto.omsOrderId },
            include: { lines: true },
        });
        if (!order)
            throw new common_1.NotFoundException('OMS order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        if (order.status !== client_1.OmsOrderStatus.delivered) {
            throw new domain_exceptions_1.InvalidStateException('OMS returns can only be created for Delivered orders.');
        }
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, companyId: true, trackingType: true, sku: true },
        });
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException('One or more products not found.');
        }
        for (const p of products) {
            if (p.companyId !== order.companyId) {
                throw new common_1.BadRequestException('Product does not belong to the order company.');
            }
        }
        const productById = new Map(products.map((p) => [p.id, p]));
        const resolvedLines = [];
        for (const line of dto.lines) {
            const p = productById.get(line.productId);
            let lotId = line.lotId ?? null;
            if (p.trackingType === client_1.ProductTrackingType.lot && !lotId) {
                lotId = await this.resolveLotFromOutbound(line.productId, order.outboundOrderId);
            }
            if (p.trackingType === client_1.ProductTrackingType.lot && !lotId) {
                throw new common_1.BadRequestException(`Product ${p.sku} requires a lotId on the return line.`);
            }
            const orderLine = order.lines.find((l) => l.productId === line.productId);
            if (!orderLine) {
                throw new common_1.BadRequestException(`Product ${p.sku} is not on the original OMS order.`);
            }
            if (new client_1.Prisma.Decimal(line.quantity).greaterThan(orderLine.requestedQuantity)) {
                throw new common_1.BadRequestException(`Return qty for ${p.sku} exceeds ordered quantity.`);
            }
            resolvedLines.push({
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lotId,
            });
        }
        const seq = await this.prisma.omsReturn.count({
            where: { companyId: order.companyId },
        });
        const returnNumber = `OR-${String(seq + 1).padStart(6, '0')}`;
        const created = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsReturn.create({
                data: {
                    companyId: order.companyId,
                    omsOrderId: order.id,
                    returnNumber,
                    status: client_1.OmsReturnStatus.requested,
                    reason: dto.reason?.trim() || null,
                    notes: dto.notes?.trim() || null,
                    createdBy: user.id,
                    lines: {
                        create: resolvedLines.map((l, idx) => {
                            const unitPrice = l.unitPrice != null
                                ? new client_1.Prisma.Decimal(l.unitPrice)
                                : order.lines.find((ol) => ol.productId === l.productId)
                                    ?.unitPrice ?? null;
                            const qty = new client_1.Prisma.Decimal(l.quantity);
                            const lineTotal = unitPrice != null ? unitPrice.mul(qty) : null;
                            return {
                                productId: l.productId,
                                quantity: qty,
                                unitPrice: unitPrice ?? undefined,
                                lineTotal: lineTotal ?? undefined,
                                lotId: l.lotId,
                                lineNumber: idx + 1,
                            };
                        }),
                    },
                },
                include: INCLUDE,
            });
            await tx.omsOrderEvent.create({
                data: {
                    omsOrderId: order.id,
                    companyId: order.companyId,
                    eventType: 'oms_return.created',
                    createdBy: user.id,
                    payload: { omsReturnId: row.id, returnNumber },
                },
            });
            return row;
        });
        this.emitReturn(created.companyId, created.id, created.status, 'oms_return.created', created.omsOrderId);
        return serialize(created);
    }
    async approve(id, user, dto = {}) {
        const existing = await this.prisma.omsReturn.findUnique({
            where: { id },
            include: { ...INCLUDE, omsOrder: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        if (existing.status === client_1.OmsReturnStatus.approved &&
            existing.warehouseReturnId) {
            const wh = await this.prisma.returnOrder.findUnique({
                where: { id: existing.warehouseReturnId },
                select: { status: true },
            });
            if (wh && wh.status !== 'completed') {
                await this.warehouseReturns.finalizeAfterOmsApproval(user, existing.warehouseReturnId);
            }
            else if (wh?.status === 'completed') {
                await this.onWarehouseReturnCompleted(user, existing.warehouseReturnId);
            }
            return this.findById(id, user);
        }
        if (existing.status === client_1.OmsReturnStatus.completed) {
            return this.findById(id, user);
        }
        if (existing.status !== client_1.OmsReturnStatus.requested) {
            throw new domain_exceptions_1.InvalidStateException(`Only requested returns can be approved (current: ${existing.status}).`);
        }
        const outboundId = existing.omsOrder?.outboundOrderId;
        if (!outboundId) {
            throw new common_1.BadRequestException('OMS order has no outbound; cannot create warehouse return.');
        }
        const outboundLines = await this.prisma.outboundOrderLine.findMany({
            where: { outboundOrderId: outboundId },
            select: { id: true, productId: true },
        });
        const outboundLineByProduct = new Map(outboundLines.map((l) => [l.productId, l.id]));
        const warehouseId = dto.warehouseId ??
            (await this.prisma.stockReservation.findFirst({
                where: { outboundOrderId: outboundId },
                orderBy: { createdAt: 'desc' },
                select: { location: { select: { warehouseId: true } } },
            }))?.location.warehouseId;
        if (!warehouseId) {
            throw new common_1.BadRequestException('Cannot resolve warehouse for return restock. Provide warehouseId on approve.');
        }
        const whReturn = await this.warehouseReturns.create(user, {
            companyId: existing.companyId,
            warehouseId,
            originalOutboundOrderId: outboundId,
            notes: existing.reason ?? existing.notes ?? undefined,
            clientReference: existing.returnNumber,
            lines: existing.lines.map((l) => ({
                productId: l.productId,
                expectedQuantity: Number(l.quantity),
                lotId: l.lotId ?? undefined,
                outboundOrderLineId: outboundLineByProduct.get(l.productId),
            })),
        });
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.omsReturn.update({
                where: { id },
                data: {
                    status: client_1.OmsReturnStatus.approved,
                    warehouseReturnId: whReturn.id,
                    approvedAt: new Date(),
                    approvedBy: user.id,
                },
            });
            await tx.omsOrderEvent.create({
                data: {
                    omsOrderId: existing.omsOrderId,
                    companyId: existing.companyId,
                    eventType: 'oms_return.approved',
                    createdBy: user.id,
                    payload: {
                        omsReturnId: id,
                        warehouseReturnId: whReturn.id,
                    },
                },
            });
            await tx.omsOrderEvent.create({
                data: {
                    omsOrderId: existing.omsOrderId,
                    companyId: existing.companyId,
                    eventType: 'warehouse_return.created',
                    createdBy: user.id,
                    payload: { warehouseReturnId: whReturn.id },
                },
            });
        });
        await this.warehouseReturns.finalizeAfterOmsApproval(user, whReturn.id);
        const approved = await this.findById(id, user);
        this.emitReturn(existing.companyId, id, typeof approved === 'object' && approved && 'status' in approved
            ? String(approved.status)
            : 'approved', 'oms_return.approved', existing.omsOrderId);
        return approved;
    }
    async reject(id, user, dto = {}) {
        const existing = await this.prisma.omsReturn.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        if (existing.status !== client_1.OmsReturnStatus.requested) {
            throw new domain_exceptions_1.InvalidStateException(`Only requested returns can be rejected (current: ${existing.status}).`);
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsReturn.update({
                where: { id },
                data: {
                    status: client_1.OmsReturnStatus.rejected,
                    rejectedAt: new Date(),
                    rejectedBy: user.id,
                    rejectionReason: dto.reason?.trim() || null,
                },
                include: INCLUDE,
            });
            await tx.omsOrderEvent.create({
                data: {
                    omsOrderId: existing.omsOrderId,
                    companyId: existing.companyId,
                    eventType: 'oms_return.rejected',
                    createdBy: user.id,
                    payload: { reason: dto.reason },
                },
            });
            return row;
        });
        this.emitReturn(existing.companyId, id, updated.status, 'oms_return.rejected', existing.omsOrderId);
        return serialize(updated);
    }
    async onWarehouseReturnCompleted(user, warehouseReturnId) {
        const omsReturn = await this.prisma.omsReturn.findUnique({
            where: { warehouseReturnId },
            include: { lines: true },
        });
        if (!omsReturn)
            return null;
        if (omsReturn.status === client_1.OmsReturnStatus.completed) {
            await this.applyCodAdjustment(user, omsReturn);
            return this.findById(omsReturn.id, user);
        }
        if (omsReturn.status !== client_1.OmsReturnStatus.approved) {
            return null;
        }
        await this.prisma.omsReturn.update({
            where: { id: omsReturn.id },
            data: {
                status: client_1.OmsReturnStatus.completed,
                completedAt: new Date(),
            },
        });
        await this.prisma.omsOrderEvent.create({
            data: {
                omsOrderId: omsReturn.omsOrderId,
                companyId: omsReturn.companyId,
                eventType: 'oms_return.completed',
                createdBy: user.id,
                payload: { omsReturnId: omsReturn.id, warehouseReturnId },
            },
        });
        await this.applyCodAdjustment(user, omsReturn);
        const completed = await this.findById(omsReturn.id, user);
        this.emitReturn(omsReturn.companyId, omsReturn.id, 'completed', 'oms_return.completed', omsReturn.omsOrderId);
        return completed;
    }
    async applyCodAdjustment(user, omsReturn) {
        const amount = omsReturn.lines.reduce((sum, l) => {
            if (l.lineTotal != null)
                return sum.add(l.lineTotal);
            if (l.unitPrice != null)
                return sum.add(l.unitPrice.mul(l.quantity));
            return sum;
        }, new client_1.Prisma.Decimal(0));
        if (amount.isZero())
            return;
        try {
            await this.cod.createReturnAdjustment({
                user,
                omsReturnId: omsReturn.id,
                companyId: omsReturn.companyId,
                omsOrderId: omsReturn.omsOrderId,
                amount,
                reason: omsReturn.reason ?? undefined,
            });
        }
        catch {
        }
    }
    async resolveLotFromOutbound(productId, outboundOrderId) {
        if (!outboundOrderId)
            return null;
        const byLine = await this.prisma.outboundOrderLine.findFirst({
            where: {
                outboundOrderId,
                productId,
                specificLotId: { not: null },
            },
            select: { specificLotId: true },
        });
        if (byLine?.specificLotId)
            return byLine.specificLotId;
        const reservation = await this.prisma.stockReservation.findFirst({
            where: {
                outboundOrderId,
                productId,
                lotId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            select: { lotId: true },
        });
        return reservation?.lotId ?? null;
    }
};
exports.OmsReturnsService = OmsReturnsService;
exports.OmsReturnsService = OmsReturnsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => returns_service_1.ReturnsService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        returns_service_1.ReturnsService,
        cod_records_service_1.CodRecordsService,
        realtime_service_1.RealtimeService])
], OmsReturnsService);
//# sourceMappingURL=oms-returns.service.js.map