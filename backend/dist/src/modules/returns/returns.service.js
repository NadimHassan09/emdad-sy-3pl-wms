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
exports.ReturnsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const assert_product_orderable_1 = require("../../common/utils/assert-product-orderable");
const discrete_uom_quantity_1 = require("../../common/utils/discrete-uom-quantity");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const realtime_service_1 = require("../realtime/realtime.service");
const oms_returns_service_1 = require("../oms-returns/oms-returns.service");
const realtime_ops_payload_1 = require("../realtime/realtime-ops.payload");
const list_return_orders_query_dto_1 = require("./dto/list-return-orders-query.dto");
const outbound_confirm_lock_util_1 = require("../outbound/outbound-confirm-lock.util");
const return_line_integrity_util_1 = require("./return-line-integrity.util");
const return_quantity_validation_1 = require("./return-quantity.validation");
const return_workflow_service_1 = require("./return-workflow.service");
const returns_constants_1 = require("./returns.constants");
const ORDER_INCLUDE = {
    company: { select: { id: true, name: true } },
    originalOutbound: {
        select: {
            id: true,
            orderNumber: true,
            status: true,
            trackingNumber: true,
            shippedAt: true,
        },
    },
    warehouse: { select: { id: true, code: true, name: true } },
    package: { select: { id: true, packageCode: true, status: true } },
    lines: {
        orderBy: { lineNumber: 'asc' },
        include: {
            product: {
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    barcode: true,
                    status: true,
                    trackingType: true,
                    uom: true,
                },
            },
            lot: { select: { id: true, lotNumber: true } },
            outboundOrderLine: { select: { id: true, lineNumber: true, pickedQuantity: true } },
            package: { select: { id: true, packageCode: true } },
            targetLocation: { select: { id: true, fullPath: true, type: true } },
        },
    },
};
let ReturnsService = class ReturnsService {
    prisma;
    companyAccess;
    quantityGuard;
    workflow;
    audit;
    realtime;
    omsReturns;
    constructor(prisma, companyAccess, quantityGuard, workflow, audit, realtime, omsReturns) {
        this.prisma = prisma;
        this.companyAccess = companyAccess;
        this.quantityGuard = quantityGuard;
        this.workflow = workflow;
        this.audit = audit;
        this.realtime = realtime;
        this.omsReturns = omsReturns;
    }
    async create(user, dto) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        (0, return_line_integrity_util_1.assertUniqueReturnLineBuckets)(dto.lines);
        if (dto.originalOutboundOrderId) {
            const outbound = await this.prisma.outboundOrder.findUnique({
                where: { id: dto.originalOutboundOrderId },
                select: { id: true, companyId: true },
            });
            if (!outbound)
                throw new common_1.NotFoundException('Original outbound order not found.');
            if (outbound.companyId !== companyId) {
                throw new common_1.BadRequestException('Original outbound order must belong to the same company as the return.');
            }
        }
        if (dto.packageId) {
            await this.assertPackageForCompany(dto.packageId, companyId);
        }
        if (dto.warehouseId) {
            await this.assertWarehouse(dto.warehouseId);
        }
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                companyId: true,
                sku: true,
                status: true,
                trackingType: true,
                uom: true,
            },
        });
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException('One or more products not found.');
        }
        const wrongCompany = products.find((p) => p.companyId !== companyId);
        if (wrongCompany) {
            throw new common_1.BadRequestException('All line products must belong to the same company as the return order.');
        }
        for (const p of products) {
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(p.status);
        }
        const productById = new Map(products.map((p) => [p.id, p]));
        const lineCreates = [];
        const resolvedLots = [];
        for (let idx = 0; idx < dto.lines.length; idx++) {
            const l = dto.lines[idx];
            const p = productById.get(l.productId);
            (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(p.uom, l.expectedQuantity, 'Expected quantity');
            let lotId = l.lotId ?? null;
            if (p.trackingType === client_1.ProductTrackingType.lot && !lotId) {
                lotId = await this.resolveLotFromOutbound({
                    productId: l.productId,
                    outboundOrderLineId: l.outboundOrderLineId,
                    originalOutboundOrderId: dto.originalOutboundOrderId,
                });
            }
            if (p.trackingType === client_1.ProductTrackingType.lot && !lotId) {
                throw new common_1.BadRequestException(`Product ${p.sku} requires a lot on return lines.`);
            }
            if (lotId) {
                await this.assertLotForProduct(lotId, l.productId, companyId);
            }
            if (l.packageId) {
                await this.assertLinePackage(l.packageId, l.productId, companyId);
            }
            if (l.outboundOrderLineId && !dto.originalOutboundOrderId) {
                throw new common_1.BadRequestException('outboundOrderLineId requires originalOutboundOrderId on the return header.');
            }
            resolvedLots.push(lotId);
            lineCreates.push({
                product: { connect: { id: l.productId } },
                expectedQuantity: new client_1.Prisma.Decimal(l.expectedQuantity),
                lineNumber: idx + 1,
                ...(l.outboundOrderLineId
                    ? { outboundOrderLine: { connect: { id: l.outboundOrderLineId } } }
                    : {}),
                ...(l.packageId ? { package: { connect: { id: l.packageId } } } : {}),
                ...(lotId ? { lot: { connect: { id: lotId } } } : {}),
                ...(l.condition ? { condition: l.condition } : {}),
                ...(l.disposition ? { disposition: l.disposition } : {}),
            });
        }
        if (dto.originalOutboundOrderId) {
            await this.quantityGuard.assertWithinShippedLimits(dto.originalOutboundOrderId, dto.lines.map((l, idx) => ({
                productId: l.productId,
                lotId: resolvedLots[idx],
                outboundOrderLineId: l.outboundOrderLineId ?? null,
                expectedQuantity: new client_1.Prisma.Decimal(l.expectedQuantity),
            })));
        }
        const order = await this.prisma.returnOrder.create({
            data: {
                companyId,
                warehouseId: dto.warehouseId ?? null,
                originalOutboundOrderId: dto.originalOutboundOrderId ?? null,
                packageId: dto.packageId ?? null,
                shipmentReference: dto.shipmentReference?.trim() || null,
                clientReference: dto.clientReference?.trim() || null,
                notes: dto.notes?.trim() || null,
                createdBy: user.id,
                lines: { create: lineCreates },
            },
            include: ORDER_INCLUDE,
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId,
            action: 'RETURN_CREATED',
            resourceType: 'return_order',
            resourceId: order.id,
            newState: { orderNumber: order.orderNumber, lineCount: order.lines.length },
        }));
        this.emitReturnEvent(order, 'created');
        return order;
    }
    async list(user, query) {
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(this.companyAccess, user, query.companyId);
        if (companyId) {
            where.companyId = companyId;
        }
        if (query.status)
            where.status = query.status;
        if (query.originalOutboundOrderId) {
            where.originalOutboundOrderId = query.originalOutboundOrderId;
        }
        const andParts = [];
        if (query.orderSearch?.trim()) {
            const t = query.orderSearch.trim();
            const orParts = [
                { orderNumber: { contains: t, mode: 'insensitive' } },
                { clientReference: { contains: t, mode: 'insensitive' } },
                { shipmentReference: { contains: t, mode: 'insensitive' } },
            ];
            if (list_return_orders_query_dto_1.ListReturnOrdersQueryDto.fullUuidPattern.test(t))
                orParts.push({ id: t });
            andParts.push({ OR: orParts });
        }
        if (query.createdFrom || query.createdTo) {
            const createdAt = {};
            if (query.createdFrom)
                createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
            if (query.createdTo)
                createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
            where.createdAt = createdAt;
        }
        if (query.source === 'oms') {
            andParts.push({
                OR: [
                    { clientReference: { startsWith: 'oms:' } },
                    { originalOutbound: { is: { omsOrder: { isNot: null } } } },
                ],
            });
        }
        else if (query.source === 'outbound') {
            andParts.push({
                AND: [
                    {
                        OR: [
                            { clientReference: null },
                            { NOT: { clientReference: { startsWith: 'oms:' } } },
                        ],
                    },
                    {
                        OR: [
                            { originalOutboundOrderId: null },
                            { originalOutbound: { is: { omsOrder: null } } },
                        ],
                    },
                ],
            });
        }
        if (andParts.length > 0)
            where.AND = andParts;
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [rows, total] = await Promise.all([
                tx.returnOrder.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        company: { select: { id: true, name: true } },
                        originalOutbound: { select: { id: true, orderNumber: true, status: true } },
                        _count: { select: { lines: true } },
                        lines: {
                            select: {
                                expectedQuantity: true,
                                receivedQuantity: true,
                                disposition: true,
                                product: { select: { sku: true } },
                            },
                        },
                    },
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.returnOrder.count({ where }),
            ]);
            return {
                items: rows.map(({ lines, ...order }) => ({
                    ...order,
                    summary: (0, return_line_integrity_util_1.buildReturnListSummary)(lines),
                })),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async getOutboundReturnQuota(user, outboundOrderId, excludeReturnOrderId) {
        const outbound = await this.prisma.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            select: { id: true, companyId: true },
        });
        if (!outbound)
            throw new common_1.NotFoundException('Outbound order not found.');
        this.companyAccess.validateResourceOwnership(user, outbound);
        return this.quantityGuard.getOutboundReturnQuota(outboundOrderId, excludeReturnOrderId);
    }
    async findById(id, user) {
        const order = await this.prisma.returnOrder.findUnique({
            where: { id },
            include: ORDER_INCLUDE,
        });
        if (!order)
            throw new common_1.NotFoundException('Return order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        return order;
    }
    async confirm(user, id) {
        const order = await this.findById(id, user);
        if (!(0, returns_constants_1.isReturnConfirmable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Only draft return orders can be confirmed (current status: ${order.status}).`);
        }
        if (order.lines.length === 0) {
            throw new common_1.BadRequestException('Add at least one line before confirming this return.');
        }
        for (const line of order.lines) {
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            if (order.originalOutboundOrderId) {
                await (0, outbound_confirm_lock_util_1.lockOutboundOrderRow)(tx, order.originalOutboundOrderId);
                await this.quantityGuard.assertWithinShippedLimits(order.originalOutboundOrderId, order.lines.map((l) => ({
                    productId: l.productId,
                    lotId: l.lotId,
                    outboundOrderLineId: l.outboundOrderLineId,
                    expectedQuantity: l.expectedQuantity,
                })), id, tx);
            }
            return tx.returnOrder.update({
                where: { id },
                data: { status: client_1.ReturnOrderStatus.confirmed, confirmedAt: new Date() },
                include: ORDER_INCLUDE,
            });
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId: order.companyId,
            action: 'RETURN_CONFIRMED',
            resourceType: 'return_order',
            resourceId: id,
        }));
        this.emitReturnEvent(updated, 'confirmed');
        return updated;
    }
    async startReceiving(user, id) {
        const order = await this.findById(id, user);
        if (order.status !== client_1.ReturnOrderStatus.confirmed) {
            throw new domain_exceptions_1.InvalidStateException(`Only confirmed return orders can start receiving (current status: ${order.status}).`);
        }
        return this.prisma.returnOrder.update({
            where: { id },
            data: {
                status: client_1.ReturnOrderStatus.receiving,
                receivingStartedAt: new Date(),
            },
            include: ORDER_INCLUDE,
        }).then((updated) => {
            this.emitReturnEvent(updated, 'updated');
            return updated;
        });
    }
    async receiveLine(user, returnOrderId, lineId, dto) {
        const order = await this.findById(returnOrderId, user);
        if (!(0, returns_constants_1.isReturnReceivable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Return order is not open for receiving (current status: ${order.status}).`);
        }
        const line = order.lines.find((l) => l.id === lineId);
        if (!line)
            throw new common_1.NotFoundException('Return line not found.');
        const increment = new client_1.Prisma.Decimal(dto.quantity);
        const nextReceived = line.receivedQuantity.add(increment);
        if (nextReceived.gt(line.expectedQuantity)) {
            throw new common_1.BadRequestException(`Received quantity cannot exceed expected (${line.expectedQuantity.toString()}).`);
        }
        const lineStatus = nextReceived.gt(0) ? client_1.ReturnLineStatus.received : client_1.ReturnLineStatus.pending;
        const data = {
            receivedQuantity: nextReceived,
            lineStatus,
            ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        };
        const result = await this.prisma.$transaction(async (tx) => {
            await this.workflow.syncOrderWorkflowStatus(tx, returnOrderId, { receiving: true });
            await tx.returnOrderLine.update({ where: { id: lineId }, data });
            return tx.returnOrder.findUniqueOrThrow({
                where: { id: returnOrderId },
                include: ORDER_INCLUDE,
            });
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId: order.companyId,
            action: 'RETURN_LINE_RECEIVED',
            resourceType: 'return_order_line',
            resourceId: lineId,
            newState: {
                returnOrderId,
                receivedQuantity: nextReceived.toString(),
            },
        }));
        this.emitReturnEvent(result, 'updated');
        return result;
    }
    inspectLine(user, returnOrderId, lineId, dto) {
        return this.workflow.inspectLine(user, returnOrderId, lineId, dto);
    }
    applyDisposition(user, returnOrderId, lineId, dto) {
        return this.workflow.applyDisposition(user, returnOrderId, lineId, dto);
    }
    postAllInventory(user, returnOrderId) {
        return this.workflow.postAllEligibleLines(user, returnOrderId);
    }
    async complete(user, id) {
        const order = await this.findById(id, user);
        if (!(0, returns_constants_1.isReturnCompletable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Only receiving return orders can be completed (current status: ${order.status}).`);
        }
        const incomplete = order.lines.find((l) => l.receivedQuantity.lt(l.expectedQuantity));
        if (incomplete) {
            throw new common_1.BadRequestException('All lines must be fully received before completing the return order.');
        }
        this.workflow.assertAllLinesPosted(order.lines);
        const updated = await this.prisma.returnOrder.update({
            where: { id },
            data: { status: client_1.ReturnOrderStatus.completed, completedAt: new Date() },
            include: ORDER_INCLUDE,
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId: order.companyId,
            action: 'RETURN_COMPLETED',
            resourceType: 'return_order',
            resourceId: id,
        }));
        this.emitReturnEvent(updated, 'completed');
        try {
            await this.omsReturns?.onWarehouseReturnCompleted(user, id);
        }
        catch {
        }
        return updated;
    }
    async finalizeAfterOmsApproval(user, returnOrderId) {
        let order = await this.findById(returnOrderId, user);
        if (order.status === client_1.ReturnOrderStatus.completed) {
            return order;
        }
        if (order.status === client_1.ReturnOrderStatus.cancelled) {
            throw new domain_exceptions_1.InvalidStateException('Cannot finalize a cancelled return order.');
        }
        if (!order.warehouseId) {
            const warehouseId = await this.resolveWarehouseIdFromOutbound(order.originalOutboundOrderId);
            if (!warehouseId) {
                throw new common_1.BadRequestException('Cannot resolve warehouse for return restock. Provide warehouseId on approve.');
            }
            order = await this.prisma.returnOrder.update({
                where: { id: returnOrderId },
                data: { warehouseId },
                include: ORDER_INCLUDE,
            });
        }
        if (order.status === client_1.ReturnOrderStatus.draft) {
            order = await this.confirm(user, returnOrderId);
        }
        if (order.status === client_1.ReturnOrderStatus.confirmed) {
            order = await this.startReceiving(user, returnOrderId);
        }
        order = await this.findById(returnOrderId, user);
        for (const line of order.lines) {
            const remaining = line.expectedQuantity.minus(line.receivedQuantity);
            if (remaining.gt(0)) {
                await this.receiveLine(user, returnOrderId, line.id, {
                    quantity: Number(remaining),
                });
            }
        }
        order = await this.findById(returnOrderId, user);
        for (const line of order.lines) {
            if (line.lineStatus === client_1.ReturnLineStatus.posted)
                continue;
            if (line.receivedQuantity.lte(0))
                continue;
            const targetLocationId = await this.resolveRestockLocationId({
                warehouseId: order.warehouseId,
                productId: line.productId,
                lotId: line.lotId,
                outboundOrderId: order.originalOutboundOrderId,
            });
            await this.applyDisposition(user, returnOrderId, line.id, {
                disposition: client_1.ReturnItemDisposition.restock,
                targetLocationId,
            });
        }
        return this.complete(user, returnOrderId);
    }
    async resolveWarehouseIdFromOutbound(outboundOrderId) {
        if (!outboundOrderId)
            return null;
        const reservation = await this.prisma.stockReservation.findFirst({
            where: { outboundOrderId },
            orderBy: { createdAt: 'desc' },
            select: { location: { select: { warehouseId: true } } },
        });
        return reservation?.location.warehouseId ?? null;
    }
    async resolveRestockLocationId(params) {
        if (params.outboundOrderId) {
            const fromOutbound = await this.prisma.stockReservation.findFirst({
                where: {
                    outboundOrderId: params.outboundOrderId,
                    productId: params.productId,
                    ...(params.lotId ? { lotId: params.lotId } : {}),
                    location: {
                        warehouseId: params.warehouseId,
                        type: { in: ['internal', 'fridge'] },
                        status: 'active',
                    },
                },
                orderBy: { createdAt: 'desc' },
                select: { locationId: true },
            });
            if (fromOutbound?.locationId)
                return fromOutbound.locationId;
        }
        const sellable = await this.prisma.location.findFirst({
            where: {
                warehouseId: params.warehouseId,
                type: { in: ['internal', 'fridge'] },
                status: 'active',
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        if (!sellable) {
            throw new common_1.BadRequestException('No sellable location available to restock returned inventory.');
        }
        return sellable.id;
    }
    async cancel(user, id) {
        const order = await this.findById(id, user);
        if ((0, returns_constants_1.isReturnTerminal)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Return order cannot be cancelled (current status: ${order.status}).`);
        }
        if (order.lines.some((l) => l.receivedQuantity.gt(0))) {
            throw new common_1.BadRequestException('Cannot cancel a return order after quantity has been received on a line.');
        }
        const updated = await this.prisma.returnOrder.update({
            where: { id },
            data: {
                status: client_1.ReturnOrderStatus.cancelled,
                cancelledAt: new Date(),
                cancelledBy: user.id,
            },
            include: ORDER_INCLUDE,
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            companyId: order.companyId,
            action: 'RETURN_CANCELLED',
            resourceType: 'return_order',
            resourceId: id,
        }));
        this.emitReturnEvent(updated, 'updated');
        return updated;
    }
    emitReturnEvent(order, kind) {
        const listItem = (0, realtime_ops_payload_1.returnListItemPayload)(order);
        const detail = (0, realtime_ops_payload_1.returnDetailPayload)(order);
        const payload = { listItem, return: detail };
        switch (kind) {
            case 'created':
                this.realtime.emitReturnCreated(order.companyId, payload);
                break;
            case 'updated':
                this.realtime.emitReturnUpdated(order.companyId, payload);
                break;
            case 'confirmed':
                this.realtime.emitReturnConfirmed(order.companyId, payload);
                break;
            case 'completed':
                this.realtime.emitReturnCompleted(order.companyId, payload);
                break;
        }
    }
    async assertWarehouse(warehouseId) {
        const wh = await this.prisma.warehouse.findUnique({
            where: { id: warehouseId },
            select: { id: true, status: true },
        });
        if (!wh || wh.status !== 'active') {
            throw new common_1.NotFoundException('Warehouse not found.');
        }
    }
    async assertPackageForCompany(packageId, companyId) {
        const pkg = await this.prisma.package.findUnique({
            where: { id: packageId },
            include: { product: { select: { companyId: true } } },
        });
        if (!pkg)
            throw new common_1.NotFoundException('Package not found.');
        if (pkg.product.companyId !== companyId) {
            throw new common_1.NotFoundException('Package not found.');
        }
    }
    async assertLinePackage(packageId, productId, companyId) {
        const pkg = await this.prisma.package.findUnique({
            where: { id: packageId },
            include: { product: { select: { id: true, companyId: true } } },
        });
        if (!pkg || pkg.product.companyId !== companyId) {
            throw new common_1.NotFoundException('Package not found.');
        }
        if (pkg.productId !== productId) {
            throw new common_1.BadRequestException('Package product does not match the return line product.');
        }
    }
    async assertLotForProduct(lotId, productId, companyId) {
        const lot = await this.prisma.lot.findUnique({
            where: { id: lotId },
            include: { product: { select: { id: true, companyId: true } } },
        });
        if (!lot || lot.product.companyId !== companyId) {
            throw new common_1.NotFoundException('Lot not found.');
        }
        if (lot.productId !== productId) {
            throw new common_1.BadRequestException('Lot does not belong to the return line product.');
        }
    }
    async resolveLotFromOutbound(params) {
        if (params.outboundOrderLineId) {
            const line = await this.prisma.outboundOrderLine.findUnique({
                where: { id: params.outboundOrderLineId },
                select: {
                    specificLotId: true,
                    outboundOrderId: true,
                    productId: true,
                },
            });
            if (line?.specificLotId)
                return line.specificLotId;
            if (line) {
                const byLine = await this.prisma.stockReservation.findFirst({
                    where: {
                        outboundOrderLineId: params.outboundOrderLineId,
                        productId: params.productId,
                        lotId: { not: null },
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { lotId: true },
                });
                if (byLine?.lotId)
                    return byLine.lotId;
                const byOrder = await this.prisma.stockReservation.findFirst({
                    where: {
                        outboundOrderId: line.outboundOrderId,
                        productId: params.productId,
                        lotId: { not: null },
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { lotId: true },
                });
                if (byOrder?.lotId)
                    return byOrder.lotId;
            }
        }
        if (params.originalOutboundOrderId) {
            const byOrder = await this.prisma.stockReservation.findFirst({
                where: {
                    outboundOrderId: params.originalOutboundOrderId,
                    productId: params.productId,
                    lotId: { not: null },
                },
                orderBy: { createdAt: 'desc' },
                select: { lotId: true },
            });
            if (byOrder?.lotId)
                return byOrder.lotId;
        }
        return null;
    }
};
exports.ReturnsService = ReturnsService;
exports.ReturnsService = ReturnsService = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, common_1.Inject)((0, common_1.forwardRef)(() => oms_returns_service_1.OmsReturnsService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        company_access_service_1.CompanyAccessService,
        return_quantity_validation_1.ReturnQuantityValidation,
        return_workflow_service_1.ReturnWorkflowService,
        audit_log_service_1.AuditLogService,
        realtime_service_1.RealtimeService,
        oms_returns_service_1.OmsReturnsService])
], ReturnsService);
//# sourceMappingURL=returns.service.js.map