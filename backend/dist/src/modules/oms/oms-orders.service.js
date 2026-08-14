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
exports.OmsOrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const discrete_uom_quantity_1 = require("../../common/utils/discrete-uom-quantity");
const order_planning_date_1 = require("../../common/utils/order-planning-date");
const assert_product_orderable_1 = require("../../common/utils/assert-product-orderable");
const realtime_service_1 = require("../realtime/realtime.service");
const realtime_client_payload_1 = require("../realtime/realtime-client.payload");
const outbound_service_1 = require("../outbound/outbound.service");
const cod_records_service_1 = require("../cod/cod-records.service");
const oms_order_events_service_1 = require("./oms-order-events.service");
const oms_outbound_sync_service_1 = require("./oms-outbound-sync.service");
const oms_order_mapper_1 = require("./oms-order.mapper");
const oms_order_transitions_1 = require("./oms-order-transitions");
const order_allocation_service_1 = require("./order-allocation.service");
const shipping_service_1 = require("../shipping/shipping.service");
const shipping_config_util_1 = require("../shipping/shipping-config.util");
const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_INCLUDE = {
    company: { select: { id: true, name: true } },
    outboundOrder: { select: { id: true, orderNumber: true, status: true } },
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
                    weightKg: true,
                    volumeCbm: true,
                },
            },
        },
    },
};
let OmsOrdersService = class OmsOrdersService {
    prisma;
    outbound;
    companyAccess;
    allocation;
    events;
    sync;
    realtime;
    cod;
    shipping;
    constructor(prisma, outbound, companyAccess, allocation, events, sync, realtime, cod, shipping) {
        this.prisma = prisma;
        this.outbound = outbound;
        this.companyAccess = companyAccess;
        this.allocation = allocation;
        this.events = events;
        this.sync = sync;
        this.realtime = realtime;
        this.cod = cod;
        this.shipping = shipping;
    }
    async list(user, query) {
        const where = {};
        const andParts = [];
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        if (companyId)
            where.companyId = companyId;
        if (query.status) {
            const expansions = {
                [client_1.OmsOrderStatus.waiting_for_confirmation]: [
                    client_1.OmsOrderStatus.waiting_for_confirmation,
                    client_1.OmsOrderStatus.draft,
                ],
                [client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval]: [
                    client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
                    client_1.OmsOrderStatus.pending_approval,
                ],
                [client_1.OmsOrderStatus.processing]: [
                    client_1.OmsOrderStatus.processing,
                    client_1.OmsOrderStatus.pending,
                    client_1.OmsOrderStatus.approved,
                    client_1.OmsOrderStatus.confirmed,
                    client_1.OmsOrderStatus.allocated,
                    client_1.OmsOrderStatus.picking,
                    client_1.OmsOrderStatus.packing,
                ],
                [client_1.OmsOrderStatus.shipped]: [
                    client_1.OmsOrderStatus.shipped,
                    client_1.OmsOrderStatus.out_for_delivery,
                ],
                [client_1.OmsOrderStatus.delivered]: [
                    client_1.OmsOrderStatus.delivered,
                    client_1.OmsOrderStatus.completed,
                ],
                [client_1.OmsOrderStatus.cancelled]: [
                    client_1.OmsOrderStatus.cancelled,
                    client_1.OmsOrderStatus.rejected,
                ],
            };
            where.status = expansions[query.status]
                ? { in: expansions[query.status] }
                : query.status;
        }
        if (query.storeChannel?.trim()) {
            where.storeChannel = { contains: query.storeChannel.trim(), mode: 'insensitive' };
        }
        if (query.linkStatus === 'linked')
            where.outboundOrderId = { not: null };
        if (query.linkStatus === 'unlinked')
            where.outboundOrderId = null;
        if (query.orderSearch?.trim()) {
            const t = query.orderSearch.trim();
            const orParts = [
                { orderNumber: { contains: t, mode: 'insensitive' } },
                { recipientName: { contains: t, mode: 'insensitive' } },
                { recipientPhone: { contains: t, mode: 'insensitive' } },
            ];
            if (FULL_UUID.test(t))
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
        if (andParts.length > 0)
            where.AND = andParts;
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total] = await Promise.all([
                tx.omsOrder.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    include: ORDER_INCLUDE,
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.omsOrder.count({ where }),
            ]);
            return {
                items: items.map(oms_order_mapper_1.serializeOmsOrderListItem),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async create(user, dto, opts) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.requiredShipDate, 'Required ship date');
        const provisionOutbound = !!opts?.provisionOutbound && !dto.outboundOrderId;
        if (dto.outboundOrderId) {
            await this.assertOutboundLinkable(user, dto.outboundOrderId, companyId);
        }
        let destination = (0, oms_order_mapper_1.composeDestinationAddress)(dto);
        if (!destination && dto.outboundOrderId) {
            const linked = await this.outbound.findById(dto.outboundOrderId, user);
            destination = linked.destinationAddress?.trim() || 'Linked outbound order';
        }
        if (!destination) {
            throw new common_1.BadRequestException('Destination address is required (address line / city / destination).');
        }
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, companyId: true, status: true, uom: true, sku: true, weightKg: true, volumeCbm: true },
        });
        if (products.length !== productIds.length) {
            throw new common_1.NotFoundException('One or more products not found.');
        }
        const wrongCompany = products.find((p) => p.companyId !== companyId);
        if (wrongCompany) {
            throw new common_1.BadRequestException('All line products must belong to the same company as the order.');
        }
        for (const p of products)
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(p.status);
        const productById = new Map(products.map((p) => [p.id, p]));
        for (const l of dto.lines) {
            const p = productById.get(l.productId);
            (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(p.uom, l.requestedQuantity, 'Requested quantity');
        }
        const weightByProductId = new Map(products.map((p) => [p.id, p.weightKg?.toString() ?? null]));
        const volumeByProductId = new Map(products.map((p) => [p.id, p.volumeCbm?.toString() ?? null]));
        const shippingMethod = dto.shippingMethod ?? client_1.ShippingMethod.manual;
        const lineQty = dto.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: l.requestedQuantity,
        }));
        const shippingWeightKg = (0, shipping_config_util_1.resolveShippingWeightKg)({
            method: shippingMethod,
            explicit: dto.shippingWeightKg,
            lines: lineQty,
            weightByProductId,
        });
        const shippingVolumeCbm = (0, shipping_config_util_1.resolveShippingVolumeCbm)({
            method: shippingMethod,
            explicit: dto.shippingVolumeCbm,
            lines: lineQty,
            volumeByProductId,
        });
        const shippingFields = {
            shippingMethod,
            shippingProviderCode: dto.shippingProviderCode,
            shippingReceiverLat: dto.shippingReceiverLat,
            shippingReceiverLng: dto.shippingReceiverLng,
            shippingPackageType: dto.shippingPackageType,
            shippingContents: dto.shippingContents,
            shippingDeliveryType: dto.shippingDeliveryType,
            shippingPickupType: dto.shippingPickupType,
            shippingPayer: dto.shippingPayer,
            shippingWeightKg,
            shippingVolumeCbm,
            shippingPhoneCountry: dto.shippingPhoneCountry,
        };
        (0, shipping_config_util_1.assertShippingIntentReady)(shippingFields);
        await this.shipping.assertLiveCarrierSelection({
            fields: shippingFields,
            governorate: dto.city,
            city: dto.district,
            neighborhood: dto.addressLine1,
        });
        await this.assertSufficientStockForLines(companyId, dto.lines, products);
        const linesWithTotals = dto.lines.map((l) => {
            const qty = new client_1.Prisma.Decimal(l.requestedQuantity);
            const unitPrice = l.unitPrice != null ? new client_1.Prisma.Decimal(l.unitPrice) : null;
            const lineTotal = l.lineTotal != null
                ? new client_1.Prisma.Decimal(l.lineTotal)
                : unitPrice != null
                    ? unitPrice.mul(qty)
                    : null;
            return { ...l, qty, unitPrice, lineTotal };
        });
        const linesSum = linesWithTotals.reduce((sum, l) => (l.lineTotal != null ? sum.add(l.lineTotal) : sum), new client_1.Prisma.Decimal(0));
        const shippingFee = dto.shippingFee != null ? new client_1.Prisma.Decimal(dto.shippingFee) : new client_1.Prisma.Decimal(0);
        const subtotal = linesSum.add(shippingFee);
        const derivedCod = dto.codAmount != null
            ? new client_1.Prisma.Decimal(dto.codAmount)
            : dto.paymentMethod === 'COD'
                ? subtotal
                : null;
        const codStatus = (0, oms_order_mapper_1.deriveCodStatus)(dto.paymentMethod, derivedCod);
        const now = new Date();
        const initialStatus = dto.outboundOrderId
            ? client_1.OmsOrderStatus.draft
            : provisionOutbound
                ? client_1.OmsOrderStatus.processing
                : client_1.OmsOrderStatus.waiting_for_confirmation;
        const order = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const created = await tx.omsOrder.create({
                data: {
                    companyId,
                    outboundOrderId: dto.outboundOrderId,
                    status: initialStatus,
                    destinationAddress: destination,
                    requiredShipDate: new Date(dto.requiredShipDate),
                    carrier: dto.carrier,
                    clientReference: dto.clientReference,
                    notes: dto.notes,
                    requiresPacking: dto.requiresPacking !== false,
                    recipientName: dto.recipientName,
                    recipientPhone: dto.recipientPhone,
                    city: dto.city,
                    district: dto.district,
                    addressLine1: dto.addressLine1,
                    addressLine2: dto.addressLine2,
                    deliveryInstructions: dto.deliveryInstructions,
                    paymentMethod: dto.paymentMethod,
                    subtotal,
                    shippingFee: dto.shippingFee != null ? shippingFee : undefined,
                    codAmount: derivedCod ?? undefined,
                    currency: dto.currency ?? 'USD',
                    codStatus: codStatus ?? undefined,
                    storeChannel: dto.storeChannel,
                    externalReference: dto.externalReference,
                    ...(0, shipping_config_util_1.shippingPrismaData)(shippingFields),
                    submittedAt: initialStatus === client_1.OmsOrderStatus.waiting_for_confirmation ||
                        initialStatus === client_1.OmsOrderStatus.processing
                        ? now
                        : undefined,
                    approvedAt: provisionOutbound ? now : undefined,
                    approvedBy: provisionOutbound ? user.id : undefined,
                    confirmedAt: provisionOutbound ? now : undefined,
                    createdBy: user.id,
                    lines: {
                        create: linesWithTotals.map((l, idx) => ({
                            productId: l.productId,
                            requestedQuantity: l.qty,
                            specificLotId: l.specificLotId,
                            lineNumber: idx + 1,
                            unitPrice: l.unitPrice ?? undefined,
                            lineTotal: l.lineTotal ?? undefined,
                            discountAmount: l.discountAmount != null ? new client_1.Prisma.Decimal(l.discountAmount) : undefined,
                        })),
                    },
                },
                include: ORDER_INCLUDE,
            });
            await this.events.record(tx, {
                omsOrderId: created.id,
                outboundOrderId: created.outboundOrderId ?? undefined,
                companyId: created.companyId,
                eventType: 'oms.created',
                createdBy: user.id,
                payload: {
                    linkedOutbound: !!created.outboundOrderId,
                    status: created.status,
                    provisionOutbound,
                },
            });
            if (created.status === client_1.OmsOrderStatus.waiting_for_confirmation) {
                await this.events.record(tx, {
                    omsOrderId: created.id,
                    companyId: created.companyId,
                    eventType: 'order.waiting_for_confirmation',
                    createdBy: user.id,
                });
            }
            if (provisionOutbound) {
                await this.sync.createOutboundFromOms(tx, {
                    omsOrderId: created.id,
                    actorUserId: user.id,
                });
                return tx.omsOrder.findUnique({ where: { id: created.id }, include: ORDER_INCLUDE });
            }
            if (created.outboundOrderId &&
                this.allocation.isEnabled() &&
                dto.warehouseId) {
                await this.allocateLinkedOutbound(tx, user, created.id, created.outboundOrderId, {
                    warehouseId: dto.warehouseId,
                });
                return tx.omsOrder.findUnique({ where: { id: created.id }, include: ORDER_INCLUDE });
            }
            return created;
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (order.outboundOrderId && provisionOutbound) {
            this.realtime.emitOutboundOrderCreated(order.companyId, {
                orderId: order.outboundOrderId,
                status: 'draft',
            });
        }
        this.emitOms('oms.created', order.companyId, order.id, order.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(order);
    }
    async confirm(id, user) {
        const existing = await this.resolveOrder(id, user);
        const actor = (0, oms_order_transitions_1.resolveOmsActorRole)(user.role);
        const action = actor === 'client' ? 'client_confirm' : 'admin_confirm';
        if (actor === 'client' &&
            existing.status === client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval) {
            return (0, oms_order_mapper_1.serializeOmsOrder)(existing);
        }
        if (actor === 'admin' &&
            existing.status === client_1.OmsOrderStatus.processing &&
            existing.outboundOrderId) {
            return (0, oms_order_mapper_1.serializeOmsOrder)(existing);
        }
        const next = (0, oms_order_transitions_1.assertOmsTransition)(existing.status, action, actor);
        if (next === client_1.OmsOrderStatus.processing) {
            const products = existing.lines.map((l) => ({
                id: l.productId,
                sku: l.product?.sku ?? l.productId,
            }));
            await this.assertSufficientStockForLines(existing.companyId, existing.lines.map((l) => ({
                productId: l.productId,
                requestedQuantity: Number(l.requestedQuantity),
            })), products);
            const order = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
                await this.sync.createOutboundFromOms(tx, {
                    omsOrderId: existing.id,
                    actorUserId: user.id,
                });
                await this.events.record(tx, {
                    omsOrderId: existing.id,
                    companyId: existing.companyId,
                    eventType: 'oms.confirmed',
                    createdBy: user.id,
                    payload: { via: 'admin_confirm', omsStatus: client_1.OmsOrderStatus.processing },
                });
                return tx.omsOrder.findUnique({ where: { id: existing.id }, include: ORDER_INCLUDE });
            });
            if (!order)
                throw new common_1.NotFoundException('Order not found.');
            if (order.outboundOrderId) {
                this.realtime.emitOutboundOrderCreated(order.companyId, {
                    orderId: order.outboundOrderId,
                    status: 'draft',
                });
            }
            this.emitOms('oms.confirmed', order.companyId, order.id, order.status);
            return (0, oms_order_mapper_1.serializeOmsOrder)(order);
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsOrder.update({
                where: { id: existing.id },
                data: {
                    status: next,
                    confirmedAt: new Date(),
                },
                include: ORDER_INCLUDE,
            });
            await this.events.record(tx, {
                omsOrderId: row.id,
                companyId: row.companyId,
                eventType: 'oms.confirmed',
                createdBy: user.id,
                payload: { via: 'client_confirm', omsStatus: next },
            });
            return row;
        });
        this.emitOms('oms.confirmed', updated.companyId, updated.id, updated.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(updated);
    }
    async approve(id, user, dto = {}) {
        const existing = await this.resolveOrder(id, user);
        if ((existing.status === client_1.OmsOrderStatus.processing ||
            existing.status === client_1.OmsOrderStatus.pending) &&
            existing.outboundOrderId) {
            return (0, oms_order_mapper_1.serializeOmsOrder)(existing);
        }
        (0, oms_order_transitions_1.assertOmsTransition)(existing.status, 'admin_approve', 'admin');
        const products = existing.lines.map((l) => ({
            id: l.productId,
            sku: l.product?.sku ?? l.productId,
        }));
        await this.assertSufficientStockForLines(existing.companyId, existing.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: Number(l.requestedQuantity),
        })), products);
        const order = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            if (dto.shippingFee != null) {
                const linesSum = existing.lines.reduce((sum, l) => {
                    if (l.lineTotal != null)
                        return sum.add(l.lineTotal);
                    if (l.unitPrice != null)
                        return sum.add(l.unitPrice.mul(l.requestedQuantity));
                    return sum;
                }, new client_1.Prisma.Decimal(0));
                const ship = new client_1.Prisma.Decimal(dto.shippingFee);
                const subtotal = linesSum.add(ship);
                await tx.omsOrder.update({
                    where: { id: existing.id },
                    data: {
                        shippingFee: ship,
                        subtotal,
                        codAmount: existing.paymentMethod === 'COD' ? subtotal : existing.codAmount ?? undefined,
                    },
                });
            }
            await this.sync.createOutboundFromOms(tx, {
                omsOrderId: existing.id,
                actorUserId: user.id,
            });
            return tx.omsOrder.findUnique({ where: { id: existing.id }, include: ORDER_INCLUDE });
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (order.outboundOrderId) {
            this.realtime.emitOutboundOrderCreated(order.companyId, {
                orderId: order.outboundOrderId,
                status: 'draft',
            });
        }
        this.emitOms('oms.approved', order.companyId, order.id, order.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(order);
    }
    async reject(id, user, dto = {}) {
        const existing = await this.resolveOrder(id, user);
        (0, oms_order_transitions_1.assertOmsTransition)(existing.status, 'reject', 'admin');
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsOrder.update({
                where: { id: existing.id },
                data: {
                    status: client_1.OmsOrderStatus.cancelled,
                    rejectedAt: new Date(),
                    rejectedBy: user.id,
                    cancelledAt: new Date(),
                    cancelledBy: user.id,
                    rejectionReason: dto.reason?.trim() || null,
                },
                include: ORDER_INCLUDE,
            });
            await this.events.record(tx, {
                omsOrderId: row.id,
                companyId: row.companyId,
                eventType: 'oms.cancelled',
                createdBy: user.id,
                payload: { reason: dto.reason?.trim() || null, via: 'reject' },
            });
            return row;
        });
        this.emitOms('oms.cancelled', updated.companyId, updated.id, updated.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(updated);
    }
    async markFailedDelivery(id, user) {
        const existing = await this.resolveOrder(id, user);
        const next = (0, oms_order_transitions_1.assertOmsTransition)(existing.status, 'failed_delivery', 'admin');
        return this.transition(id, user, {
            allowed: [existing.status],
            next,
            event: 'order.failed_delivery',
            extra: {},
        });
    }
    async markCompleted(_id, _user) {
        throw new common_1.BadRequestException('Delivered is the terminal success state. There is no separate Completed status.');
    }
    async assertSufficientStockForLines(companyId, lines, products) {
        const productIds = Array.from(new Set(lines.map((l) => l.productId)));
        const requestedByProduct = new Map();
        for (const l of lines) {
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
        const skuById = new Map(products.map((p) => [p.id, p.sku]));
        for (const [productId, requested] of requestedByProduct) {
            const available = availMap.get(productId) ?? new client_1.Prisma.Decimal(0);
            if (requested.greaterThan(available)) {
                const sku = skuById.get(productId) ?? productId;
                throw new common_1.BadRequestException(`Insufficient stock for ${sku}: requested ${requested.toString()}, available ${available.toString()}.`);
            }
        }
    }
    async findById(id, user) {
        const order = await this.resolveOrder(id, user);
        const timeline = await this.events.listForOrder(order.id);
        const reservations = order.outboundOrderId
            ? await this.prisma.stockReservation.findMany({
                where: { outboundOrderId: order.outboundOrderId },
                orderBy: { createdAt: 'asc' },
            })
            : [];
        return {
            ...(0, oms_order_mapper_1.serializeOmsOrder)(order),
            timeline,
            reservations: reservations.map((r) => ({
                ...r,
                quantity: r.quantity.toString(),
            })),
        };
    }
    async update(id, user, dto) {
        const existing = await this.resolveOrder(id, user);
        const destination = dto.destinationAddress !== undefined
            ? (0, oms_order_mapper_1.composeDestinationAddress)({
                destinationAddress: dto.destinationAddress,
                addressLine1: dto.addressLine1 ?? existing.addressLine1 ?? undefined,
                addressLine2: dto.addressLine2 ?? existing.addressLine2 ?? undefined,
                district: dto.district ?? existing.district ?? undefined,
                city: dto.city ?? existing.city ?? undefined,
            })
            : undefined;
        if (dto.outboundOrderId) {
            if (!existing.outboundOrderId) {
                throw new common_1.BadRequestException('Manual outbound linking is deprecated. Approve the OMS order to generate a warehouse order.');
            }
            await this.assertOutboundLinkable(user, dto.outboundOrderId, existing.companyId, existing.id);
        }
        if ((0, shipping_config_util_1.hasShippingConfigPatch)(dto)) {
            (0, shipping_config_util_1.assertShippingConfigUnlocked)(existing.outboundOrder?.status);
        }
        const weightByProductId = new Map(existing.lines.map((l) => [
            l.productId,
            l.product?.weightKg?.toString() ??
                null,
        ]));
        const volumeByProductId = new Map(existing.lines.map((l) => [
            l.productId,
            l.product?.volumeCbm?.toString() ??
                null,
        ]));
        if (([...weightByProductId.values()].every((v) => v == null) ||
            [...volumeByProductId.values()].every((v) => v == null)) &&
            existing.lines.length > 0) {
            const products = await this.prisma.product.findMany({
                where: { id: { in: existing.lines.map((l) => l.productId) } },
                select: { id: true, weightKg: true, volumeCbm: true },
            });
            for (const p of products) {
                weightByProductId.set(p.id, p.weightKg?.toString() ?? null);
                volumeByProductId.set(p.id, p.volumeCbm?.toString() ?? null);
            }
        }
        const nextMethod = dto.shippingMethod ?? existing.shippingMethod;
        const lineQty = existing.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: l.requestedQuantity.toString(),
        }));
        const shippingWeightKg = (0, shipping_config_util_1.hasShippingConfigPatch)(dto)
            ? (0, shipping_config_util_1.resolveShippingWeightKg)({
                method: nextMethod,
                explicit: dto.shippingWeightKg !== undefined ? dto.shippingWeightKg : existing.shippingWeightKg?.toString(),
                lines: lineQty,
                weightByProductId,
            })
            : undefined;
        const shippingVolumeCbm = (0, shipping_config_util_1.hasShippingConfigPatch)(dto)
            ? (0, shipping_config_util_1.resolveShippingVolumeCbm)({
                method: nextMethod,
                explicit: dto.shippingVolumeCbm !== undefined
                    ? dto.shippingVolumeCbm
                    : existing.shippingVolumeCbm?.toString(),
                lines: lineQty,
                volumeByProductId,
            })
            : undefined;
        const shippingPatch = (0, shipping_config_util_1.hasShippingConfigPatch)(dto)
            ? {
                shippingMethod: dto.shippingMethod,
                shippingProviderCode: dto.shippingProviderCode,
                shippingReceiverLat: dto.shippingReceiverLat,
                shippingReceiverLng: dto.shippingReceiverLng,
                shippingPackageType: dto.shippingPackageType,
                shippingContents: dto.shippingContents,
                shippingDeliveryType: dto.shippingDeliveryType,
                shippingPickupType: dto.shippingPickupType,
                shippingPayer: dto.shippingPayer,
                shippingWeightKg: dto.shippingWeightKg !== undefined
                    ? dto.shippingWeightKg
                    : shippingWeightKg !== undefined
                        ? shippingWeightKg
                        : undefined,
                shippingVolumeCbm: dto.shippingVolumeCbm !== undefined
                    ? dto.shippingVolumeCbm
                    : shippingVolumeCbm !== undefined
                        ? shippingVolumeCbm
                        : undefined,
                shippingPhoneCountry: dto.shippingPhoneCountry,
            }
            : null;
        if (shippingPatch) {
            const nextFields = {
                shippingMethod: nextMethod,
                shippingProviderCode: dto.shippingProviderCode !== undefined
                    ? dto.shippingProviderCode
                    : existing.shippingProviderCode,
                shippingReceiverLat: dto.shippingReceiverLat !== undefined
                    ? dto.shippingReceiverLat
                    : (existing.shippingReceiverLat?.toString() ?? null),
                shippingReceiverLng: dto.shippingReceiverLng !== undefined
                    ? dto.shippingReceiverLng
                    : (existing.shippingReceiverLng?.toString() ?? null),
                shippingPackageType: dto.shippingPackageType !== undefined
                    ? dto.shippingPackageType
                    : existing.shippingPackageType,
                shippingDeliveryType: dto.shippingDeliveryType !== undefined
                    ? dto.shippingDeliveryType
                    : existing.shippingDeliveryType,
                shippingPickupType: dto.shippingPickupType !== undefined
                    ? dto.shippingPickupType
                    : existing.shippingPickupType,
                shippingWeightKg: dto.shippingWeightKg !== undefined
                    ? dto.shippingWeightKg
                    : (existing.shippingWeightKg?.toString() ?? null),
                shippingVolumeCbm: dto.shippingVolumeCbm !== undefined
                    ? dto.shippingVolumeCbm
                    : (existing
                        .shippingVolumeCbm?.toString() ?? null),
            };
            (0, shipping_config_util_1.assertShippingIntentReady)(nextFields);
            await this.shipping.assertLiveCarrierSelection({
                fields: nextFields,
                governorate: dto.city ?? existing.city,
                city: dto.district ?? existing.district,
                neighborhood: dto.addressLine1 ?? existing.addressLine1,
            });
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const nextPayment = dto.paymentMethod ?? existing.paymentMethod;
            const nextShipping = dto.shippingFee != null
                ? new client_1.Prisma.Decimal(dto.shippingFee)
                : (existing.shippingFee ?? new client_1.Prisma.Decimal(0));
            const linesSum = existing.lines.reduce((sum, l) => {
                if (l.lineTotal != null)
                    return sum.add(l.lineTotal);
                if (l.unitPrice != null) {
                    return sum.add(l.unitPrice.mul(l.requestedQuantity));
                }
                return sum;
            }, new client_1.Prisma.Decimal(0));
            const nextSubtotal = dto.subtotal != null
                ? new client_1.Prisma.Decimal(dto.subtotal)
                : linesSum.add(nextShipping);
            const nextCod = dto.codAmount != null
                ? new client_1.Prisma.Decimal(dto.codAmount)
                : nextPayment === 'COD' &&
                    (dto.paymentMethod !== undefined ||
                        dto.subtotal !== undefined ||
                        dto.shippingFee !== undefined)
                    ? nextSubtotal
                    : undefined;
            const row = await tx.omsOrder.update({
                where: { id: existing.id },
                data: {
                    recipientName: dto.recipientName,
                    recipientPhone: dto.recipientPhone,
                    city: dto.city,
                    district: dto.district,
                    addressLine1: dto.addressLine1,
                    addressLine2: dto.addressLine2,
                    deliveryInstructions: dto.deliveryInstructions,
                    ...(destination ? { destinationAddress: destination } : {}),
                    requiredShipDate: dto.requiredShipDate
                        ? new Date(dto.requiredShipDate)
                        : undefined,
                    carrier: dto.carrier,
                    trackingNumber: dto.trackingNumber,
                    clientReference: dto.clientReference,
                    notes: dto.notes,
                    paymentMethod: dto.paymentMethod,
                    subtotal: nextSubtotal,
                    shippingFee: dto.shippingFee != null ? new client_1.Prisma.Decimal(dto.shippingFee) : undefined,
                    ...(nextCod !== undefined ? { codAmount: nextCod } : {}),
                    ...(dto.paymentMethod !== undefined
                        ? {
                            codStatus: (0, oms_order_mapper_1.deriveCodStatus)(nextPayment, nextCod ?? existing.codAmount) ??
                                (nextPayment === 'COD' ? existing.codStatus : null),
                        }
                        : {}),
                    currency: dto.currency,
                    storeChannel: dto.storeChannel,
                    externalReference: dto.externalReference,
                    ...(dto.outboundOrderId !== undefined
                        ? { outboundOrderId: dto.outboundOrderId }
                        : {}),
                    ...(shippingPatch ? (0, shipping_config_util_1.shippingPrismaData)(shippingPatch) : {}),
                },
                include: ORDER_INCLUDE,
            });
            if (shippingPatch && row.outboundOrderId) {
                await tx.outboundOrder.update({
                    where: { id: row.outboundOrderId },
                    data: {
                        ...(0, shipping_config_util_1.shippingPrismaData)({
                            shippingMethod: row.shippingMethod,
                            shippingProviderCode: row.shippingProviderCode,
                            shippingReceiverLat: row.shippingReceiverLat?.toString() ?? null,
                            shippingReceiverLng: row.shippingReceiverLng?.toString() ?? null,
                            shippingPackageType: row.shippingPackageType,
                            shippingContents: row.shippingContents,
                            shippingDeliveryType: row.shippingDeliveryType,
                            shippingPickupType: row.shippingPickupType,
                            shippingPayer: row.shippingPayer,
                            shippingWeightKg: row.shippingWeightKg?.toString() ?? null,
                            shippingVolumeCbm: row.shippingVolumeCbm?.toString() ?? null,
                            shippingPhoneCountry: row.shippingPhoneCountry,
                        }),
                        ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
                    },
                });
            }
            await this.events.record(tx, {
                omsOrderId: row.id,
                outboundOrderId: row.outboundOrderId ?? undefined,
                companyId: row.companyId,
                eventType: dto.outboundOrderId === null ? 'warehouse.unlinked' : 'order.updated',
                createdBy: user.id,
                payload: dto.outboundOrderId !== undefined
                    ? { outboundOrderId: dto.outboundOrderId }
                    : undefined,
            });
            return row;
        });
        this.emitOms('order.updated', updated.companyId, updated.id, updated.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(updated);
    }
    async delete(id, user) {
        const existing = await this.resolveOrder(id, user);
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.omsOrder.delete({ where: { id: existing.id } });
        });
        this.emitOms('order.deleted', existing.companyId, existing.id, existing.status);
        return { ok: true };
    }
    async cancel(id, user) {
        const existing = await this.resolveOrder(id, user);
        if (existing.status === client_1.OmsOrderStatus.cancelled) {
            return (0, oms_order_mapper_1.serializeOmsOrder)(existing);
        }
        if (existing.status === client_1.OmsOrderStatus.delivered) {
            throw new domain_exceptions_1.InvalidStateException('Delivered orders cannot be cancelled.');
        }
        if (existing.status === client_1.OmsOrderStatus.shipped ||
            existing.status === client_1.OmsOrderStatus.out_for_delivery) {
            throw new domain_exceptions_1.InvalidStateException('Shipped orders cannot be cancelled. Use failed delivery or return flows.');
        }
        const actor = (0, oms_order_transitions_1.resolveOmsActorRole)(user.role);
        if (actor === 'client') {
            const clientCancellable = [
                client_1.OmsOrderStatus.waiting_for_confirmation,
                client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
                client_1.OmsOrderStatus.pending_approval,
            ];
            if (!clientCancellable.includes(existing.status)) {
                throw new domain_exceptions_1.InvalidStateException('This order has already been approved. Only warehouse admin can cancel it now.');
            }
        }
        (0, oms_order_transitions_1.assertOmsTransition)(existing.status, 'cancel', actor);
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsOrder.update({
                where: { id },
                data: {
                    status: client_1.OmsOrderStatus.cancelled,
                    cancelledAt: new Date(),
                    cancelledBy: user.id,
                },
                include: ORDER_INCLUDE,
            });
            if (row.outboundOrderId) {
                const outbound = await tx.outboundOrder.findUnique({
                    where: { id: row.outboundOrderId },
                    select: { id: true, status: true, companyId: true },
                });
                if (outbound &&
                    outbound.status !== client_1.OutboundOrderStatus.cancelled &&
                    outbound.status !== client_1.OutboundOrderStatus.shipped &&
                    outbound.status !== client_1.OutboundOrderStatus.delivered &&
                    outbound.status !== client_1.OutboundOrderStatus.out_for_delivery) {
                    await tx.outboundOrder.update({
                        where: { id: outbound.id },
                        data: { status: client_1.OutboundOrderStatus.cancelled },
                    });
                }
                else if (outbound &&
                    (outbound.status === client_1.OutboundOrderStatus.shipped ||
                        outbound.status === client_1.OutboundOrderStatus.delivered ||
                        outbound.status === client_1.OutboundOrderStatus.out_for_delivery)) {
                    throw new domain_exceptions_1.InvalidStateException('Cannot cancel OMS while outbound has already left the warehouse.');
                }
            }
            await this.events.record(tx, {
                omsOrderId: id,
                outboundOrderId: row.outboundOrderId ?? undefined,
                companyId: row.companyId,
                eventType: 'oms.cancelled',
                createdBy: user.id,
            });
            return row;
        });
        this.emitOms('oms.cancelled', updated.companyId, updated.id, updated.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(updated);
    }
    async allocate(id, user, dto) {
        const order = await this.resolveOrder(id, user);
        if (!order.outboundOrderId) {
            throw new common_1.BadRequestException('Link an outbound order before allocating inventory.');
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await this.allocateLinkedOutbound(tx, user, order.id, order.outboundOrderId, dto);
        });
        const fresh = await this.resolveOrder(id, user);
        this.emitOms('order.allocated', fresh.companyId, fresh.id, fresh.status);
        this.emitOms('inventory.allocated', fresh.companyId, fresh.id, fresh.status);
        this.realtime.emitInventoryChanged(fresh.companyId, {
            source: 'oms_allocate',
            orderId: fresh.id,
        });
        return (0, oms_order_mapper_1.serializeOmsOrder)(fresh);
    }
    async releaseAllocation(id, user) {
        const order = await this.resolveOrder(id, user);
        if (!order.outboundOrderId) {
            throw new common_1.BadRequestException('No linked outbound order.');
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const full = await tx.outboundOrder.findUnique({ where: { id: order.outboundOrderId } });
            if (!full)
                throw new common_1.NotFoundException('Linked outbound order not found.');
            await this.allocation.releaseAllocation(tx, {
                outboundOrderId: order.outboundOrderId,
                companyId: full.companyId,
                actorUserId: user.id,
            });
            await tx.omsOrder.update({
                where: { id: order.id },
                data: { allocationStatus: 'released' },
            });
            await this.events.record(tx, {
                omsOrderId: order.id,
                outboundOrderId: order.outboundOrderId,
                companyId: order.companyId,
                eventType: 'inventory.released',
                createdBy: user.id,
            });
        });
        const fresh = await this.resolveOrder(id, user);
        this.emitOms('inventory.released', fresh.companyId, fresh.id, fresh.status);
        this.realtime.emitInventoryChanged(fresh.companyId, {
            source: 'oms_release_allocation',
            orderId: fresh.id,
        });
        return (0, oms_order_mapper_1.serializeOmsOrder)(fresh);
    }
    async markOutForDelivery(id, user) {
        return this.transition(id, user, {
            allowed: [
                client_1.OmsOrderStatus.processing,
                client_1.OmsOrderStatus.pending,
                client_1.OmsOrderStatus.ready_to_ship,
                client_1.OmsOrderStatus.allocated,
                client_1.OmsOrderStatus.picking,
                client_1.OmsOrderStatus.packing,
                client_1.OmsOrderStatus.approved,
            ],
            next: client_1.OmsOrderStatus.shipped,
            event: 'oms.shipped',
            extra: { outForDeliveryAt: new Date() },
        });
    }
    async markDelivered(id, user) {
        const existing = await this.resolveOrder(id, user);
        if (existing.status === client_1.OmsOrderStatus.delivered) {
            if (existing.paymentMethod === 'COD' &&
                existing.codGenerationStatus !== 'ok') {
                await this.cod.generateForDeliveredOrder(user, existing.id);
                const refreshed = await this.resolveOrder(id, user);
                return (0, oms_order_mapper_1.serializeOmsOrder)(refreshed);
            }
            return (0, oms_order_mapper_1.serializeOmsOrder)(existing);
        }
        (0, oms_order_transitions_1.assertOmsTransition)(existing.status, 'mark_delivered', 'admin');
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsOrder.update({
                where: { id },
                data: {
                    status: client_1.OmsOrderStatus.delivered,
                    deliveredAt: new Date(),
                    codGenerationStatus: existing.paymentMethod === 'COD' ? 'pending' : 'none',
                },
                include: ORDER_INCLUDE,
            });
            await this.events.record(tx, {
                omsOrderId: id,
                outboundOrderId: row.outboundOrderId ?? undefined,
                companyId: row.companyId,
                eventType: 'oms.delivered',
                createdBy: user.id,
            });
            return row;
        });
        this.emitOms('oms.delivered', updated.companyId, updated.id, updated.status);
        if (updated.paymentMethod === 'COD') {
            try {
                await this.cod.generateForDeliveredOrder(user, updated.id);
            }
            catch {
                await this.prisma.omsOrder.update({
                    where: { id: updated.id },
                    data: { codGenerationStatus: 'failed' },
                });
            }
        }
        const fresh = await this.resolveOrder(id, user);
        return (0, oms_order_mapper_1.serializeOmsOrder)(fresh);
    }
    async revertDelivery(id, user, dto) {
        const reason = dto.reason?.trim();
        if (!reason) {
            throw new common_1.BadRequestException('A reason is required to revert delivery.');
        }
        const existing = await this.resolveOrder(id, user);
        (0, oms_order_transitions_1.assertOmsTransition)(existing.status, 'delivery_revert', 'admin');
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.omsOrder.update({
                where: { id },
                data: {
                    status: client_1.OmsOrderStatus.shipped,
                    deliveredAt: null,
                },
                include: ORDER_INCLUDE,
            });
            await this.events.record(tx, {
                omsOrderId: id,
                outboundOrderId: row.outboundOrderId ?? undefined,
                companyId: row.companyId,
                eventType: 'oms.delivery_reverted',
                createdBy: user.id,
                payload: { reason, previousStatus: client_1.OmsOrderStatus.delivered },
            });
            return row;
        });
        this.emitOms('oms.delivery_reverted', updated.companyId, updated.id, updated.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(updated);
    }
    async markReturned(_id, _user) {
        throw new common_1.BadRequestException('Use OMS Returns to request a return after Delivered. Direct OMS returned status is deprecated.');
    }
    async collectCod(_id, _user) {
        throw new common_1.BadRequestException('Use COD module: PATCH /cod/records/:id/status. Legacy collect on OMS order is removed.');
    }
    async settleCod(_id, _user) {
        throw new common_1.BadRequestException('Use COD module: PATCH /cod/records/:id/status to paid_out. Legacy settle on OMS order is removed.');
    }
    async timeline(id, user) {
        const order = await this.resolveOrder(id, user);
        return this.events.listForOrder(order.id);
    }
    async mirrorFromOutbound(tx, params) {
        const o = params.outbound;
        const created = await tx.omsOrder.create({
            data: {
                companyId: o.companyId,
                outboundOrderId: o.id,
                destinationAddress: o.destinationAddress,
                requiredShipDate: o.requiredShipDate,
                carrier: o.carrier,
                clientReference: o.clientReference,
                notes: o.notes,
                requiresPacking: o.requiresPacking,
                recipientName: o.recipientName,
                recipientPhone: o.recipientPhone,
                city: o.city,
                district: o.district,
                addressLine1: o.addressLine1,
                addressLine2: o.addressLine2,
                deliveryInstructions: o.deliveryInstructions,
                paymentMethod: o.paymentMethod,
                subtotal: o.subtotal ?? undefined,
                shippingFee: o.shippingFee ?? undefined,
                codAmount: o.codAmount ?? undefined,
                currency: o.currency ?? 'USD',
                codStatus: o.codStatus,
                allocationStatus: o.allocationStatus,
                storeChannel: o.storeChannel,
                externalReference: o.externalReference,
                status: (0, oms_order_mapper_1.mapOutboundStatusToOms)(o.status) ?? client_1.OmsOrderStatus.processing,
                createdBy: o.createdBy,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                lines: {
                    create: params.lines.map((line) => ({
                        productId: line.productId,
                        requestedQuantity: line.requestedQuantity,
                        specificLotId: line.specificLotId,
                        lineNumber: line.lineNumber,
                        unitPrice: line.unitPrice ?? undefined,
                        lineTotal: line.lineTotal ?? undefined,
                        discountAmount: line.discountAmount ?? undefined,
                    })),
                },
            },
        });
        if (params.recordEvent !== false) {
            await this.events.record(tx, {
                omsOrderId: created.id,
                outboundOrderId: o.id,
                companyId: o.companyId,
                eventType: 'order.created',
                createdBy: params.actorUserId,
                payload: { source: 'wms-outbound' },
            });
        }
        return created;
    }
    async resolveOrder(id, user) {
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            let order = await tx.omsOrder.findUnique({
                where: { id },
                include: ORDER_INCLUDE,
            });
            if (!order) {
                order = await tx.omsOrder.findFirst({
                    where: { outboundOrderId: id },
                    include: ORDER_INCLUDE,
                });
            }
            if (!order)
                throw new common_1.NotFoundException('OMS order not found.');
            this.companyAccess.validateResourceOwnership(user, order);
            return order;
        });
    }
    async assertOutboundLinkable(user, outboundOrderId, companyId, excludeOmsOrderId) {
        const outbound = await this.outbound.findById(outboundOrderId, user);
        if (outbound.companyId !== companyId) {
            throw new common_1.BadRequestException('Outbound order must belong to the same company.');
        }
        const existing = await this.prisma.omsOrder.findFirst({
            where: {
                outboundOrderId,
                ...(excludeOmsOrderId ? { NOT: { id: excludeOmsOrderId } } : {}),
            },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.BadRequestException('Outbound order is already linked to another OMS order.');
        }
    }
    async allocateLinkedOutbound(tx, user, omsOrderId, outboundOrderId, dto) {
        await this.allocation.assertAllocatable(tx, outboundOrderId);
        const full = await tx.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            include: { lines: true },
        });
        if (!full)
            throw new common_1.NotFoundException('Linked outbound order not found.');
        await this.allocation.allocateOrder(tx, {
            outboundOrderId: full.id,
            companyId: full.companyId,
            warehouseId: dto.warehouseId,
            actorUserId: user.id,
            previousStatus: full.status,
            lines: full.lines.map((line) => ({
                outboundOrderLineId: line.id,
                productId: line.productId,
                requestedQty: line.requestedQuantity,
                specificLotId: line.specificLotId,
            })),
        });
        const currentOms = await tx.omsOrder.findUnique({
            where: { id: omsOrderId },
            select: { status: true },
        });
        const keepCommercial = currentOms?.status === client_1.OmsOrderStatus.processing ||
            currentOms?.status === client_1.OmsOrderStatus.ready_to_ship ||
            currentOms?.status === client_1.OmsOrderStatus.shipped ||
            currentOms?.status === client_1.OmsOrderStatus.out_for_delivery;
        await tx.omsOrder.update({
            where: { id: omsOrderId },
            data: {
                allocationStatus: 'allocated',
                allocatedAt: new Date(),
                ...(keepCommercial ? {} : { status: client_1.OmsOrderStatus.processing }),
            },
        });
        await this.events.record(tx, {
            omsOrderId,
            outboundOrderId,
            companyId: full.companyId,
            eventType: 'order.allocated',
            createdBy: user.id,
        });
    }
    async transition(id, user, opts) {
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const cur = await tx.omsOrder.findUnique({ where: { id } });
            if (!cur)
                throw new common_1.NotFoundException('Order not found.');
            this.companyAccess.validateResourceOwnership(user, cur);
            if (!opts.allowed.includes(cur.status)) {
                throw new domain_exceptions_1.InvalidStateException(`Cannot transition from ${cur.status} to ${opts.next}.`);
            }
            if (cur.outboundOrderId &&
                opts.outboundAllowed &&
                opts.outboundNext) {
                const outbound = await tx.outboundOrder.findUnique({
                    where: { id: cur.outboundOrderId },
                });
                if (outbound && opts.outboundAllowed.includes(outbound.status)) {
                    await tx.outboundOrder.update({
                        where: { id: cur.outboundOrderId },
                        data: { status: opts.outboundNext },
                    });
                    this.realtime.emitOutboundOrderUpdated(outbound.companyId, {
                        orderId: outbound.id,
                        status: opts.outboundNext,
                        listItem: (0, realtime_client_payload_1.adminOutboundListItem)({ ...outbound, status: opts.outboundNext }),
                        reason: opts.event,
                    });
                }
            }
            const row = await tx.omsOrder.update({
                where: { id },
                data: { status: opts.next, ...opts.extra },
                include: ORDER_INCLUDE,
            });
            await this.events.record(tx, {
                omsOrderId: id,
                outboundOrderId: row.outboundOrderId ?? undefined,
                companyId: row.companyId,
                eventType: opts.event,
                createdBy: user.id,
            });
            return row;
        });
        this.emitOms(opts.event, updated.companyId, updated.id, updated.status);
        return (0, oms_order_mapper_1.serializeOmsOrder)(updated);
    }
    emitOms(event, companyId, orderId, status) {
        this.realtime.emitOmsOrderEvent(companyId, { orderId, status, event });
    }
};
exports.OmsOrdersService = OmsOrdersService;
exports.OmsOrdersService = OmsOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => outbound_service_1.OutboundService))),
    __param(7, (0, common_1.Inject)((0, common_1.forwardRef)(() => cod_records_service_1.CodRecordsService))),
    __param(8, (0, common_1.Inject)((0, common_1.forwardRef)(() => shipping_service_1.ShippingService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        outbound_service_1.OutboundService,
        company_access_service_1.CompanyAccessService,
        order_allocation_service_1.OrderAllocationService,
        oms_order_events_service_1.OmsOrderEventsService,
        oms_outbound_sync_service_1.OmsOutboundSyncService,
        realtime_service_1.RealtimeService,
        cod_records_service_1.CodRecordsService,
        shipping_service_1.ShippingService])
], OmsOrdersService);
//# sourceMappingURL=oms-orders.service.js.map