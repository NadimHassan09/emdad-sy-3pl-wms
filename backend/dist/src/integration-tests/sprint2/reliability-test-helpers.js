"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceDeps = createServiceDeps;
exports.createOutboundServiceDeps = createOutboundServiceDeps;
exports.createWorkflowEngineDeps = createWorkflowEngineDeps;
exports.createDraftOutboundFixture = createDraftOutboundFixture;
exports.cleanupDraftOutboundFixture = cleanupDraftOutboundFixture;
exports.createBaseFixture = createBaseFixture;
exports.seedOnHand = seedOnHand;
exports.reserveWithSnapshot = reserveWithSnapshot;
exports.readReserved = readReserved;
exports.cleanupFixture = cleanupFixture;
exports.assertEq = assertEq;
const node_crypto_1 = require("node:crypto");
const node_assert_1 = require("node:assert");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const inventory_consistency_service_1 = require("../../modules/inventory/inventory-consistency.service");
const ledger_idempotency_service_1 = require("../../modules/inventory/ledger-idempotency.service");
const stock_helpers_1 = require("../../modules/inventory/stock.helpers");
const task_inventory_effects_service_1 = require("../../modules/warehouse-workflow/task-inventory-effects.service");
const warehouse_tasks_service_1 = require("../../modules/warehouse-workflow/warehouse-tasks.service");
const outbound_service_1 = require("../../modules/outbound/outbound.service");
const workflow_bootstrap_service_1 = require("../../modules/warehouse-workflow/workflow-bootstrap.service");
const workflow_engine_service_1 = require("../../modules/warehouse-workflow/workflow-engine.service");
function companyAccessMock() {
    return {
        assertSameCompany(user, workflowCompanyId) {
            if (user.companyId !== workflowCompanyId && !user.authorizedCompanyIds.includes(workflowCompanyId)) {
                throw new Error('cross-tenant access denied in test mock');
            }
        },
        getReadFilterCompanyId(user, requested) {
            return requested ?? user.companyId ?? undefined;
        },
        resolveWriteCompanyId(user, requested) {
            const id = requested ?? user.companyId;
            if (!id)
                throw new Error('missing company');
            return id;
        },
        validateResourceOwnership(user, resource) {
            if (user.companyId !== resource.companyId && !user.authorizedCompanyIds.includes(resource.companyId)) {
                throw new Error('cross-tenant resource');
            }
        },
        requireActiveTenant(user) {
            const id = user.companyId;
            if (!id)
                throw new Error('missing tenant');
            return id;
        },
    };
}
async function createServiceDeps() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const companyAccess = companyAccessMock();
    const consistency = new inventory_consistency_service_1.InventoryConsistencyService(prisma, companyAccess);
    const stock = new stock_helpers_1.StockHelpers(consistency);
    const ledger = new ledger_idempotency_service_1.LedgerIdempotencyService(prisma);
    const effects = new task_inventory_effects_service_1.TaskInventoryEffectsService(stock, ledger);
    const realtimeCalls = { taskUpdates: 0 };
    const notificationCalls = { completed: 0 };
    const realtime = {
        emitTaskUpdatedByTaskId: async () => {
            realtimeCalls.taskUpdates += 1;
        },
        emitTaskUpdated: () => undefined,
        emitInventoryChanged: () => undefined,
    };
    const notifications = {
        notifyClientOrderCompleted: async () => {
            notificationCalls.completed += 1;
        },
    };
    const cacheInv = {
        afterTaskAndStockMutation: async () => undefined,
        afterTaskMutation: async () => undefined,
    };
    const orchestration = {
        onTaskCompleted: async () => ({ inboundCompleted: undefined, outboundCompleted: undefined }),
        spawnPutawayFromFullReceive: async () => undefined,
        enqueueDispatchTaskIfNeeded: async () => undefined,
    };
    const taskReadCache = {
        getOrLoad: async (_k, _t, loader) => loader(),
    };
    const audit = {
        log: async () => undefined,
        logTx: async () => undefined,
        fromPrincipal: (_principal, patch) => patch,
    };
    const tasks = new warehouse_tasks_service_1.WarehouseTasksService(prisma, effects, cacheInv, orchestration, taskReadCache, realtime, notifications, companyAccess, audit);
    return { prisma, tasks, stock, consistency, realtimeCalls, notificationCalls };
}
function configMock(flags) {
    return {
        get: (key) => flags[key] ?? '',
    };
}
async function createOutboundServiceDeps(opts) {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const companyAccess = companyAccessMock();
    const consistency = new inventory_consistency_service_1.InventoryConsistencyService(prisma, companyAccess);
    const stock = new stock_helpers_1.StockHelpers(consistency);
    const ledger = new ledger_idempotency_service_1.LedgerIdempotencyService(prisma);
    const config = configMock({
        TASK_ONLY_FLOWS: opts?.taskOnlyFlows === false ? 'false' : 'true',
        TASK_WORKFLOW_OUTBOUND_CONFIRM_DEFERS_DEDUCTION: opts?.deferDeduction ? 'true' : 'false',
    });
    const engine = new workflow_engine_service_1.WorkflowEngineService(companyAccess);
    const workflowBootstrap = new workflow_bootstrap_service_1.WorkflowBootstrapService(prisma, config, engine, companyAccess);
    const realtime = {
        emitOutboundOrderUpdated: () => undefined,
        emitInventoryChanged: () => undefined,
    };
    const notifications = {
        notifyClientOrderConfirmed: async () => undefined,
        dismissPendingAdminNotifications: async () => undefined,
        notifyClientOrderCompleted: async () => undefined,
    };
    const audit = {
        log: async () => undefined,
        fromPrincipal: (_principal, patch) => patch,
    };
    const outbound = new outbound_service_1.OutboundService(prisma, stock, ledger, config, workflowBootstrap, realtime, notifications, companyAccess, audit);
    return { prisma, outbound, stock, engine };
}
async function createWorkflowEngineDeps() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const companyAccess = companyAccessMock();
    const engine = new workflow_engine_service_1.WorkflowEngineService(companyAccess);
    return { prisma, engine };
}
async function createDraftOutboundFixture(prisma) {
    const tag = `oc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const companyId = (0, node_crypto_1.randomUUID)();
    const warehouseId = (0, node_crypto_1.randomUUID)();
    const userId = (0, node_crypto_1.randomUUID)();
    const locationId = (0, node_crypto_1.randomUUID)();
    const productId = (0, node_crypto_1.randomUUID)();
    const outboundOrderId = (0, node_crypto_1.randomUUID)();
    const outboundOrderLineId = (0, node_crypto_1.randomUUID)();
    await prisma.company.create({
        data: {
            id: companyId,
            name: `IT ${tag}`,
            contactEmail: `${tag}@example.com`,
        },
    });
    await prisma.user.create({
        data: {
            id: userId,
            companyId: null,
            email: `${tag}.user@example.com`,
            passwordHash: 'x',
            fullName: `User ${tag}`,
            role: 'super_admin',
            status: 'active',
        },
    });
    await prisma.warehouse.create({
        data: {
            id: warehouseId,
            name: `WH ${tag}`,
            code: `WH${tag}`.slice(0, 20),
            status: 'active',
        },
    });
    await prisma.location.create({
        data: {
            id: locationId,
            warehouseId,
            name: `LOC ${tag}`,
            fullPath: `/A/${tag}`,
            type: 'internal',
            barcode: `BC${tag}`,
            status: 'active',
        },
    });
    await prisma.product.create({
        data: {
            id: productId,
            companyId,
            name: `P ${tag}`,
            sku: `SKU-${tag}`,
            trackingType: 'none',
            uom: 'piece',
            status: 'active',
        },
    });
    await prisma.outboundOrder.create({
        data: {
            id: outboundOrderId,
            companyId,
            destinationAddress: `ADDR ${tag}`,
            requiredShipDate: new Date(),
            createdBy: userId,
            status: 'draft',
            requiresPacking: false,
        },
    });
    await prisma.outboundOrderLine.create({
        data: {
            id: outboundOrderLineId,
            outboundOrderId,
            productId,
            requestedQuantity: new client_1.Prisma.Decimal('5'),
            pickedQuantity: new client_1.Prisma.Decimal('0'),
            lineNumber: 1,
            status: 'pending',
        },
    });
    const principal = {
        id: userId,
        companyId,
        role: 'super_admin',
        tenantScope: 'all',
        authorizedCompanyIds: [companyId],
        email: `${tag}.user@example.com`,
    };
    return {
        principal,
        companyId,
        userId,
        warehouseId,
        locationId,
        productId,
        outboundOrderId,
        outboundOrderLineId,
    };
}
async function cleanupDraftOutboundFixture(prisma, f) {
    const wfIds = (await prisma.workflowInstance.findMany({
        where: { referenceType: 'outbound_order', referenceId: f.outboundOrderId },
        select: { id: true },
    })).map((w) => w.id);
    if (wfIds.length > 0) {
        await prisma.taskEvent.deleteMany({ where: { task: { workflowInstanceId: { in: wfIds } } } });
        await prisma.taskAssignment.deleteMany({ where: { task: { workflowInstanceId: { in: wfIds } } } });
        await prisma.warehouseTaskRequiredSkill.deleteMany({
            where: { task: { workflowInstanceId: { in: wfIds } } },
        });
        await prisma.warehouseTask.deleteMany({ where: { workflowInstanceId: { in: wfIds } } });
        await prisma.workflowNode.deleteMany({ where: { instanceId: { in: wfIds } } });
        await prisma.workflowInstance.deleteMany({ where: { id: { in: wfIds } } });
    }
    await prisma.outboundOrderLine.deleteMany({ where: { outboundOrderId: f.outboundOrderId } });
    await prisma.outboundOrder.deleteMany({ where: { id: f.outboundOrderId } });
    await prisma.currentStock.deleteMany({ where: { companyId: f.companyId } });
}
async function createBaseFixture(prisma, opts) {
    const tag = `it-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const companyId = (0, node_crypto_1.randomUUID)();
    const warehouseId = (0, node_crypto_1.randomUUID)();
    const userId = (0, node_crypto_1.randomUUID)();
    const workerId = (0, node_crypto_1.randomUUID)();
    const locationId = (0, node_crypto_1.randomUUID)();
    const productId = (0, node_crypto_1.randomUUID)();
    const outboundOrderId = (0, node_crypto_1.randomUUID)();
    const outboundOrderLineId = (0, node_crypto_1.randomUUID)();
    const workflowInstanceId = (0, node_crypto_1.randomUUID)();
    const pickTaskId = (0, node_crypto_1.randomUUID)();
    const dispatchTaskId = (0, node_crypto_1.randomUUID)();
    await prisma.company.create({
        data: {
            id: companyId,
            name: `IT ${tag}`,
            contactEmail: `${tag}@example.com`,
        },
    });
    await prisma.user.create({
        data: {
            id: userId,
            companyId: null,
            email: `${tag}.user@example.com`,
            passwordHash: 'x',
            fullName: `User ${tag}`,
            role: 'super_admin',
            status: 'active',
        },
    });
    await prisma.warehouse.create({
        data: {
            id: warehouseId,
            name: `WH ${tag}`,
            code: `WH${tag}`.slice(0, 20),
            status: 'active',
        },
    });
    await prisma.location.create({
        data: {
            id: locationId,
            warehouseId,
            name: `LOC ${tag}`,
            fullPath: `/A/${tag}`,
            type: 'internal',
            barcode: `BC${tag}`,
            status: 'active',
        },
    });
    await prisma.product.create({
        data: {
            id: productId,
            companyId,
            name: `P ${tag}`,
            sku: `SKU-${tag}`,
            trackingType: 'none',
            uom: 'piece',
            status: 'active',
        },
    });
    await prisma.worker.create({
        data: {
            id: workerId,
            companyId,
            warehouseId,
            displayName: `W ${tag}`,
            status: 'active',
        },
    });
    await prisma.outboundOrder.create({
        data: {
            id: outboundOrderId,
            companyId,
            destinationAddress: `ADDR ${tag}`,
            requiredShipDate: new Date(),
            createdBy: userId,
            status: 'picking',
            requiresPacking: false,
        },
    });
    await prisma.outboundOrderLine.create({
        data: {
            id: outboundOrderLineId,
            outboundOrderId,
            productId,
            requestedQuantity: new client_1.Prisma.Decimal('5'),
            pickedQuantity: new client_1.Prisma.Decimal('0'),
            lineNumber: 1,
            status: 'pending',
        },
    });
    await prisma.workflowInstance.create({
        data: {
            id: workflowInstanceId,
            companyId,
            warehouseId,
            referenceType: 'outbound_order',
            referenceId: outboundOrderId,
            definitionCode: 'outbound_default',
            status: 'in_progress',
        },
    });
    await prisma.warehouseTask.create({
        data: {
            id: pickTaskId,
            workflowInstanceId,
            taskType: client_1.WarehouseTaskType.pick,
            status: opts?.pickStatus ?? client_1.WarehouseTaskStatus.pending,
            payload: {
                outbound_order_id: outboundOrderId,
                lines: [{ outbound_order_line_id: outboundOrderLineId, requested_qty: '5' }],
            },
            executionState: client_1.Prisma.DbNull,
        },
    });
    await prisma.taskAssignment.create({
        data: { taskId: pickTaskId, workerId },
    });
    await prisma.warehouseTask.create({
        data: {
            id: dispatchTaskId,
            workflowInstanceId,
            taskType: client_1.WarehouseTaskType.dispatch,
            status: opts?.dispatchStatus ?? client_1.WarehouseTaskStatus.pending,
            payload: { outbound_order_id: outboundOrderId, pick_task_id: pickTaskId },
            executionState: client_1.Prisma.DbNull,
        },
    });
    await prisma.taskAssignment.create({
        data: { taskId: dispatchTaskId, workerId },
    });
    const principal = {
        id: userId,
        companyId,
        role: 'super_admin',
        tenantScope: 'all',
        authorizedCompanyIds: [companyId],
        email: `${tag}.user@example.com`,
    };
    return {
        principal,
        companyId,
        userId,
        warehouseId,
        locationId,
        productId,
        outboundOrderId,
        outboundOrderLineId,
        workflowInstanceId,
        pickTaskId,
        dispatchTaskId,
        workerId,
    };
}
async function seedOnHand(stock, prisma, f, qty) {
    await prisma.$transaction(async (tx) => {
        await stock.upsertPositiveWithMeta(tx, {
            companyId: f.companyId,
            productId: f.productId,
            locationId: f.locationId,
            warehouseId: f.warehouseId,
            lotId: null,
            quantity: qty,
        });
    });
}
async function reserveWithSnapshot(stock, prisma, f, qty, taskId) {
    await prisma.$transaction(async (tx) => {
        await stock.incrementReservedWithMeta(tx, {
            companyId: f.companyId,
            productId: f.productId,
            locationId: f.locationId,
            lotId: null,
            quantity: qty,
        });
    });
    await prisma.warehouseTask.update({
        where: { id: taskId },
        data: {
            executionState: {
                reservations: [
                    {
                        outboundOrderLineId: f.outboundOrderLineId,
                        companyId: f.companyId,
                        productId: f.productId,
                        locationId: f.locationId,
                        warehouseId: f.warehouseId,
                        lotId: null,
                        quantity: qty,
                    },
                ],
            },
        },
    });
}
async function readReserved(prisma, f) {
    const row = await prisma.currentStock.findFirstOrThrow({
        where: {
            companyId: f.companyId,
            productId: f.productId,
            locationId: f.locationId,
            lotId: null,
            packageId: null,
        },
        select: { quantityReserved: true },
    });
    return row.quantityReserved.toString();
}
async function cleanupFixture(prisma, f) {
    await prisma.taskEvent.deleteMany({ where: { taskId: { in: [f.pickTaskId, f.dispatchTaskId] } } });
    await prisma.taskAssignment.deleteMany({ where: { taskId: { in: [f.pickTaskId, f.dispatchTaskId] } } });
    await prisma.warehouseTaskRequiredSkill.deleteMany({
        where: { taskId: { in: [f.pickTaskId, f.dispatchTaskId] } },
    });
    await prisma.warehouseTask.deleteMany({ where: { id: { in: [f.pickTaskId, f.dispatchTaskId] } } });
    await prisma.workflowInstance.deleteMany({ where: { id: f.workflowInstanceId } });
    await prisma.ledgerIdempotency.deleteMany({});
    await prisma.inventoryLedger.deleteMany({ where: { companyId: f.companyId } });
    await prisma.outboundOrderLine.deleteMany({ where: { outboundOrderId: f.outboundOrderId } });
    await prisma.outboundOrder.deleteMany({ where: { id: f.outboundOrderId } });
    await prisma.currentStock.deleteMany({ where: { companyId: f.companyId } });
    await prisma.worker.deleteMany({ where: { id: f.workerId } });
    await prisma.product.deleteMany({ where: { id: f.productId } });
    await prisma.location.deleteMany({ where: { id: f.locationId } });
    await prisma.warehouse.deleteMany({ where: { id: f.warehouseId } });
    await prisma.user.deleteMany({ where: { id: f.userId } });
    await prisma.company.deleteMany({ where: { id: f.companyId } });
}
function assertEq(actual, expected, msg) {
    node_assert_1.strict.equal(actual, expected, msg);
}
//# sourceMappingURL=reliability-test-helpers.js.map