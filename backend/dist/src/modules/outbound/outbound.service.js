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
exports.OutboundService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const warehouse_order_scope_1 = require("../../common/utils/warehouse-order-scope");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const assert_product_orderable_1 = require("../../common/utils/assert-product-orderable");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const stock_helpers_1 = require("../inventory/stock.helpers");
const feature_flags_1 = require("../warehouse-workflow/feature-flags");
const realtime_service_1 = require("../realtime/realtime.service");
const workflow_bootstrap_service_1 = require("../warehouse-workflow/workflow-bootstrap.service");
const ORDER_INCLUDE = {
    company: { select: { id: true, name: true } },
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
        },
    },
};
const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let OutboundService = class OutboundService {
    prisma;
    stock;
    config;
    workflowBootstrap;
    realtime;
    constructor(prisma, stock, config, workflowBootstrap, realtime) {
        this.prisma = prisma;
        this.stock = stock;
        this.config = config;
        this.workflowBootstrap = workflowBootstrap;
        this.realtime = realtime;
    }
    async create(user, dto) {
        const companyId = dto.companyId ?? user.companyId;
        if (!companyId) {
            throw new common_1.BadRequestException('companyId is required (no default company on current user).');
        }
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, companyId: true, sku: true, name: true, status: true },
        });
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException('One or more products not found.');
        }
        const wrongCompany = products.find((p) => p.companyId !== companyId);
        if (wrongCompany) {
            throw new common_1.BadRequestException('All line products must belong to the same company as the order.');
        }
        for (const p of products) {
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(p.status);
        }
        const requestedByProduct = new Map();
        for (const l of dto.lines) {
            const cur = requestedByProduct.get(l.productId) ?? new client_1.Prisma.Decimal(0);
            requestedByProduct.set(l.productId, cur.plus(new client_1.Prisma.Decimal(l.requestedQuantity)));
        }
        const availability = await this.prisma.currentStock.groupBy({
            by: ['productId'],
            where: {
                companyId,
                productId: { in: productIds },
                status: 'available',
            },
            _sum: { quantityAvailable: true },
        });
        const availMap = new Map(availability.map((a) => [
            a.productId,
            a._sum.quantityAvailable ?? new client_1.Prisma.Decimal(0),
        ]));
        const shortages = [];
        for (const [productId, requested] of requestedByProduct.entries()) {
            const available = availMap.get(productId) ?? new client_1.Prisma.Decimal(0);
            if (requested.greaterThan(available)) {
                shortages.push({
                    productId,
                    requested: requested.toString(),
                    available: available.toString(),
                });
            }
        }
        if (shortages.length > 0) {
            const productById = new Map(products.map((p) => [p.id, p]));
            const summary = shortages
                .map((s) => {
                const p = productById.get(s.productId);
                const sku = p?.sku ?? s.productId;
                return `${sku}: ${s.available}`;
            })
                .join('; ');
            throw new domain_exceptions_1.InsufficientStockException(`Insufficient stock. Available: ${summary}`, shortages);
        }
        const created = await this.prisma.outboundOrder.create({
            data: {
                companyId,
                destinationAddress: dto.destinationAddress,
                requiredShipDate: new Date(dto.requiredShipDate),
                carrier: dto.carrier,
                clientReference: dto.clientReference,
                notes: dto.notes,
                createdBy: user.id,
                lines: {
                    create: dto.lines.map((l, idx) => ({
                        productId: l.productId,
                        requestedQuantity: new client_1.Prisma.Decimal(l.requestedQuantity),
                        specificLotId: l.specificLotId,
                        lineNumber: idx + 1,
                    })),
                },
            },
            include: ORDER_INCLUDE,
        });
        this.realtime.emitOutboundOrderCreated(created.companyId, {
            orderId: created.id,
            status: created.status,
        });
        return created;
    }
    async list(user, query) {
        const baseAnd = [];
        const where = {};
        const companyId = query.companyId ?? user.companyId ?? undefined;
        if (companyId)
            where.companyId = companyId;
        if (query.status)
            where.status = query.status;
        if (query.orderSearch?.trim()) {
            const t = query.orderSearch.trim();
            const orParts = [
                { orderNumber: { contains: t, mode: 'insensitive' } },
            ];
            if (FULL_UUID.test(t))
                orParts.push({ id: t });
            baseAnd.push({ OR: orParts });
        }
        if (query.createdFrom || query.createdTo) {
            const createdAt = {};
            if (query.createdFrom)
                createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
            if (query.createdTo)
                createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
            where.createdAt = createdAt;
        }
        if (query.warehouseId) {
            const scope = await (0, warehouse_order_scope_1.outboundIdsVisibleForWarehouse)(this.prisma, query.warehouseId, {
                ...(companyId ? { companyId } : {}),
            });
            baseAnd.push(scope);
        }
        if (baseAnd.length > 0)
            where.AND = baseAnd;
        return this.prisma.$transaction([
            this.prisma.outboundOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    company: { select: { id: true, name: true } },
                    _count: { select: { lines: true } },
                },
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.outboundOrder.count({ where }),
        ]).then(([items, total]) => ({ items, total, limit: query.limit, offset: query.offset }));
    }
    async findById(id) {
        const order = await this.prisma.outboundOrder.findUnique({
            where: { id },
            include: ORDER_INCLUDE,
        });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found.');
        return order;
    }
    async cancel(id, user) {
        const order = await this.findById(id);
        if (order.status !== 'draft') {
            throw new domain_exceptions_1.InvalidStateException(`Outbound orders can only be cancelled while in draft (current: ${order.status}).`);
        }
        const cancelled = await this.prisma.outboundOrder.update({
            where: { id },
            data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id },
            include: ORDER_INCLUDE,
        });
        this.realtime.emitOutboundOrderUpdated(cancelled.companyId, {
            orderId: cancelled.id,
            status: cancelled.status,
            reason: 'cancel',
        });
        return cancelled;
    }
    async confirmWithoutDeduction(user, orderId) {
        const updated = await this.prisma.$transaction(async (tx) => {
            const order = await tx.outboundOrder.findUnique({
                where: { id: orderId },
                include: {
                    lines: {
                        orderBy: { lineNumber: 'asc' },
                        include: { product: { select: { status: true } } },
                    },
                },
            });
            if (!order)
                throw new common_1.NotFoundException('Outbound order not found.');
            if (order.status !== 'draft') {
                throw new domain_exceptions_1.InvalidStateException(`Only draft orders can be confirmed (current: ${order.status}).`);
            }
            if (order.lines.length === 0) {
                throw new common_1.BadRequestException('Cannot confirm an order with no lines.');
            }
            for (const line of order.lines) {
                (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
            }
            return tx.outboundOrder.update({
                where: { id: orderId },
                data: {
                    status: 'picking',
                    confirmedAt: new Date(),
                    pickingStartedAt: new Date(),
                },
                include: ORDER_INCLUDE,
            });
        });
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'confirm_without_deduction',
        });
        return updated;
    }
    async confirmAndDeduct(user, orderId, body) {
        if ((0, feature_flags_1.taskOnlyFlows)(this.config)) {
            if (!body?.warehouseId) {
                throw new common_1.BadRequestException('When TASK_ONLY_FLOWS=true, confirm body must include warehouseId for workflow bootstrap.');
            }
            await this.prisma.$transaction(async (tx) => {
                const wh = body.warehouseId;
                const order = await tx.outboundOrder.findUnique({
                    where: { id: orderId },
                    include: {
                        lines: {
                            orderBy: { lineNumber: 'asc' },
                            include: { product: { select: { status: true } } },
                        },
                    },
                });
                if (!order)
                    throw new common_1.NotFoundException('Outbound order not found.');
                if (user.companyId && order.companyId !== user.companyId) {
                    throw new common_1.NotFoundException('Outbound order not found.');
                }
                if (order.status !== 'draft') {
                    throw new domain_exceptions_1.InvalidStateException(`Only draft orders can be confirmed (current status: ${order.status}).`);
                }
                if (order.lines.length === 0) {
                    throw new common_1.BadRequestException('Cannot confirm an order with no lines.');
                }
                for (const line of order.lines) {
                    (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
                }
                await tx.outboundOrder.update({
                    where: { id: orderId },
                    data: {
                        status: 'picking',
                        confirmedAt: new Date(),
                        pickingStartedAt: new Date(),
                    },
                });
                await this.workflowBootstrap.startOutboundWorkflowTx(tx, user, orderId, wh);
            });
            const wfConfirmed = await this.findById(orderId);
            this.realtime.emitOutboundOrderUpdated(wfConfirmed.companyId, {
                orderId: wfConfirmed.id,
                status: wfConfirmed.status,
                reason: 'confirm_task_flow',
            });
            return wfConfirmed;
        }
        if ((0, feature_flags_1.outboundConfirmDefersDeduction)(this.config)) {
            return this.confirmWithoutDeduction(user, orderId);
        }
        const shipped = await this.prisma.$transaction(async (tx) => {
            const order = await tx.outboundOrder.findUnique({
                where: { id: orderId },
                include: {
                    lines: {
                        orderBy: { lineNumber: 'asc' },
                        include: { product: { select: { status: true } } },
                    },
                },
            });
            if (!order)
                throw new common_1.NotFoundException('Outbound order not found.');
            if (order.status !== 'draft') {
                throw new domain_exceptions_1.InvalidStateException(`Only draft orders can be confirmed (current: ${order.status}).`);
            }
            if (order.lines.length === 0) {
                throw new common_1.BadRequestException('Cannot confirm an order with no lines.');
            }
            for (const line of order.lines) {
                (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
            }
            for (const line of order.lines) {
                const requested = line.requestedQuantity;
                let remaining = new client_1.Prisma.Decimal(requested.toString());
                const candidates = await this.findStockCandidates(tx, order.companyId, line.productId, line.specificLotId);
                for (const row of candidates) {
                    if (remaining.lessThanOrEqualTo(0))
                        break;
                    const take = client_1.Prisma.Decimal.min(remaining, row.quantityAvailable);
                    if (take.lessThanOrEqualTo(0))
                        continue;
                    const meta = await this.stock.decrementWithMeta(tx, {
                        companyId: order.companyId,
                        productId: line.productId,
                        locationId: row.locationId,
                        lotId: row.lotId,
                        quantity: take.toString(),
                    });
                    await tx.inventoryLedger.create({
                        data: {
                            companyId: order.companyId,
                            productId: line.productId,
                            lotId: row.lotId,
                            fromLocationId: row.locationId,
                            movementType: 'outbound_pick',
                            quantity: take,
                            quantityBefore: meta.before,
                            quantityAfter: meta.after,
                            referenceType: 'outbound_order',
                            referenceId: orderId,
                            operatorId: user.id,
                            idempotencyKey: `bm:outbound:${orderId}:${line.productId}:line:${line.id}:loc:${row.locationId}:lot:${row.lotId ?? 'null'}:${take.toString()}`,
                        },
                    });
                    remaining = remaining.minus(take);
                }
                if (remaining.greaterThan(0)) {
                    const agg = await tx.currentStock.aggregate({
                        where: {
                            companyId: order.companyId,
                            productId: line.productId,
                            status: 'available',
                        },
                        _sum: { quantityAvailable: true },
                    });
                    const available = agg._sum.quantityAvailable?.toString() ?? '0';
                    throw new domain_exceptions_1.InsufficientStockException(`Insufficient stock. Available: ${available}`, [
                        {
                            productId: line.productId,
                            requested: requested.toString(),
                            available,
                        },
                    ]);
                }
                await tx.outboundOrderLine.update({
                    where: { id: line.id },
                    data: {
                        pickedQuantity: requested,
                        status: 'done',
                    },
                });
            }
            return tx.outboundOrder.update({
                where: { id: orderId },
                data: {
                    status: 'shipped',
                    confirmedAt: new Date(),
                    shippedAt: new Date(),
                },
                include: ORDER_INCLUDE,
            });
        });
        this.realtime.emitOutboundOrderUpdated(shipped.companyId, {
            orderId: shipped.id,
            status: shipped.status,
            reason: 'confirm_and_deduct',
        });
        this.realtime.emitInventoryChanged(shipped.companyId, {
            source: 'outbound_ship',
            orderId: shipped.id,
        });
        return shipped;
    }
    async findStockCandidates(tx, companyId, productId, specificLotId) {
        const lotFilter = specificLotId
            ? client_1.Prisma.sql `AND cs.lot_id = ${specificLotId}::uuid`
            : client_1.Prisma.empty;
        const rows = await tx.$queryRaw(client_1.Prisma.sql `
      SELECT cs.id,
             cs.product_id,
             cs.location_id,
             cs.warehouse_id,
             cs.lot_id,
             cs.quantity_available::text AS quantity_available,
             l.expiry_date,
             cs.last_movement_at AS created_at
        FROM current_stock cs
   LEFT JOIN lots l ON l.id = cs.lot_id
       WHERE cs.company_id = ${companyId}::uuid
         AND cs.product_id = ${productId}::uuid
         AND cs.status = 'available'
         AND cs.quantity_available > 0
         ${lotFilter}
    ORDER BY (l.expiry_date IS NULL),
             l.expiry_date ASC,
             cs.last_movement_at ASC NULLS LAST,
             cs.id ASC
    `);
        return rows.map((r) => ({
            id: r.id,
            productId: r.product_id,
            locationId: r.location_id,
            warehouseId: r.warehouse_id,
            lotId: r.lot_id,
            quantityAvailable: new client_1.Prisma.Decimal(r.quantity_available),
            expiryDate: r.expiry_date,
            createdAt: r.created_at,
        }));
    }
};
exports.OutboundService = OutboundService;
exports.OutboundService = OutboundService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_helpers_1.StockHelpers,
        config_1.ConfigService,
        workflow_bootstrap_service_1.WorkflowBootstrapService,
        realtime_service_1.RealtimeService])
], OutboundService);
//# sourceMappingURL=outbound.service.js.map