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
const outbound_confirm_lock_util_1 = require("./outbound-confirm-lock.util");
const feature_flags_1 = require("../warehouse-workflow/feature-flags");
const execution_plan_util_1 = require("../orders/execution-plan.util");
const workflow_bootstrap_service_1 = require("../warehouse-workflow/workflow-bootstrap.service");
const warehouse_tasks_service_1 = require("../warehouse-workflow/warehouse-tasks.service");
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
const quick_directed_outbound_helper_1 = require("./quick-directed-outbound.helper");
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
                },
            },
        },
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
    constructor(prisma, stock, ledger, config, workflowBootstrap, tasks, realtime, notifications, companyAccess, audit, billingAccess, billingInvoiceCalc, orderAllocation, omsEvents, omsOrders, omsSync) {
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
            const executionMode = (0, execution_plan_util_1.normalizeExecutionMode)(dto.executionMode);
            let executionPlan;
            if (dto.executionPlan) {
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
            else if (executionMode === 'admin') {
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
                    requiresPacking: dto.requiresPacking !== false,
                    executionMode,
                    executionPlan,
                    createdBy: user.id,
                    ...(0, oms_order_types_1.omsOrderDataFromExtras)(opts?.oms),
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
                opts?.oms?.allocateAfterCreate !== false &&
                !opts?.pendingClientApproval) {
                await this.orderAllocation.allocateOrder(tx, {
                    outboundOrderId: created.id,
                    companyId: created.companyId,
                    warehouseId: opts?.oms?.warehouseId,
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
        const baseAnd = [];
        const where = {};
        const companyId = (0, company_read_scope_1.readCompanyIdCatalogFilter)(this.companyAccess, user, query.companyId);
        if (companyId) {
            where.companyId = companyId;
        }
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
        const listInclude = {
            company: { select: { id: true, name: true } },
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
            return { items, total, limit: query.limit, offset: query.offset };
        });
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
        if (!(0, outbound_confirm_lock_util_1.isOutboundConfirmable)(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Plan can only be updated while draft (current: ${order.status}).`);
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
            return tx.outboundOrder.update({
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
                },
                include: ORDER_INCLUDE,
            });
        });
    }
    async executeAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('execute-admin requires executionMode=admin.');
        }
        if (!(0, outbound_confirm_lock_util_1.isOutboundConfirmable)(order.status)) {
            throw new common_1.BadRequestException(`Admin execute requires draft order (current: ${order.status}).`);
        }
        const plan = (0, execution_plan_util_1.parseOutboundExecutionPlan)(order.executionPlan);
        if (!plan)
            throw new common_1.BadRequestException('Admin execute requires a saved executionPlan.');
        (0, execution_plan_util_1.assertOutboundAdminPlanComplete)(plan);
        const wrap = (step, err) => {
            const msg = err instanceof Error ? err.message : String(err);
            return new common_1.BadRequestException(`Admin execute failed at ${step}: ${msg}`);
        };
        try {
            await this.confirmAndDeduct(user, orderId, { warehouseId: plan.warehouseId });
        }
        catch (err) {
            throw wrap('confirm', err);
        }
        const waitTask = async (taskType) => {
            for (let i = 0; i < 8; i++) {
                const t = await this.prisma.warehouseTask.findFirst({
                    where: {
                        taskType,
                        status: {
                            in: [
                                client_1.WarehouseTaskStatus.pending,
                                client_1.WarehouseTaskStatus.assigned,
                                client_1.WarehouseTaskStatus.in_progress,
                            ],
                        },
                        workflowInstance: { referenceType: 'outbound_order', referenceId: orderId },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                if (t)
                    return t;
                await new Promise((r) => setTimeout(r, 50 * (i + 1)));
            }
            throw new common_1.BadRequestException(`Admin execute failed: expected open ${taskType} task was not created.`);
        };
        const pick = await waitTask(client_1.WarehouseTaskType.pick);
        try {
            await this.tasks.start(pick.id, user);
        }
        catch (err) {
            throw wrap('pick_start', err);
        }
        const pickDetail = await this.prisma.warehouseTask.findUnique({ where: { id: pick.id } });
        if (!pickDetail)
            throw new common_1.NotFoundException('Pick task missing after start.');
        const exec = pickDetail.executionState &&
            typeof pickDetail.executionState === 'object' &&
            !Array.isArray(pickDetail.executionState)
            ? pickDetail.executionState
            : {};
        const reservations = Array.isArray(exec.reservations) ? exec.reservations : [];
        if (reservations.length === 0) {
            throw new common_1.BadRequestException('Admin execute failed at pick: no FEFO reservations (stock may be insufficient).');
        }
        const pickGroups = new Map();
        for (const raw of reservations) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                continue;
            const row = raw;
            const lineId = typeof row.outboundOrderLineId === 'string'
                ? row.outboundOrderLineId
                : typeof row.outbound_order_line_id === 'string'
                    ? row.outbound_order_line_id
                    : null;
            const locationId = typeof row.locationId === 'string'
                ? row.locationId
                : typeof row.location_id === 'string'
                    ? row.location_id
                    : null;
            const qty = row.quantity != null
                ? String(row.quantity)
                : row.qty != null
                    ? String(row.qty)
                    : null;
            if (!lineId || !locationId || !qty)
                continue;
            const lotRaw = row.lotId ?? row.lot_id;
            const lotId = lotRaw == null || lotRaw === '' ? null : String(lotRaw);
            const g = pickGroups.get(lineId) ?? [];
            g.push({ location_id: locationId, lot_id: lotId, quantity: qty });
            pickGroups.set(lineId, g);
        }
        try {
            await this.tasks.complete(pick.id, user, {
                task_type: 'pick',
                picks: [...pickGroups.entries()].map(([outbound_order_line_id, lines]) => ({
                    outbound_order_line_id,
                    lines,
                })),
            });
        }
        catch (err) {
            throw wrap('pick', err);
        }
        const requiresPacking = order.requiresPacking !== false && plan.requiresPacking !== false;
        if (requiresPacking) {
            const pack = await waitTask(client_1.WarehouseTaskType.pack);
            const refreshed = await this.findById(orderId, user);
            try {
                await this.tasks.adminConfirm(pack.id, user, {
                    task_type: 'pack',
                    lines: refreshed.lines.map((l) => ({
                        outbound_order_line_id: l.id,
                        packed_qty: String(l.pickedQuantity ?? l.requestedQuantity),
                    })),
                });
            }
            catch (err) {
                throw wrap('pack', err);
            }
        }
        const dispatch = await waitTask(client_1.WarehouseTaskType.dispatch);
        const finalOrder = await this.findById(orderId, user);
        try {
            await this.tasks.adminConfirm(dispatch.id, user, {
                task_type: 'dispatch',
                lines: finalOrder.lines.map((l) => ({
                    outbound_order_line_id: l.id,
                    ship_qty: String(l.pickedQuantity ?? l.requestedQuantity),
                })),
            });
        }
        catch (err) {
            throw wrap('dispatch', err);
        }
        return this.findById(orderId, user);
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
            select: { status: true, companyId: true, orderNumber: true, id: true },
        }));
        if (!before)
            throw new common_1.NotFoundException('Outbound order not found.');
        this.companyAccess.validateResourceOwnership(user, before);
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
                    quantityBefore: meta.before,
                    quantityAfter: meta.after,
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
                    quantityBefore: meta.before,
                    quantityAfter: meta.after,
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
        oms_outbound_sync_service_1.OmsOutboundSyncService])
], OutboundService);
//# sourceMappingURL=outbound.service.js.map