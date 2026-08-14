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
const oms_return_admin_stages_1 = require("./oms-return-admin-stages");
const execution_plan_util_1 = require("../orders/execution-plan.util");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const query_transform_1 = require("../../common/transformers/query-transform");
const class_validator_1 = require("class-validator");
const is_uuid_loose_1 = require("../../common/validators/is-uuid-loose");
class ListOmsReturnsQueryDto extends pagination_dto_1.PaginationDto {
    companyId;
    omsOrderId;
    status;
    search;
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
__decorate([
    (0, query_transform_1.EmptyToUndefined)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListOmsReturnsQueryDto.prototype, "search", void 0);
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
        select: {
            id: true,
            orderNumber: true,
            status: true,
            warehouseId: true,
            lines: {
                orderBy: { lineNumber: 'asc' },
                select: {
                    id: true,
                    productId: true,
                    expectedQuantity: true,
                    receivedQuantity: true,
                    postedQuantity: true,
                    lineStatus: true,
                    targetLocationId: true,
                },
            },
        },
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
                    imagePath: true,
                },
            },
        },
    },
};
function decStr(v) {
    if (v == null)
        return '0';
    return typeof v === 'object' && 'toString' in v ? v.toString() : String(v);
}
function resolvePlanPutawayLocationId(plan, productId) {
    const planLine = plan.lines.find((l) => l.productId === productId);
    const splits = planLine?.putaway ?? [];
    if (splits.length === 0) {
        throw new common_1.BadRequestException(`Plan is missing putaway location for product ${productId}.`);
    }
    const locationIds = [...new Set(splits.map((s) => s.locationId))];
    if (locationIds.length > 1) {
        throw new common_1.BadRequestException(`Return putaway supports one location per product (got ${locationIds.length} for ${productId}).`);
    }
    return locationIds[0];
}
function serialize(row) {
    const whLines = row.warehouseReturn?.lines ?? [];
    const hasUnreceivedQty = whLines.some((l) => l.receivedQuantity.lt(l.expectedQuantity));
    const hasUnpostedQty = whLines.some((l) => l.lineStatus !== client_1.ReturnLineStatus.posted &&
        l.receivedQuantity.gt(0));
    const nextAction = (0, oms_return_admin_stages_1.nextOmsReturnAdminAction)(row.status, {
        status: row.warehouseReturn?.status ?? null,
        hasUnreceivedQty,
        hasUnpostedQty,
    });
    return {
        ...row,
        executionMode: (0, execution_plan_util_1.normalizeExecutionMode)(row.executionMode),
        executionPlan: (0, execution_plan_util_1.parseInboundExecutionPlan)(row.executionPlan),
        nextAdminAction: nextAction,
        lines: row.lines.map((l) => ({
            ...l,
            quantity: l.quantity.toString(),
            unitPrice: l.unitPrice?.toString() ?? null,
            lineTotal: l.lineTotal?.toString() ?? null,
        })),
        warehouseReturn: row.warehouseReturn
            ? {
                ...row.warehouseReturn,
                lines: whLines.map((l) => ({
                    ...l,
                    expectedQuantity: decStr(l.expectedQuantity),
                    receivedQuantity: decStr(l.receivedQuantity),
                    postedQuantity: decStr(l.postedQuantity),
                })),
            }
            : null,
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
        if (query.search?.trim()) {
            const t = query.search.trim();
            where.OR = [
                { returnNumber: { contains: t, mode: 'insensitive' } },
                { reason: { contains: t, mode: 'insensitive' } },
                { notes: { contains: t, mode: 'insensitive' } },
                { company: { name: { contains: t, mode: 'insensitive' } } },
                { omsOrder: { orderNumber: { contains: t, mode: 'insensitive' } } },
            ];
        }
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
        const priorReturned = await this.sumActiveReturnedQtyByProduct(order.id);
        const requestedNow = new Map();
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
            const qty = new client_1.Prisma.Decimal(line.quantity);
            const already = priorReturned.get(line.productId) ?? new client_1.Prisma.Decimal(0);
            const batch = requestedNow.get(line.productId) ?? new client_1.Prisma.Decimal(0);
            const nextBatch = batch.add(qty);
            requestedNow.set(line.productId, nextBatch);
            if (already.add(nextBatch).greaterThan(orderLine.requestedQuantity)) {
                const available = orderLine.requestedQuantity.sub(already);
                throw new common_1.BadRequestException(`Return qty for ${p.sku} exceeds remaining returnable quantity ` +
                    `(ordered ${orderLine.requestedQuantity.toString()}, already returned ${already.toString()}, available ${available.toString()}).`);
            }
            resolvedLines.push({
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lotId,
            });
        }
        const created = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsReturn.create({
                data: {
                    companyId: order.companyId,
                    omsOrderId: order.id,
                    status: client_1.OmsReturnStatus.requested,
                    executionMode: 'admin',
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
                    payload: {
                        omsReturnId: row.id,
                        returnNumber: row.returnNumber,
                    },
                },
            });
            return row;
        });
        this.emitReturn(created.companyId, created.id, created.status, 'oms_return.created', created.omsOrderId);
        return serialize(created);
    }
    async updatePlan(id, user, dto) {
        const existing = await this.prisma.omsReturn.findUnique({
            where: { id },
            include: INCLUDE,
        });
        if (!existing)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        if (existing.status !== client_1.OmsReturnStatus.requested) {
            throw new domain_exceptions_1.InvalidStateException(`Plan can only be edited while the return is requested (current: ${existing.status}).`);
        }
        let executionPlan;
        if (dto.executionPlan !== undefined) {
            const parsed = (0, execution_plan_util_1.parseInboundExecutionPlan)(dto.executionPlan);
            if (!parsed)
                throw new common_1.BadRequestException('Invalid executionPlan.');
            const withLineIds = {
                ...parsed,
                planUpdatedAt: new Date().toISOString(),
                lines: existing.lines.map((ol) => {
                    const match = parsed.lines.find((l) => l.orderLineId === ol.id) ??
                        parsed.lines.find((l) => l.productId === ol.productId);
                    return {
                        productId: ol.productId,
                        orderLineId: ol.id,
                        expectedQty: Number(ol.quantity),
                        putaway: match?.putaway ?? [],
                    };
                }),
            };
            (0, execution_plan_util_1.assertInboundAdminPlanComplete)(withLineIds);
            executionPlan = withLineIds;
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.omsReturn.update({
            where: { id },
            data: {
                ...(dto.executionMode !== undefined
                    ? { executionMode: (0, execution_plan_util_1.normalizeExecutionMode)(dto.executionMode) }
                    : { executionMode: existing.executionMode ?? 'admin' }),
                ...(executionPlan !== undefined ? { executionPlan } : {}),
                ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
            },
            include: INCLUDE,
        }));
        this.emitReturn(existing.companyId, id, updated.status, 'oms_return.plan_updated', existing.omsOrderId);
        return serialize(updated);
    }
    async approve(id, user, dto = {}) {
        const existing = await this.prisma.omsReturn.findUnique({
            where: { id },
            include: {
                ...INCLUDE,
                omsOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        outboundOrderId: true,
                        lines: {
                            select: { productId: true, requestedQuantity: true },
                        },
                    },
                },
            },
        });
        if (!existing)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        if (existing.status === client_1.OmsReturnStatus.approved &&
            existing.warehouseReturnId) {
            return this.findById(id, user);
        }
        if (existing.status === client_1.OmsReturnStatus.completed) {
            return this.findById(id, user);
        }
        (0, oms_return_admin_stages_1.assertOmsReturnAdminStageAction)(existing.status, 'approve');
        const plan = (0, execution_plan_util_1.parseInboundExecutionPlan)(existing.executionPlan);
        if (!plan) {
            throw new common_1.BadRequestException('Approve requires a saved execution plan (receiving dock + putaway locations).');
        }
        (0, execution_plan_util_1.assertInboundAdminPlanComplete)(plan);
        await this.assertOmsReturnStillReturnable(existing);
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
            plan.warehouseId ??
            (await this.prisma.stockReservation.findFirst({
                where: { outboundOrderId: outboundId },
                orderBy: { createdAt: 'desc' },
                select: { location: { select: { warehouseId: true } } },
            }))?.location.warehouseId;
        if (!warehouseId) {
            throw new common_1.BadRequestException('Cannot resolve warehouse for return. Provide warehouseId on the plan or approve.');
        }
        let whReturn = await this.prisma.returnOrder.findFirst({
            where: {
                originalOutboundOrderId: outboundId,
                clientReference: existing.returnNumber,
                status: { notIn: ['cancelled', 'completed'] },
            },
            select: { id: true, status: true },
        });
        if (!whReturn) {
            const created = await this.warehouseReturns.create(user, {
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
            whReturn = { id: created.id, status: created.status };
        }
        if (whReturn.status === 'draft') {
            await this.warehouseReturns.confirm(user, whReturn.id);
            whReturn = { id: whReturn.id, status: 'confirmed' };
        }
        if (whReturn.status === 'confirmed') {
            await this.warehouseReturns.startReceiving(user, whReturn.id);
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.omsReturn.update({
                where: { id },
                data: {
                    status: client_1.OmsReturnStatus.approved,
                    warehouseReturnId: whReturn.id,
                    approvedAt: new Date(),
                    approvedBy: user.id,
                    executionMode: existing.executionMode ?? 'admin',
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
                        receivingDockId: plan.receivingDockId,
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
        const approved = await this.findById(id, user);
        this.emitReturn(existing.companyId, id, typeof approved === 'object' && approved && 'status' in approved
            ? String(approved.status)
            : 'approved', 'oms_return.approved', existing.omsOrderId);
        return approved;
    }
    async completeReceivingAdmin(id, user) {
        const existing = await this.prisma.omsReturn.findUnique({
            where: { id },
            include: INCLUDE,
        });
        if (!existing)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        (0, oms_return_admin_stages_1.assertOmsReturnAdminStageAction)(existing.status, 'complete_receiving');
        if (!existing.warehouseReturnId || !existing.warehouseReturn) {
            throw new common_1.BadRequestException('Approved return has no warehouse return yet.');
        }
        const whId = existing.warehouseReturnId;
        let wh = await this.warehouseReturns.findById(whId, user);
        for (const line of wh.lines) {
            const remaining = line.expectedQuantity.minus(line.receivedQuantity);
            if (remaining.gt(0)) {
                await this.warehouseReturns.receiveLine(user, whId, line.id, {
                    quantity: Number(remaining),
                });
            }
        }
        wh = await this.warehouseReturns.findById(whId, user);
        this.emitReturn(existing.companyId, id, existing.status, 'oms_return.receiving_completed', existing.omsOrderId);
        return this.findById(id, user);
    }
    async completePutawayAdmin(id, user) {
        const existing = await this.prisma.omsReturn.findUnique({
            where: { id },
            include: INCLUDE,
        });
        if (!existing)
            throw new common_1.NotFoundException('OMS return not found.');
        this.companyAccess.validateResourceOwnership(user, existing);
        (0, oms_return_admin_stages_1.assertOmsReturnAdminStageAction)(existing.status, 'complete_putaway');
        if (!existing.warehouseReturnId) {
            throw new common_1.BadRequestException('Approved return has no warehouse return yet.');
        }
        const plan = (0, execution_plan_util_1.parseInboundExecutionPlan)(existing.executionPlan);
        if (!plan) {
            throw new common_1.BadRequestException('Putaway requires a saved execution plan.');
        }
        const whId = existing.warehouseReturnId;
        let wh = await this.warehouseReturns.findById(whId, user);
        for (const line of wh.lines) {
            if (line.receivedQuantity.lt(line.expectedQuantity)) {
                throw new common_1.BadRequestException('Mark receiving complete before putaway.');
            }
        }
        for (const line of wh.lines) {
            if (line.lineStatus === client_1.ReturnLineStatus.posted)
                continue;
            if (line.receivedQuantity.lte(0))
                continue;
            const targetLocationId = resolvePlanPutawayLocationId(plan, line.productId);
            await this.warehouseReturns.applyDisposition(user, whId, line.id, {
                disposition: client_1.ReturnItemDisposition.restock,
                targetLocationId,
            });
        }
        await this.warehouseReturns.complete(user, whId);
        this.emitReturn(existing.companyId, id, client_1.OmsReturnStatus.completed, 'oms_return.putaway_completed', existing.omsOrderId);
        return this.findById(id, user);
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
        await this.maybeMarkOmsFullyReturned(user, omsReturn.omsOrderId);
        const completed = await this.findById(omsReturn.id, user);
        this.emitReturn(omsReturn.companyId, omsReturn.id, 'completed', 'oms_return.completed', omsReturn.omsOrderId);
        return completed;
    }
    async sumActiveReturnedQtyByProduct(omsOrderId, excludeReturnId) {
        const lines = await this.prisma.omsReturnLine.findMany({
            where: {
                omsReturn: {
                    omsOrderId,
                    status: {
                        in: [
                            client_1.OmsReturnStatus.requested,
                            client_1.OmsReturnStatus.approved,
                            client_1.OmsReturnStatus.completed,
                        ],
                    },
                    ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
                },
            },
            select: { productId: true, quantity: true },
        });
        const map = new Map();
        for (const l of lines) {
            const cur = map.get(l.productId) ?? new client_1.Prisma.Decimal(0);
            map.set(l.productId, cur.add(l.quantity));
        }
        return map;
    }
    async assertOmsReturnStillReturnable(omsReturn) {
        const orderLines = omsReturn.omsOrder?.lines ??
            (await this.prisma.omsOrder.findUnique({
                where: { id: omsReturn.omsOrderId },
                select: { lines: { select: { productId: true, requestedQuantity: true } } },
            }))?.lines ??
            [];
        const prior = await this.sumActiveReturnedQtyByProduct(omsReturn.omsOrderId, omsReturn.id);
        for (const line of omsReturn.lines) {
            const ordered = orderLines.find((l) => l.productId === line.productId);
            if (!ordered) {
                throw new common_1.BadRequestException(`Product ${line.product?.sku ?? line.productId} is not on the original OMS order.`);
            }
            const already = prior.get(line.productId) ?? new client_1.Prisma.Decimal(0);
            const available = ordered.requestedQuantity.sub(already);
            if (line.quantity.gt(available)) {
                const sku = line.product?.sku ?? line.productId;
                throw new common_1.BadRequestException(`Cannot approve return for ${sku}: ordered ${ordered.requestedQuantity.toString()}, ` +
                    `already covered by other returns ${already.toString()}, ` +
                    `this return requests ${line.quantity.toString()} ` +
                    `(available ${client_1.Prisma.Decimal.max(available, new client_1.Prisma.Decimal(0)).toString()}). ` +
                    `Reject this return or reduce its quantity.`);
            }
        }
    }
    async maybeMarkOmsFullyReturned(user, omsOrderId) {
        const order = await this.prisma.omsOrder.findUnique({
            where: { id: omsOrderId },
            include: { lines: true },
        });
        if (!order || order.status !== client_1.OmsOrderStatus.delivered)
            return;
        const completedLines = await this.prisma.omsReturnLine.findMany({
            where: {
                omsReturn: {
                    omsOrderId,
                    status: client_1.OmsReturnStatus.completed,
                },
            },
            select: { productId: true, quantity: true },
        });
        const returnedByProduct = new Map();
        for (const l of completedLines) {
            const cur = returnedByProduct.get(l.productId) ?? new client_1.Prisma.Decimal(0);
            returnedByProduct.set(l.productId, cur.add(l.quantity));
        }
        for (const ol of order.lines) {
            const ret = returnedByProduct.get(ol.productId) ?? new client_1.Prisma.Decimal(0);
            if (ret.lessThan(ol.requestedQuantity))
                return;
        }
        await this.prisma.omsOrder.update({
            where: { id: omsOrderId },
            data: {
                status: client_1.OmsOrderStatus.returned,
                returnedAt: new Date(),
            },
        });
        await this.prisma.omsOrderEvent.create({
            data: {
                omsOrderId,
                companyId: order.companyId,
                eventType: 'oms.returned',
                createdBy: user.id,
                payload: {
                    reason: 'all_ordered_qty_returned_via_completed_returns',
                },
            },
        });
        try {
            await this.cod.markReturnedForOrder(omsOrderId, user);
        }
        catch {
        }
    }
    async applyCodAdjustment(user, omsReturn) {
        const amount = omsReturn.lines.reduce((sum, l) => {
            if (l.lineTotal != null)
                return sum.add(l.lineTotal);
            if (l.unitPrice != null)
                return sum.add(l.unitPrice.mul(l.quantity));
            return sum;
        }, new client_1.Prisma.Decimal(0));
        if (amount.isZero()) {
            try {
                await this.cod.markReturnedForOrder(omsReturn.omsOrderId, user);
            }
            catch {
            }
            return;
        }
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