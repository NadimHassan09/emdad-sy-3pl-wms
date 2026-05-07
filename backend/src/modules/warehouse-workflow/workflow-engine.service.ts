import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WarehouseTaskStatus,
  WarehouseTaskType,
  WorkflowStepKind,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { InboundReceivingPayload, OutboundPickPayload } from './workflow-payload.contracts';
import { defaultSlaMinutesForTaskType } from './task-sla-defaults';

const DEF_INBOUND = 'inbound_default_v1';
const DEF_OUTBOUND = 'outbound_default_v1';

/** Core transactional workflow bootstrap (TASK_ONLY_FLOWS order confirm delegates here). */
@Injectable()
export class WorkflowEngineService {
  /**
   * Idempotent: returns existing open instance + tasks when already present.
   * Caller must run inside a transaction when combined with order mutations.
   */
  async createInboundInstanceWithFirstReceiveTask(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    orderId: string,
    warehouseId: string,
    stagingOverrides?: Record<string, string>,
  ): Promise<{
    workflowInstance: { id: string; status: string; referenceType: string; referenceId: string } & Record<string, unknown>;
    nodes: unknown[];
    tasks: unknown[];
  }> {
    if (!user.companyId) throw new BadRequestException('companyId required on user.');

    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!order || order.companyId !== user.companyId) {
      throw new NotFoundException('Inbound order not found.');
    }
    if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
      throw new InvalidStateException('Workflow can only start for an active inbound order.');
    }

    const existing = await tx.workflowInstance.findFirst({
      where: {
        referenceType: 'inbound_order',
        referenceId: orderId,
        status: { in: ['pending', 'in_progress', 'degraded'] },
      },
    });
    if (existing) {
      const tasks = await tx.warehouseTask.findMany({
        where: { workflowInstanceId: existing.id },
        orderBy: { id: 'asc' },
      });
      return { workflowInstance: existing, nodes: [], tasks };
    }

    const staging = stagingOverrides ?? {};
    const linesPayload: InboundReceivingPayload['lines'] = order.lines.map((l) => {
      const sid = staging[l.id];
      if (!sid) {
        throw new BadRequestException(
          `stagingOverrides must map every line id → staging_location_id (missing ${l.id}).`,
        );
      }
      return {
        inbound_order_line_id: l.id,
        expected_qty: l.expectedQuantity.toString(),
        staging_location_id: sid,
      };
    });

    const wf = await tx.workflowInstance.create({
      data: {
        companyId: user.companyId,
        warehouseId,
        referenceType: 'inbound_order',
        referenceId: orderId,
        definitionCode: DEF_INBOUND,
        status: 'in_progress',
        metadata: { createdByUserId: user.id, stage: 'receiving' } as object,
      },
    });

    const nRecv = await tx.workflowNode.create({
      data: {
        instanceId: wf.id,
        stepKind: WorkflowStepKind.receiving,
        sequence: 1,
        status: 'in_progress',
      },
    });

    const recvPayload: InboundReceivingPayload = {
      inbound_order_id: orderId,
      lines: linesPayload,
    };

    await tx.warehouseTask.create({
      data: {
        workflowInstanceId: wf.id,
        workflowNodeId: nRecv.id,
        taskType: WarehouseTaskType.receiving,
        status: WarehouseTaskStatus.pending,
        slaMinutes: defaultSlaMinutesForTaskType(WarehouseTaskType.receiving),
        payload: recvPayload as object as Prisma.InputJsonValue,
      },
    });

    const tasks = await tx.warehouseTask.findMany({
      where: { workflowInstanceId: wf.id },
      orderBy: { id: 'asc' },
    });

    const nodes = await tx.workflowNode.findMany({
      where: { instanceId: wf.id },
      orderBy: { sequence: 'asc' },
    });

    return { workflowInstance: wf, nodes, tasks };
  }

  async createOutboundInstanceWithFirstPickTask(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    orderId: string,
    warehouseId: string,
  ): Promise<{
    workflowInstance: { id: string; status: string; referenceType: string; referenceId: string } & Record<string, unknown>;
    nodes: unknown[];
    tasks: unknown[];
  }> {
    if (!user.companyId) throw new BadRequestException('companyId required on user.');
    const order = await tx.outboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!order || order.companyId !== user.companyId) throw new NotFoundException('Outbound order not found.');
    if (order.status !== 'picking' && order.status !== 'confirmed') {
      throw new InvalidStateException('Workflow requires confirmed / picking outbound order.');
    }

    const existing = await tx.workflowInstance.findFirst({
      where: {
        referenceType: 'outbound_order',
        referenceId: orderId,
        status: { in: ['pending', 'in_progress', 'degraded'] },
      },
    });
    if (existing) {
      const tasks = await tx.warehouseTask.findMany({
        where: { workflowInstanceId: existing.id },
        orderBy: { id: 'asc' },
      });
      return { workflowInstance: existing, nodes: [], tasks };
    }

    const wf = await tx.workflowInstance.create({
      data: {
        companyId: user.companyId,
        warehouseId,
        referenceType: 'outbound_order',
        referenceId: orderId,
        definitionCode: DEF_OUTBOUND,
        status: 'in_progress',
        metadata: { createdByUserId: user.id, stage: 'pick' } as object,
      },
    });

    const nPick = await tx.workflowNode.create({
      data: { instanceId: wf.id, stepKind: WorkflowStepKind.pick, sequence: 1, status: 'in_progress' },
    });

    const pickPayload: OutboundPickPayload = {
      outbound_order_id: orderId,
      lines: order.lines.map((l) => ({
        outbound_order_line_id: l.id,
        requested_qty: l.requestedQuantity.toString(),
      })),
    };

    await tx.warehouseTask.create({
      data: {
        workflowInstanceId: wf.id,
        workflowNodeId: nPick.id,
        taskType: WarehouseTaskType.pick,
        status: WarehouseTaskStatus.pending,
        slaMinutes: defaultSlaMinutesForTaskType(WarehouseTaskType.pick),
        payload: pickPayload as object as Prisma.InputJsonValue,
      },
    });

    const tasks = await tx.warehouseTask.findMany({
      where: { workflowInstanceId: wf.id },
      orderBy: { id: 'asc' },
    });
    const nodes = await tx.workflowNode.findMany({
      where: { instanceId: wf.id },
      orderBy: { sequence: 'asc' },
    });
    return { workflowInstance: wf, nodes, tasks };
  }
}
