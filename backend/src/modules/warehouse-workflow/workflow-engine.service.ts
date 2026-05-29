import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WarehouseTaskStatus,
  WarehouseTaskType,
  WorkflowReferenceType,
  WorkflowStepKind,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { InboundReceivingPayload, OutboundPickPayload } from './workflow-payload.contracts';
import { defaultSlaMinutesForTaskType } from './task-sla-defaults';
import {
  findActiveWorkflowForReference,
  isActiveWorkflowUniqueViolation,
  loadWorkflowBootstrapBundle,
  lockWorkflowReferenceOrder,
} from './workflow-active.util';

const DEF_INBOUND = 'inbound_default_v1';
const DEF_OUTBOUND = 'outbound_default_v1';

/** Core transactional workflow bootstrap (TASK_ONLY_FLOWS order confirm delegates here). */
@Injectable()
export class WorkflowEngineService {
  constructor(private readonly companyAccess: CompanyAccessService) {}

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
    const tenantCompanyId = this.companyAccess.requireActiveTenant(user);

    await lockWorkflowReferenceOrder(tx, WorkflowReferenceType.inbound_order, orderId);

    const order = await tx.inboundOrder.findUnique({
      where: { id: orderId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!order) {
      throw new NotFoundException('Inbound order not found.');
    }
    this.companyAccess.validateResourceOwnership(user, order);
    if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
      throw new InvalidStateException('Workflow can only start for an active inbound order.');
    }

    const existing = await findActiveWorkflowForReference(
      tx,
      WorkflowReferenceType.inbound_order,
      orderId,
    );
    if (existing) {
      return loadWorkflowBootstrapBundle(tx, existing.id);
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

    try {
      const wf = await tx.workflowInstance.create({
        data: {
          companyId: tenantCompanyId,
          warehouseId,
          referenceType: WorkflowReferenceType.inbound_order,
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

      return loadWorkflowBootstrapBundle(tx, wf.id);
    } catch (err) {
      if (isActiveWorkflowUniqueViolation(err)) {
        const replay = await findActiveWorkflowForReference(
          tx,
          WorkflowReferenceType.inbound_order,
          orderId,
        );
        if (replay) return loadWorkflowBootstrapBundle(tx, replay.id);
      }
      throw err;
    }
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
    const tenantCompanyId = this.companyAccess.requireActiveTenant(user);

    await lockWorkflowReferenceOrder(tx, WorkflowReferenceType.outbound_order, orderId);

    const order = await tx.outboundOrder.findUnique({
      where: { id: orderId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Outbound order not found.');
    this.companyAccess.validateResourceOwnership(user, order);
    if (order.status !== 'picking' && order.status !== 'confirmed') {
      throw new InvalidStateException('Workflow requires confirmed / picking outbound order.');
    }

    const existing = await findActiveWorkflowForReference(
      tx,
      WorkflowReferenceType.outbound_order,
      orderId,
    );
    if (existing) {
      return loadWorkflowBootstrapBundle(tx, existing.id);
    }

    const pickPayload: OutboundPickPayload = {
      outbound_order_id: orderId,
      lines: order.lines.map((l) => ({
        outbound_order_line_id: l.id,
        requested_qty: l.requestedQuantity.toString(),
      })),
    };

    try {
      const wf = await tx.workflowInstance.create({
        data: {
          companyId: tenantCompanyId,
          warehouseId,
          referenceType: WorkflowReferenceType.outbound_order,
          referenceId: orderId,
          definitionCode: DEF_OUTBOUND,
          status: 'in_progress',
          metadata: { createdByUserId: user.id, stage: 'pick' } as object,
        },
      });

      const nPick = await tx.workflowNode.create({
        data: {
          instanceId: wf.id,
          stepKind: WorkflowStepKind.pick,
          sequence: 1,
          status: 'in_progress',
        },
      });

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

      return loadWorkflowBootstrapBundle(tx, wf.id);
    } catch (err) {
      if (isActiveWorkflowUniqueViolation(err)) {
        const replay = await findActiveWorkflowForReference(
          tx,
          WorkflowReferenceType.outbound_order,
          orderId,
        );
        if (replay) return loadWorkflowBootstrapBundle(tx, replay.id);
      }
      throw err;
    }
  }
}
