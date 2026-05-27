import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';

import { Prisma, WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryConsistencyService } from '../../modules/inventory/inventory-consistency.service';
import { LedgerIdempotencyService } from '../../modules/inventory/ledger-idempotency.service';
import { StockHelpers } from '../../modules/inventory/stock.helpers';
import { RealtimeService } from '../../modules/realtime/realtime.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { TaskInventoryEffectsService } from '../../modules/warehouse-workflow/task-inventory-effects.service';
import { WarehouseTasksService } from '../../modules/warehouse-workflow/warehouse-tasks.service';
import { WorkflowOrchestrationService } from '../../modules/warehouse-workflow/workflow-orchestration.service';
import { TaskReadCacheService } from '../../common/redis/task-read-cache.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';

type ServiceDeps = {
  prisma: PrismaService;
  tasks: WarehouseTasksService;
  stock: StockHelpers;
  consistency: InventoryConsistencyService;
  realtimeCalls: { taskUpdates: number };
  notificationCalls: { completed: number };
};

export type BaseFixture = {
  principal: AuthPrincipal;
  companyId: string;
  userId: string;
  warehouseId: string;
  locationId: string;
  productId: string;
  outboundOrderId: string;
  outboundOrderLineId: string;
  workflowInstanceId: string;
  pickTaskId: string;
  dispatchTaskId: string;
  workerId: string;
};

function companyAccessMock(): CompanyAccessService {
  return {
    assertSameCompany(user: AuthPrincipal, workflowCompanyId: string) {
      if (user.companyId !== workflowCompanyId && !user.authorizedCompanyIds.includes(workflowCompanyId)) {
        throw new Error('cross-tenant access denied in test mock');
      }
    },
    getReadFilterCompanyId(user: AuthPrincipal, requested?: string) {
      return requested ?? user.companyId ?? undefined;
    },
    resolveWriteCompanyId(user: AuthPrincipal, requested?: string) {
      const id = requested ?? user.companyId;
      if (!id) throw new Error('missing company');
      return id;
    },
    validateResourceOwnership(user: AuthPrincipal, resource: { companyId: string }) {
      if (user.companyId !== resource.companyId && !user.authorizedCompanyIds.includes(resource.companyId)) {
        throw new Error('cross-tenant resource');
      }
    },
  } as unknown as CompanyAccessService;
}

export async function createServiceDeps(): Promise<ServiceDeps> {
  const prisma = new PrismaService();
  await prisma.$connect();

  const companyAccess = companyAccessMock();
  const consistency = new InventoryConsistencyService(prisma, companyAccess);
  const stock = new StockHelpers(consistency);
  const ledger = new LedgerIdempotencyService(prisma);
  const effects = new TaskInventoryEffectsService(stock, ledger);

  const realtimeCalls = { taskUpdates: 0 };
  const notificationCalls = { completed: 0 };

  const realtime = {
    emitTaskUpdatedByTaskId: async () => {
      realtimeCalls.taskUpdates += 1;
    },
    emitTaskUpdated: () => undefined,
    emitInventoryChanged: () => undefined,
  } as unknown as RealtimeService;

  const notifications = {
    notifyClientOrderCompleted: async () => {
      notificationCalls.completed += 1;
    },
  } as unknown as NotificationsService;

  const cacheInv = {
    afterTaskAndStockMutation: async () => undefined,
    afterTaskMutation: async () => undefined,
  } as unknown as CacheInvalidationService;

  const orchestration = {
    onTaskCompleted: async () => ({ inboundCompleted: undefined, outboundCompleted: undefined }),
    spawnPutawayFromFullReceive: async () => undefined,
    enqueueDispatchTaskIfNeeded: async () => undefined,
  } as unknown as WorkflowOrchestrationService;

  const taskReadCache = {
    getOrLoad: async (_k: string, _t: string, loader: () => Promise<unknown>) => loader(),
  } as unknown as TaskReadCacheService;

  const tasks = new WarehouseTasksService(
    prisma,
    effects,
    cacheInv,
    orchestration,
    taskReadCache,
    realtime,
    notifications,
    companyAccess,
  );

  return { prisma, tasks, stock, consistency, realtimeCalls, notificationCalls };
}

export async function createBaseFixture(
  prisma: PrismaService,
  opts?: { pickStatus?: WarehouseTaskStatus; dispatchStatus?: WarehouseTaskStatus },
): Promise<BaseFixture> {
  const tag = `it-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const companyId = randomUUID();
  const warehouseId = randomUUID();
  const userId = randomUUID();
  const workerId = randomUUID();
  const locationId = randomUUID();
  const productId = randomUUID();
  const outboundOrderId = randomUUID();
  const outboundOrderLineId = randomUUID();
  const workflowInstanceId = randomUUID();
  const pickTaskId = randomUUID();
  const dispatchTaskId = randomUUID();

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
      requestedQuantity: new Prisma.Decimal('5'),
      pickedQuantity: new Prisma.Decimal('0'),
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
      taskType: WarehouseTaskType.pick,
      status: opts?.pickStatus ?? WarehouseTaskStatus.pending,
      payload: {
        outbound_order_id: outboundOrderId,
        lines: [{ outbound_order_line_id: outboundOrderLineId, requested_qty: '5' }],
      } as Prisma.InputJsonValue,
      executionState: Prisma.DbNull,
    },
  });
  await prisma.taskAssignment.create({
    data: { taskId: pickTaskId, workerId },
  });
  await prisma.warehouseTask.create({
    data: {
      id: dispatchTaskId,
      workflowInstanceId,
      taskType: WarehouseTaskType.dispatch,
      status: opts?.dispatchStatus ?? WarehouseTaskStatus.pending,
      payload: { outbound_order_id: outboundOrderId, pick_task_id: pickTaskId } as Prisma.InputJsonValue,
      executionState: Prisma.DbNull,
    },
  });
  await prisma.taskAssignment.create({
    data: { taskId: dispatchTaskId, workerId },
  });

  const principal: AuthPrincipal = {
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

export async function seedOnHand(
  stock: StockHelpers,
  prisma: PrismaService,
  f: BaseFixture,
  qty: string,
): Promise<void> {
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

export async function reserveWithSnapshot(
  stock: StockHelpers,
  prisma: PrismaService,
  f: BaseFixture,
  qty: string,
  taskId: string,
): Promise<void> {
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
      } as Prisma.InputJsonValue,
    },
  });
}

export async function readReserved(prisma: PrismaService, f: BaseFixture): Promise<string> {
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

export async function cleanupFixture(prisma: PrismaService, f: BaseFixture): Promise<void> {
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

export function assertEq(actual: unknown, expected: unknown, msg: string): void {
  assert.equal(actual, expected, msg);
}

