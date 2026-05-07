import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, WorkflowReferenceType } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { taskOnlyFlows } from './feature-flags';
import { getFrontierBlockedReason } from './task-runnable.util';
import { buildWorkflowTimelineSteps } from './workflow-timeline.helpers';
import { WorkflowEngineService } from './workflow-engine.service';

export type {
  InboundPutawayPayload,
  InboundQcTaskPayload,
  InboundReceivingPayload,
  OutboundPickPayload,
} from './workflow-payload.contracts';

/**
 * HTTP/public workflow bootstrap + read models.
 * Transactional instance + first task creation lives in `WorkflowEngineService`.
 */
@Injectable()
export class WorkflowBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly engine: WorkflowEngineService,
  ) {}

  async startInboundWorkflow(
    user: AuthPrincipal,
    orderId: string,
    warehouseId: string,
    stagingOverrides?: Record<string, string>,
  ) {
    return this.prisma.$transaction((tx) =>
      this.engine.createInboundInstanceWithFirstReceiveTask(tx, user, orderId, warehouseId, stagingOverrides),
    );
  }

  /** Use from order `confirm` when TASK_ONLY_FLOWS shares a transaction with status updates. */
  async startInboundWorkflowTx(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    orderId: string,
    warehouseId: string,
    stagingOverrides?: Record<string, string>,
  ) {
    return this.engine.createInboundInstanceWithFirstReceiveTask(tx, user, orderId, warehouseId, stagingOverrides);
  }

  async startOutboundWorkflow(user: AuthPrincipal, orderId: string, warehouseId: string) {
    return this.prisma.$transaction((tx) =>
      this.engine.createOutboundInstanceWithFirstPickTask(tx, user, orderId, warehouseId),
    );
  }

  async startOutboundWorkflowTx(
    tx: Prisma.TransactionClient,
    user: AuthPrincipal,
    orderId: string,
    warehouseId: string,
  ) {
    return this.engine.createOutboundInstanceWithFirstPickTask(tx, user, orderId, warehouseId);
  }

  /** Timeline + ordered steps (pending | locked | done) for GET /workflows/references/... */
  async getWorkflowTimeline(user: AuthPrincipal, referenceType: 'inbound_order' | 'outbound_order', referenceId: string) {
    if (!user.companyId) throw new BadRequestException('companyId required.');
    const wf = await this.prisma.workflowInstance.findFirst({
      where: {
        referenceType,
        referenceId,
        companyId: user.companyId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!wf) {
      return {
        workflowInstance: null,
        tasks: [] as unknown[],
        steps: buildWorkflowTimelineSteps(referenceType, []),
      };
    }

    const tasks = await this.prisma.warehouseTask.findMany({
      where: { workflowInstanceId: wf.id },
      orderBy: { createdAt: 'asc' },
      include: {
        assignments: { where: { unassignedAt: null }, take: 1, include: { worker: true } },
      },
    });

    const light = tasks.map((t) => ({
      id: t.id,
      workflowInstanceId: t.workflowInstanceId,
      taskType: t.taskType,
      status: t.status,
    }));

    const stepRows = tasks.map((t) => ({
      id: t.id,
      workflowInstanceId: t.workflowInstanceId,
      taskType: t.taskType,
      status: t.status,
      createdAt: t.createdAt,
    }));

    return {
      workflowInstance: wf,
      tasks: tasks.map((t) => ({
        ...t,
        is_current_runnable: getFrontierBlockedReason(t.id, light, referenceType) === null,
        runnability_blocked_reason: getFrontierBlockedReason(t.id, light, referenceType),
      })),
      steps: buildWorkflowTimelineSteps(referenceType, stepRows),
    };
  }

  /** Part I.F / Part II — DAG read for dashboards (instance-centric). */
  async getWorkflowInstanceGraph(user: AuthPrincipal, instanceId: string) {
    if (!user.companyId) throw new BadRequestException('companyId required.');
    const wf = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!wf || wf.companyId !== user.companyId) throw new NotFoundException('Workflow instance not found.');

    const [nodes, tasks] = await Promise.all([
      this.prisma.workflowNode.findMany({
        where: { instanceId },
        orderBy: { sequence: 'asc' },
      }),
      this.prisma.warehouseTask.findMany({
        where: { workflowInstanceId: instanceId },
        orderBy: { createdAt: 'asc' },
        include: {
          assignments: { where: { unassignedAt: null }, take: 1, include: { worker: true } },
        },
      }),
    ]);

    const refTag =
      wf.referenceType === WorkflowReferenceType.inbound_order
        ? 'inbound_order'
        : wf.referenceType === WorkflowReferenceType.outbound_order
          ? 'outbound_order'
          : (wf.referenceType as string);

    const light = tasks.map((t) => ({
      id: t.id,
      workflowInstanceId: t.workflowInstanceId,
      taskType: t.taskType,
      status: t.status,
    }));

    return {
      workflowInstance: wf,
      nodes,
      tasks: tasks.map((t) => ({
        ...t,
        is_current_runnable: getFrontierBlockedReason(t.id, light, refTag) === null,
        runnability_blocked_reason: getFrontierBlockedReason(t.id, light, refTag),
      })),
    };
  }

  /** Resolve active instance by reference, then same graph shape as `instances/:id/graph`. */
  async getWorkflowInstanceGraphByReference(
    user: AuthPrincipal,
    referenceType: 'inbound_order' | 'outbound_order',
    referenceId: string,
  ) {
    if (!user.companyId) throw new BadRequestException('companyId required.');
    const wf = await this.prisma.workflowInstance.findFirst({
      where: {
        referenceType,
        referenceId,
        companyId: user.companyId,
        status: { in: ['pending', 'in_progress', 'degraded'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!wf) throw new NotFoundException('Workflow instance not found for reference.');
    return this.getWorkflowInstanceGraph(user, wf.id);
  }

  /**
   * GET /workflows/context-settings — authoritative TASK_ONLY flag + UX merge defaults.
   * `warehouseId` is always a string echo of the query param (empty when omitted).
   */
  async getWorkflowContextSettings(user: AuthPrincipal, warehouseId?: string) {
    if (!user.companyId) throw new BadRequestException('companyId required.');
    const flag = taskOnlyFlows(this.config);
    const defaults = {
      showAdvancedJson: false,
      confirmUnsavedDraft: true,
    };
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { workflowUxSettings: true },
    });
    let warehouse: { workflowUxSettings: unknown } | null = null;
    if (warehouseId) {
      warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { workflowUxSettings: true },
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found.');
    }
    const c = (company?.workflowUxSettings as Record<string, unknown> | null) ?? {};
    const w = (warehouse?.workflowUxSettings as Record<string, unknown> | null) ?? {};
    const merged = {
      ...defaults,
      ...c,
      ...w,
    };

    const wid = (warehouseId ?? '').trim();

    return {
      taskOnlyFlows: flag,
      warehouseId: wid,
      defaults,
      company: company?.workflowUxSettings ?? null,
      warehouse: warehouse?.workflowUxSettings ?? null,
      effective: merged,
    };
  }
}
