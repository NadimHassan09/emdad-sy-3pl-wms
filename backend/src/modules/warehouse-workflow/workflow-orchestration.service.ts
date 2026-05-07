import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  ProductTrackingType,
  WarehouseTaskStatus,
  WarehouseTaskType,
  WorkflowInstance,
  WorkflowStepKind,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { defaultSlaMinutesForTaskType } from './task-sla-defaults';
import type {
  InboundPutawayPayload,
  InboundQcTaskPayload,
  InboundReceivingPayload,
} from './workflow-payload.contracts';
import type { TaskCompleteBody } from './task-payload.schema';

@Injectable()
export class WorkflowOrchestrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run after a task has been marked `completed` inside the same transaction.
   */
  async onTaskCompleted(
    tx: Prisma.TransactionClient,
    task: Prisma.WarehouseTaskGetPayload<{ include: { workflowInstance: true } }>,
    body: TaskCompleteBody,
    actorUserId: string,
  ): Promise<void> {
    const wf = task.workflowInstance;
    if (wf.referenceType === 'inbound_order') {
      await this.afterInboundTask(tx, wf, task.taskType, body, actorUserId);
      await this.maybeCloseInboundWorkflow(tx, wf.id);
      return;
    }
    if (wf.referenceType === 'outbound_order') {
      await this.afterOutboundTask(tx, wf, task.taskType, body);
    }
  }

  /**
   * Receiving posts staged stock under the resolved lot UUID for lot-tracked products.
   * Putaway decrement must target that same row; spawning tasks with lot_id null would hit the wrong bucket and raise InsufficientStockException.
   */
  private async resolveStagingLotIdForPutaway(
    tx: Prisma.TransactionClient,
    args: {
      companyId: string;
      productId: string;
      stagingLocationId: string;
      qty: Prisma.Decimal;
      trackingType: ProductTrackingType;
    },
  ): Promise<string | null> {
    const { companyId, productId, stagingLocationId, qty, trackingType } = args;
    if (trackingType !== ProductTrackingType.lot) {
      return null;
    }

    const rows = await tx.currentStock.findMany({
      where: {
        companyId,
        productId,
        locationId: stagingLocationId,
        packageId: null,
        lotId: { not: null },
        quantityAvailable: { gt: 0 },
      },
      select: { lotId: true, quantityAvailable: true },
      orderBy: { quantityAvailable: 'desc' },
    });

    const covering = rows.find((r) =>
      new Prisma.Decimal(r.quantityAvailable.toString()).greaterThanOrEqualTo(qty),
    );
    if (!covering?.lotId) {
      throw new BadRequestException(
        'Cannot prepare putaway: no staged lot line has enough available quantity for this inbound line. If stock is split across lots at staging, adjust inventory or receive again.',
      );
    }
    return covering.lotId;
  }

  private async nextNodeSequence(tx: Prisma.TransactionClient, instanceId: string): Promise<number> {
    const agg = await tx.workflowNode.aggregate({
      where: { instanceId },
      _max: { sequence: true },
    });
    return (agg._max.sequence ?? 0) + 1;
  }

  private async countOpenTasks(tx: Prisma.TransactionClient, instanceId: string): Promise<number> {
    return tx.warehouseTask.count({
      where: {
        workflowInstanceId: instanceId,
        status: { notIn: ['completed', 'cancelled', 'failed'] },
      },
    });
  }

  /** Used by skip-QC path: route all received qty to sellable putaway. */
  async spawnPutawayFromFullReceive(tx: Prisma.TransactionClient, wf: WorkflowInstance): Promise<void> {
    const orderId = wf.referenceId;
    const recvTask = await tx.warehouseTask.findFirst({
      where: {
        workflowInstanceId: wf.id,
        taskType: WarehouseTaskType.receiving,
        status: WarehouseTaskStatus.completed,
      },
      orderBy: { completedAt: 'desc' },
    });
    if (!recvTask) throw new BadRequestException('Missing completed receiving task.');
    const recvPayload = recvTask.payload as unknown as InboundReceivingPayload;
    const stagingMap = new Map(
      recvPayload.lines.map((l) => [l.inbound_order_line_id, l.staging_location_id]),
    );

    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: { orderBy: { lineNumber: 'asc' }, include: { product: true } } },
    });
    if (!order || order.companyId !== wf.companyId) throw new BadRequestException('Inbound order invalid.');

    const putLines: InboundPutawayPayload['lines'] = [];
    for (const l of order.lines) {
      if (l.receivedQuantity.lessThanOrEqualTo(0)) continue;
      const sid = stagingMap.get(l.id);
      if (!sid) throw new BadRequestException(`Missing staging for line ${l.id} on skip-qc putaway.`);
      const lotId = await this.resolveStagingLotIdForPutaway(tx, {
        companyId: order.companyId,
        productId: l.productId,
        stagingLocationId: sid,
        qty: l.receivedQuantity,
        trackingType: l.product.trackingType,
      });
      putLines.push({
        inbound_order_line_id: l.id,
        product_id: l.productId,
        quantity: l.receivedQuantity.toString(),
        lot_id: lotId,
        source_staging_location_id: sid,
      });
    }
    if (putLines.length === 0) return;

    await this.insertPutawayTask(tx, wf.id, orderId, WarehouseTaskType.putaway, putLines, {});
  }

  private async afterInboundTask(
    tx: Prisma.TransactionClient,
    wf: WorkflowInstance,
    taskType: WarehouseTaskType,
    body: TaskCompleteBody,
    actorUserId: string,
  ): Promise<void> {
    switch (taskType) {
      case WarehouseTaskType.receiving:
        await this.afterReceiving(tx, wf);
        break;
      case WarehouseTaskType.qc:
        if (body.task_type === 'qc') {
          await this.afterQc(tx, wf, body, actorUserId);
        }
        break;
      default:
        break;
    }
  }

  private async afterReceiving(tx: Prisma.TransactionClient, wf: WorkflowInstance) {
    /** Inbound flow: receiving → putaway (no QC task). */
    await this.spawnPutawayFromFullReceive(tx, wf);
  }

  private async afterQc(
    tx: Prisma.TransactionClient,
    wf: WorkflowInstance,
    body: Extract<TaskCompleteBody, { task_type: 'qc' }>,
    actorUserId: string,
  ) {
    const orderId = wf.referenceId;
    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: { orderBy: { lineNumber: 'asc' }, include: { product: true } } },
    });
    if (!order) throw new BadRequestException('Inbound order not found.');

    const recvTask = await tx.warehouseTask.findFirst({
      where: {
        workflowInstanceId: wf.id,
        taskType: WarehouseTaskType.receiving,
        status: WarehouseTaskStatus.completed,
      },
      orderBy: { completedAt: 'desc' },
    });
    if (!recvTask) throw new BadRequestException('Missing receiving task for putaway spawn.');
    const recvPayload = recvTask.payload as unknown as InboundReceivingPayload;
    const stagingMap = new Map(
      recvPayload.lines.map((l) => [l.inbound_order_line_id, l.staging_location_id]),
    );

    const sellable: InboundPutawayPayload['lines'] = [];
    const quarantine: InboundPutawayPayload['lines'] = [];

    for (const row of body.lines) {
      const line = order.lines.find((l) => l.id === row.inbound_order_line_id);
      if (!line) throw new BadRequestException(`Unknown inbound line ${row.inbound_order_line_id}`);
      const eligible = line.receivedQuantity;
      const passed = new Prisma.Decimal(String(row.passed_qty));
      const failed = new Prisma.Decimal(String(row.failed_qty));
      if (!passed.plus(failed).equals(eligible)) {
        throw new BadRequestException(
          `QC quantities must sum to received qty for line ${line.id} (expected ${eligible.toString()}).`,
        );
      }
      const sid = stagingMap.get(line.id);
      if (!sid) throw new BadRequestException(`Missing staging for line ${line.id}.`);

      if (passed.greaterThan(0)) {
        const lotIdPassed = await this.resolveStagingLotIdForPutaway(tx, {
          companyId: order.companyId,
          productId: line.productId,
          stagingLocationId: sid,
          qty: passed,
          trackingType: line.product.trackingType,
        });
        sellable.push({
          inbound_order_line_id: line.id,
          product_id: line.productId,
          quantity: passed.toString(),
          lot_id: lotIdPassed,
          source_staging_location_id: sid,
        });
      }
      if (failed.greaterThan(0)) {
        const lotIdFailed = await this.resolveStagingLotIdForPutaway(tx, {
          companyId: order.companyId,
          productId: line.productId,
          stagingLocationId: sid,
          qty: failed,
          trackingType: line.product.trackingType,
        });
        quarantine.push({
          inbound_order_line_id: line.id,
          product_id: line.productId,
          quantity: failed.toString(),
          lot_id: lotIdFailed,
          source_staging_location_id: sid,
        });
      }
    }

    if (sellable.length > 0) {
      await this.insertPutawayTask(tx, wf.id, orderId, WarehouseTaskType.putaway, sellable, {});
    }
    if (quarantine.length > 0) {
      await this.insertPutawayTask(tx, wf.id, orderId, WarehouseTaskType.putaway_quarantine, quarantine, {});
    }
  }

  private async insertPutawayTask(
    tx: Prisma.TransactionClient,
    instanceId: string,
    inboundOrderId: string,
    taskType: typeof WarehouseTaskType.putaway | typeof WarehouseTaskType.putaway_quarantine,
    lines: InboundPutawayPayload['lines'],
    extraPayload: Record<string, unknown>,
  ) {
    const seq = await this.nextNodeSequence(tx, instanceId);
    const node = await tx.workflowNode.create({
      data: {
        instanceId,
        stepKind: WorkflowStepKind.putaway,
        sequence: seq,
        status: 'pending',
      },
    });

    const putPayload: InboundPutawayPayload & Record<string, unknown> = {
      inbound_order_id: inboundOrderId,
      lines,
      ...extraPayload,
    };

    await tx.warehouseTask.create({
      data: {
        workflowInstanceId: instanceId,
        workflowNodeId: node.id,
        taskType,
        status: WarehouseTaskStatus.pending,
        slaMinutes: defaultSlaMinutesForTaskType(taskType),
        payload: putPayload as object as Prisma.InputJsonValue,
      },
    });
  }

  private async maybeCloseInboundWorkflow(tx: Prisma.TransactionClient, instanceId: string) {
    const wf = await tx.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!wf || wf.referenceType !== 'inbound_order') return;

    const open = await this.countOpenTasks(tx, instanceId);
    if (open > 0) return;

    const inboundOrderId = wf.referenceId;

    await tx.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'completed' },
    });

    await tx.inboundOrder.update({
      where: { id: inboundOrderId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  private async afterOutboundTask(
    tx: Prisma.TransactionClient,
    wf: WorkflowInstance,
    taskType: WarehouseTaskType,
    body: TaskCompleteBody,
  ) {
    const orderId = wf.referenceId;
    switch (taskType) {
      case WarehouseTaskType.pick:
        if (body.task_type === 'pick') {
          await this.spawnPackIfNeeded(tx, wf.id, orderId);
        }
        break;
      case WarehouseTaskType.pack:
        if (body.task_type === 'pack') {
          await this.enqueueDispatchTaskIfNeeded(tx, wf.id, orderId);
        }
        break;
      case WarehouseTaskType.dispatch:
        if (body.task_type === 'dispatch') {
          await tx.workflowInstance.update({
            where: { id: wf.id },
            data: { status: 'completed' },
          });
        }
        break;
      default:
        break;
    }
  }

  private async spawnPackIfNeeded(tx: Prisma.TransactionClient, instanceId: string, orderId: string) {
    const existing = await tx.warehouseTask.findFirst({
      where: {
        workflowInstanceId: instanceId,
        taskType: WarehouseTaskType.pack,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      existing &&
      [WarehouseTaskStatus.pending, WarehouseTaskStatus.assigned, WarehouseTaskStatus.in_progress].includes(
        existing.status as 'pending' | 'assigned' | 'in_progress',
      )
    ) {
      return;
    }
    if (existing?.status === WarehouseTaskStatus.completed) {
      return;
    }

    const order = await tx.outboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!order) throw new BadRequestException('Outbound order missing for pack spawn.');

    const seq = await this.nextNodeSequence(tx, instanceId);
    const node = await tx.workflowNode.create({
      data: {
        instanceId,
        stepKind: WorkflowStepKind.pack,
        sequence: seq,
        status: 'pending',
      },
    });

    await tx.warehouseTask.create({
      data: {
        workflowInstanceId: instanceId,
        workflowNodeId: node.id,
        taskType: WarehouseTaskType.pack,
        status: WarehouseTaskStatus.pending,
        slaMinutes: defaultSlaMinutesForTaskType(WarehouseTaskType.pack),
        payload: {
          outbound_order_id: orderId,
          outbound_order_line_ids: order.lines.map((l) => l.id),
        } as object as Prisma.InputJsonValue,
      },
    });
  }

  /** Public for skip-pack UX: enqueue ship task once pack is bypassed. */
  async enqueueDispatchTaskIfNeeded(tx: Prisma.TransactionClient, instanceId: string, orderId: string) {
    const existing = await tx.warehouseTask.findFirst({
      where: {
        workflowInstanceId: instanceId,
        taskType: WarehouseTaskType.dispatch,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      existing &&
      [WarehouseTaskStatus.pending, WarehouseTaskStatus.assigned, WarehouseTaskStatus.in_progress].includes(
        existing.status as 'pending' | 'assigned' | 'in_progress',
      )
    ) {
      return;
    }
    if (existing?.status === WarehouseTaskStatus.completed) {
      return;
    }

    const seq = await this.nextNodeSequence(tx, instanceId);
    const node = await tx.workflowNode.create({
      data: {
        instanceId,
        stepKind: WorkflowStepKind.dispatch,
        sequence: seq,
        status: 'pending',
      },
    });

    await tx.warehouseTask.create({
      data: {
        workflowInstanceId: instanceId,
        workflowNodeId: node.id,
        taskType: WarehouseTaskType.dispatch,
        status: WarehouseTaskStatus.pending,
        slaMinutes: defaultSlaMinutesForTaskType(WarehouseTaskType.dispatch),
        payload: { outbound_order_id: orderId } as object as Prisma.InputJsonValue,
      },
    });
  }
}
