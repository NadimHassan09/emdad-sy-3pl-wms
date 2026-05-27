import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';

import { Prisma, WarehouseTaskStatus } from '@prisma/client';

import {
  assertEq,
  cleanupFixture,
  createBaseFixture,
  createServiceDeps,
  readReserved,
  reserveWithSnapshot,
  seedOnHand,
} from './reliability-test-helpers';

type TestCase = { name: string; run: () => Promise<void> };

async function testConcurrentPickStart() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { pickStatus: WarehouseTaskStatus.pending });
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '50');
    await Promise.all([deps.tasks.start(f.pickTaskId, f.principal), deps.tasks.start(f.pickTaskId, f.principal)]);
    const reserved = await readReserved(deps.prisma, f);
    assertEq(reserved, '5', 'concurrent pick.start must not double reserve');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testDuplicatePickComplete() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { pickStatus: WarehouseTaskStatus.completed });
  try {
    const body = { task_type: 'pick' as const, picks: [] };
    await deps.tasks.complete(f.pickTaskId, f.principal, body);
    await deps.tasks.complete(f.pickTaskId, f.principal, body);
    const task = await deps.prisma.warehouseTask.findUniqueOrThrow({ where: { id: f.pickTaskId } });
    assertEq(task.status, 'completed', 'duplicate pick.complete must remain completed');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testDuplicateDispatchComplete() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { dispatchStatus: WarehouseTaskStatus.completed });
  try {
    const body = {
      task_type: 'dispatch' as const,
      lines: [{ outbound_order_line_id: f.outboundOrderLineId, ship_qty: '0' }],
    };
    await deps.tasks.complete(f.dispatchTaskId, f.principal, body);
    await deps.tasks.complete(f.dispatchTaskId, f.principal, body);
    const task = await deps.prisma.warehouseTask.findUniqueOrThrow({ where: { id: f.dispatchTaskId } });
    assertEq(task.status, 'completed', 'duplicate dispatch.complete must remain completed');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testDispatchUsesBoundPickReservations() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, {
    pickStatus: WarehouseTaskStatus.completed,
    dispatchStatus: WarehouseTaskStatus.in_progress,
  });
  let pick2TaskId: string | null = null;
  let location2Id: string | null = null;
  try {
    // Pick #1 (wrong if binding points to pick #2).
    await seedOnHand(deps.stock, deps.prisma, f, '5');
    await reserveWithSnapshot(deps.stock, deps.prisma, f, '5', f.pickTaskId);
    await deps.prisma.warehouseTask.update({
      where: { id: f.pickTaskId },
      data: { completedAt: new Date('2030-01-01T00:00:00.000Z') },
    });

    // Add a second location for pick #2 reservations.
    location2Id = randomUUID();
    await deps.prisma.location.create({
      data: {
        id: location2Id!,
        warehouseId: f.warehouseId,
        name: `LOC2-${location2Id!}`,
        fullPath: `/A/${location2Id!}`,
        type: 'internal',
        barcode: `BC2-${location2Id!}`,
        status: 'active',
      },
    });

    await deps.prisma.$transaction(async (tx) => {
      await deps.stock.upsertPositiveWithMeta(tx, {
        companyId: f.companyId,
        productId: f.productId,
        locationId: location2Id!,
        warehouseId: f.warehouseId,
        lotId: null,
        quantity: '5',
      });
      await deps.stock.incrementReservedWithMeta(tx, {
        companyId: f.companyId,
        productId: f.productId,
        locationId: location2Id!,
        lotId: null,
        quantity: '5',
      });
    });

    pick2TaskId = randomUUID();
    await deps.prisma.warehouseTask.create({
      data: {
        id: pick2TaskId!,
        workflowInstanceId: f.workflowInstanceId,
        taskType: 'pick',
        status: WarehouseTaskStatus.completed,
        payload: {
          outbound_order_id: f.outboundOrderId,
          lines: [{ outbound_order_line_id: f.outboundOrderLineId, requested_qty: '5' }],
        } as Prisma.InputJsonValue,
        executionState: {
          reservations: [
            {
              outboundOrderLineId: f.outboundOrderLineId,
              companyId: f.companyId,
              productId: f.productId,
              locationId: location2Id!,
              warehouseId: f.warehouseId,
              lotId: null,
              quantity: '5',
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });
    await deps.prisma.taskAssignment.create({
      data: { taskId: pick2TaskId!, workerId: f.workerId },
    });
    await deps.prisma.warehouseTask.update({
      where: { id: pick2TaskId! },
      data: { completedAt: new Date('2029-01-01T00:00:00.000Z') },
    });

    // Dispatch completion should ship pick #2 snapshot (even though pick #1 is latest).
    await deps.prisma.outboundOrderLine.update({
      where: { id: f.outboundOrderLineId },
      data: { pickedQuantity: new Prisma.Decimal('5') },
    });
    await deps.prisma.warehouseTask.update({
      where: { id: f.dispatchTaskId },
      data: {
        payload: {
          outbound_order_id: f.outboundOrderId,
          pick_task_id: pick2TaskId!,
        } as Prisma.InputJsonValue,
      },
    });

    const body = {
      task_type: 'dispatch' as const,
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
        locationId: location2Id!,
        lotId: null,
        packageId: null,
      },
      select: { quantityReserved: true },
    });
    assertEq(reserved1.quantityReserved.toString(), '5', 'bound pick mismatch must not ship pick #1');
    assertEq(reserved2.quantityReserved.toString(), '0', 'dispatch must ship reservations from bound pick #2');
  } finally {
    await deps.prisma.$disconnect();
  }
}

async function testOrphanReservationReleaseByCancelRemaining() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma);
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '50');
    await reserveWithSnapshot(deps.stock, deps.prisma, f, '5', f.pickTaskId);
    await deps.prisma.warehouseTask.update({
      where: { id: f.pickTaskId },
      data: { status: WarehouseTaskStatus.completed, completedAt: new Date() },
    });
    await deps.prisma.warehouseTask.update({
      where: { id: f.dispatchTaskId },
      data: { status: WarehouseTaskStatus.blocked },
    });
    await deps.tasks.resolveBlocked(f.dispatchTaskId, f.principal, {
      resolution: 'cancel_remaining',
      reason: 'integration orphan reservation cleanup',
    });
    const reserved = await readReserved(deps.prisma, f);
    assertEq(reserved, '0', 'cancel_remaining must release orphan reservations');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testDispatchCancelReservationCleanup() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { dispatchStatus: WarehouseTaskStatus.pending });
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '50');
    await reserveWithSnapshot(deps.stock, deps.prisma, f, '5', f.pickTaskId);
    await deps.prisma.warehouseTask.update({
      where: { id: f.pickTaskId },
      data: { status: WarehouseTaskStatus.completed, completedAt: new Date() },
    });
    await deps.tasks.cancel(f.dispatchTaskId, f.principal, 'cancel dispatch');
    const reserved = await readReserved(deps.prisma, f);
    assertEq(reserved, '0', 'dispatch cancel must release pick reservations');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testPickFailReservationCleanup() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { pickStatus: WarehouseTaskStatus.in_progress });
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '50');
    await reserveWithSnapshot(deps.stock, deps.prisma, f, '5', f.pickTaskId);
    await deps.tasks.fail(f.pickTaskId, f.principal, 'fail for cleanup');
    const reserved = await readReserved(deps.prisma, f);
    assertEq(reserved, '0', 'pick fail must release reservations');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testReopenReReserveFlow() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { pickStatus: WarehouseTaskStatus.in_progress });
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '50');
    await reserveWithSnapshot(deps.stock, deps.prisma, f, '5', f.pickTaskId);
    await deps.tasks.fail(f.pickTaskId, f.principal, 'fail then reopen');
    await deps.tasks.reopen(f.pickTaskId, f.principal);
    await deps.tasks.start(f.pickTaskId, f.principal);
    const reserved = await readReserved(deps.prisma, f);
    assertEq(reserved, '5', 'reopen -> start must re-reserve exactly once');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testInventoryConsistencyValidate() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma);
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '10');
    const report = await deps.consistency.validateForUser(f.principal, { companyId: f.companyId });
    assert(report.summary.critical === 0, 'consistency validate should report no critical issues for clean fixture');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testReservationInvariantRollback() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma);
  try {
    await seedOnHand(deps.stock, deps.prisma, f, '5');
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
    } catch {
      threw = true;
    }
    assert(threw, 'reserve beyond available must throw');
    const reserved = await readReserved(deps.prisma, f);
    assertEq(reserved, '0', 'failed reserve must rollback to previous reserved quantity');
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function testWebsocketReplaySafety() {
  const deps = await createServiceDeps();
  const f = await createBaseFixture(deps.prisma, { pickStatus: WarehouseTaskStatus.in_progress });
  try {
    const body = { task_type: 'pick' as const, picks: [] };
    await deps.tasks.complete(f.pickTaskId, f.principal, body);
    await deps.tasks.complete(f.pickTaskId, f.principal, body);
    assertEq(deps.realtimeCalls.taskUpdates, 1, 'duplicate replay should emit realtime task update once');
    assertEq(
      deps.notificationCalls.completed,
      0,
      'pick replay should not emit duplicate completion notifications',
    );
  } finally {
    await cleanupFixture(deps.prisma, f);
    await deps.prisma.$disconnect();
  }
}

async function runAll() {
  const tests: TestCase[] = [
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

  const failures: Array<{ name: string; error: unknown }> = [];
  for (const t of tests) {
    const started = Date.now();
    try {
      await t.run();
      // eslint-disable-next-line no-console
      console.log(`PASS ${t.name} (${Date.now() - started}ms)`);
    } catch (error) {
      failures.push({ name: t.name, error });
      // eslint-disable-next-line no-console
      console.error(`FAIL ${t.name}`, error);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Sprint 2 reliability integration suite failed: ${failures.length} test(s).`);
  }
}

void runAll();

