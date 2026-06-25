import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserRole,
  UserStatus,
  WarehouseTaskStatus,
  WarehouseTaskType,
  WorkerOperationalStatus,
  WorkflowInstanceStatus,
} from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import {
  NotificationsService,
  OrderNotificationTarget,
} from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { TaskReadCacheService } from '../../common/redis/task-read-cache.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TaskMutationResponseEnvelope } from './task-mutation-envelope.dto';
import { TaskInventoryEffectsService, ReservationSnapshot } from './task-inventory-effects.service';
import type {
  OutboundDispatchPayload,
  OutboundPickPayload,
  InboundPutawayPayload,
  InboundQcTaskPayload,
} from './workflow-payload.contracts';
import type { ResolveTaskDto } from './dto/resolve-task.dto';
import { WorkflowOrchestrationService } from './workflow-orchestration.service';
import { BillingInvoiceCalculationService } from '../billing/billing-invoice-calculation.service';
import { billingTriggerForWarehouseTask } from '../billing/billing-recalculation-triggers.util';
import { TaskCompleteBody, safeParseTaskComplete, taskProgressRequestSchema } from './task-payload.schema';
import { canTransitionTask } from './task-transitions';
import {
  computeRunnableTaskIds,
  getFrontierBlockedReason,
  RUNN_BLOCKED_ASSIGNMENT_REQUIRED,
  RUNN_BLOCKED_NOT_ON_FRONT,
  RUNN_BLOCKED_SKILL_GAP,
} from './task-runnable.util';

