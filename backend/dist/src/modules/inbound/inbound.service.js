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
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const receiving_qty_validation_1 = require("../warehouse-workflow/receiving-qty.validation");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const tenant_rls_1 = require("../../common/prisma/tenant-rls");
const stock_helpers_1 = require("../inventory/stock.helpers");
const feature_flags_1 = require("../warehouse-workflow/feature-flags");
const notifications_service_1 = require("../notifications/notifications.service");
const realtime_service_1 = require("../realtime/realtime.service");
const billing_access_service_1 = require("../billing/billing-access.service");
const realtime_client_payload_1 = require("../realtime/realtime-client.payload");
const workflow_bootstrap_service_1 = require("../warehouse-workflow/workflow-bootstrap.service");
const warehouse_tasks_service_1 = require("../warehouse-workflow/warehouse-tasks.service");
const execution_plan_util_1 = require("../orders/execution-plan.util");
const inbound_admin_stages_1 = require("./inbound-admin-stages");
const outbound_admin_task_helpers_1 = require("../outbound/outbound-admin-task.helpers");
const avatar_url_1 = require("../media/avatar-url");
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
                    imagePath: true,
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
function isInboundPlanEditable(status, lines) {
    if (isInboundConfirmable(status))
        return true;
    if (status !== client_1.InboundOrderStatus.confirmed &&
        status !== client_1.InboundOrderStatus.in_progress) {
        return false;
    }
    return lines.every((l) => l.receivedQuantity.lte(0));
}
const INBOUND_DELETABLE = [client_1.InboundOrderStatus.cancelled];
let InboundService = class InboundService {
    prisma;
    stock;
    config;
    workflowBootstrap;
    tasks;
    realtime;
    notifications;
    companyAccess;
    audit;
    billingAccess;
    constructor(prisma, stock, config, workflowBootstrap, tasks, realtime, notifications, companyAccess, audit, billingAccess) {
        this.prisma = prisma;
        this.stock = stock;
        this.config = config;
        this.workflowBootstrap = workflowBootstrap;
        this.tasks = tasks;
        this.realtime = realtime;
        this.notifications = notifications;
        this.companyAccess = companyAccess;
        this.audit = audit;
        this.billingAccess = billingAccess;
    }
    async create(user, dto, opts) {
        const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
        await this.billingAccess.assertOperationalBilling(companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
            const products = await tx.product.findMany({
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
            const clientSubmission = !!opts?.pendingClientApproval;
            const executionMode = clientSubmission
                ? 'admin'
                : (0, execution_plan_util_1.normalizeExecutionMode)(dto.executionMode);
            let executionPlan;
            if (dto.executionPlan && !clientSubmission) {
                const parsed = (0, execution_plan_util_1.parseInboundExecutionPlan)(dto.executionPlan);
                if (!parsed)
                    throw new common_1.BadRequestException('Invalid executionPlan.');
                if (executionMode === 'admin')
                    (0, execution_plan_util_1.assertInboundAdminPlanComplete)(parsed);
                executionPlan = parsed;
            }
            else if (executionMode === 'admin' && !clientSubmission) {
                throw new common_1.BadRequestException('Admin execution requires executionPlan on create.');
            }
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
            const order = await tx.inboundOrder.create({
                data: {
                    companyId,
                    status: opts?.pendingClientApproval ? client_1.InboundOrderStatus.pending_approval : undefined,
                    expectedArrivalDate: new Date(dto.expectedArrivalDate),
                    clientReference: dto.clientReference,
                    notes: dto.notes,
                    sourceType: dto.sourceType,
                    storeChannel: dto.storeChannel,
                    externalReference: dto.externalReference,
                    executionMode,
                    executionPlan,
                    createdBy: user.id,
                    lines: {
                        create: lineCreates,
                    },
                },
                include: ORDER_INCLUDE,
            });
            if (executionPlan && order.lines.length > 0) {
                const parsed = (0, execution_plan_util_1.parseInboundExecutionPlan)(executionPlan);
                const byProduct = new Map(order.lines.map((l) => [l.productId, l.id]));
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
                    void byProduct;
                    return { ...pl, orderLineId };
                });
                parsed.planUpdatedAt = new Date().toISOString();
                await tx.inboundOrder.update({
                    where: { id: order.id },
                    data: { executionPlan: parsed },
                });
                order.executionPlan = parsed;
            }
            this.realtime.emitInboundOrderCreated(order.companyId, {
                orderId: order.id,
                status: order.status,
                listItem: (0, realtime_client_payload_1.adminInboundListItem)(order),
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
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'INBOUND_CREATED',
                resourceType: 'inbound_order',
                resourceId: order.id,
                companyId: order.companyId,
                newState: {
                    orderNumber: order.orderNumber,
                    status: order.status,
                    lineCount: order.lines.length,
                    expectedArrivalDate: order.expectedArrivalDate.toISOString(),
                },
            }));
            return order;
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
            const scope = await (0, warehouse_order_scope_1.inboundIdsVisibleForWarehouse)(this.prisma, query.warehouseId, {
                ...(companyId ? { companyId } : {}),
            });
            baseAnd.push(scope);
        }
        if (baseAnd.length > 0)
            where.AND = baseAnd;
        return where;
    }
    async listForExport(user, query, opts) {
        if (opts.ids?.length) {
            const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
            const { limit: _l, offset: _o, ...queryNoPage } = query;
            const baseWhere = await this.buildListWhere(user, queryNoPage);
            const where = { ...baseWhere, id: { in: unique.slice(0, opts.maxRows) } };
            return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
                const rows = await tx.inboundOrder.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        company: { select: { id: true, name: true } },
                        lines: { select: { expectedQuantity: true } },
                    },
                });
                return {
                    items: rows,
                    total: rows.length,
                    truncated: unique.length > rows.length,
                };
            });
        }
        const where = await this.buildListWhere(user, query);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const total = await tx.inboundOrder.count({ where });
            const rows = await tx.inboundOrder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    company: { select: { id: true, name: true } },
                    lines: {
                        select: { expectedQuantity: true },
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
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.inboundOrder.findFirst({
            where: {
                companyId,
                externalReference: { equals: externalReference, mode: 'insensitive' },
            },
            select: { id: true, orderNumber: true },
        }));
    }
    async findByOrderNumber(user, companyId, orderNumber) {
        this.companyAccess.assertCompanyAccess(user, companyId);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => tx.inboundOrder.findFirst({
            where: {
                companyId,
                orderNumber: { equals: orderNumber.trim(), mode: 'insensitive' },
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
        (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.expectedArrivalDate, 'Expected arrival date');
        const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, companyId: true, status: true, uom: true },
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
            (0, discrete_uom_quantity_1.assertDiscreteUomPositiveIntegerQuantity)(p.uom, l.expectedQuantity, 'Expected quantity');
        }
    }
    async list(user, query) {
        const where = await this.buildListWhere(user, query);
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const [items, total] = await Promise.all([
                tx.inboundOrder.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        company: { select: { id: true, name: true, logoPath: true } },
                        _count: { select: { lines: true } },
                        lines: {
                            select: { id: true, productId: true, expectedQuantity: true, receivedQuantity: true, lineNumber: true },
                        },
                    },
                    take: query.limit,
                    skip: query.offset,
                }),
                tx.inboundOrder.count({ where }),
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
    async findById(id, user) {
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const order = await tx.inboundOrder.findUnique({
                where: { id },
                include: ORDER_INCLUDE,
            });
            if (!order)
                throw new common_1.NotFoundException('Inbound order not found.');
            this.companyAccess.validateResourceOwnership(user, order);
            return order;
        });
    }
    async updatePlan(user, id, dto) {
        const order = await this.findById(id, user);
        if (!isInboundPlanEditable(order.status, order.lines)) {
            throw new domain_exceptions_1.InvalidStateException(`Plan can only be updated before receiving starts (current: ${order.status}).`);
        }
        const executionMode = (0, execution_plan_util_1.normalizeExecutionMode)(dto.executionMode ?? order.executionMode);
        let executionPlan = undefined;
        if (dto.executionPlan !== undefined) {
            const parsed = (0, execution_plan_util_1.parseInboundExecutionPlan)(dto.executionPlan);
            if (!parsed)
                throw new common_1.BadRequestException('Invalid executionPlan.');
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
                (0, execution_plan_util_1.assertInboundAdminPlanComplete)(parsed);
            executionPlan = parsed;
        }
        else if (executionMode === 'admin') {
            const existing = (0, execution_plan_util_1.parseInboundExecutionPlan)(order.executionPlan);
            if (!existing)
                throw new common_1.BadRequestException('Admin mode requires executionPlan.');
            (0, execution_plan_util_1.assertInboundAdminPlanComplete)(existing);
        }
        if (dto.expectedArrivalDate) {
            (0, order_planning_date_1.assertCalendarDateNotBeforeToday)(dto.expectedArrivalDate, 'Expected arrival date');
        }
        return (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const updated = await tx.inboundOrder.update({
                where: { id },
                data: {
                    executionMode,
                    ...(executionPlan !== undefined ? { executionPlan } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                    ...(dto.expectedArrivalDate
                        ? { expectedArrivalDate: new Date(dto.expectedArrivalDate) }
                        : {}),
                },
                include: ORDER_INCLUDE,
            });
            return updated;
        });
    }
    async approveAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('Approve requires executionMode=admin.');
        }
        if (!(0, feature_flags_1.taskOnlyFlows)(this.config)) {
            throw new common_1.BadRequestException('Admin Approve requires TASK_ONLY_FLOWS=true so approval only starts receiving.');
        }
        (0, inbound_admin_stages_1.assertInboundAdminStageAction)(order.status, 'approve');
        const plan = (0, execution_plan_util_1.parseInboundExecutionPlan)(order.executionPlan);
        if (!plan)
            throw new common_1.BadRequestException('Approve requires a saved executionPlan.');
        (0, execution_plan_util_1.assertInboundAdminPlanComplete)(plan);
        const stagingByLineId = {};
        for (const line of order.lines) {
            stagingByLineId[line.id] = plan.receivingDockId;
        }
        return this.confirm(user, orderId, {
            warehouseId: plan.warehouseId,
            stagingByLineId,
        });
    }
    async completeReceivingAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('complete-receiving requires executionMode=admin.');
        }
        (0, inbound_admin_stages_1.assertInboundAdminStageAction)(order.status, 'complete_receiving');
        const receiving = await (0, outbound_admin_task_helpers_1.waitForOpenWarehouseTask)(this.prisma, 'inbound_order', orderId, client_1.WarehouseTaskType.receiving);
        try {
            await this.tasks.adminConfirm(receiving.id, user, {
                task_type: 'receiving',
                lines: order.lines.map((l) => {
                    const lotPayload = l.product?.trackingType === 'lot' && l.expectedLotNumber?.trim()
                        ? { capture_lot_number: l.expectedLotNumber.trim() }
                        : {};
                    return {
                        inbound_order_line_id: l.id,
                        received_qty: String(l.expectedQuantity),
                        ...lotPayload,
                    };
                }),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadRequestException(`Receiving complete failed: ${msg}`);
        }
        const updated = await this.findById(orderId, user);
        this.realtime.emitInboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'admin_complete_receiving',
            listItem: (0, realtime_client_payload_1.adminInboundListItem)(updated),
        });
        return updated;
    }
    async completePutawayAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('complete-putaway requires executionMode=admin.');
        }
        (0, inbound_admin_stages_1.assertInboundAdminStageAction)(order.status, 'complete_putaway');
        const plan = (0, execution_plan_util_1.parseInboundExecutionPlan)(order.executionPlan);
        if (!plan)
            throw new common_1.BadRequestException('Putaway requires a saved executionPlan.');
        const putaway = await (0, outbound_admin_task_helpers_1.waitForOpenWarehouseTask)(this.prisma, 'inbound_order', orderId, client_1.WarehouseTaskType.putaway);
        const putawayLines = [];
        for (const ol of order.lines) {
            const planLine = plan.lines.find((p) => p.orderLineId === ol.id) ??
                plan.lines.find((p) => p.productId === ol.productId);
            for (const s of planLine?.putaway ?? []) {
                putawayLines.push({
                    inbound_order_line_id: ol.id,
                    putaway_quantity: String(s.qty),
                    destination_location_id: s.locationId,
                });
            }
        }
        if (putawayLines.length === 0) {
            throw new common_1.BadRequestException('Putaway complete failed: no destination splits in plan.');
        }
        try {
            await this.tasks.adminConfirm(putaway.id, user, {
                task_type: 'putaway',
                lines: putawayLines,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new common_1.BadRequestException(`Putaway complete failed: ${msg}`);
        }
        const updated = await this.findById(orderId, user);
        this.realtime.emitInboundOrderUpdated(updated.companyId, {
            orderId: updated.id,
            status: updated.status,
            reason: 'admin_complete_putaway',
            listItem: (0, realtime_client_payload_1.adminInboundListItem)(updated),
        });
        return updated;
    }
    async executeAdmin(user, orderId) {
        const order = await this.findById(orderId, user);
        if ((0, execution_plan_util_1.normalizeExecutionMode)(order.executionMode) !== 'admin') {
            throw new common_1.BadRequestException('execute-admin requires executionMode=admin.');
        }
        let openTask = null;
        if (!isInboundConfirmable(order.status)) {
            const receivingOpen = await this.prisma.warehouseTask.findFirst({
                where: {
                    taskType: client_1.WarehouseTaskType.receiving,
                    status: {
                        in: [
                            client_1.WarehouseTaskStatus.pending,
                            client_1.WarehouseTaskStatus.assigned,
                            client_1.WarehouseTaskStatus.in_progress,
                        ],
                    },
                    workflowInstance: { referenceType: 'inbound_order', referenceId: orderId },
                },
                select: { id: true },
            });
            if (receivingOpen)
                openTask = 'receiving';
            else {
                const putawayOpen = await this.prisma.warehouseTask.findFirst({
                    where: {
                        taskType: client_1.WarehouseTaskType.putaway,
                        status: {
                            in: [
                                client_1.WarehouseTaskStatus.pending,
                                client_1.WarehouseTaskStatus.assigned,
                                client_1.WarehouseTaskStatus.in_progress,
                            ],
                        },
                        workflowInstance: { referenceType: 'inbound_order', referenceId: orderId },
                    },
                    select: { id: true },
                });
                if (putawayOpen)
                    openTask = 'putaway';
            }
        }
        const next = (0, inbound_admin_stages_1.nextInboundAdminAction)(order.status, openTask);
        if (!next) {
            throw new common_1.BadRequestException(`No Admin stage action available for status ${order.status}. Use stage endpoints.`);
        }
        switch (next) {
            case 'approve':
                return this.approveAdmin(user, orderId);
            case 'complete_receiving':
                return this.completeReceivingAdmin(user, orderId);
            case 'complete_putaway':
                return this.completePutawayAdmin(user, orderId);
            default:
                throw new common_1.BadRequestException(`Unknown Admin stage action: ${next}`);
        }
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
        const releasePlan = (0, execution_plan_util_1.parseInboundExecutionPlan)(order.executionPlan);
        if (!releasePlan) {
            throw new common_1.BadRequestException('A complete execution plan is required before confirmation or release.');
        }
        (0, execution_plan_util_1.assertInboundAdminPlanComplete)(releasePlan);
        if ((0, feature_flags_1.taskOnlyFlows)(this.config)) {
            if (!body?.warehouseId || !body.stagingByLineId) {
                throw new common_1.BadRequestException('When TASK_ONLY_FLOWS=true, confirm body must include warehouseId and stagingByLineId (per line).');
            }
            const previousStatus = order.status;
            await this.prisma.$transaction(async (tx) => {
                await (0, tenant_rls_1.setTenantRlsContext)(tx, user);
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
                await this.audit.logTx(tx, this.audit.fromPrincipal(user, {
                    action: 'INBOUND_CONFIRMED',
                    resourceType: 'inbound_order',
                    resourceId: id,
                    companyId: cur.companyId,
                    previousState: { status: previousStatus },
                    newState: {
                        status: 'in_progress',
                        warehouseId: wh,
                        stagingByLineId: body.stagingByLineId,
                    },
                }));
            });
            const updated = await this.findById(id, user);
            this.realtime.emitInboundOrderUpdated(updated.companyId, {
                orderId: updated.id,
                status: updated.status,
                reason: 'confirm',
                listItem: (0, realtime_client_payload_1.adminInboundListItem)(updated),
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
        const previousStatus = order.status;
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.inboundOrder.update({
                where: { id },
                data: { status: 'confirmed', confirmedAt: new Date() },
            });
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'INBOUND_CONFIRMED',
            resourceType: 'inbound_order',
            resourceId: id,
            companyId: order.companyId,
            previousState: { status: previousStatus },
            newState: { status: 'confirmed' },
        }));
        const confirmed = await this.findById(id, user);
        this.realtime.emitInboundOrderUpdated(confirmed.companyId, {
            orderId: confirmed.id,
            status: confirmed.status,
            reason: 'confirm',
            listItem: (0, realtime_client_payload_1.adminInboundListItem)(confirmed),
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
        if (order.status === client_1.InboundOrderStatus.completed ||
            order.status === client_1.InboundOrderStatus.cancelled) {
            throw new domain_exceptions_1.InvalidStateException(`Inbound orders cannot be cancelled once ${order.status} (current: ${order.status}).`);
        }
        const previousStatus = order.status;
        const cancelled = await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            await tx.workflowInstance.deleteMany({
                where: { referenceType: 'inbound_order', referenceId: id },
            });
            return tx.inboundOrder.update({
                where: { id },
                data: {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelledBy: user.id,
                },
                include: ORDER_INCLUDE,
            });
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'INBOUND_ORDER_CANCELLED',
            resourceType: 'inbound_order',
            resourceId: cancelled.id,
            companyId: cancelled.companyId,
            previousState: { status: previousStatus },
            newState: { status: cancelled.status, cancelledBy: user.id },
        }));
        this.realtime.emitInboundOrderUpdated(cancelled.companyId, {
            orderId: cancelled.id,
            status: cancelled.status,
            reason: 'cancel',
            listItem: (0, realtime_client_payload_1.adminInboundListItem)(cancelled),
        });
        return cancelled;
    }
    async remove(id, user) {
        const order = await this.findById(id, user);
        if (!INBOUND_DELETABLE.includes(order.status)) {
            throw new domain_exceptions_1.InvalidStateException(`Only cancelled inbound orders can be deleted. Cancel the order first (current: ${order.status}).`);
        }
        await (0, tenant_rls_1.withTenantRls)(this.prisma, user, async (tx) => {
            const ledgerCount = await tx.inventoryLedger.count({
                where: { referenceType: 'inbound_order', referenceId: id },
            });
            if (ledgerCount > 0) {
                throw new domain_exceptions_1.InvalidStateException('This order has stock movements recorded and cannot be deleted.');
            }
            await tx.workflowInstance.deleteMany({
                where: { referenceType: 'inbound_order', referenceId: id },
            });
            await tx.inboundOrder.delete({ where: { id } });
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'INBOUND_ORDER_DELETED',
            resourceType: 'inbound_order',
            resourceId: id,
            companyId: order.companyId,
            previousState: { status: order.status, orderNumber: order.orderNumber },
            newState: { deleted: true },
        }));
        this.realtime.emitInboundOrderUpdated(order.companyId, {
            orderId: id,
            status: order.status,
            reason: 'delete',
            listItem: (0, realtime_client_payload_1.adminInboundListItem)(order),
        });
        return { id, deleted: true };
    }
    async receiveLine(user, orderId, lineId, dto) {
        if ((0, feature_flags_1.taskOnlyFlows)(this.config)) {
            throw new common_1.GoneException('Use warehouse RECEIVING task completion when TASK_ONLY_FLOWS=true; line receive API is disabled.');
        }
        const received = await this.prisma.$transaction(async (tx) => {
            await (0, tenant_rls_1.setTenantRlsContext)(tx, user);
            const order = await tx.inboundOrder.findUnique({ where: { id: orderId } });
            if (!order)
                throw new common_1.NotFoundException('Inbound order not found.');
            this.companyAccess.validateResourceOwnership(user, order);
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
            const delta = new client_1.Prisma.Decimal(dto.quantity);
            (0, receiving_qty_validation_1.assertReceivingQuantitiesWithinExpected)({
                expected: line.expectedQuantity,
                receivedQty: delta,
                damagedQty: new client_1.Prisma.Decimal(0),
                priorReceived: line.receivedQuantity,
                lineId: line.id,
            });
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
            await this.stock.upsertPositive(tx, {
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
            const receivedLine = received.lines.find((l) => l.id === lineId);
            this.realtime.emitInboundOrderUpdated(received.companyId, {
                orderId: received.id,
                status: received.status,
                reason: 'receive_line',
                listItem: (0, realtime_client_payload_1.adminInboundListItem)(received),
            });
            this.realtime.emitInventoryChanged(received.companyId, {
                source: 'inbound_receive_line',
                orderId: received.id,
                productId: receivedLine?.productId,
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
        warehouse_tasks_service_1.WarehouseTasksService,
        realtime_service_1.RealtimeService,
        notifications_service_1.NotificationsService,
        company_access_service_1.CompanyAccessService,
        audit_log_service_1.AuditLogService,
        billing_access_service_1.BillingAccessService])
], InboundService);
//# sourceMappingURL=inbound.service.js.map