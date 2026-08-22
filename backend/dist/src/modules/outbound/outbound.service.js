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
exports.OutboundService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const warehouse_order_scope_1 = require("../../common/utils/warehouse-order-scope");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const assert_product_orderable_1 = require("../../common/utils/assert-product-orderable");
const order_planning_date_1 = require("../../common/utils/order-planning-date");
const discrete_uom_quantity_1 = require("../../common/utils/discrete-uom-quantity");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const ledger_idempotency_service_1 = require("../inventory/ledger-idempotency.service");
const stock_helpers_1 = require("../inventory/stock.helpers");
const oms_warehouse_guards_1 = require("../oms/oms-warehouse-guards");
const outbound_confirm_lock_util_1 = require("./outbound-confirm-lock.util");
const feature_flags_1 = require("../warehouse-workflow/feature-flags");
const execution_plan_util_1 = require("../orders/execution-plan.util");
const workflow_bootstrap_service_1 = require("../warehouse-workflow/workflow-bootstrap.service");
const warehouse_tasks_service_1 = require("../warehouse-workflow/warehouse-tasks.service");
const workflow_orchestration_service_1 = require("../warehouse-workflow/workflow-orchestration.service");
const notifications_service_1 = require("../notifications/notifications.service");
const realtime_service_1 = require("../realtime/realtime.service");
const billing_access_service_1 = require("../billing/billing-access.service");
const billing_invoice_calculation_service_1 = require("../billing/billing-invoice-calculation.service");
const realtime_client_payload_1 = require("../realtime/realtime-client.payload");
const oms_order_events_service_1 = require("../oms/oms-order-events.service");
const oms_orders_service_1 = require("../oms/oms-orders.service");
const oms_outbound_sync_service_1 = require("../oms/oms-outbound-sync.service");
const order_allocation_service_1 = require("../oms/order-allocation.service");
const oms_order_types_1 = require("../oms/oms-order.types");
const shipping_config_util_1 = require("../shipping/shipping-config.util");
const shipping_service_1 = require("../shipping/shipping.service");
const avatar_url_1 = require("../media/avatar-url");
const quick_directed_outbound_helper_1 = require("./quick-directed-outbound.helper");
const outbound_admin_stages_1 = require("./outbound-admin-stages");
const outbound_admin_task_helpers_1 = require("./outbound-admin-task.helpers");
const task_allocation_helper_1 = require("../warehouse-workflow/task-allocation.helper");
const quick_directed_outbound_constants_1 = require("./quick-directed-outbound.constants");
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
                    imagePath: true,
                    weightKg: true,
                    volumeCbm: true,
                },
            },
        },
    },
    stockReservations: {
        where: { status: { in: ['active', 'fulfilled'] } },
        orderBy: { createdAt: 'asc' },
        include: {
            product: { select: { id: true, sku: true, name: true } },
            location: { select: { id: true, fullPath: true, barcode: true } },
            lot: { select: { id: true, lotNumber: true } },
        },
    },
    carrierShipments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
    },
    omsOrder: {
        select: { id: true, orderNumber: true },
    },
};
const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRM_LINE_INCLUDE = {
    orderBy: { lineNumber: 'asc' },
    include: { product: { select: { status: true } } },
};
let OutboundService = class OutboundService {
    prisma;
    stock;
    ledger;
    config;
    workflowBootstrap;
    tasks;
    realtime;
    notifications;
    companyAccess;
    audit;
    billingAccess;
    billingInvoiceCalc;
    orderAllocation;
    omsEvents;
    omsOrders;
    omsSync;
    shipping;
    orchestration;
    constructor(prisma, stock, ledger, config, workflowBootstrap, tasks, realtime, notifications, companyAccess, audit, billingAccess, billingInvoiceCalc, orderAllocation, omsEvents, omsOrders, omsSync, shipping, orchestration) {
        this.prisma = prisma;
        this.stock = stock;
        this.ledger = ledger;
        this.config = config;
        this.workflowBootstrap = workflowBootstrap;
        this.tasks = tasks;
        this.realtime = realtime;
        this.notifications = notifications;
        this.companyAccess = companyAccess;
        this.audit = audit;
        this.billingAccess = billingAccess;
        this.billingInvoiceCalc = billingInvoiceCalc;
        this.orderAllocation = orderAllocation;
        this.omsEvents = omsEvents;
        this.omsOrders = omsOrders;
        this.omsSync = omsSync;
        this.shipping = shipping;
        this.orchestration = orchestration;
    }
    async create(user, dto, opts) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.billingAccess.assertOperationalBilling(companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: {
                    id: true,
                    companyId: true,
                    sku: true,
                    name: true,
                    status: true,
                    uom: true,
                    weightKg: true,
                    volumeCbm: true,
                },
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
            (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.requiredShipDate, 'Required ship date');
            const productById = new Map(products.map((p) => [p.id, p]));
            for (const l of dto.lines) {
                const p = productById.get(l.productId);
                (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(p.uom, l.requestedQuantity, 'Requested quantity');
            }
            await this.assertSufficientStockForLines(companyId, dto.lines, products);
            const weightByProductId = new Map(products.map((p) => [p.id, p.weightKg?.toString() ?? null]));
            const volumeByProductId = new Map(products.map((p) => [p.id, p.volumeCbm?.toString() ?? null]));
            const shippingMethod = dto.shippingMethod ?? null;
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
            const clientSubmission = !!opts?.pendingClientApproval;
            const executionMode = clientSubmission
                ? 'admin'
                : (0, execution_plan_util_1.normalizeExecutionMode)(dto.executionMode);
            let executionPlan;
            if (dto.executionPlan && !clientSubmission) {
                const parsed = (0, execution_plan_util_1.parseOutboundExecutionPlan)(dto.executionPlan);
                if (!parsed)
                    throw new common_1.BadRequestException('Invalid executionPlan.');
                if (dto.requiresPacking === false)
                    parsed.requiresPacking = false;
                if (dto.requiresPacking === true)
                    parsed.requiresPacking = true;
                if (executionMode === 'admin')
                    (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(parsed);
                executionPlan = parsed;
            }
            else if (executionMode === 'admin' && !clientSubmission) {
                throw new common_1.BadRequestException('Admin execution requires executionPlan on create.');
            }
            const created = await tx.outboundOrder.create({
                data: {
                    companyId,
                    status: opts?.pendingClientApproval ? client_1.OutboundOrderStatus.pending_approval : undefined,
                    destinationAddress: dto.destinationAddress,
                    requiredShipDate: new Date(dto.requiredShipDate),
                    carrier: dto.carrier,
                    clientReference: dto.clientReference,
                    notes: dto.notes,
                    externalReference: dto.externalReference,
                    requiresPacking: dto.requiresPacking !== false,
                    executionMode,
                    executionPlan,
                    createdBy: user.id,
                    ...(0, oms_order_types_1.omsOrderDataFromExtras)(opts?.oms),
                    ...(0, shipping_config_util_1.shippingPrismaData)(shippingFields),
                    lines: {
                        create: dto.lines.map((l, idx) => {
                            const extras = opts?.oms?.lineExtras?.[idx];
                            return {
                                productId: l.productId,
                                requestedQuantity: new client_1.Prisma.Decimal(l.requestedQuantity),
                                specificLotId: l.specificLotId,
                                lineNumber: idx + 1,
                                unitPrice: extras?.unitPrice != null
                                    ? new client_1.Prisma.Decimal(extras.unitPrice)
                                    : undefined,
                                lineTotal: extras?.lineTotal != null
                                    ? new client_1.Prisma.Decimal(extras.lineTotal)
                                    : undefined,
                                discountAmount: extras?.discountAmount != null
                                    ? new client_1.Prisma.Decimal(extras.discountAmount)
                                    : undefined,
                            };
                        }),
                    },
                },
                include: ORDER_INCLUDE,
            });
            if (executionPlan && created.lines.length > 0) {
                const parsed = (0, execution_plan_util_1.parseOutboundExecutionPlan)(executionPlan);
                const used = new Set();
                parsed.lines = parsed.lines.map((pl) => {
                    let orderLineId = pl.orderLineId;
                    if (!orderLineId || !created.lines.some((l) => l.id === orderLineId)) {
                        const match = created.lines.find((l) => l.productId === pl.productId && !used.has(l.id));
                        orderLineId = match?.id;
                        if (match)
                            used.add(match.id);
                    }
                    else {
                        used.add(orderLineId);
                    }
                    return { ...pl, orderLineId };
                });
                parsed.planUpdatedAt = new Date().toISOString();
                await tx.outboundOrder.update({
                    where: { id: created.id },
                    data: { executionPlan: parsed },
                });
                created.executionPlan = parsed;
            }
            if (opts?.oms && this.omsOrders) {
                await this.omsOrders.mirrorFromOutbound(tx, {
                    outbound: created,
                    lines: created.lines.map((line) => ({
                        productId: line.productId,
                        requestedQuantity: line.requestedQuantity,
                        specificLotId: line.specificLotId,
                        lineNumber: line.lineNumber,
                        unitPrice: line.unitPrice,
                        lineTotal: line.lineTotal,
                        discountAmount: line.discountAmount,
                    })),
                    actorUserId: user.id,
                });
            }
            else if (opts?.oms?.recordOmsEvent !== false && this.omsEvents) {
                await this.omsEvents.record(tx, {
                    outboundOrderId: created.id,
                    companyId: created.companyId,
                    eventType: 'order.created',
                    createdBy: user.id,
                    payload: { source: opts?.oms ? 'oms' : 'wms' },
                });
            }
            if (this.orderAllocation?.isEnabled() &&
                !opts?.skipAllocation &&
                opts?.oms?.allocateAfterCreate !== false) {
                const planWarehouse = executionPlan != null
                    ? (0, execution_plan_util_1.parseOutboundExecutionPlan)(executionPlan)?.warehouseId
                    : undefined;
                await this.orderAllocation.allocateOrder(tx, {
                    outboundOrderId: created.id,
                    companyId: created.companyId,
                    warehouseId: opts?.oms?.warehouseId ?? planWarehouse,
                    actorUserId: user.id,
                    previousStatus: created.status,
                    lines: created.lines.map((line) => ({
                        outboundOrderLineId: line.id,
                        productId: line.productId,
                        requestedQty: line.requestedQuantity,
                        specificLotId: line.specificLotId,
                    })),
                });
            }
            const fresh = await tx.outboundOrder.findUnique({
                where: { id: created.id },
                include: ORDER_INCLUDE,
            });
            const result = fresh ?? created;
            this.realtime.emitOutboundOrderCreated(result.companyId, {
                orderId: result.id,
                status: result.status,
                listItem: (0, realtime_client_payload_1.adminOutboundListItem)(result),
            });
            if (opts?.pendingClientApproval) {
                await this.notifications.notifyAdminsPendingApproval({
                    companyId: result.companyId,
                    companyName: result.company.name,
                    orderType: 'outbound',
                    orderId: result.id,
                    orderNumber: result.orderNumber,
                });
            }
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'OUTBOUND_ORDER_CREATED',
                resourceType: 'outbound_order',
                resourceId: result.id,
                companyId: result.companyId,
                newState: {
                    status: result.status,
                    lineCount: result.lines.length,
                    requiresPacking: result.requiresPacking,
                },
            }));
            return result;
        });
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
    }
    async list(user, query) {
        const where = await this.buildListWhere(user, query);
        const listInclude = {
            company: { select: { id: true, name: true, logoPath: true } },
            _count: { select: { lines: true } },
            ...(query.quickDirectedOnly
                ? {
                    lines: {
                        take: 1,
                        orderBy: { lineNumber: 'asc' },
                        include: {
                            product: { select: { id: true, sku: true, name: true, barcode: true } },
                        },
                    },
                }
                : {}),
        };
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total] = await Promise.all([
                tx.outboundOrder.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    include: listInclude,
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.outboundOrder.count({ where }),
            ]);
            return {
                items: items.map((o) => ({
                    ...o,
                    company: {
                        id: o.company.id,
                        name: o.company.name,
                        logoUrl: (0, avatar_url_1.toAvatarPublicUrl)(o.company.logoPath),
                    },
                })),
                total,
                limit: query.limit,
                offset: query.offset,
            };
        });
    }
    async buildListWhere(user, query) {
        const baseAnd = [];
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        if (companyId) {
            where.companyId = companyId;
        }
        if (query.statusIn?.length) {
            where.status = { in: query.statusIn };
        }
        else if (query.status) {
            where.status = query.status;
        }
        if (query.orderSearch?.trim()) {
            const t = query.orderSearch.trim();
            const orParts = [
                { orderNumber: { contains: t, mode: 'insensitive' } },
                { company: { name: { contains: t, mode: 'insensitive' } } },
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
        if (query.quickDirectedOnly === true) {
            baseAnd.push({
                clientReference: { startsWith: quick_directed_outbound_constants_1.QUICK_DIRECTED_OUTBOUND_REF_PREFIX },
            });
        }
        else if (query.quickDirectedOnly === false) {
            baseAnd.push({
                OR: [
                    { clientReference: null },
                    { NOT: { clientReference: { startsWith: quick_directed_outbound_constants_1.QUICK_DIRECTED_OUTBOUND_REF_PREFIX } } },
                ],
            });
        }
        if (baseAnd.length > 0)
            where.AND = baseAnd;
        return where;
    }
    async listForExport(user, query, opts) {
        const where = await this.buildListWhere(user, query);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const total = await tx.outboundOrder.count({ where });
            const rows = await tx.outboundOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    company: { select: { id: true, name: true } },
                    lines: {
                        select: { requestedQuantity: true },
                    },
                },
                take: opts.maxRows,
            });
            return {
                items: rows,
                total,
                truncated: total > rows.length,
            };
        });
    }
    resolveImportCompanyId(user, companyId) {
        return this.companyAccess.resolveWriteCompanyId(user, companyId);
    }
    async findByExternalReference(user, companyId, externalReference) {
        this.companyAccess.assertCompanyAccess(user, companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.outboundOrder.findFirst({
            where: {
                companyId,
                externalReference: { equals: externalReference, mode: 'insensitive' },
            },
            select: { id: true, orderNumber: true },
        }));
    }
    async findProductsBySkus(companyId, skus) {
        const upper = skus.map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (upper.length === 0)
            return [];
        return this.prisma.product.findMany({
            where: {
                companyId,
                OR: upper.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' } })),
            },
            select: { id: true, sku: true, companyId: true, status: true, uom: true },
        });
    }
    async assertImportCreateReady(user, dto) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.billingAccess.assertOperationalBilling(companyId);
        (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.requiredShipDate, 'Required ship date');
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                companyId: true,
                sku: true,
                status: true,
                uom: true,
                weightKg: true,
                volumeCbm: true,
            },
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
        await this.assertSufficientStockForLines(companyId, dto.lines, products);
        const shippingMethod = dto.shippingMethod ?? null;
        const weightByProductId = new Map(products.map((p) => [p.id, p.weightKg?.toString() ?? null]));
        const volumeByProductId = new Map(products.map((p) => [p.id, p.volumeCbm?.toString() ?? null]));
        const lineQty = dto.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: l.requestedQuantity,
        }));
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
            shippingWeightKg: (0, shipping_config_util_1.resolveShippingWeightKg)({
                method: shippingMethod,
                explicit: dto.shippingWeightKg,
                lines: lineQty,
                weightByProductId,
            }),
            shippingVolumeCbm: (0, shipping_config_util_1.resolveShippingVolumeCbm)({
                method: shippingMethod,
                explicit: dto.shippingVolumeCbm,
                lines: lineQty,
                volumeByProductId,
            }),
            shippingPhoneCountry: dto.shippingPhoneCountry,
        };
        (0, shipping_config_util_1.assertShippingIntentReady)(shippingFields);
    }
    async findById(id, user) {
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const order = await tx.outboundOrder.findUnique({
                where: { id },
                include: ORDER_INCLUDE,
            });
            if (!order)
                throw new common_1.NotFoundException('Outbound order not found.');
            this.companyAccess.validateResourceOwnership(user, order);
            return order;
        });
    }
    async updatePlan(user, id, dto) {
        const order = await this.findById(id, user);
        const shippingOnly = (0, shipping_config_util_1.hasShippingConfigPatch)(dto) &&
            dto.executionMode === undefined &&
            dto.executionPlan === undefined &&
            dto.requiredShipDate === undefined &&
            dto.notes === undefined &&
            dto.destinationAddress === undefined &&
            dto.requiresPacking === undefined;
        if (!shippingOnly && !(0, outbound_confirm_lock_util_1.isOutboundConfirmable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Plan can only be updated while draft (current: ${order.status}).`);
        }
        if ((0, shipping_config_util_1.hasShippingConfigPatch)(dto)) {
            (0, shipping_config_util_1.assertShippingConfigUnlocked)(order.status);
            if (order.omsOrder) {
                throw new common_1.BadRequestException('Shipping for OMS-linked outbound orders is managed on the OMS order. Edit the OMS order instead.');
            }
        }
        const weightByProductId = new Map(order.lines.map((l) => [l.productId, l.product?.weightKg?.toString() ?? null]));
        const volumeByProductId = new Map(order.lines.map((l) => [
            l.productId,
            l.product?.volumeCbm?.toString() ??
                null,
        ]));
        const nextMethod = dto.shippingMethod ?? order.shippingMethod;
        const lineQty = order.lines.map((l) => ({
            productId: l.productId,
            requestedQuantity: l.requestedQuantity.toString(),
        }));
        const shippingWeightKg = (0, shipping_config_util_1.hasShippingConfigPatch)(dto)
            ? (0, shipping_config_util_1.resolveShippingWeightKg)({
                method: nextMethod,
                explicit: dto.shippingWeightKg !== undefined
                    ? dto.shippingWeightKg
                    : order.shippingWeightKg?.toString(),
                lines: lineQty,
                weightByProductId,
            })
            : undefined;
        const shippingVolumeCbm = (0, shipping_config_util_1.hasShippingConfigPatch)(dto)
            ? (0, shipping_config_util_1.resolveShippingVolumeCbm)({
                method: nextMethod,
                explicit: dto.shippingVolumeCbm !== undefined
                    ? dto.shippingVolumeCbm
                    : order.shippingVolumeCbm?.toString(),
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
            (0, shipping_config_util_1.assertShippingIntentReady)({
                shippingMethod: nextMethod,
                shippingProviderCode: dto.shippingProviderCode !== undefined
                    ? dto.shippingProviderCode
                    : order.shippingProviderCode,
            });
        }
        if (shippingOnly) {
            return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
                const updated = await tx.outboundOrder.update({
                    where: { id },
                    data: (0, shipping_config_util_1.shippingPrismaData)(shippingPatch),
                    include: ORDER_INCLUDE,
                });
                this.realtime.emitOutboundOrderUpdated(updated.companyId, {
                    orderId: updated.id,
                    status: updated.status,
                    reason: 'shipping_config_updated',
                    listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
                });
                return updated;
            });
        }
        const executionMode = (0, execution_plan_util_1.normalizeExecutionMode)(dto.executionMode ?? order.executionMode);
        let executionPlan;
        if (dto.executionPlan !== undefined) {
            const parsed = (0, execution_plan_util_1.parseOutboundExecutionPlan)(dto.executionPlan);
            if (!parsed)
                throw new common_1.BadRequestException('Invalid executionPlan.');
            if (dto.requiresPacking !== undefined)
                parsed.requiresPacking = dto.requiresPacking;
            const used = new Set();
            parsed.lines = parsed.lines.map((pl) => {
                let orderLineId = pl.orderLineId;
                if (!orderLineId || !order.lines.some((l) => l.id === orderLineId)) {
                    const match = order.lines.find((l) => l.productId === pl.productId && !used.has(l.id));
                    orderLineId = match?.id;
                    if (match)
                        used.add(match.id);
                }
                else {
                    used.add(orderLineId);
                }
                return { ...pl, orderLineId };
            });
            parsed.planUpdatedAt = new Date().toISOString();
            if (executionMode === 'admin')
                (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(parsed);
            executionPlan = parsed;
        }
        else if (executionMode === 'admin') {
            const existing = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
            if (!existing)
                throw new common_1.BadRequestException('Admin mode requires executionPlan.');
            (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(existing);
        }
        if (dto.requiredShipDate) {
            (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.requiredShipDate, 'Required ship date');
        }
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const updated = await tx.outboundOrder.update({
                where: { id },
                data: {
                    executionMode,
                    ...(executionPlan !== undefined ? { executionPlan } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                    ...(dto.destinationAddress !== undefined
                        ? { destinationAddress: dto.destinationAddress }
                        : {}),
                    ...(dto.requiresPacking !== undefined ? { requiresPacking: dto.requiresPacking } : {}),
                    ...(dto.requiredShipDate
                        ? { requiredShipDate: new Date(dto.requiredShipDate) }
                        : {}),
                    ...(shippingPatch ? (0, shipping_config_util_1.shippingPrismaData)(shippingPatch) : {}),
                },
                include: ORDER_INCLUDE,
            });
            if (this.orderAllocation?.isEnabled() && updated.lines.length > 0) {
                const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(updated.executionPlan) ??
                    (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
                const previousPlan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
                const warehouseChanged = !!plan?.warehouseId &&
                    plan.warehouseId !== (previousPlan?.warehouseId ?? undefined);
                const has = await this.orderAllocation.hasActiveReservations(tx, id);
                if (has && warehouseChanged) {
                    await this.orderAllocation.releaseAllocation(tx, {
                        outboundOrderId: id,
                        companyId: updated.companyId,
                        actorUserId: user.id,
                    });
                }
                await this.orderAllocation.allocateOrder(tx, {
                    outboundOrderId: id,
                    companyId: updated.companyId,
                    warehouseId: plan?.warehouseId,
                    actorUserId: user.id,
                    previousStatus: updated.status,
                    lines: updated.lines.map((line) => ({
                        outboundOrderLineId: line.id,
                        productId: line.productId,
                        requestedQty: line.requestedQuantity,
                        specificLotId: line.specificLotId,
                    })),
                });
            }
            return updated;
        });
    }
    async approveAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('Approve requires executionMode=admin.');
        }
        if (!(0, feature_flags_1.taskOnlyFlows)(this.config)) {
            throw new common_1.BadRequestException('Admin Approve requires TASK_ONLY_FLOWS=true so approval cannot deduct inventory or ship.');
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        const requiresPacking = (0, outbound_admin_stages_1.outboundRequiresPacking)({
            requiresPacking: order.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
        });
        (0, outbound_admin_stages_1.assertOutboundAdminStageAction)(order.status, 'approve', requiresPacking);
        if (!plan)
            throw new common_1.BadRequestException('Approve requires a saved executionPlan.');
        (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(plan);
        return this.confirmAndDeduct(user, orderId, { warehouseId: plan.warehouseId });
    }
    async completePickingAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('complete-picking requires executionMode=admin.');
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        const requiresPacking = (0, outbound_admin_stages_1.outboundRequiresPacking)({
            requiresPacking: order.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
        });
        (0, outbound_admin_stages_1.assertOutboundAdminStageAction)(order.status, 'complete_picking', requiresPacking);
        const pick = await (0, outbound_admin_task_helpers_1.waitForOpenWarehouseTask)(this.prisma, 'outbound_order', orderId, client_1.WarehouseTaskType.pick);
        try {
            await this.tasks.start(pick.id, user);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadRequestException(`Picking start failed: ${msg}`);
        }
        const pickDetail = await this.prisma.warehouseTask.findUnique({ where: { id: pick.id } });
        if (!pickDetail)
            throw new common_1.NotFoundException('Pick task missing after start.');
        try {
            await this.tasks.complete(pick.id, user, (0, outbound_admin_task_helpers_1.buildAdminPickCompleteBody)(pickDetail.executionState));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadRequestException(`Picking complete failed: ${msg}`);
        }
        const updated = await this.findById(orderId, user);
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'admin_complete_picking',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        return updated;
    }
    async completePackingAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('complete-packing requires executionMode=admin.');
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        const requiresPacking = (0, outbound_admin_stages_1.outboundRequiresPacking)({
            requiresPacking: order.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
        });
        (0, outbound_admin_stages_1.assertOutboundAdminStageAction)(order.status, 'complete_packing', requiresPacking);
        const pack = await (0, outbound_admin_task_helpers_1.waitForOpenWarehouseTask)(this.prisma, 'outbound_order', orderId, client_1.WarehouseTaskType.pack);
        try {
            await this.tasks.adminConfirm(pack.id, user, {
                task_type: 'pack',
                lines: order.lines.map((l) => ({
                    outbound_order_line_id: l.id,
                    packed_qty: String(l.pickedQuantity ?? l.requestedQuantity),
                })),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadRequestException(`Packing complete failed: ${msg}`);
        }
        const updated = await this.findById(orderId, user);
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'admin_complete_packing',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        return updated;
    }
    async selectShippingMethodAdmin(user, orderId, body) {
        const order = await this.findById(orderId, user);
        if (order.status !== client_1.OutboundOrderStatus.waiting_for_shipping_method &&
            order.status !== 'waiting_for_shipping_method') {
            throw new common_1.BadRequestException(`Shipping method can only be selected at waiting_for_shipping_method (current: ${order.status}).`);
        }
        const method = body.shippingMethod === 'carrier' ? client_1.ShippingMethod.carrier : client_1.ShippingMethod.manual;
        if (method === client_1.ShippingMethod.carrier && !body.shippingProviderCode?.trim()) {
            throw new common_1.BadRequestException('shippingProviderCode is required when selecting Shipping Company.');
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.outboundOrder.update({
                where: { id: orderId },
                data: {
                    shippingMethod: method,
                    shippingProviderCode: method === client_1.ShippingMethod.carrier ? body.shippingProviderCode : null,
                    status: client_1.OutboundOrderStatus.waiting_for_shipping_details,
                },
            });
            await this.omsSync?.syncFromOutbound(tx, orderId);
        });
        const updated = await this.findById(orderId, user);
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'admin_select_shipping_method',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        return updated;
    }
    async saveShippingDetails(user, orderId, dto) {
        const order = await this.findById(orderId, user);
        if (order.status !== client_1.OutboundOrderStatus.waiting_for_shipping_details) {
            throw new common_1.BadRequestException(`Shipping details can only be saved while waiting_for_shipping_details (current: ${order.status}).`);
        }
        const createdShipment = (order.carrierShipments ?? []).find((s) => s.status === client_1.CarrierShipmentStatus.created);
        if (createdShipment) {
            throw new common_1.BadRequestException('Shipping details are locked after the carrier shipment was sent. Complete the stage or contact support.');
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const lineQty = order.lines.map((l) => ({
                productId: l.productId,
                requestedQuantity: l.requestedQuantity.toString(),
            }));
            const weightByProductId = new Map(order.lines.map((l) => [l.productId, l.product?.weightKg?.toString() ?? null]));
            const volumeByProductId = new Map(order.lines.map((l) => [
                l.productId,
                l.product?.volumeCbm?.toString() ??
                    null,
            ]));
            const resolvedWeight = dto.shippingWeightKg !== undefined && dto.shippingWeightKg !== null
                ? dto.shippingWeightKg
                : order.shippingWeightKg != null
                    ? Number(order.shippingWeightKg)
                    : (0, shipping_config_util_1.calculateOrderWeight)(lineQty, weightByProductId);
            const resolvedVolume = dto.shippingVolumeCbm !== undefined && dto.shippingVolumeCbm !== null
                ? dto.shippingVolumeCbm
                : order.shippingVolumeCbm !=
                    null
                    ? Number(order.shippingVolumeCbm)
                    : (0, shipping_config_util_1.calculateOrderVolume)(lineQty, volumeByProductId);
            if (dto.shippingMethod === client_1.ShippingMethod.carrier) {
                (0, shipping_config_util_1.assertShippingIntentReady)({
                    shippingMethod: dto.shippingMethod,
                    shippingProviderCode: dto.shippingProviderCode,
                });
            }
            const row = await tx.outboundOrder.update({
                where: { id: orderId },
                data: {
                    ...(0, shipping_config_util_1.shippingPrismaData)({
                        shippingMethod: dto.shippingMethod,
                        shippingProviderCode: dto.shippingProviderCode,
                        shippingReceiverLat: dto.shippingReceiverLat,
                        shippingReceiverLng: dto.shippingReceiverLng,
                        shippingPackageType: dto.shippingPackageType,
                        shippingContents: dto.shippingContents,
                        shippingDeliveryType: dto.shippingDeliveryType,
                        shippingPickupType: dto.shippingPickupType,
                        shippingPayer: dto.shippingPayer,
                        shippingWeightKg: dto.shippingWeightKg !== undefined ? dto.shippingWeightKg : resolvedWeight,
                        shippingVolumeCbm: dto.shippingVolumeCbm !== undefined ? dto.shippingVolumeCbm : resolvedVolume,
                        shippingPhoneCountry: dto.shippingPhoneCountry,
                    }),
                    ...(dto.carrier !== undefined ? { carrier: dto.carrier } : {}),
                    ...(dto.trackingNumber !== undefined ? { trackingNumber: dto.trackingNumber } : {}),
                },
                include: ORDER_INCLUDE,
            });
            await tx.carrierShipment.deleteMany({
                where: { outboundOrderId: orderId, status: client_1.CarrierShipmentStatus.failed },
            });
            if (this.omsEvents && row.omsOrder) {
                await this.omsEvents.record(tx, {
                    omsOrderId: row.omsOrder.id,
                    outboundOrderId: row.id,
                    companyId: row.companyId,
                    eventType: 'shipping.details.saved',
                    createdBy: user.id,
                });
            }
            return row;
        });
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'shipping_details_saved',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        return updated;
    }
    async sendShippingDetails(user, orderId) {
        const order = await this.findById(orderId, user);
        if (order.status !== client_1.OutboundOrderStatus.waiting_for_shipping_details) {
            throw new common_1.BadRequestException(`Send Shipment is only available while waiting_for_shipping_details (current: ${order.status}).`);
        }
        if (order.shippingMethod !== client_1.ShippingMethod.carrier) {
            throw new common_1.BadRequestException('Send Shipment is only for carrier shipping. Use Mark Shipping Details Complete for manual.');
        }
        if (!this.shipping) {
            throw new common_1.BadRequestException('Shipping service is unavailable.');
        }
        (0, shipping_config_util_1.assertCarrierShippingReady)({
            shippingMethod: order.shippingMethod,
            shippingProviderCode: order.shippingProviderCode,
            shippingReceiverLat: order.shippingReceiverLat?.toString() ?? null,
            shippingReceiverLng: order.shippingReceiverLng?.toString() ?? null,
            shippingPackageType: order.shippingPackageType,
            shippingContents: order.shippingContents,
            shippingDeliveryType: order.shippingDeliveryType,
            shippingPickupType: order.shippingPickupType,
            shippingPayer: order.shippingPayer,
            shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
        });
        await this.shipping.assertLiveCarrierSelection({
            fields: {
                shippingMethod: order.shippingMethod,
                shippingProviderCode: order.shippingProviderCode,
                shippingReceiverLat: order.shippingReceiverLat?.toString() ?? null,
                shippingReceiverLng: order.shippingReceiverLng?.toString() ?? null,
                shippingPackageType: order.shippingPackageType,
                shippingDeliveryType: order.shippingDeliveryType,
                shippingPickupType: order.shippingPickupType,
                shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
                shippingVolumeCbm: order.shippingVolumeCbm?.toString() ?? null,
            },
            governorate: order.city,
            city: order.district,
            neighborhood: order.addressLine1,
            requireQuote: true,
        });
        await this.shipping.ensureShipmentForOutbound(orderId);
        const updated = await this.findById(orderId, user);
        const latest = updated.carrierShipments?.[0];
        if (latest?.status === client_1.CarrierShipmentStatus.failed) {
            throw new common_1.BadRequestException(latest.lastErrorSafe?.trim() || 'Carrier shipment submission failed.');
        }
        if (latest?.status !== client_1.CarrierShipmentStatus.created) {
            throw new common_1.BadRequestException('Carrier shipment was not created. Check provider connection and retry.');
        }
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'shipping_shipment_sent',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        return updated;
    }
    async completeShippingDetailsAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        const requiresPacking = (0, outbound_admin_stages_1.outboundRequiresPacking)({
            requiresPacking: order.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
        });
        (0, outbound_admin_stages_1.assertOutboundAdminStageAction)(order.status, 'complete_shipping_details', requiresPacking);
        if (order.shippingMethod === client_1.ShippingMethod.carrier) {
            const created = (order.carrierShipments ?? []).find((s) => s.status === client_1.CarrierShipmentStatus.created);
            if (!created) {
                throw new common_1.BadRequestException('Send Shipment successfully before marking Shipping Details as Complete.');
            }
        }
        const updated = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const row = await tx.outboundOrder.update({
                where: { id: orderId },
                data: { status: client_1.OutboundOrderStatus.ready_to_ship },
                include: ORDER_INCLUDE,
            });
            await this.omsSync?.syncFromOutbound(tx, orderId, user.id);
            const openTask = await tx.warehouseTask.findFirst({
                where: {
                    taskType: client_1.WarehouseTaskType.shipping_details,
                    status: {
                        in: [
                            client_1.WarehouseTaskStatus.pending,
                            client_1.WarehouseTaskStatus.assigned,
                            client_1.WarehouseTaskStatus.in_progress,
                        ],
                    },
                    workflowInstance: {
                        referenceType: 'outbound_order',
                        referenceId: orderId,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            if (openTask) {
                await tx.warehouseTask.update({
                    where: { id: openTask.id },
                    data: {
                        status: client_1.WarehouseTaskStatus.completed,
                        completedAt: new Date(),
                        completedById: user.id,
                    },
                });
                if (openTask.workflowInstanceId && this.orchestration) {
                    await this.orchestration.enqueueDispatchTaskIfNeeded(tx, openTask.workflowInstanceId, orderId);
                }
            }
            else if (this.orchestration) {
                const wf = await tx.workflowInstance.findFirst({
                    where: { referenceType: 'outbound_order', referenceId: orderId },
                    orderBy: { createdAt: 'desc' },
                });
                if (wf) {
                    await this.orchestration.enqueueDispatchTaskIfNeeded(tx, wf.id, orderId);
                }
            }
            if (this.omsEvents && row.omsOrder) {
                await this.omsEvents.record(tx, {
                    omsOrderId: row.omsOrder.id,
                    outboundOrderId: row.id,
                    companyId: row.companyId,
                    eventType: 'shipping.details.completed',
                    createdBy: user.id,
                });
            }
            return row;
        });
        const fresh = await this.findById(orderId, user);
        this.realtime.emitOutboundOrderUpdated(fresh.companyId, {
            orderId: fresh.id,
            status: fresh.status,
            reason: 'admin_complete_shipping_details',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(fresh),
        });
        return fresh;
    }
    async completeDispatchAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('complete-dispatch requires executionMode=admin.');
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        const requiresPacking = (0, outbound_admin_stages_1.outboundRequiresPacking)({
            requiresPacking: order.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
        });
        (0, outbound_admin_stages_1.assertOutboundAdminStageAction)(order.status, 'complete_dispatch', requiresPacking);
        const dispatch = await (0, outbound_admin_task_helpers_1.waitForOpenWarehouseTask)(this.prisma, 'outbound_order', orderId, client_1.WarehouseTaskType.dispatch);
        try {
            await this.tasks.adminConfirm(dispatch.id, user, {
                task_type: 'dispatch',
                lines: order.lines.map((l) => ({
                    outbound_order_line_id: l.id,
                    ship_qty: String(l.pickedQuantity ?? l.requestedQuantity),
                })),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadRequestException(`Dispatch complete failed: ${msg}`);
        }
        const updated = await this.findById(orderId, user);
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'admin_complete_dispatch',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        return updated;
    }
    async executeAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('execute-admin requires executionMode=admin.');
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        const requiresPacking = (0, outbound_admin_stages_1.outboundRequiresPacking)({
            requiresPacking: order.requiresPacking,
            planRequiresPacking: plan?.requiresPacking,
        });
        const next = (0, outbound_admin_stages_1.nextOutboundAdminAction)(order.status, requiresPacking);
        if (!next) {
            throw new common_1.BadRequestException(`No Admin stage action available for status ${order.status}. Use stage endpoints.`);
        }
        switch (next) {
            case 'approve':
                return this.approveAdmin(user, orderId);
            case 'complete_picking':
                return this.completePickingAdmin(user, orderId);
            case 'complete_packing':
                return this.completePackingAdmin(user, orderId);
            case 'complete_shipping_details':
                return this.completeShippingDetailsAdmin(user, orderId);
            case 'complete_dispatch':
                return this.completeDispatchAdmin(user, orderId);
            default:
                throw new common_1.BadRequestException(`Unknown Admin stage action: ${next}`);
        }
    }
    async cancel(id, user) {
        const order = await this.findById(id, user);
        if (order.status === client_1.OutboundOrderStatus.shipped ||
            order.status === client_1.OutboundOrderStatus.cancelled) {
            throw new domain_exceptions_1.InvalidStateException(`Outbound orders cannot be cancelled once ${order.status} (current: ${order.status}).`);
        }
        const previousStatus = order.status;
        const cancelled = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            if (this.orderAllocation?.isEnabled()) {
                await this.orderAllocation.releaseAllocation(tx, {
                    outboundOrderId: id,
                    companyId: order.companyId,
                    actorUserId: user.id,
                });
            }
            await tx.workflowInstance.deleteMany({
                where: { referenceType: 'outbound_order', referenceId: id },
            });
            const row = await tx.outboundOrder.update({
                where: { id },
                data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.id },
                include: ORDER_INCLUDE,
            });
            await this.omsSync?.syncFromOutbound(tx, id, user.id);
            return row;
        });
        this.realtime.emitOutboundOrderUpdated(cancelled.companyId, {
            orderId: cancelled.id,
            status: cancelled.status,
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(cancelled),
            reason: 'cancel',
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'OUTBOUND_ORDER_CANCELLED',
            resourceType: 'outbound_order',
            resourceId: cancelled.id,
            companyId: cancelled.companyId,
            previousState: { status: previousStatus },
            newState: { status: cancelled.status, cancelledBy: user.id },
        }));
        return cancelled;
    }
    async remove(id, user) {
        const order = await this.findById(id, user);
        if (order.status !== client_1.OutboundOrderStatus.cancelled) {
            throw new domain_exceptions_1.InvalidStateException(`Only cancelled outbound orders can be deleted. Cancel the order first (current: ${order.status}).`);
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const ledgerCount = await tx.inventoryLedger.count({
                where: { referenceType: 'outbound_order', referenceId: id },
            });
            if (ledgerCount > 0) {
                throw new domain_exceptions_1.InvalidStateException('This order has stock movements recorded and cannot be deleted.');
            }
            await tx.workflowInstance.deleteMany({
                where: { referenceType: 'outbound_order', referenceId: id },
            });
            await tx.outboundOrder.delete({ where: { id } });
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'OUTBOUND_ORDER_DELETED',
            resourceType: 'outbound_order',
            resourceId: id,
            companyId: order.companyId,
            previousState: { status: order.status, orderNumber: order.orderNumber },
            newState: { deleted: true },
        }));
        this.realtime.emitOutboundOrderUpdated(order.companyId, {
            orderId: id,
            status: order.status,
            reason: 'delete',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(order),
        });
        return { id, deleted: true };
    }
    async confirmWithoutDeduction(user, orderId) {
        const before = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.outboundOrder.findUnique({
            where: { id: orderId },
            select: { status: true, companyId: true, orderNumber: true, id: true },
        }));
        if (before) {
            this.companyAccess.validateResourceOwnership(user, before);
        }
        const txResult = await this.prisma.$transaction(async (tx) => {
            await (0, tenant_rls_1.setTenantRlsContext)(tx, user);
            const gate = await this.gateConfirmTransaction(tx, user, orderId);
            if (gate.kind === 'idempotent') {
                return { idempotent: true, order: gate.order };
            }
            await this.tryAllocateOnConfirm(tx, user, gate.order);
            const claimed = await (0, outbound_confirm_lock_util_1.claimOutboundConfirmableOrder)(tx, orderId, {
                status: client_1.OutboundOrderStatus.picking,
                confirmedAt: new Date(),
                pickingStartedAt: new Date(),
            });
            if (!claimed) {
                const replay = await tx.outboundOrder.findUnique({
                    where: { id: orderId },
                    include: ORDER_INCLUDE,
                });
                if (!replay)
                    throw new common_1.NotFoundException('Outbound order not found.');
                return { idempotent: true, order: replay };
            }
            await this.omsSync?.syncFromOutbound(tx, orderId, user.id);
            const updated = await tx.outboundOrder.findUnique({
                where: { id: orderId },
                include: ORDER_INCLUDE,
            });
            if (!updated)
                throw new common_1.NotFoundException('Outbound order not found.');
            return { idempotent: false, order: updated };
        });
        if (txResult.idempotent) {
            return txResult.order;
        }
        const updated = txResult.order;
        this.realtime.emitOutboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'confirm_without_deduction',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(updated),
        });
        if (before?.status === client_1.OutboundOrderStatus.pending_approval) {
            await this.notifications.notifyClientOrderConfirmed({
                companyId: before.companyId,
                orderType: 'outbound',
                orderId: before.id,
                orderNumber: before.orderNumber,
            });
            await this.notifications.dismissPendingAdminNotifications('outbound_order', before.id);
        }
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'OUTBOUND_ORDER_CONFIRMED',
            resourceType: 'outbound_order',
            resourceId: updated.id,
            companyId: updated.companyId,
            previousState: { status: before?.status ?? null },
            newState: { status: updated.status },
        }));
        return updated;
    }
    async confirmAndDeduct(user, orderId, body) {
        const before = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.outboundOrder.findUnique({
            where: { id: orderId },
            select: {
                status: true,
                companyId: true,
                orderNumber: true,
                id: true,
                executionPlan: true,
                executionMode: true,
            },
        }));
        if (!before)
            throw new common_1.NotFoundException('Outbound order not found.');
        this.companyAccess.validateResourceOwnership(user, before);
        const releasePlan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(before.executionPlan);
        if (!releasePlan) {
            throw new common_1.BadRequestException('A complete execution plan is required before confirmation or release.');
        }
        (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(releasePlan);
        if ((0, feature_flags_1.taskOnlyFlows)(this.config)) {
            if (!body?.warehouseId) {
                throw new common_1.BadRequestException('When TASK_ONLY_FLOWS=true, confirm body must include warehouseId for workflow bootstrap.');
            }
            const wh = body.warehouseId;
            const txResult = await this.prisma.$transaction(async (tx) => {
                await (0, tenant_rls_1.setTenantRlsContext)(tx, user);
                const gate = await this.gateConfirmTransaction(tx, user, orderId);
                if (gate.kind === 'idempotent') {
                    return { fresh: false, order: gate.order };
                }
                await this.tryAllocateOnConfirm(tx, user, gate.order, wh);
                const claimed = await (0, outbound_confirm_lock_util_1.claimOutboundConfirmableOrder)(tx, orderId, {
                    status: client_1.OutboundOrderStatus.picking,
                    confirmedAt: new Date(),
                    pickingStartedAt: new Date(),
                });
                if (!claimed) {
                    const replay = await tx.outboundOrder.findUnique({
                        where: { id: orderId },
                        include: ORDER_INCLUDE,
                    });
                    if (!replay)
                        throw new common_1.NotFoundException('Outbound order not found.');
                    return { fresh: false, order: replay };
                }
                await this.workflowBootstrap.startOutboundWorkflowTx(tx, user, orderId, wh);
                await this.omsSync?.syncFromOutbound(tx, orderId, user.id);
                const order = await tx.outboundOrder.findUnique({
                    where: { id: orderId },
                    include: ORDER_INCLUDE,
                });
                if (!order)
                    throw new common_1.NotFoundException('Outbound order not found.');
                return { fresh: true, order };
            });
            if (!txResult.fresh) {
                return txResult.order;
            }
            const wfConfirmed = txResult.order;
            this.realtime.emitOutboundOrderUpdated(wfConfirmed.companyId, {
                orderId: wfConfirmed.id,
                status: wfConfirmed.status,
                reason: 'confirm_task_flow',
                listItem: (0, realtime_client_payload_1.adminOutboundListItem)(wfConfirmed),
            });
            if (before.status === client_1.OutboundOrderStatus.pending_approval) {
                await this.notifications.notifyClientOrderConfirmed({
                    companyId: before.companyId,
                    orderType: 'outbound',
                    orderId: before.id,
                    orderNumber: before.orderNumber,
                });
                await this.notifications.dismissPendingAdminNotifications('outbound_order', before.id);
            }
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'OUTBOUND_ORDER_CONFIRMED',
                resourceType: 'outbound_order',
                resourceId: wfConfirmed.id,
                companyId: wfConfirmed.companyId,
                previousState: { status: before.status },
                newState: { status: wfConfirmed.status, flow: 'task_only' },
            }));
            return wfConfirmed;
        }
        if ((0, feature_flags_1.outboundConfirmDefersDeduction)(this.config)) {
            return this.confirmWithoutDeduction(user, orderId);
        }
        const txResult = await this.prisma.$transaction(async (tx) => {
            await (0, tenant_rls_1.setTenantRlsContext)(tx, user);
            const gate = await this.gateConfirmTransaction(tx, user, orderId);
            if (gate.kind === 'idempotent') {
                return { fresh: false, order: gate.order };
            }
            await this.tryAllocateOnConfirm(tx, user, gate.order, body?.warehouseId);
            const claimed = await (0, outbound_confirm_lock_util_1.claimOutboundConfirmableOrder)(tx, orderId, {
                status: client_1.OutboundOrderStatus.picking,
                confirmedAt: new Date(),
                pickingStartedAt: new Date(),
            });
            if (!claimed) {
                const replay = await tx.outboundOrder.findUnique({
                    where: { id: orderId },
                    include: ORDER_INCLUDE,
                });
                if (!replay)
                    throw new common_1.NotFoundException('Outbound order not found.');
                return { fresh: false, order: replay };
            }
            await this.deductOutboundOrderLines(tx, user, gate.order, orderId);
            const finalized = await (0, outbound_confirm_lock_util_1.finalizeOutboundShipped)(tx, orderId);
            if (!finalized) {
                throw new domain_exceptions_1.InvalidStateException('Outbound confirm could not finalize to shipped.');
            }
            await this.omsSync?.syncFromOutbound(tx, orderId, user.id);
            const shipped = await tx.outboundOrder.findUnique({
                where: { id: orderId },
                include: ORDER_INCLUDE,
            });
            if (!shipped)
                throw new common_1.NotFoundException('Outbound order not found.');
            return { fresh: true, order: shipped };
        });
        if (!txResult.fresh) {
            return txResult.order;
        }
        const shipped = txResult.order;
        this.realtime.emitOutboundOrderUpdated(shipped.companyId, {
            orderId: shipped.id,
            status: shipped.status,
            reason: 'confirm_and_deduct',
            listItem: (0, realtime_client_payload_1.adminOutboundListItem)(shipped),
        });
        this.realtime.emitInventoryChanged(shipped.companyId, {
            source: 'outbound_ship',
            orderId: shipped.id,
            productId: shipped.lines[0]?.productId,
        });
        if (before?.status === client_1.OutboundOrderStatus.pending_approval) {
            await this.notifications.notifyClientOrderConfirmed({
                companyId: before.companyId,
                orderType: 'outbound',
                orderId: before.id,
                orderNumber: before.orderNumber,
            });
            await this.notifications.dismissPendingAdminNotifications('outbound_order', before.id);
        }
        await this.notifications.notifyClientOrderCompleted({
            companyId: shipped.companyId,
            orderType: 'outbound',
            orderId: shipped.id,
            orderNumber: shipped.orderNumber,
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'OUTBOUND_ORDER_SHIPPED',
            resourceType: 'outbound_order',
            resourceId: shipped.id,
            companyId: shipped.companyId,
            previousState: { status: before.status },
            newState: { status: shipped.status, shippedAt: shipped.shippedAt?.toISOString() ?? null },
        }));
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'INVENTORY_MUTATION_APPLIED',
            resourceType: 'outbound_order',
            resourceId: shipped.id,
            companyId: shipped.companyId,
            newState: { source: 'confirm_and_deduct', movementType: 'outbound_pick' },
        }));
        void this.billingInvoiceCalc.recalculateForCompany(shipped.companyId, 'outbound_completed');
        return shipped;
    }
    async gateConfirmTransaction(tx, user, orderId) {
        await (0, outbound_confirm_lock_util_1.lockOutboundOrderRow)(tx, orderId);
        const order = await tx.outboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: CONFIRM_LINE_INCLUDE },
        });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        if ((0, outbound_confirm_lock_util_1.isOutboundPostConfirm)(order.status)) {
            const full = await tx.outboundOrder.findUnique({
                where: { id: orderId },
                include: ORDER_INCLUDE,
            });
            if (!full)
                throw new common_1.NotFoundException('Outbound order not found.');
            return { kind: 'idempotent', order: full };
        }
        if (!(0, outbound_confirm_lock_util_1.isOutboundConfirmable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Only draft or pending-approval orders can be confirmed (current: ${order.status}).`);
        }
        const linkedOms = await tx.omsOrder.findFirst({
            where: { outboundOrderId: orderId },
            select: { id: true, status: true, orderNumber: true },
        });
        if (linkedOms && (0, oms_warehouse_guards_1.omsBlocksWarehouseExecution)(linkedOms.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Cannot confirm outbound while linked OMS order ${linkedOms.orderNumber} is ${linkedOms.status}.`);
        }
        if (order.lines.length === 0) {
            throw new common_1.BadRequestException('Cannot confirm an order with no lines.');
        }
        for (const line of order.lines) {
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(line.product.status);
        }
        return { kind: 'proceed', order };
    }
    async tryAllocateOnConfirm(tx, user, order, warehouseId) {
        if (!this.orderAllocation?.isEnabled())
            return;
        const has = await this.orderAllocation.hasActiveReservations(tx, order.id);
        if (has)
            return;
        await this.orderAllocation.allocateOrder(tx, {
            outboundOrderId: order.id,
            companyId: order.companyId,
            warehouseId,
            actorUserId: user.id,
            previousStatus: order.status,
            lines: order.lines.map((line) => ({
                outboundOrderLineId: line.id,
                productId: line.productId,
                requestedQty: line.requestedQuantity,
                specificLotId: line.specificLotId,
            })),
        });
    }
    async deductOutboundOrderLines(tx, user, order, orderId) {
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
                const idempotencyKey = `bm:outbound:${orderId}:${line.productId}:line:${line.id}:loc:${row.locationId}:lot:${row.lotId ?? 'null'}:${take.toString()}`;
                await this.ledger.appendIfAbsent(tx, idempotencyKey, {
                    companyId: order.companyId,
                    productId: line.productId,
                    lotId: row.lotId,
                    fromLocationId: row.locationId,
                    movementType: 'outbound_pick',
                    quantity: take,
                    referenceType: 'outbound_order',
                    referenceId: orderId,
                    operatorId: user.id,
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
    async quickDirectedOutbound(user, dto) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.billingAccess.assertOperationalBilling(companyId);
        const productCode = dto.productCode.trim();
        if (!productCode) {
            throw new common_1.BadRequestException('Product barcode or SKU is required.');
        }
        const txResult = await this.prisma.$transaction(async (tx) => {
            await (0, tenant_rls_1.setTenantRlsContext)(tx, user);
            const warehouse = await tx.warehouse.findFirst({
                where: { id: dto.warehouseId, status: 'active' },
                select: { id: true, name: true },
            });
            if (!warehouse) {
                throw new common_1.NotFoundException('Warehouse not found.');
            }
            const product = await tx.product.findFirst({
                where: {
                    companyId,
                    OR: [
                        { barcode: { equals: productCode, mode: 'insensitive' } },
                        { sku: { equals: productCode, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    barcode: true,
                    status: true,
                    uom: true,
                },
            });
            if (!product) {
                throw new common_1.NotFoundException('Product not found for the given barcode or SKU.');
            }
            (0, assert_product_orderable_1.assertProductOrderableForOrders)(product.status);
            (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(product.uom, dto.quantity, 'Quantity');
            const requested = new client_1.Prisma.Decimal(dto.quantity);
            const warehouseAgg = await tx.currentStock.aggregate({
                where: {
                    companyId,
                    warehouseId: dto.warehouseId,
                    productId: product.id,
                    status: 'available',
                },
                _sum: { quantityAvailable: true },
            });
            const warehouseAvailable = warehouseAgg._sum.quantityAvailable ?? new client_1.Prisma.Decimal(0);
            if (requested.greaterThan(warehouseAvailable)) {
                throw new domain_exceptions_1.InsufficientStockException(`Insufficient stock in warehouse. Available: ${warehouseAvailable.toString()}`, [
                    {
                        productId: product.id,
                        requested: requested.toString(),
                        available: warehouseAvailable.toString(),
                    },
                ]);
            }
            const today = new Date();
            const shipDate = today.toISOString().slice(0, 10);
            const order = await tx.outboundOrder.create({
                data: {
                    companyId,
                    destinationAddress: `Quick directed outbound — ${warehouse.name}`,
                    requiredShipDate: new Date(shipDate),
                    requiresPacking: false,
                    notes: `Quick directed outbound | reason: ${dto.reasonCode}`,
                    clientReference: `${quick_directed_outbound_constants_1.QUICK_DIRECTED_OUTBOUND_REF_PREFIX}${dto.reasonCode}`,
                    createdBy: user.id,
                    lines: {
                        create: [
                            {
                                productId: product.id,
                                requestedQuantity: requested,
                                lineNumber: 1,
                            },
                        ],
                    },
                },
                include: { lines: true },
            });
            await (0, outbound_confirm_lock_util_1.lockOutboundOrderRow)(tx, order.id);
            const claimed = await (0, outbound_confirm_lock_util_1.claimOutboundConfirmableOrder)(tx, order.id, {
                status: client_1.OutboundOrderStatus.picking,
                confirmedAt: new Date(),
                pickingStartedAt: new Date(),
            });
            if (!claimed) {
                throw new domain_exceptions_1.InvalidStateException('Quick directed outbound could not claim the order.');
            }
            const line = order.lines[0];
            const candidates = await (0, task_allocation_helper_1.findWarehouseStockFefo)(tx, companyId, dto.warehouseId, product.id);
            let remaining = new client_1.Prisma.Decimal(requested.toString());
            const pickSlices = [];
            for (const row of candidates) {
                if (remaining.lessThanOrEqualTo(0))
                    break;
                const take = client_1.Prisma.Decimal.min(remaining, row.quantityAvailable);
                if (take.lessThanOrEqualTo(0))
                    continue;
                const meta = await this.stock.decrementWithMeta(tx, {
                    companyId,
                    productId: product.id,
                    locationId: row.locationId,
                    lotId: row.lotId,
                    quantity: take.toString(),
                });
                const idempotencyKey = `bm:quick-outbound:${order.id}:${product.id}:line:${line.id}:loc:${row.locationId}:lot:${row.lotId ?? 'null'}:${take.toString()}`;
                await this.ledger.appendIfAbsent(tx, idempotencyKey, {
                    companyId,
                    productId: product.id,
                    lotId: row.lotId,
                    fromLocationId: row.locationId,
                    movementType: 'outbound_pick',
                    quantity: take,
                    referenceType: 'outbound_order',
                    referenceId: order.id,
                    operatorId: user.id,
                });
                pickSlices.push({
                    locationId: row.locationId,
                    lotId: row.lotId,
                    quantity: take,
                });
                remaining = remaining.minus(take);
            }
            if (remaining.greaterThan(0)) {
                throw new domain_exceptions_1.InsufficientStockException(`Insufficient stock. Available: ${warehouseAvailable.toString()}`, [
                    {
                        productId: product.id,
                        requested: requested.toString(),
                        available: warehouseAvailable.toString(),
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
            const finalized = await (0, outbound_confirm_lock_util_1.finalizeOutboundShipped)(tx, order.id);
            if (!finalized) {
                throw new domain_exceptions_1.InvalidStateException('Quick directed outbound could not finalize to shipped.');
            }
            const locationIds = [...new Set(pickSlices.map((slice) => slice.locationId))];
            const locations = await tx.location.findMany({
                where: { id: { in: locationIds } },
                select: { id: true, fullPath: true, name: true, barcode: true },
            });
            const locationById = new Map(locations.map((loc) => [loc.id, loc]));
            const lotIds = pickSlices.map((slice) => slice.lotId).filter((id) => !!id);
            const lots = lotIds.length === 0
                ? []
                : await tx.lot.findMany({
                    where: { id: { in: lotIds } },
                    select: { id: true, lotNumber: true },
                });
            const lotById = new Map(lots.map((lot) => [lot.id, lot]));
            const directedPick = pickSlices.map((slice) => {
                const loc = locationById.get(slice.locationId);
                const locationLabel = loc?.fullPath || loc?.name || loc?.barcode || slice.locationId;
                const lot = slice.lotId ? lotById.get(slice.lotId) : null;
                return {
                    locationId: slice.locationId,
                    locationLabel,
                    quantity: slice.quantity.toString(),
                    lotNumber: lot?.lotNumber ?? null,
                };
            });
            const shipped = await tx.outboundOrder.findUnique({
                where: { id: order.id },
                select: { id: true, orderNumber: true, status: true },
            });
            if (!shipped) {
                throw new common_1.NotFoundException('Outbound order not found.');
            }
            const messages = (0, quick_directed_outbound_helper_1.buildQuickDirectedPickMessages)(directedPick);
            return {
                orderId: shipped.id,
                orderNumber: shipped.orderNumber,
                status: shipped.status,
                product: {
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    barcode: product.barcode,
                    uom: product.uom,
                },
                totalQuantity: requested.toString(),
                reasonCode: dto.reasonCode,
                directedPick,
                ...messages,
            };
        });
        this.realtime.emitOutboundOrderCreated(companyId, {
            orderId: txResult.orderId,
            status: txResult.status,
            listItem: {
                id: txResult.orderId,
                orderNumber: txResult.orderNumber,
                status: txResult.status,
                companyId,
                destinationAddress: `Quick directed outbound`,
                requiredShipDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                lineCount: 1,
            },
        });
        this.realtime.emitOutboundOrderUpdated(companyId, {
            orderId: txResult.orderId,
            status: txResult.status,
            reason: 'quick_directed_outbound',
            listItem: {
                id: txResult.orderId,
                orderNumber: txResult.orderNumber,
                status: txResult.status,
                companyId,
                destinationAddress: `Quick directed outbound`,
                requiredShipDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                lineCount: 1,
            },
        });
        this.realtime.emitInventoryChanged(companyId, {
            source: 'quick_directed_outbound',
            orderId: txResult.orderId,
            productId: txResult.product.id,
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'QUICK_DIRECTED_OUTBOUND',
            resourceType: 'outbound_order',
            resourceId: txResult.orderId,
            companyId,
            newState: {
                orderNumber: txResult.orderNumber,
                productId: txResult.product.id,
                quantity: txResult.totalQuantity,
                reasonCode: txResult.reasonCode,
                directedPick: txResult.directedPick,
            },
        }));
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'OUTBOUND_ORDER_SHIPPED',
            resourceType: 'outbound_order',
            resourceId: txResult.orderId,
            companyId,
            newState: {
                status: txResult.status,
                flow: 'quick_directed',
            },
        }));
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'INVENTORY_MUTATION_APPLIED',
            resourceType: 'outbound_order',
            resourceId: txResult.orderId,
            companyId,
            newState: {
                source: 'quick_directed_outbound',
                movementType: 'outbound_pick',
            },
        }));
        void this.billingInvoiceCalc.recalculateForCompany(companyId, 'outbound_completed');
        return txResult;
    }
};
exports.OutboundService = OutboundService;
exports.OutboundService = OutboundService = __decorate([
    (0, common_1.Injectable)(),
    __param(12, (0, common_1.Optional)()),
    __param(12, (0, common_1.Inject)((0, common_1.forwardRef)(() => order_allocation_service_1.OrderAllocationService))),
    __param(13, (0, common_1.Optional)()),
    __param(13, (0, common_1.Inject)((0, common_1.forwardRef)(() => oms_order_events_service_1.OmsOrderEventsService))),
    __param(14, (0, common_1.Optional)()),
    __param(14, (0, common_1.Inject)((0, common_1.forwardRef)(() => oms_orders_service_1.OmsOrdersService))),
    __param(15, (0, common_1.Optional)()),
    __param(15, (0, common_1.Inject)((0, common_1.forwardRef)(() => oms_outbound_sync_service_1.OmsOutboundSyncService))),
    __param(16, (0, common_1.Optional)()),
    __param(17, (0, common_1.Optional)()),
    __param(17, (0, common_1.Inject)((0, common_1.forwardRef)(() => workflow_orchestration_service_1.WorkflowOrchestrationService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_helpers_1.StockHelpers,
        ledger_idempotency_service_1.LedgerIdempotencyService,
        config_1.ConfigService,
        workflow_bootstrap_service_1.WorkflowBootstrapService,
        warehouse_tasks_service_1.WarehouseTasksService,
        realtime_service_1.RealtimeService,
        notifications_service_1.NotificationsService,
        company_access_service_1.CompanyAccessService,
        audit_log_service_1.AuditLogService,
        billing_access_service_1.BillingAccessService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService,
        order_allocation_service_1.OrderAllocationService,
        oms_order_events_service_1.OmsOrderEventsService,
        oms_orders_service_1.OmsOrdersService,
        oms_outbound_sync_service_1.OmsOutboundSyncService,
        shipping_service_1.ShippingService,
        workflow_orchestration_service_1.WorkflowOrchestrationService])
], OutboundService);
//# sourceMappingURL=outbound.service.js.map