type ExecState = { reservations: ReservationSnapshot[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

@Injectable()
export class WarehouseTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effects: TaskInventoryEffectsService,
    private readonly cacheInv: CacheInvalidationService,
    private readonly orchestration: WorkflowOrchestrationService,
    private readonly taskReadCache: TaskReadCacheService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly companyAccess: CompanyAccessService,
    private readonly audit: AuditLogService,
    private readonly billingInvoiceCalc: BillingInvoiceCalculationService,
  ) {}

  private assertTaskWorkflowTenant(
    user: AuthPrincipal,
    workflowCompanyId: string,
  ): void {
    this.companyAccess.assertSameCompany(user, workflowCompanyId);
  }

  async list(
    user: AuthPrincipal,
    query: {
      status?: WarehouseTaskStatus;
      taskType?: string;
      warehouseId?: string;
      workerId?: string;
      referenceId?: string;
      updatedFrom?: Date;
      updatedTo?: Date;
      limit: number;
      offset: number;
      includeRunnability?: boolean;
    },
  ) {
    const where = await this.buildListWhere(user, query);

    const includeRunnability = query.includeRunnability === true;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.warehouseTask.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { updatedAt: 'desc' },
        select: this.listTaskSelect(includeRunnability),
      }),
      this.prisma.warehouseTask.count({ where }),
    ]);

    if (!includeRunnability) {
      return {
        items,
        total,
        limit: query.limit,
        offset: query.offset,
      };
    }

    const enriched = await this.withRunnableFlags(items);
    return {
      items: enriched,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  private listTaskSelect(includeRunnability: boolean): Prisma.WarehouseTaskSelect {
    return {
      id: true,
      taskType: true,
      status: true,
      updatedAt: true,
      ...(includeRunnability ? { workflowInstanceId: true } : {}),
      workflowInstance: {
        select: {
          id: true,
          companyId: true,
          referenceType: true,
          referenceId: true,
          warehouseId: true,
        },
      },
      ...(includeRunnability
        ? {
            requiredSkills: {
              select: { skillCode: true, minimumProficiency: true },
            },
          }
        : {}),
      assignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: 'desc' },
        take: 1,
        select: {
          unassignedAt: true,
          workerId: true,
          worker: {
            select: {
              id: true,
              displayName: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      },
    };
  }

  private async buildListWhere(
    user: AuthPrincipal,
    query: {
      status?: WarehouseTaskStatus;
      taskType?: string;
      warehouseId?: string;
      workerId?: string;
      referenceId?: string;
      updatedFrom?: Date;
      updatedTo?: Date;
    },
  ): Promise<Prisma.WarehouseTaskWhereInput> {
    const where: Prisma.WarehouseTaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.taskType) where.taskType = query.taskType as never;
    const and: Prisma.WarehouseTaskWhereInput[] = [];
    if (query.warehouseId) {
      and.push({
        workflowInstance: { warehouseId: query.warehouseId },
      });
    }
    if (user.role === UserRole.wh_operator) {
      const operatorWorkerId = await this.workerIdForUser(user.id);
      if (!operatorWorkerId) {
        return { id: { in: [] } };
      }
      and.push({
        assignments: { some: { workerId: operatorWorkerId, unassignedAt: null } },
      });
    } else if (query.workerId) {
      and.push({
        assignments: { some: { workerId: query.workerId, unassignedAt: null } },
      });
    }
    if (query.referenceId) {
      and.push({
        workflowInstance: { referenceId: query.referenceId },
      });
    }
    if (query.updatedFrom || query.updatedTo) {
      where.updatedAt = {};
      if (query.updatedFrom) where.updatedAt.gte = query.updatedFrom;
      if (query.updatedTo) where.updatedAt.lte = query.updatedTo;
    }
    const listCompanyId = this.companyAccess.requireReadTenantScope(user);
    if (listCompanyId) {
      and.push({
        workflowInstance: { companyId: listCompanyId },
      });
    }
    if (and.length) where.AND = and;
    return where;
  }

  async getById(taskId: string, user: AuthPrincipal) {
    const companyKey = user.companyId ?? '_';
    const task = await this.taskReadCache.getOrLoad(companyKey, taskId, () =>
      this.fetchTaskAuthorized(taskId, user),
    );
    const [withFlag] = await this.withRunnableFlags([task]);
    return withFlag;
  }

  private async fetchTaskAuthorized(taskId: string, user: AuthPrincipal) {
    const task = await this.prisma.warehouseTask.findUnique({
      where: { id: taskId },
      include: {
        workflowInstance: true,
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: 'desc' },
          include: {
            worker: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' }, take: 80 },
        requiredSkills: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found.');
    this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
    await this.assertOperatorAssignedToTask(user, task);
    return task;
  }

  private async workerIdForUser(userId: string): Promise<string | null> {
    const worker = await this.prisma.worker.findUnique({
      where: { userId },
      select: { id: true },
    });
    return worker?.id ?? null;
  }

  /** Warehouse operators may only read or mutate tasks assigned to their worker profile. */
  private async assertOperatorAssignedToTask(
    user: AuthPrincipal,
    task: { assignments?: Array<{ workerId: string; unassignedAt: Date | null }> },
  ): Promise<void> {
    if (user.role !== UserRole.wh_operator) return;
    const workerId = await this.workerIdForUser(user.id);
    if (!workerId) throw new NotFoundException('Task not found.');
    const assigned = task.assignments?.some(
      (a) => a.workerId === workerId && a.unassignedAt == null,
    );
    if (!assigned) throw new NotFoundException('Task not found.');
  }

  /** UX guard flags (Parts II & IV): workflow frontier plus optional worker skills gate. */
  private async withRunnableFlags<
    T extends {
      id: string;
      workflowInstanceId: string;
      workflowInstance: { referenceType: string };
      requiredSkills?: Array<{ skillCode: string; minimumProficiency: number }>;
      assignments?: Array<{ unassignedAt: Date | null; workerId?: string | null }>;
    },
  >(
    items: T[],
  ): Promise<
    Array<
      T & {
        is_current_runnable: boolean;
        runnability_blocked_reason: string | null;
      }
    >
  > {
    const instIds = [...new Set(items.map((i) => i.workflowInstanceId))];
    if (instIds.length === 0) {
      return items.map((i) => ({
        ...i,
        is_current_runnable: false,
        runnability_blocked_reason: RUNN_BLOCKED_NOT_ON_FRONT,
      }));
    }
    const all = await this.prisma.warehouseTask.findMany({
      where: { workflowInstanceId: { in: instIds } },
      select: { id: true, taskType: true, status: true, workflowInstanceId: true },
    });
    const byInst = new Map<string, typeof all>();
    for (const row of all) {
      const cur = byInst.get(row.workflowInstanceId) ?? [];
      cur.push(row);
      byInst.set(row.workflowInstanceId, cur);
    }

    const withFrontier = items.map((task) => {
      const grp = byInst.get(task.workflowInstanceId) ?? [];
      const blockedReason = getFrontierBlockedReason(task.id, grp, task.workflowInstance.referenceType);
      return {
        ...task,
        is_current_runnable: blockedReason === null,
        runnability_blocked_reason: blockedReason,
      };
    });

    return this.applySkillRunnability(withFrontier);
  }

  private async applySkillRunnability<
    T extends {
      is_current_runnable: boolean;
      runnability_blocked_reason: string | null;
      requiredSkills?: Array<{ skillCode: string; minimumProficiency: number }>;
      assignments?: Array<{ unassignedAt: Date | null; workerId?: string | null }>;
    },
  >(items: T[]): Promise<T[]> {
    const now = new Date();
    return Promise.all(
      items.map(async (task) => {
        if (!task.is_current_runnable) return task;
        const reqs = task.requiredSkills ?? [];
        if (!reqs.length) return task;
        const workerId =
          task.assignments?.find((a) => a.unassignedAt == null)?.workerId ?? undefined;
        if (!workerId) {
          return {
            ...task,
            is_current_runnable: false,
            runnability_blocked_reason: RUNN_BLOCKED_ASSIGNMENT_REQUIRED,
          };
        }
        const ok = await this.workerMeetsRequiredSkills(workerId, reqs, now);
        if (!ok) {
          return {
            ...task,
            is_current_runnable: false,
            runnability_blocked_reason: RUNN_BLOCKED_SKILL_GAP,
          };
        }
        return task;
      }),
    );
  }

  private async workerMeetsRequiredSkills(
    workerId: string,
    reqs: Array<{ skillCode: string; minimumProficiency: number }>,
    now: Date,
  ): Promise<boolean> {
    if (!reqs.length) return true;
    const skills = await this.prisma.workerSkill.findMany({ where: { workerId } });
    for (const r of reqs) {
      const s = skills.find((x) => x.skillCode === r.skillCode);
      if (!s || s.proficiency < r.minimumProficiency) return false;
      if (s.certifiedUntil != null && s.certifiedUntil < now) return false;
    }
    return true;
  }

  private async workerMeetsRequiredSkillsTx(
    tx: Prisma.TransactionClient,
    workerId: string,
    reqs: Array<{ skillCode: string; minimumProficiency: number }>,
    now: Date,
  ): Promise<boolean> {
    if (!reqs.length) return true;
    const skills = await tx.workerSkill.findMany({ where: { workerId } });
    for (const r of reqs) {
      const s = skills.find((x) => x.skillCode === r.skillCode);
      if (!s || s.proficiency < r.minimumProficiency) return false;
      if (s.certifiedUntil != null && s.certifiedUntil < now) return false;
    }
    return true;
  }

  private rejectNotRunnable(reason: string): never {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'FORBIDDEN_NOT_RUNNABLE_STEP',
      reason,
    });
  }

  private async assertFrontierOnlyTx(
    tx: Prisma.TransactionClient,
    task: {
      id: string;
      workflowInstanceId: string;
      workflowInstance: { referenceType: string };
    },
  ) {
    const wfAll = await tx.warehouseTask.findMany({
      where: { workflowInstanceId: task.workflowInstanceId },
      select: { id: true, taskType: true, status: true, workflowInstanceId: true },
    });
    if (!computeRunnableTaskIds(wfAll, task.workflowInstance.referenceType).has(task.id)) {
      this.rejectNotRunnable(RUNN_BLOCKED_NOT_ON_FRONT);
    }
  }

  private async assertFrontierAndSkillsTx(
    tx: Prisma.TransactionClient,
    task: {
      id: string;
      workflowInstanceId: string;
      workflowInstance: { referenceType: string };
      requiredSkills?: Array<{ skillCode: string; minimumProficiency: number }>;
    },
    assignmentWorkerIds: string[],
    now = new Date(),
  ) {
    await this.assertFrontierOnlyTx(tx, task);
    const reqs = task.requiredSkills ?? [];
    if (!reqs.length) return;
    const wid = assignmentWorkerIds[0];
    if (!wid) this.rejectNotRunnable(RUNN_BLOCKED_ASSIGNMENT_REQUIRED);
    const ok = await this.workerMeetsRequiredSkillsTx(tx, wid!, reqs, now);
    if (!ok) this.rejectNotRunnable(RUNN_BLOCKED_SKILL_GAP);
  }

  private async appendEvent(
    tx: Prisma.TransactionClient,
    taskId: string,
    event: string,
    actorId: string | undefined,
    payload?: unknown,
  ) {
    await tx.taskEvent.create({
      data: {
        taskId,
        event,
        actorId: actorId ?? null,
        payload: payload !== undefined ? (payload as object as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  private parseExecState(raw: unknown): ExecState {
    if (!isRecord(raw)) return { reservations: [] };
    const r = raw.reservations;
    if (!Array.isArray(r)) return { reservations: [] };
    return { reservations: r as ReservationSnapshot[] };
  }

  /**
   * Deterministically resolve which completed pick task's reservation snapshot a dispatch should ship.
   *
   * Preferred (safe) path:
   * - dispatch task payload includes pick_task_id → bind directly to that pick snapshot.
   *
   * Legacy fallback (still deterministic):
   * - if pick_task_id is missing, only allow dispatch when exactly one completed pick
   *   in the workflow has a non-empty executionState.reservations snapshot.
   * - otherwise throw to avoid "latest completed pick sibling" ambiguity.
   */
  private async resolvePickTaskForDispatchCompletion(
    tx: Prisma.TransactionClient,
    args: { workflowInstanceId: string; explicitPickTaskId?: string },
  ): Promise<{ id: string; executionState: unknown }> {
    const { workflowInstanceId, explicitPickTaskId } = args;

    if (explicitPickTaskId) {
      const pick = await tx.warehouseTask.findFirst({
        where: {
          id: explicitPickTaskId,
          workflowInstanceId,
          taskType: WarehouseTaskType.pick,
          status: WarehouseTaskStatus.completed,
        },
        select: { id: true, executionState: true },
      });

      if (!pick) {
        throw new BadRequestException(
          'Dispatch pick binding invalid: referenced pick task not found in this workflow.',
        );
      }

      const pickExec = this.parseExecState(pick.executionState);
      if (!pickExec.reservations.length) {
        throw new BadRequestException('Dispatch bound pick has no reservation snapshot.');
      }
      return pick;
    }

    const completedPicks = await tx.warehouseTask.findMany({
      where: {
        workflowInstanceId,
        taskType: WarehouseTaskType.pick,
        status: WarehouseTaskStatus.completed,
      },
      select: { id: true, executionState: true },
    });

    const withReservations = completedPicks.filter(
      (p) => this.parseExecState(p.executionState).reservations.length > 0,
    );

    if (withReservations.length === 1) return withReservations[0];
    if (withReservations.length === 0) {
      throw new BadRequestException('No completed pick reservation snapshot found for dispatch.');
    }
    throw new BadRequestException(
      'Cannot complete dispatch: multiple completed picks with reservation snapshots found; dispatch payload must include pick_task_id.',
    );
  }

  /**
   * Release reservation snapshots held on a single task and clear executionState so
   * subsequent failure/cancel paths cannot double-release the same slices.
   */
  private async releaseTaskHeldReservations(
    tx: Prisma.TransactionClient,
    taskId: string,
    executionState: unknown,
  ): Promise<boolean> {
    const exec = this.parseExecState(executionState);
    if (exec.reservations.length === 0) return false;
    await this.effects.releaseReservations(tx, exec.reservations);
    await tx.warehouseTask.update({
      where: { id: taskId },
      data: { executionState: Prisma.DbNull },
    });
    return true;
  }

  /**
   * Release active pick reservations for an outbound workflow instance.
   * Used when shipping is abandoned (dispatch cancel, cancel_remaining, etc.).
   */
  private async releaseOutboundPickReservationsInWorkflow(
    tx: Prisma.TransactionClient,
    workflowInstanceId: string,
    opts?: { excludeTaskId?: string },
  ): Promise<number> {
    const picks = await tx.warehouseTask.findMany({
      where: {
        workflowInstanceId,
        taskType: WarehouseTaskType.pick,
        ...(opts?.excludeTaskId ? { id: { not: opts.excludeTaskId } } : {}),
      },
      select: { id: true, executionState: true },
    });
    let releasedTasks = 0;
    for (const pick of picks) {
      const released = await this.releaseTaskHeldReservations(tx, pick.id, pick.executionState);
      if (released) releasedTasks += 1;
    }
    return releasedTasks;
  }

  /** Decide whether cancelling a task should release held pick reservations. */
  private async releaseReservationsOnTaskCancel(
    tx: Prisma.TransactionClient,
    task: {
      id: string;
      taskType: WarehouseTaskType;
      workflowInstanceId: string;
      executionState: unknown;
      workflowInstance: { referenceType: string };
    },
  ): Promise<boolean> {
    let released = false;

    if (task.taskType === WarehouseTaskType.pick) {
      released = (await this.releaseTaskHeldReservations(tx, task.id, task.executionState)) || released;
    }

    if (
      task.workflowInstance.referenceType === 'outbound_order' &&
      task.taskType === WarehouseTaskType.dispatch
    ) {
      const n = await this.releaseOutboundPickReservationsInWorkflow(tx, task.workflowInstanceId);
      released = released || n > 0;
    }

    return released;
  }

  private async lockTask(tx: Prisma.TransactionClient, taskId: string) {
    await tx.$executeRaw(Prisma.sql`SELECT id FROM warehouse_tasks WHERE id = ${taskId}::uuid FOR UPDATE`);
  }

  private async lockWorkflowInstance(tx: Prisma.TransactionClient, workflowInstanceId: string) {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM workflow_instances WHERE id = ${workflowInstanceId}::uuid FOR UPDATE`,
    );
  }

  /** Serialize all pick tasks in a workflow (prevents concurrent reservation on sibling picks). */
  private async lockWorkflowPickTasks(tx: Prisma.TransactionClient, workflowInstanceId: string) {
    await tx.$executeRaw(
      Prisma.sql`
        SELECT id FROM warehouse_tasks
         WHERE workflow_instance_id = ${workflowInstanceId}::uuid
           AND task_type = 'pick'
         FOR UPDATE
      `,
    );
  }

  private async lockOutboundOrder(tx: Prisma.TransactionClient, outboundOrderId: string) {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM outbound_orders WHERE id = ${outboundOrderId}::uuid FOR UPDATE`,
    );
  }

  /**
   * Only one pick task may hold active reservations per workflow at a time.
   * Called after pick-task rows are locked so concurrent starts serialize.
   */
  private async assertExclusiveActivePickInWorkflow(
    tx: Prisma.TransactionClient,
    workflowInstanceId: string,
    currentTaskId: string,
  ): Promise<void> {
    const other = await tx.warehouseTask.findFirst({
      where: {
        workflowInstanceId,
        taskType: WarehouseTaskType.pick,
        status: WarehouseTaskStatus.in_progress,
        id: { not: currentTaskId },
      },
      select: { id: true },
    });
    if (other) {
      throw new ConflictException(
        'Another pick task is already in progress for this workflow. Finish or cancel it before starting a new pick.',
      );
    }
  }

  /** HTTP pre-check for `WorkflowExecutionGateGuard` (DAG frontier + skills); mutation paths re-assert under row lock. */
  async ensureRunnableForExecutionGate(taskId: string, user: AuthPrincipal): Promise<void> {
    const task = await this.prisma.warehouseTask.findUnique({
      where: { id: taskId },
      include: {
        workflowInstance: true,
        requiredSkills: true,
        assignments: { where: { unassignedAt: null }, take: 1 },
      },
    });
    if (!task) throw new NotFoundException('Task not found.');
    this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
    await this.assertOperatorAssignedToTask(user, task);

    const wfAll = await this.prisma.warehouseTask.findMany({
      where: { workflowInstanceId: task.workflowInstanceId },
      select: { id: true, taskType: true, status: true, workflowInstanceId: true },
    });
    if (!computeRunnableTaskIds(wfAll, task.workflowInstance.referenceType).has(task.id)) {
      this.rejectNotRunnable(RUNN_BLOCKED_NOT_ON_FRONT);
    }

    const reqs = task.requiredSkills ?? [];
    if (!reqs.length) return;
    const wid = task.assignments[0]?.workerId;
    if (!wid) this.rejectNotRunnable(RUNN_BLOCKED_ASSIGNMENT_REQUIRED);
    const ok = await this.workerMeetsRequiredSkills(wid!, reqs, new Date());
    if (!ok) this.rejectNotRunnable(RUNN_BLOCKED_SKILL_GAP);
  }

  private async bumpStatus(
    tx: Prisma.TransactionClient,
    taskId: string,
    fromLock: number,
    next: WarehouseTaskStatus,
    data: Omit<Prisma.WarehouseTaskUncheckedUpdateManyInput, 'status' | 'lockVersion'> = {},
  ) {
    const res = await tx.warehouseTask.updateMany({
      where: { id: taskId, lockVersion: fromLock },
      data: {
        status: next,
        lockVersion: { increment: 1 },
        ...data,
      },
    });
    if (res.count === 0) {
      throw new ConflictException('Task was modified concurrently; retry.');
    }
  }

  async assign(taskId: string, user: AuthPrincipal, workerId: string) {
    const wid = typeof workerId === 'string' ? workerId.trim() : '';
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(wid)) {
      throw new BadRequestException(
        'workerId must be a full UUID. Choose a worker from the list instead of a short preview.',
      );
    }
    await this.ensureWorker(wid, user);
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      if (!task) throw new NotFoundException('Task not found.');
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      await tx.taskAssignment.updateMany({
        where: { taskId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      await tx.taskAssignment.create({
        data: { taskId, workerId: wid, assignedById: user.id },
      });
      if (task.status === WarehouseTaskStatus.pending) {
        await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.assigned);
      }
      await this.appendEvent(tx, taskId, 'assigned', user.id, { workerId: wid });
    });
    await this.cacheInv.afterTaskMutation();
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  async unassign(taskId: string, user: AuthPrincipal) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      if (!task) throw new NotFoundException('Task not found.');
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      await tx.taskAssignment.updateMany({
        where: { taskId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      if (task.status === WarehouseTaskStatus.assigned) {
        await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.pending);
      }
      await this.appendEvent(tx, taskId, 'unassigned', user.id);
    });
    await this.cacheInv.afterTaskMutation();
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  async start(taskId: string, user: AuthPrincipal, workerId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: {
          assignments: {
            where: { unassignedAt: null },
            take: 1,
          },
          workflowInstance: true,
          requiredSkills: true,
        },
      });
      if (!task) throw new NotFoundException('Task not found.');

      const activeWorker = workerId ?? task.assignments[0]?.workerId;
      if (!activeWorker) throw new BadRequestException('Assign a worker before starting.');

      await this.assertFrontierAndSkillsTx(tx, task, workerId ? [workerId] : [activeWorker]);

      // Persist the executing worker as the active assignment so the tasks list and
      // audit trail show who performed the task (start with a worker == implicit assign).
      if (workerId && task.assignments[0]?.workerId !== workerId) {
        await this.ensureWorker(workerId, user);
        await tx.taskAssignment.updateMany({
          where: { taskId, unassignedAt: null },
          data: { unassignedAt: new Date() },
        });
        await tx.taskAssignment.create({
          data: { taskId, workerId, assignedById: user.id },
        });
      }

      if (task.status === WarehouseTaskStatus.pending) {
        await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.in_progress, {
          startedAt: new Date(),
        });
      } else if (task.status === WarehouseTaskStatus.assigned) {
        await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.in_progress, {
          startedAt: new Date(),
        });
      } else if (task.status !== WarehouseTaskStatus.in_progress) {
        throw new BadRequestException(`Cannot start from status ${task.status}.`);
      }

      if (task.taskType === 'pick') {
        await this.lockWorkflowInstance(tx, task.workflowInstanceId);
        await this.lockWorkflowPickTasks(tx, task.workflowInstanceId);
        await this.assertExclusiveActivePickInWorkflow(tx, task.workflowInstanceId, taskId);

        const wf = await tx.workflowInstance.findUniqueOrThrow({
          where: { id: task.workflowInstanceId },
        });
        // GAP: if a pick task is reopened (failed → pending) without clearing
        // `executionState.reservations`, a subsequent `start()` would reserve stock
        // again on top of the old reserved quantity.
        //
        // Safeguard: when starting a pick task, release any existing reservations
        // encoded in `executionState` before creating the new reservation set.
        const existingExec = this.parseExecState(task.executionState);
        if (existingExec.reservations.length > 0) {
          await this.releaseTaskHeldReservations(tx, taskId, task.executionState);
        }

        const parsed = parsePickPayload(task.payload as unknown);
        await this.lockOutboundOrder(tx, parsed.outbound_order_id);
        const linesDb = await tx.outboundOrderLine.findMany({
          where: {
            outboundOrderId: parsed.outbound_order_id,
            id: { in: parsed.lines.map((l) => l.outbound_order_line_id) },
          },
        });
        const lines = parsed.lines.map((l) => {
          const ol = linesDb.find((x) => x.id === l.outbound_order_line_id);
          if (!ol) throw new BadRequestException(`Missing outbound line ${l.outbound_order_line_id}`);
          return {
            outboundOrderLineId: l.outbound_order_line_id,
            productId: ol.productId,
            requestedQty: new Prisma.Decimal(l.requested_qty),
            specificLotId: ol.specificLotId,
          };
        });
        const reservations = await this.effects.buildPickReservations(
          tx,
          wf.companyId,
          wf.warehouseId,
          lines,
        );
        await tx.warehouseTask.update({
          where: { id: taskId },
          data: {
            executionState: { reservations } as object as Prisma.InputJsonValue,
          },
        });
      }
      await this.appendEvent(tx, taskId, 'started', user.id, { workerId: activeWorker });
      const started = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'TASK_STARTED',
          resourceType: 'warehouse_task',
          resourceId: taskId,
          companyId: started.workflowInstance.companyId,
          previousState: { status: task.status },
          newState: {
            status: WarehouseTaskStatus.in_progress,
            taskType: task.taskType,
            workerId: activeWorker,
          },
        }),
      );
    });
    await this.cacheInv.afterTaskAndStockMutation();
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  async complete(taskId: string, user: AuthPrincipal, bodyRaw: unknown) {
    const parsed = safeParseTaskComplete(bodyRaw);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'TASK_EXECUTION_VALIDATION',
        issues: parsed.issues,
      });
    }
    if (parsed.request.task_id && parsed.request.task_id !== taskId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'TASK_EXECUTION_VALIDATION',
        message: 'task_id must match route id',
      });
    }
    const body = parsed.body as TaskCompleteBody;

    let inboundCompleted: OrderNotificationTarget | undefined;
    let outboundCompleted: OrderNotificationTarget | undefined;
    // Idempotency for pick completion:
    // - if a websocket/client replay sends the same "pick complete" again after the first success,
    //   we should not re-run side effects or emit duplicate completion signals.
    let idempotentPickNoop = false;
    let idempotentDispatchNoop = false;
    let billingCompanyId: string | null = null;
    let billingTaskType: WarehouseTaskType | null = null;

    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: {
          workflowInstance: true,
          requiredSkills: true,
          assignments: { where: { unassignedAt: null }, take: 1 },
        },
      });
      if (!task) throw new NotFoundException('Task not found.');
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      if (task.taskType !== body.task_type) {
        throw new BadRequestException('task_type does not match target task.');
      }
      if (task.status !== WarehouseTaskStatus.in_progress) {
        // Allow repeated pick completion requests to be idempotent after the task is already completed.
        if (
          task.taskType === 'pick' &&
          body.task_type === 'pick' &&
          task.status === WarehouseTaskStatus.completed
        ) {
          idempotentPickNoop = true;
          return;
        }
        if (
          task.taskType === WarehouseTaskType.dispatch &&
          body.task_type === 'dispatch' &&
          task.status === WarehouseTaskStatus.completed
        ) {
          idempotentDispatchNoop = true;
          return;
        }
        throw new BadRequestException('Task must be in_progress to complete.');
      }

      const assignmentIds = task.assignments.map((a) => a.workerId);
      await this.assertFrontierAndSkillsTx(tx, task, assignmentIds);

      const exec = this.parseExecState(task.executionState);
      const companyId = task.workflowInstance.companyId;
      billingCompanyId = companyId;
      billingTaskType = body.task_type;

      switch (body.task_type) {
        case 'receiving': {
          const inboundId = receivingOrderId(task.payload as unknown);
          const stagingMap = stagingMapFromReceivingPayload(task.payload as unknown);
          await this.effects.applyReceivingStaging(
            tx,
            user.id,
            taskId,
            inboundId,
            companyId,
            body,
            stagingMap,
          );
          break;
        }
        case 'putaway': {
          const put = task.payload as unknown as InboundPutawayPayload;
          const srcMap = sourceMapFromPutawayPayload(put);
          await this.effects.applyPutaway(
            tx,
            user.id,
            taskId,
            put.inbound_order_id,
            companyId,
            body,
            srcMap,
          );
          break;
        }
        case 'putaway_quarantine': {
          const put = task.payload as unknown as InboundPutawayPayload;
          const srcMap = sourceMapFromPutawayPayload(put);
          await this.effects.applyPutaway(
            tx,
            user.id,
            taskId,
            put.inbound_order_id,
            companyId,
            body,
            srcMap,
            { quarantineBinsOnly: true },
          );
          break;
        }
        case 'qc': {
          const pl = task.payload as unknown as InboundQcTaskPayload;
          await this.effects.applyQcLines(tx, pl.inbound_order_id, body);
          break;
        }
        case 'pick': {
          const po = parsePickPayload(task.payload as unknown);
          await this.effects.applyPickRecord(tx, po.outbound_order_id, exec.reservations, body);
          break;
        }
        case 'pack': {
          const outboundId = outboundIdFromPackPayload(task.payload as unknown);
          await this.effects.applyPackRecord(tx, outboundId, body);
          break;
        }
        case 'dispatch': {
          const { outbound_order_id: outboundId, pick_task_id: explicitPickTaskId } =
            parseDispatchTaskPayloadAllowLegacy(task.payload);
          await this.lockWorkflowInstance(tx, task.workflowInstanceId);
          await this.lockWorkflowPickTasks(tx, task.workflowInstanceId);
          await this.lockOutboundOrder(tx, outboundId);

          const boundPick = await this.resolvePickTaskForDispatchCompletion(tx, {
            workflowInstanceId: task.workflowInstanceId,
            explicitPickTaskId,
          });

          const pickExec = this.parseExecState(boundPick.executionState);
          if (!pickExec.reservations.length) {
            // Should never happen if resolvePickTaskForDispatchCompletion returns a completed pick
            // with a valid reservation snapshot.
            throw new BadRequestException('No pick reservations found for dispatch.');
          }
          outboundCompleted = await this.effects.applyDispatchShip(
            tx,
            user.id,
            taskId,
            outboundId,
            companyId,
            pickExec.reservations,
            body,
          );
          // Prevent stale pick snapshots from being re-released after successful ship.
          if (boundPick) {
            await tx.warehouseTask.update({
              where: { id: boundPick.id },
              data: { executionState: Prisma.DbNull },
            });
          }
          break;
        }
        case 'routing':
          throw new BadRequestException('routing task type is not implemented in this release.');
        default:
          break;
      }

      const clearExec = body.task_type !== 'pick';
      await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.completed, {
        completedAt: new Date(),
        completedById: user.id,
        ...(clearExec ? { executionState: Prisma.DbNull } : {}),
      });
      await this.appendEvent(tx, taskId, 'completed', user.id, { task_type: task.taskType });

      const finalized = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      const hooks = await this.orchestration.onTaskCompleted(tx, finalized, body, user.id);
      inboundCompleted = hooks.inboundCompleted;

      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'TASK_COMPLETED',
          resourceType: 'warehouse_task',
          resourceId: taskId,
          companyId: finalized.workflowInstance.companyId,
          previousState: {
            status: task.status,
            taskType: task.taskType,
            workflowInstanceId: task.workflowInstanceId,
          },
          newState: {
            status: WarehouseTaskStatus.completed,
            taskType: body.task_type,
            completedById: user.id,
          },
        }),
      );
      if (body.task_type === 'receiving') {
        const inboundId = receivingOrderId(task.payload as unknown);
        await this.audit.logTx(
          tx,
          this.audit.fromPrincipal(user, {
            action: 'INBOUND_RECEIVED',
            resourceType: 'inbound_order',
            resourceId: inboundId,
            companyId: finalized.workflowInstance.companyId,
            newState: {
              receivingTaskId: taskId,
              taskType: body.task_type,
            },
          }),
        );
      }
      if (body.task_type === 'dispatch') {
        const dispatchPayload = parseDispatchTaskPayloadAllowLegacy(task.payload);
        await this.audit.logTx(
          tx,
          this.audit.fromPrincipal(user, {
            action: 'SHIPMENT_DISPATCHED',
            resourceType: 'outbound_order',
            resourceId: dispatchPayload.outbound_order_id,
            companyId: finalized.workflowInstance.companyId,
            previousState: { status: 'ready_to_ship' },
            newState: {
              status: 'shipped',
              dispatchTaskId: taskId,
            },
          }),
        );
      }
      if (['pick', 'putaway', 'putaway_quarantine', 'dispatch'].includes(body.task_type)) {
        await this.audit.logTx(
          tx,
          this.audit.fromPrincipal(user, {
            action: 'INVENTORY_MUTATION_APPLIED',
            resourceType: 'warehouse_task',
            resourceId: taskId,
            companyId: finalized.workflowInstance.companyId,
            newState: {
              taskType: body.task_type,
              inventoryMutation: true,
            },
          }),
        );
      }

      await this.refreshWorkflowInstanceHealth(tx, finalized.workflowInstanceId);
    });

    if (!idempotentPickNoop && !idempotentDispatchNoop) {
      if (inboundCompleted) {
        await this.notifications.notifyClientOrderCompleted({
          companyId: inboundCompleted.companyId,
          orderType: 'inbound',
          orderId: inboundCompleted.orderId,
          orderNumber: inboundCompleted.orderNumber,
        });
      }
      if (outboundCompleted) {
        await this.notifications.notifyClientOrderCompleted({
          companyId: outboundCompleted.companyId,
          orderType: 'outbound',
          orderId: outboundCompleted.orderId,
          orderNumber: outboundCompleted.orderNumber,
        });
      }

      await this.cacheInv.afterTaskAndStockMutation();
      void this.realtime.emitTaskUpdatedByTaskId(taskId, { inventorySource: 'task_complete' });

      if (billingCompanyId && billingTaskType) {
        const trigger = billingTriggerForWarehouseTask({
          taskType: billingTaskType,
          inboundCompleted: !!inboundCompleted,
          outboundCompleted: !!outboundCompleted,
        });
        if (trigger) {
          void this.billingInvoiceCalc.recalculateForCompany(billingCompanyId, trigger);
        }
      }
    }

    return this.loadTaskEnvelope(taskId, user);
  }

  async cancel(taskId: string, user: AuthPrincipal, reason?: string) {
    let stockMutated = false;
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      if (!canTransitionTask(task.status, WarehouseTaskStatus.cancelled)) {
        throw new BadRequestException(`Cannot cancel from ${task.status}.`);
      }
      stockMutated = await this.releaseReservationsOnTaskCancel(tx, task);
      await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.cancelled, {
        failureReason: reason ?? null,
        executionState: Prisma.DbNull,
      });
      await this.appendEvent(tx, taskId, 'cancelled', user.id, { reason });
      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'TASK_CANCELLED',
          resourceType: 'warehouse_task',
          resourceId: taskId,
          companyId: task.workflowInstance.companyId,
          previousState: { status: task.status },
          newState: { status: WarehouseTaskStatus.cancelled, reason: reason ?? null },
        }),
      );
      await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
    });
    if (stockMutated) {
      await this.cacheInv.afterTaskAndStockMutation();
    } else {
      await this.cacheInv.afterTaskMutation();
    }
    void this.realtime.emitTaskUpdatedByTaskId(taskId, { inventorySource: 'task_cancel' });
    return this.loadTaskEnvelope(taskId, user);
  }

  /** Mark a task failed and release any held pick reservations (execution error / pick fail). */
  async fail(taskId: string, user: AuthPrincipal, reason?: string) {
    let stockMutated = false;
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      if (!canTransitionTask(task.status, WarehouseTaskStatus.failed)) {
        throw new BadRequestException(`Cannot fail from ${task.status}.`);
      }
      if (task.taskType === WarehouseTaskType.pick) {
        stockMutated = await this.releaseTaskHeldReservations(tx, task.id, task.executionState);
      }
      await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.failed, {
        failureReason: reason ?? null,
        executionState: Prisma.DbNull,
      });
      await this.appendEvent(tx, taskId, 'failed', user.id, { reason });
      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'TASK_FAILED',
          resourceType: 'warehouse_task',
          resourceId: taskId,
          companyId: task.workflowInstance.companyId,
          previousState: { status: task.status },
          newState: { status: WarehouseTaskStatus.failed, reason: reason ?? null },
        }),
      );
      await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
    });
    if (stockMutated) {
      await this.cacheInv.afterTaskAndStockMutation();
    } else {
      await this.cacheInv.afterTaskMutation();
    }
    void this.realtime.emitTaskUpdatedByTaskId(taskId, { inventorySource: 'task_fail' });
    return this.loadTaskEnvelope(taskId, user);
  }

  async skipTask(
    taskId: string,
    user: AuthPrincipal,
    body: { skip_target: 'qc' | 'pack'; reason: string },
  ) {
    if (!['super_admin', 'wh_manager'].includes(user.role)) {
      throw new ForbiddenException('Only warehouse managers may skip workflow steps.');
    }
    const reason = (body.reason ?? '').trim();
    if (reason.length < 4) {
      throw new BadRequestException('reason is required (min 4 characters).');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });

      await this.assertFrontierOnlyTx(tx, task);

      if (body.skip_target === 'qc') {
        if (task.taskType !== WarehouseTaskType.qc) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'SKIP_NOT_ALLOWED_FOR_TYPE',
            message: `skip_target qc does not apply to task type ${task.taskType}.`,
            skip_target: body.skip_target,
            task_type: task.taskType,
          });
        }
        if (task.status !== WarehouseTaskStatus.pending && task.status !== WarehouseTaskStatus.assigned) {
          throw new BadRequestException('QC can only be skipped before work starts.');
        }
        await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.cancelled, {
          failureReason: reason,
        });
        await this.appendEvent(tx, taskId, 'qc_skipped', user.id, { reason });
        await this.orchestration.spawnPutawayFromFullReceive(tx, task.workflowInstance);
        return;
      }

      if (body.skip_target === 'pack') {
        if (task.taskType !== WarehouseTaskType.pack) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'SKIP_NOT_ALLOWED_FOR_TYPE',
            message: `skip_target pack does not apply to task type ${task.taskType}.`,
            skip_target: body.skip_target,
            task_type: task.taskType,
          });
        }
        if (task.status !== WarehouseTaskStatus.pending && task.status !== WarehouseTaskStatus.assigned) {
          throw new BadRequestException('Pack can only be skipped before work starts.');
        }
        if (task.workflowInstance.referenceType !== 'outbound_order') {
          throw new BadRequestException('Pack skip is only valid for outbound workflows.');
        }
        await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.cancelled, {
          failureReason: reason,
        });
        await this.appendEvent(tx, taskId, 'pack_skipped', user.id, { reason });
        await this.orchestration.enqueueDispatchTaskIfNeeded(
          tx,
          task.workflowInstance.id,
          task.workflowInstance.referenceId,
        );
        await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
        return;
      }

      throw new BadRequestException('Unsupported skip_target.');
    });

    await this.cacheInv.afterTaskMutation();
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  /** Merge JSON into `execution_state` while task is in progress (partial putaway progress, scan steps, …). */
  async patchProgress(
    taskId: string,
    user: AuthPrincipal,
    body: {
      execution_state_patch: Record<string, unknown>;
      task_id?: string;
      schema_version?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const progParsed = taskProgressRequestSchema.safeParse({
      execution_state_patch: body.execution_state_patch,
      task_id: body.task_id,
      schema_version: body.schema_version,
      metadata: body.metadata,
    });
    if (!progParsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'TASK_PROGRESS_VALIDATION',
        issues: progParsed.error.issues,
      });
    }
    const patch = progParsed.data.execution_state_patch;
    if (progParsed.data.task_id && progParsed.data.task_id !== taskId) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'TASK_PROGRESS_VALIDATION',
        message: 'task_id must match route id',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: {
          workflowInstance: true,
          requiredSkills: true,
          assignments: { where: { unassignedAt: null }, take: 1 },
        },
      });
      if (!task) throw new NotFoundException('Task not found.');
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      if (task.status !== WarehouseTaskStatus.in_progress) {
        throw new BadRequestException('progress updates require task status in_progress.');
      }
      const wids = task.assignments.map((a) => a.workerId);
      await this.assertFrontierAndSkillsTx(tx, task, wids);
      const cur =
        task.executionState && typeof task.executionState === 'object' && !Array.isArray(task.executionState)
          ? (task.executionState as Record<string, unknown>)
          : {};
      // Reservation snapshots are backend-owned and immutable for pick tasks.
      // Clients may report progress metadata, but must never mutate `reservations`.
      const patchForMerge =
        task.taskType === WarehouseTaskType.pick && Object.prototype.hasOwnProperty.call(patch, 'reservations')
          ? (({ reservations: _ignored, ...rest }) => rest)(patch)
          : patch;

      const next = { ...cur, ...patchForMerge };
      if (task.taskType === WarehouseTaskType.pick && Object.prototype.hasOwnProperty.call(cur, 'reservations')) {
        next.reservations = cur.reservations;
      }
      await tx.warehouseTask.update({
        where: { id: taskId },
        data: {
          executionState: next as object as Prisma.InputJsonValue,
        },
      });
      await this.appendEvent(tx, taskId, 'execution_progress', user.id, {
        keys: Object.keys(patchForMerge),
      });
    });
    await this.cacheInv.afterTaskMutation();
    return this.loadTaskEnvelope(taskId, user);
  }

  async leaseAcquire(taskId: string, user: AuthPrincipal, minutesRaw?: number) {
    const minutes = Math.min(Math.max(minutesRaw ?? 30, 5), 480);
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: {
          workflowInstance: true,
          requiredSkills: true,
          assignments: { where: { unassignedAt: null }, take: 1 },
        },
      });
      if (!task) throw new NotFoundException('Task not found.');
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      if (
        task.status !== WarehouseTaskStatus.pending &&
        task.status !== WarehouseTaskStatus.assigned &&
        task.status !== WarehouseTaskStatus.in_progress
      ) {
        throw new BadRequestException('Lease is only valid for open actionable tasks.');
      }
      await this.assertFrontierAndSkillsTx(tx, task, task.assignments.map((a) => a.workerId));
      const until = new Date(Date.now() + minutes * 60_000);
      await tx.warehouseTask.update({
        where: { id: taskId },
        data: { leaseExpiresAt: until },
      });
      await this.appendEvent(tx, taskId, 'lease_acquired', user.id, { leaseExpiresAt: until.toISOString() });
    });
    await this.cacheInv.afterTaskMutation();
    return this.loadTaskEnvelope(taskId, user);
  }

  async leaseRelease(taskId: string, user: AuthPrincipal) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      if (!task) throw new NotFoundException('Task not found.');
      this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);
      await tx.warehouseTask.update({
        where: { id: taskId },
        data: { leaseExpiresAt: null },
      });
      await this.appendEvent(tx, taskId, 'lease_released', user.id);
    });
    await this.cacheInv.afterTaskMutation();
    return this.loadTaskEnvelope(taskId, user);
  }

  async getPathOrder(taskId: string, user: AuthPrincipal) {
    const task = await this.fetchTaskAuthorized(taskId, user);
    const st =
      task.executionState && typeof task.executionState === 'object' && !Array.isArray(task.executionState)
        ? (task.executionState as Record<string, unknown>)
        : {};
    const explicit = st.pickPathOrderedIds;
    if (Array.isArray(explicit) && explicit.every((x) => typeof x === 'string')) {
      return { orderedIds: explicit as string[], source: 'pickPathOrderedIds' as const };
    }
    const reservations = st.reservations;
    if (Array.isArray(reservations)) {
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const raw of reservations) {
        const r =
          raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : null;
        const lidRaw = r?.locationId ?? r?.location_id;
        const lid = typeof lidRaw === 'string' ? lidRaw : '';
        if (lid && !seen.has(lid)) {
          seen.add(lid);
          ids.push(lid);
        }
      }
      return { orderedIds: ids, source: 'reservations' as const };
    }
    return { orderedIds: [], source: 'none' as const };
  }

  async reopen(taskId: string, user: AuthPrincipal) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUniqueOrThrow({ where: { id: taskId } });
      if (task.status !== WarehouseTaskStatus.failed) {
        throw new BadRequestException('Only failed tasks may be reopened.');
      }
      if (!canTransitionTask(task.status, WarehouseTaskStatus.pending)) {
        throw new BadRequestException('Invalid reopen.');
      }
      await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.pending, {
        failureReason: null,
      });
      await this.appendEvent(tx, taskId, 'reopened', user.id);
      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'TASK_REOPENED',
          resourceType: 'warehouse_task',
          resourceId: taskId,
          previousState: { status: task.status },
          newState: { status: WarehouseTaskStatus.pending },
        }),
      );
      await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
    });
    await this.cacheInv.afterTaskMutation();
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  /** Part III recovery: system/business stalled row → retry execution window. */
  async retry(taskId: string, user: AuthPrincipal, body?: { reason?: string }) {
    if (!['super_admin', 'wh_manager'].includes(user.role)) {
      throw new ForbiddenException('Only warehouse managers may retry retry_pending tasks.');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      if (task.status !== WarehouseTaskStatus.retry_pending) {
        throw new BadRequestException('retry is only valid when task status is retry_pending.');
      }
      if (!canTransitionTask(task.status, WarehouseTaskStatus.in_progress)) {
        throw new BadRequestException('Invalid retry transition.');
      }
      await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.in_progress, {
        failureReason: null,
      });
      await this.appendEvent(tx, taskId, 'retry_initiated', user.id, {
        reason: body?.reason?.trim() ?? null,
      });
      await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
    });
    await this.cacheInv.afterTaskMutation();
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  /** Part III recovery: human clears business block and resumes execution. */
  async resolveBlocked(taskId: string, user: AuthPrincipal, body: ResolveTaskDto) {
    if (!['super_admin', 'wh_manager'].includes(user.role)) {
      throw new ForbiddenException('Only warehouse managers may resolve blocked tasks.');
    }
    const reason = body.reason.trim();
    let stockMutated = false;

    await this.prisma.$transaction(async (tx) => {
      await this.lockTask(tx, taskId);
      const task = await tx.warehouseTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { workflowInstance: true },
      });
      if (task.status !== WarehouseTaskStatus.blocked) {
        throw new BadRequestException('resolve only applies to blocked tasks.');
      }

      const payloadBase = {
        resolution: body.resolution,
        reason,
        fork_hint: body.fork_hint,
      };

      switch (body.resolution) {
        case 'resume':
          if (!canTransitionTask(task.status, WarehouseTaskStatus.in_progress)) {
            throw new BadRequestException('Invalid resolve transition.');
          }
          await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.in_progress, {
            failureReason: null,
          });
          await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
          break;

        case 'approve_partial':
          if (!canTransitionTask(task.status, WarehouseTaskStatus.in_progress)) {
            throw new BadRequestException('Invalid resolve transition.');
          }
          await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.in_progress, {
            failureReason: null,
          });
          {
            const prior = (task.workflowInstance.metadata as Record<string, unknown> | null) ?? {};
            const meta = {
              ...prior,
              approve_partial_at: new Date().toISOString(),
              approve_partial_by: user.id,
              approve_partial_reason: reason,
            };
            await tx.workflowInstance.update({
              where: { id: task.workflowInstanceId },
              data: { metadata: meta as object },
            });
          }
          await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
          break;

        case 'cancel_remaining':
          if (!canTransitionTask(task.status, WarehouseTaskStatus.cancelled)) {
            throw new BadRequestException('Invalid cancel_remaining transition.');
          }
          await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.cancelled, {
            failureReason: reason.slice(0, 500),
          });
          await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
          await tx.warehouseTask.updateMany({
            where: {
              workflowInstanceId: task.workflowInstanceId,
              id: { not: taskId },
              status: { in: [WarehouseTaskStatus.pending, WarehouseTaskStatus.assigned] },
            },
            data: {
              status: WarehouseTaskStatus.cancelled,
              failureReason: `cancel_remaining: ${reason.slice(0, 300)}`,
            },
          });
          if (task.workflowInstance.referenceType === 'outbound_order') {
            const released = await this.releaseOutboundPickReservationsInWorkflow(
              tx,
              task.workflowInstanceId,
            );
            stockMutated = stockMutated || released > 0;
          }
          break;

        case 'fork_new_task':
          if (!canTransitionTask(task.status, WarehouseTaskStatus.in_progress)) {
            throw new BadRequestException('Invalid fork_new_task transition.');
          }
          await this.bumpStatus(tx, taskId, task.lockVersion, WarehouseTaskStatus.in_progress, {
            failureReason: null,
          });
          {
            const prior = (task.workflowInstance.metadata as Record<string, unknown> | null) ?? {};
            await tx.workflowInstance.update({
              where: { id: task.workflowInstanceId },
              data: {
                metadata: {
                  ...prior,
                  fork_remediation_at: new Date().toISOString(),
                  fork_remediation_by: user.id,
                  fork_remediation_hint: body.fork_hint ?? null,
                } as object,
              },
            });
          }
          await this.appendEvent(tx, taskId, 'compensation_resolve', user.id, payloadBase);
          break;

        default:
          throw new BadRequestException(`Unsupported resolution`);
      }

      await this.audit.logTx(
        tx,
        this.audit.fromPrincipal(user, {
          action: 'TASK_BLOCK_RESOLVED',
          resourceType: 'warehouse_task',
          resourceId: taskId,
          companyId: task.workflowInstance.companyId,
          previousState: { status: task.status },
          newState: { status: body.resolution, resolution: body.resolution, reason },
        }),
      );

      await this.refreshWorkflowInstanceHealth(tx, task.workflowInstanceId);
    });
    if (stockMutated) {
      await this.cacheInv.afterTaskAndStockMutation();
    } else {
      await this.cacheInv.afterTaskMutation();
    }
    void this.realtime.emitTaskUpdatedByTaskId(taskId);
    return this.loadTaskEnvelope(taskId, user);
  }

  private async refreshWorkflowInstanceHealth(tx: Prisma.TransactionClient, instanceId: string) {
    const wf = await tx.workflowInstance.findUnique({ where: { id: instanceId } });
    if (!wf || wf.status === WorkflowInstanceStatus.completed || wf.status === WorkflowInstanceStatus.cancelled) {
      return;
    }

    const tasks = await tx.warehouseTask.findMany({
      where: { workflowInstanceId: instanceId },
      select: {
        status: true,
        startedAt: true,
        slaMinutes: true,
      },
    });
    const now = Date.now();
    const bad = tasks.filter((t) => {
      if (
        t.status === WarehouseTaskStatus.blocked ||
        t.status === WarehouseTaskStatus.failed ||
        t.status === WarehouseTaskStatus.retry_pending
      ) {
        return true;
      }
      if (
        t.status === WarehouseTaskStatus.in_progress &&
        t.slaMinutes != null &&
        t.startedAt != null &&
        t.startedAt.getTime() + t.slaMinutes * 60_000 < now
      ) {
        return true;
      }
      return false;
    }).length;

    let next: WorkflowInstanceStatus = wf.status;
    if (bad > 0) {
      next = WorkflowInstanceStatus.degraded;
    } else if (wf.status === WorkflowInstanceStatus.degraded) {
      next = WorkflowInstanceStatus.in_progress;
    }

    if (next !== wf.status) {
      await tx.workflowInstance.update({
        where: { id: instanceId },
        data: { status: next },
      });
    }
  }

  private async ensureWorker(workerId: string, user: AuthPrincipal) {
    const w = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        user: { select: { companyId: true, role: true, status: true } },
      },
    });
    if (!w) {
      throw new BadRequestException(
        'Worker not found. Create a system user with Worker role on Users (with X-Company-Id set), then assign again.',
      );
    }
    if (
      !w.userId ||
      !w.user ||
      w.user.companyId != null ||
      w.user.role !== UserRole.wh_operator
    ) {
      throw new BadRequestException(
        'Only operators linked to a system Worker user (Users → system user, Worker role) can be assigned to tasks.',
      );
    }
    if (w.status !== WorkerOperationalStatus.active) {
      throw new BadRequestException('This operator profile is inactive.');
    }
    if (w.user.status !== UserStatus.active) {
      throw new BadRequestException('This user account is inactive.');
    }
  }

  private async loadTaskEnvelope(
    taskId: string,
    user: AuthPrincipal,
  ): Promise<TaskMutationResponseEnvelope> {
    const task = await this.fetchTaskAuthorized(taskId, user);
    const [enriched] = await this.withRunnableFlags([task]);
    const wf = await this.prisma.workflowInstance.findUnique({
      where: { id: task.workflowInstanceId },
    });

    let orderSummary:
      | { kind: 'inbound'; id: string; orderNumber: string; status: string }
      | { kind: 'outbound'; id: string; orderNumber: string; status: string }
      | undefined;

    if (wf?.referenceType === 'inbound_order') {
      const o = await this.prisma.inboundOrder.findUnique({
        where: { id: wf.referenceId },
        select: { id: true, orderNumber: true, status: true },
      });
      if (o) orderSummary = { kind: 'inbound', ...o };
    }
    if (wf?.referenceType === 'outbound_order') {
      const o = await this.prisma.outboundOrder.findUnique({
        where: { id: wf.referenceId },
        select: { id: true, orderNumber: true, status: true },
      });
      if (o) orderSummary = { kind: 'outbound', ...o };
    }

    const { assignments, workflowInstance: _wf, ...rest } = enriched;
    const taskForClient = { ...rest, assignments };
    return {
      task: taskForClient,
      workflowInstance: wf as Record<string, unknown> | null,
      assignments,
      orderSummary,
    };
  }
}

