import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WarehouseTaskStatus, WorkflowInstanceStatus } from '@prisma/client';

import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaAuditService } from './sla-audit.service';
import {
  isTaskSlaBreached,
  SLA_ESCALATION_COOLDOWN_MS,
  slaBreachDeadlineMs,
  slaOverdueMinutes,
  slaTaskTypeLabel,
} from './sla-breach.util';

type EscalationOutcome = {
  taskId: string;
  companyId: string;
  workflowInstanceId: string;
  taskTypeLabel: string;
  escalationLevel: number;
  previousLevel: number;
  slaMinutes: number;
  breachedAt: Date;
  companyName: string;
  warehouseName: string;
};

@Injectable()
export class SlaEscalationService {
  private readonly log = new Logger(SlaEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLeader: CronLeaderService,
    private readonly notifications: NotificationsService,
    private readonly slaAudit: SlaAuditService,
  ) {}

  /** Periodic SLA breach monitoring — escalates overdue in-progress tasks and notifies managers. */
  @Cron('*/5 * * * *')
  async tick() {
    await this.cronLeader.runExclusive('sla-escalation', 360, () => this.runTick());
  }

  async runTick(): Promise<number> {
    let escalated = 0;
    try {
      const candidates = await this.prisma.warehouseTask.findMany({
        where: {
          status: WarehouseTaskStatus.in_progress,
          slaMinutes: { not: null },
          startedAt: { not: null },
          escalationLevel: { lt: 20 },
        },
        select: {
          id: true,
          startedAt: true,
          slaMinutes: true,
          escalationLevel: true,
          taskType: true,
          workflowInstanceId: true,
          workflowInstance: {
            select: {
              id: true,
              companyId: true,
              status: true,
              company: { select: { name: true } },
              warehouse: { select: { name: true, code: true } },
            },
          },
        },
      });

      const now = Date.now();
      for (const task of candidates) {
        if (!isTaskSlaBreached(task, now)) continue;

        const lastEsc = await this.prisma.taskEvent.findFirst({
          where: { taskId: task.id, event: 'sla_escalation' },
          orderBy: { createdAt: 'desc' },
        });
        if (lastEsc && now - lastEsc.createdAt.getTime() < SLA_ESCALATION_COOLDOWN_MS) continue;

        const outcome = await this.escalateTask(task.id);
        if (!outcome) continue;

        const notified = await this.notifications.notifyManagersSlaBreach({
          taskId: outcome.taskId,
          taskTypeLabel: outcome.taskTypeLabel,
          escalationLevel: outcome.escalationLevel,
          slaMinutes: outcome.slaMinutes,
          overdueMinutes: slaOverdueMinutes(task.startedAt!, task.slaMinutes!, now),
          companyName: outcome.companyName,
          warehouseName: outcome.warehouseName,
        });

        await this.slaAudit.escalated({
          companyId: outcome.companyId,
          taskId: outcome.taskId,
          previousLevel: outcome.previousLevel,
          escalationLevel: outcome.escalationLevel,
          slaMinutes: outcome.slaMinutes,
          breachedAt: outcome.breachedAt,
          notifiedManagers: notified,
          workflowInstanceId: outcome.workflowInstanceId,
        });

        if (notified > 0) {
          this.log.log(
            `SLA breach task=${outcome.taskId} level=${outcome.escalationLevel} notified=${notified} manager(s)`,
          );
        } else {
          this.log.warn(
            `SLA breach task=${outcome.taskId} level=${outcome.escalationLevel} — escalation recorded, no new manager notifications`,
          );
        }

        escalated += 1;
      }
    } catch (e) {
      this.log.warn(`sla tick failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return escalated;
  }

  private async escalateTask(taskId: string): Promise<EscalationOutcome | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.warehouseTask.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          startedAt: true,
          slaMinutes: true,
          escalationLevel: true,
          taskType: true,
          workflowInstanceId: true,
          workflowInstance: {
            select: {
              id: true,
              companyId: true,
              status: true,
              company: { select: { name: true } },
              warehouse: { select: { name: true, code: true } },
            },
          },
        },
      });
      if (!locked?.startedAt || locked.slaMinutes == null) return null;

      const innerNow = Date.now();
      if (!isTaskSlaBreached(locked, innerNow)) return null;

      const lastInner = await tx.taskEvent.findFirst({
        where: { taskId: locked.id, event: 'sla_escalation' },
        orderBy: { createdAt: 'desc' },
      });
      if (lastInner && innerNow - lastInner.createdAt.getTime() < SLA_ESCALATION_COOLDOWN_MS) {
        return null;
      }

      const previousLevel = locked.escalationLevel;
      const next = previousLevel + 1;
      const breachedAt = new Date(slaBreachDeadlineMs(locked.startedAt, locked.slaMinutes));

      await tx.warehouseTask.update({
        where: { id: locked.id },
        data: { escalationLevel: next },
      });
      await tx.taskEvent.create({
        data: {
          taskId: locked.id,
          event: 'sla_escalation',
          payload: {
            escalationLevel: next,
            breachedAtTs: breachedAt.getTime(),
            previousLevel,
          } as object,
        },
      });

      const wf = locked.workflowInstance;
      if (
        wf &&
        wf.status !== WorkflowInstanceStatus.completed &&
        wf.status !== WorkflowInstanceStatus.cancelled &&
        wf.status !== WorkflowInstanceStatus.degraded
      ) {
        await tx.workflowInstance.update({
          where: { id: wf.id },
          data: { status: WorkflowInstanceStatus.degraded },
        });
      }

      const warehouseName = wf?.warehouse.name ?? wf?.warehouse.code ?? 'Warehouse';
      const companyName = wf?.company.name ?? 'Client';

      return {
        taskId: locked.id,
        companyId: wf?.companyId ?? '',
        workflowInstanceId: locked.workflowInstanceId,
        taskTypeLabel: slaTaskTypeLabel(locked.taskType),
        escalationLevel: next,
        previousLevel,
        slaMinutes: locked.slaMinutes,
        breachedAt,
        companyName,
        warehouseName,
      };
    });
  }
}
