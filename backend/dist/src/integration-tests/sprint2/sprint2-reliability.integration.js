"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const node_assert_1 = require("node:assert");
const client_1 = require("@prisma/client");
const reliability_test_helpers_1 = require("./reliability-test-helpers");
async function testConcurrentPickStart() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { pickStatus: client_1.WarehouseTaskStatus.pending });
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '50');
        await Promise.all([deps.tasks.start(f.pickTaskId, f.principal), deps.tasks.start(f.pickTaskId, f.principal)]);
        const reserved = await (0, reliability_test_helpers_1.readReserved)(deps.prisma, f);
        (0, reliability_test_helpers_1.assertEq)(reserved, '5', 'concurrent pick.start must not double reserve');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testDuplicatePickComplete() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { pickStatus: client_1.WarehouseTaskStatus.completed });
    try {
        const body = { task_type: 'pick', picks: [] };
        await deps.tasks.complete(f.pickTaskId, f.principal, body);
        await deps.tasks.complete(f.pickTaskId, f.principal, body);
        const task = await deps.prisma.warehouseTask.findUniqueOrThrow({ where: { id: f.pickTaskId } });
        (0, reliability_test_helpers_1.assertEq)(task.status, 'completed', 'duplicate pick.complete must remain completed');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testDuplicateDispatchComplete() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { dispatchStatus: client_1.WarehouseTaskStatus.completed });
    try {
        const body = {
            task_type: 'dispatch',
            lines: [{ outbound_order_line_id: f.outboundOrderLineId, ship_qty: '0' }],
        };
        await deps.tasks.complete(f.dispatchTaskId, f.principal, body);
        await deps.tasks.complete(f.dispatchTaskId, f.principal, body);
        const task = await deps.prisma.warehouseTask.findUniqueOrThrow({ where: { id: f.dispatchTaskId } });
        (0, reliability_test_helpers_1.assertEq)(task.status, 'completed', 'duplicate dispatch.complete must remain completed');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testDispatchUsesBoundPickReservations() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, {
        pickStatus: client_1.WarehouseTaskStatus.completed,
        dispatchStatus: client_1.WarehouseTaskStatus.in_progress,
    });
    let pick2TaskId = null;
    let location2Id = null;
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '5');
        await (0, reliability_test_helpers_1.reserveWithSnapshot)(deps.stock, deps.prisma, f, '5', f.pickTaskId);
        await deps.prisma.warehouseTask.update({
            where: { id: f.pickTaskId },
            data: { completedAt: new Date('2030-01-01T00:00:00.000Z') },
        });
        location2Id = (0, node_crypto_1.randomUUID)();
        await deps.prisma.location.create({
            data: {
                id: location2Id,
                warehouseId: f.warehouseId,
                name: `LOC2-${location2Id}`,
                fullPath: `/A/${location2Id}`,
                type: 'internal',
                barcode: `BC2-${location2Id}`,
                status: 'active',
            },
        });
        await deps.prisma.$transaction(async (tx) => {
            await deps.stock.upsertPositiveWithMeta(tx, {
                companyId: f.companyId,
                productId: f.productId,
                locationId: location2Id,
                warehouseId: f.warehouseId,
                lotId: null,
                quantity: '5',
            });
            await deps.stock.incrementReservedWithMeta(tx, {
                companyId: f.companyId,
                productId: f.productId,
                locationId: location2Id,
                lotId: null,
                quantity: '5',
            });
        });
        pick2TaskId = (0, node_crypto_1.randomUUID)();
        await deps.prisma.warehouseTask.create({
            data: {
                id: pick2TaskId,
                workflowInstanceId: f.workflowInstanceId,
                taskType: 'pick',
                status: client_1.WarehouseTaskStatus.completed,
                payload: {
                    outbound_order_id: f.outboundOrderId,
                    lines: [{ outbound_order_line_id: f.outboundOrderLineId, requested_qty: '5' }],
                },
                executionState: {
                    reservations: [
                        {
                            outboundOrderLineId: f.outboundOrderLineId,
                            companyId: f.companyId,
                            productId: f.productId,
                            locationId: location2Id,
                            warehouseId: f.warehouseId,
                            lotId: null,
                            quantity: '5',
                        },
                    ],
                },
            },
        });
        await deps.prisma.taskAssignment.create({
            data: { taskId: pick2TaskId, workerId: f.workerId },
        });
        await deps.prisma.warehouseTask.update({
            where: { id: pick2TaskId },
            data: { completedAt: new Date('2029-01-01T00:00:00.000Z') },
        });
        await deps.prisma.outboundOrderLine.update({
            where: { id: f.outboundOrderLineId },
            data: { pickedQuantity: new client_1.Prisma.Decimal('5') },
        });
        await deps.prisma.warehouseTask.update({
            where: { id: f.dispatchTaskId },
            data: {
                payload: {
                    outbound_order_id: f.outboundOrderId,
                    pick_task_id: pick2TaskId,
                },
            },
        });
        const body = {
            task_type: 'dispatch',
            lines: [{ outbound_order_line_id: f.outboundOrderLineId, ship_qty: '5' }],
        };
        await deps.tasks.complete(f.dispatchTaskId, f.principal, body);
        const reserved1 = await deps.prisma.currentStock.findFirstOrThrow({
            where: {
                companyId: f.companyId,
                productId: f.productId,
                locationId: f.locationId,
                lotId: null,
                packageId: null,
            },
            select: { quantityReserved: true },
        });
        const reserved2 = await deps.prisma.currentStock.findFirstOrThrow({
            where: {
                companyId: f.companyId,
                productId: f.productId,
                locationId: location2Id,
                lotId: null,
                packageId: null,
            },
            select: { quantityReserved: true },
        });
        (0, reliability_test_helpers_1.assertEq)(reserved1.quantityReserved.toString(), '5', 'bound pick mismatch must not ship pick #1');
        (0, reliability_test_helpers_1.assertEq)(reserved2.quantityReserved.toString(), '0', 'dispatch must ship reservations from bound pick #2');
    }
    finally {
        await deps.prisma.$disconnect();
    }
}
async function testOrphanReservationReleaseByCancelRemaining() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma);
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '50');
        await (0, reliability_test_helpers_1.reserveWithSnapshot)(deps.stock, deps.prisma, f, '5', f.pickTaskId);
        await deps.prisma.warehouseTask.update({
            where: { id: f.pickTaskId },
            data: { status: client_1.WarehouseTaskStatus.completed, completedAt: new Date() },
        });
        await deps.prisma.warehouseTask.update({
            where: { id: f.dispatchTaskId },
            data: { status: client_1.WarehouseTaskStatus.blocked },
        });
        await deps.tasks.resolveBlocked(f.dispatchTaskId, f.principal, {
            resolution: 'cancel_remaining',
            reason: 'integration orphan reservation cleanup',
        });
        const reserved = await (0, reliability_test_helpers_1.readReserved)(deps.prisma, f);
        (0, reliability_test_helpers_1.assertEq)(reserved, '0', 'cancel_remaining must release orphan reservations');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testDispatchCancelReservationCleanup() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { dispatchStatus: client_1.WarehouseTaskStatus.pending });
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '50');
        await (0, reliability_test_helpers_1.reserveWithSnapshot)(deps.stock, deps.prisma, f, '5', f.pickTaskId);
        await deps.prisma.warehouseTask.update({
            where: { id: f.pickTaskId },
            data: { status: client_1.WarehouseTaskStatus.completed, completedAt: new Date() },
        });
        await deps.tasks.cancel(f.dispatchTaskId, f.principal, 'cancel dispatch');
        const reserved = await (0, reliability_test_helpers_1.readReserved)(deps.prisma, f);
        (0, reliability_test_helpers_1.assertEq)(reserved, '0', 'dispatch cancel must release pick reservations');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testPickFailReservationCleanup() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { pickStatus: client_1.WarehouseTaskStatus.in_progress });
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '50');
        await (0, reliability_test_helpers_1.reserveWithSnapshot)(deps.stock, deps.prisma, f, '5', f.pickTaskId);
        await deps.tasks.fail(f.pickTaskId, f.principal, 'fail for cleanup');
        const reserved = await (0, reliability_test_helpers_1.readReserved)(deps.prisma, f);
        (0, reliability_test_helpers_1.assertEq)(reserved, '0', 'pick fail must release reservations');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testReopenReReserveFlow() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { pickStatus: client_1.WarehouseTaskStatus.in_progress });
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '50');
        await (0, reliability_test_helpers_1.reserveWithSnapshot)(deps.stock, deps.prisma, f, '5', f.pickTaskId);
        await deps.tasks.fail(f.pickTaskId, f.principal, 'fail then reopen');
        await deps.tasks.reopen(f.pickTaskId, f.principal);
        await deps.tasks.start(f.pickTaskId, f.principal);
        const reserved = await (0, reliability_test_helpers_1.readReserved)(deps.prisma, f);
        (0, reliability_test_helpers_1.assertEq)(reserved, '5', 'reopen -> start must re-reserve exactly once');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testInventoryConsistencyValidate() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma);
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '10');
        const report = await deps.consistency.validateForUser(f.principal, { companyId: f.companyId });
        (0, node_assert_1.strict)(report.summary.critical === 0, 'consistency validate should report no critical issues for clean fixture');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testReservationInvariantRollback() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma);
    try {
        await (0, reliability_test_helpers_1.seedOnHand)(deps.stock, deps.prisma, f, '5');
        let threw = false;
        try {
            await deps.prisma.$transaction(async (tx) => {
                await deps.stock.incrementReservedWithMeta(tx, {
                    companyId: f.companyId,
                    productId: f.productId,
                    locationId: f.locationId,
                    lotId: null,
                    quantity: '20',
                });
            });
        }
        catch {
            threw = true;
        }
        (0, node_assert_1.strict)(threw, 'reserve beyond available must throw');
        const reserved = await (0, reliability_test_helpers_1.readReserved)(deps.prisma, f);
        (0, reliability_test_helpers_1.assertEq)(reserved, '0', 'failed reserve must rollback to previous reserved quantity');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function testWebsocketReplaySafety() {
    const deps = await (0, reliability_test_helpers_1.createServiceDeps)();
    const f = await (0, reliability_test_helpers_1.createBaseFixture)(deps.prisma, { pickStatus: client_1.WarehouseTaskStatus.in_progress });
    try {
        const body = { task_type: 'pick', picks: [] };
        await deps.tasks.complete(f.pickTaskId, f.principal, body);
        await deps.tasks.complete(f.pickTaskId, f.principal, body);
        (0, reliability_test_helpers_1.assertEq)(deps.realtimeCalls.taskUpdates, 1, 'duplicate replay should emit realtime task update once');
        (0, reliability_test_helpers_1.assertEq)(deps.notificationCalls.completed, 0, 'pick replay should not emit duplicate completion notifications');
    }
    finally {
        await (0, reliability_test_helpers_1.cleanupFixture)(deps.prisma, f);
        await deps.prisma.$disconnect();
    }
}
async function runAll() {
    const tests = [
        { name: 'concurrent pick.start()', run: testConcurrentPickStart },
        { name: 'duplicate pick.complete()', run: testDuplicatePickComplete },
        { name: 'duplicate dispatch.complete()', run: testDuplicateDispatchComplete },
        { name: 'dispatch.complete binds to bound pick', run: testDispatchUsesBoundPickReservations },
        { name: 'orphan reservation release (cancel_remaining)', run: testOrphanReservationReleaseByCancelRemaining },
        { name: 'dispatch cancel reservation cleanup', run: testDispatchCancelReservationCleanup },
        { name: 'pick fail reservation cleanup', run: testPickFailReservationCleanup },
        { name: 'reopen -> re-reserve flow', run: testReopenReReserveFlow },
        { name: 'inventory consistency validate', run: testInventoryConsistencyValidate },
        { name: 'reservation invariant rollback', run: testReservationInvariantRollback },
        { name: 'websocket replay safety', run: testWebsocketReplaySafety },
    ];
    const failures = [];
    for (const t of tests) {
        const started = Date.now();
        try {
            await t.run();
            console.log(`PASS ${t.name} (${Date.now() - started}ms)`);
        }
        catch (error) {
            failures.push({ name: t.name, error });
            console.error(`FAIL ${t.name}`, error);
        }
    }
    if (failures.length > 0) {
        throw new Error(`Sprint 2 reliability integration suite failed: ${failures.length} test(s).`);
    }
}
void runAll();
//# sourceMappingURL=sprint2-reliability.integration.js.map