function parsePickPayload(raw: unknown): OutboundPickPayload {
  if (!isRecord(raw)) throw new BadRequestException('Invalid pick task payload.');
  const lines = raw.lines;
  if (!Array.isArray(lines)) throw new BadRequestException('pick payload missing lines.');
  return raw as unknown as OutboundPickPayload;
}

function receivingOrderId(raw: unknown): string {
  if (!isRecord(raw) || typeof raw.inbound_order_id !== 'string') {
    throw new BadRequestException('Invalid receiving task payload.');
  }
  return raw.inbound_order_id;
}

function stagingMapFromReceivingPayload(raw: unknown): Map<string, string> {
  if (!isRecord(raw) || !Array.isArray(raw.lines)) throw new BadRequestException('Receiving payload malformed.');
  const m = new Map<string, string>();
  for (const row of raw.lines) {
    if (
      row &&
      typeof row === 'object' &&
      typeof (row as { inbound_order_line_id?: unknown }).inbound_order_line_id === 'string' &&
      typeof (row as { staging_location_id?: unknown }).staging_location_id === 'string'
    ) {
      m.set(
        (row as { inbound_order_line_id: string }).inbound_order_line_id,
        (row as { staging_location_id: string }).staging_location_id,
      );
    }
  }
  return m;
}

