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
exports.InboundService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const warehouse_order_scope_1 = require("../../common/utils/warehouse-order-scope");
const storage_location_types_1 = require("../../common/constants/storage-location-types");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const order_planning_date_1 = require("../../common/utils/order-planning-date");
const location_operational_1 = require("../../common/utils/location-operational");
const identifiers_1 = require("../../common/generators/identifiers");
const assert_product_orderable_1 = require("../../common/utils/assert-product-orderable");
const discrete_uom_quantity_1 = require("../../common/utils/discrete-uom-quantity");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const stock_helpers_1 = require("../inventory/stock.helpers");
const feature_flags_1 = require("../warehouse-workflow/feature-flags");
const notifications_service_1 = require("../notifications/notifications.service");
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
                    expiryTracking: true,
                },
            },
        },
    },
};
const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INBOUND_CONFIRMABLE = [
    client_1.InboundOrderStatus.draft,
    client_1.InboundOrderStatus.pending_approval,
];
function isInboundConfirmable(status) {
    return INBOUND_CONFIRMABLE.includes(status);
}
let InboundService = class InboundService {
    prisma;
    stock;
    config;
    workflowBootstrap;
    realtime;
    notifications;
    companyAccess;
    constructor(prisma, stock, config, workflowBootstrap, realtime, notifications, companyAccess) {
        this.prisma = prisma;
        this.stock = stock;
        this.config = config;
        this.workflowBootstrap = workflowBootstrap;
        this.realtime = realtime;
        this.notifications = notifications;
        this.companyAccess = companyAccess;
    }
    async create(user, dto, opts) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, companyId: true, status: true, trackingType: true, uom: true },
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
        (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.expectedArrivalDate, 'Expected arrival date');
        const productById = new Map(products.map((p) => [p.id, p]));
        const lineCreates = [];
        for (let idx = 0; idx < dto.lines.length; idx++) {
            const l = dto.lines[idx];
            const p = productById.get(l.productId);
            (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(p.uom, l.expectedQuantity, 'Expected quantity');
            let expectedLotNumber = l.expectedLotNumber?.trim() ?? null;
            if (p.trackingType === 'lot') {
                if (!expectedLotNumber) {
                    expectedLotNumber = await this.allocateInboundExpectedLotNumber(l.productId);
                }
            }
            else {
                expectedLotNumber = null;
            }
            lineCreates.push({
                product: { connect: { id: l.productId } },
                expectedQuantity: new client_1.Prisma.Decimal(l.expectedQuantity),
                expectedLotNumber,
                expectedExpiryDate: l.expectedExpiryDate ? new Date(l.expectedExpiryDate) : null,
                lineNumber: idx + 1,
            });
        }
        const order = await this.prisma.inboundOrder.create({
            data: {
                companyId,
                status: opts?.pendingClientApproval ? client_1.InboundOrderStatus.pending_approval : undefined,
                expectedArrivalDate: new Date(dto.expectedArrivalDate),
                clientReference: dto.clientReference,
                notes: dto.notes,
                createdBy: user.id,
                lines: {
                    create: lineCreates,
                },
            },
            include: ORDER_INCLUDE,
        });
        this.realtime.emitInboundOrderCreated(order.companyId, {
            orderId: order.id,
            status: order.status,
        });
        if (opts?.pendingClientApproval) {
            await this.notifications.notifyAdminsPendingApproval({
                companyId: order.companyId,
                companyName: order.company.name,
                orderType: 'inbound',
                orderId: order.id,
                orderNumber: order.orderNumber,
            });
        }
        return order;
    }
    async list(user, query) {
        const baseAnd = [];
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdFilter)(this.companyAccess, user, query.companyId);
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
            const scope = await (0, warehouse_order_scope_1.inboundIdsVisibleForWarehouse)(this.prisma, query.warehouseId, {
                ...(companyId ? { companyId } : {}),
            });
            baseAnd.push(scope);
        }
        if (baseAnd.length > 0)
            where.AND = baseAnd;
        return this.prisma.$transaction([
            this.prisma.inboundOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    company: { select: { id: true, name: true } },
                    _count: { select: { lines: true } },
                    lines: {
                        select: { id: true, productId: true, expectedQuantity: true, receivedQuantity: true, lineNumber: true },
                    },
                },
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.inboundOrder.count({ where }),
        ]).then(([items, total]) => ({ items, total, limit: query.limit, offset: query.offset }));
    }
    async findById(id, user) {
        const order = await this.prisma.inboundOrder.findUnique({
            where: { id },
            include: ORDER_INCLUDE,
        });
        if (!order)
            throw new common_1.NotFoundException('Inbound order not found.');
        if (user) {
            this.companyAccess.validateResourceOwnership(user, order);
        }
        return order;
    }
    async confirm(user, id, body) {
        const order = await this.findById(id, user);
        const wasPendingApproval = order.status === client_1.InboundOrderStatus.pending_approval;
        for (const line of order.lines) {
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
        }
        if (!isInboundConfirmable(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Only draft or pending-approval orders can be confirmed (current status: ${order.status}).`);
        }
        if (order.lines.length === 0) {
            throw new common_1.BadRequestException('Add at least one line before confirming this order.');
        }
        if ((0, feature_flags_1.taskOnlyFlows)(this.config)) {
            if (!body?.warehouseId || !body.stagingByLineId) {
                throw new common_1.BadRequestException('When TASK_ONLY_FLOWS=true, confirm body must include warehouseId and stagingByLineId (per line).');
            }
            await this.prisma.$transaction(async (tx) => {
                const wh = body.warehouseId;
                const cur = await tx.inboundOrder.findUnique({ where: { id } });
                if (!cur)
                    throw new common_1.NotFoundException('Inbound order not found.');
                this.companyAccess.validateResourceOwnership(user, cur);
                if (!isInboundConfirmable(cur.status)) {
                    throw new domain_exceptions_1.InvalidStateException(`Only draft or pending-approval orders can be confirmed (current status: ${cur.status}).`);
                }
                await tx.inboundOrder.update({
                    where: { id },
                    data: { status: 'in_progress', confirmedAt: new Date() },
                });
                await this.workflowBootstrap.startInboundWorkflowTx(tx, user, id, wh, body.stagingByLineId);
            });
            const updated = await this.findById(id);
            this.realtime.emitInboundOrderUpdated(updated.companyId, {
                orderId: updated.id,
                status: updated.status,
                reason: 'confirm',
            });
            if (wasPendingApproval) {
                await this.notifications.notifyClientOrderConfirmed({
                    companyId: updated.companyId,
                    orderType: 'inbound',
                    orderId: updated.id,
                    orderNumber: updated.orderNumber,
                });
                await this.notifications.dismissPendingAdminNotifications('inbound_order', updated.id);
            }
            return updated;
        }
        await this.prisma.inboundOrder.update({
            where: { id },
            data: { status: 'confirmed', confirmedAt: new Date() },
        });
        const confirmed = await this.findById(id);
        this.realtime.emitInboundOrderUpdated(confirmed.companyId, {
            orderId: confirmed.id,
            status: confirmed.status,
            reason: 'confirm',
        });
        if (wasPendingApproval) {
            await this.notifications.notifyClientOrderConfirmed({
                companyId: confirmed.companyId,
                orderType: 'inbound',
                orderId: confirmed.id,
                orderNumber: confirmed.orderNumber,
            });
            await this.notifications.dismissPendingAdminNotifications('inbound_order', confirmed.id);
        }
        return confirmed;
    }
    async cancel(id, user) {
        const order = await this.findById(id, user);
        if (!['draft', 'pending_approval', 'confirmed'].includes(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Inbound orders can only be cancelled while in draft, pending approval, or confirmed (current: ${order.status}).`);
        }
        const cancelled = await this.prisma.inboundOrder.update({
            where: { id },
            data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelledBy: user.id,
            },
            include: ORDER_INCLUDE,
        });
        this.realtime.emitInboundOrderUpdated(cancelled.companyId, {
            orderId: cancelled.id,
            status: cancelled.status,
            reason: 'cancel',
        });
        return cancelled;
    }
    async receiveLine(user, orderId, lineId, dto) {
        if ((0, feature_flags_1.taskOnlyFlows)(this.config)) {
            throw new common_1.GoneException('Use warehouse RECEIVING task completion when TASK_ONLY_FLOWS=true; line receive API is disabled.');
        }
        const received = await this.prisma.$transaction(async (tx) => {
            const order = await tx.inboundOrder.findUnique({ where: { id: orderId } });
            if (!order)
                throw new common_1.NotFoundException('Inbound order not found.');
            if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
                throw new domain_exceptions_1.InvalidStateException(`Receive is only allowed when order status is confirmed/in_progress (current: ${order.status}).`);
            }
            const line = await tx.inboundOrderLine.findUnique({
                where: { id: lineId },
                include: {
                    product: {
                        select: {
                            id: true,
                            status: true,
                            trackingType: true,
                            expiryTracking: true,
                            uom: true,
                        },
                    },
                },
            });
            if (!line || line.inboundOrderId !== orderId) {
                throw new common_1.NotFoundException('Inbound line not found on this order.');
            }
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
            (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(line.product.uom, dto.quantity, 'Receive quantity');
            const location = await tx.location.findUnique({
                where: { id: dto.locationId },
                select: { id: true, warehouseId: true, type: true, status: true },
            });
            if (!location)
                throw new common_1.NotFoundException('Destination location not found.');
            (0, location_operational_1.assertLocationUsableForInventoryMove)(location.status);
            if ((0, feature_flags_1.inboundReceiveDefersPutaway)(this.config)) {
                if (!this.isDockStagingLocationType(location.type)) {
                    throw new domain_exceptions_1.InvalidLocationTypeException('Deferred putaway mode: receive only to a receiving dock location (`input`). Inventory posts on putaway task.');
                }
                const delta = new client_1.Prisma.Decimal(dto.quantity);
                await tx.inboundOrderLine.update({
                    where: { id: lineId },
                    data: { receivedQuantity: { increment: delta } },
                });
                await this.refreshInboundOrderHeadStatus(tx, orderId);
                return tx.inboundOrder.findUnique({
                    where: { id: orderId },
                    include: ORDER_INCLUDE,
                });
            }
            if (!(0, storage_location_types_1.isStorageLocationType)(location.type)) {
                throw new domain_exceptions_1.InvalidLocationTypeException('Destination must be a storage-capable location (e.g. internal, packing, quarantine). Aisles/sections and dock nodes cannot receive stock.');
            }
            const expected = line.expectedLotNumber?.trim() || null;
            let effectiveLotNumber;
            if (line.product.trackingType === 'lot') {
                if (expected && !dto.overrideLot) {
                    if (dto.lotNumber && dto.lotNumber !== expected) {
                        throw new domain_exceptions_1.LotLockedException();
                    }
                    effectiveLotNumber = expected;
                }
                else {
                    if (!dto.lotNumber)
                        throw new domain_exceptions_1.LotRequiredException();
                    effectiveLotNumber = dto.lotNumber;
                }
            }
            let expiryForLot = null;
            if (line.product.trackingType === 'lot' && line.product.expiryTracking) {
                if (dto.expiryDate && dto.expiryDate.trim() !== '') {
                    expiryForLot = new Date(dto.expiryDate);
                }
                else if (expected && !dto.overrideLot && line.expectedExpiryDate) {
                    expiryForLot = new Date(line.expectedExpiryDate);
                }
                if (!expiryForLot) {
                    throw new common_1.BadRequestException('expiryDate is required for expiry-tracked products (send on line or use expected expiry).');
                }
            }
            let lotId = null;
            if (effectiveLotNumber) {
                const existing = await tx.lot.findUnique({
                    where: {
                        productId_lotNumber: {
                            productId: line.productId,
                            lotNumber: effectiveLotNumber,
                        },
                    },
                });
                if (existing) {
                    lotId = existing.id;
                    if (expiryForLot && !existing.expiryDate) {
                        await tx.lot.update({
                            where: { id: existing.id },
                            data: { expiryDate: expiryForLot },
                        });
                    }
                }
                else {
                    const created = await tx.lot.create({
                        data: {
                            productId: line.productId,
                            lotNumber: effectiveLotNumber,
                            expiryDate: expiryForLot,
                        },
                    });
                    lotId = created.id;
                }
            }
            const stockMeta = await this.stock.upsertPositiveWithMeta(tx, {
                companyId: order.companyId,
                productId: line.productId,
                locationId: dto.locationId,
                warehouseId: location.warehouseId,
                lotId,
                quantity: dto.quantity,
            });
            await tx.inventoryLedger.create({
                data: {
                    companyId: order.companyId,
                    productId: line.productId,
                    lotId,
                    toLocationId: dto.locationId,
                    movementType: 'inbound_receive',
                    quantity: new client_1.Prisma.Decimal(dto.quantity),
                    quantityBefore: stockMeta.before,
                    quantityAfter: stockMeta.after,
                    referenceType: 'inbound_order',
                    referenceId: orderId,
                    operatorId: user.id,
                    idempotencyKey: `bm:inbound:${orderId}:${line.productId}:line:${line.id}:loc:${dto.locationId}:lot:${lotId ?? 'null'}`,
                },
            });
            const newReceived = line.receivedQuantity.plus(new client_1.Prisma.Decimal(dto.quantity));
            await tx.inboundOrderLine.update({
                where: { id: lineId },
                data: { receivedQuantity: newReceived },
            });
            await this.refreshInboundOrderHeadStatus(tx, orderId);
            return tx.inboundOrder.findUnique({
                where: { id: orderId },
                include: ORDER_INCLUDE,
            });
        });
        if (received) {
            this.realtime.emitInboundOrderUpdated(received.companyId, {
                orderId: received.id,
                status: received.status,
                reason: 'receive_line',
            });
            this.realtime.emitInventoryChanged(received.companyId, {
                source: 'inbound_receive_line',
                orderId: received.id,
            });
        }
        return received;
    }
    async refreshInboundOrderHeadStatus(tx, orderId) {
        const order = await tx.inboundOrder.findUnique({
            where: { id: orderId },
            select: { status: true },
        });
        if (!order)
            return;
        const allLines = await tx.inboundOrderLine.findMany({
            where: { inboundOrderId: orderId },
            select: { receivedQuantity: true, expectedQuantity: true },
        });
        const allComplete = allLines.every((l) => l.receivedQuantity.greaterThanOrEqualTo(l.expectedQuantity));
        const anyReceived = allLines.some((l) => l.receivedQuantity.greaterThan(0));
        if (!anyReceived)
            return;
        if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
            return;
        }
        const next = allComplete ? 'in_progress' : 'partially_received';
        if (next !== order.status) {
            await tx.inboundOrder.update({ where: { id: orderId }, data: { status: next } });
        }
    }
    isDockStagingLocationType(locationType) {
        return locationType === 'input';
    }
    async allocateInboundExpectedLotNumber(productId) {
        for (let attempt = 0; attempt < 24; attempt++) {
            const candidate = (0, identifiers_1.generateLotCandidate)();
            const clash = await this.prisma.lot.findUnique({
                where: { productId_lotNumber: { productId, lotNumber: candidate } },
                select: { id: true },
            });
            if (!clash)
                return candidate;
        }
        throw new common_1.InternalServerErrorException('Could not allocate a unique inbound lot number.');
    }
};
exports.InboundService = InboundService;
exports.InboundService = InboundService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_helpers_1.StockHelpers,
        config_1.ConfigService,
        workflow_bootstrap_service_1.WorkflowBootstrapService,
        realtime_service_1.RealtimeService,
        notifications_service_1.NotificationsService,
        company_access_service_1.CompanyAccessService])
], InboundService);
//# sourceMappingURL=inbound.service.js.map