function sourceMapFromPutawayPayload(put: InboundPutawayPayload) {
  const m = new Map<string, { locationId: string; productId: string; lotId: string | null }>();
  for (const row of put.lines) {
    m.set(row.inbound_order_line_id, {
      locationId: row.source_staging_location_id,
      productId: row.product_id,
      lotId: row.lot_id ?? null,
    });
  }
  return m;
}

function outboundIdFromPackPayload(raw: unknown) {
  if (!isRecord(raw) || typeof raw.outbound_order_id !== 'string') {
    throw new BadRequestException('pack payload malformed.');
  }
  return raw.outbound_order_id;
}

function parseDispatchTaskPayloadAllowLegacy(
  raw: unknown,
): { outbound_order_id: string; pick_task_id?: string; source_packing_location_id?: string } {
  if (!isRecord(raw) || typeof raw.outbound_order_id !== 'string') {
    throw new BadRequestException('dispatch task payload malformed.');
  }
  const pickTaskId = (raw as { pick_task_id?: unknown }).pick_task_id;
  if (pickTaskId !== undefined && typeof pickTaskId !== 'string') {
    throw new BadRequestException('dispatch task payload pick_task_id malformed.');
  }
  const sourcePackingLocationId = (raw as { source_packing_location_id?: unknown })
    .source_packing_location_id;
  if (sourcePackingLocationId !== undefined && typeof sourcePackingLocationId !== 'string') {
    throw new BadRequestException('dispatch task payload source_packing_location_id malformed.');
  }
  return {
    outbound_order_id: raw.outbound_order_id,
    pick_task_id: pickTaskId,
    source_packing_location_id: sourcePackingLocationId,
  };
}
