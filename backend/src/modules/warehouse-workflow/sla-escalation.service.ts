import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WarehouseTaskStatus, WorkflowInstanceStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const ESCALATION_COOLDOWN_MS = 60 * 60 * 1000;

@Injectable()
export class SlaEscalationService {
  private readonly log = new Logger(SlaEscalationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Periodic SLA breach notification — bumps `escalation_level` idempotently with cooldown between events. */
  @Cron('*/5 * * * *')
  async tick() {
    try {
      const candidates = await this.prisma.warehouseTask.findMany({
        where: {
          /** SLA clock starts when execution begins (`start`). */
          status: WarehouseTaskStatus.in_progress,
          slaMinutes: { not: null },
          startedAt: { not: null },
          escalationLevel: { lt: 20 },
        },
        select: { id: true, startedAt: true, slaMinutes: true, escalationLevel: true },
      });

      const now = Date.now();
      for (const t of candidates) {
        const slaMin = t.slaMinutes!;
        const started = t.startedAt!.getTime();
        const breachedAtTs = started + slaMin * 60_000;
        if (now <= breachedAtTs) continue;

        const lastEsc = await this.prisma.taskEvent.findFirst({
          where: { taskId: t.id, event: 'sla_escalation' },
          orderBy: { createdAt: 'desc' },
        });
        if (lastEsc && now - lastEsc.createdAt.getTime() < ESCALATION_COOLDOWN_MS) continue;

        await this.prisma.$transaction(async (tx) => {
          const locked = await tx.warehouseTask.findUnique({ where: { id: t.id } });
          if (!locked?.startedAt || locked.slaMinutes == null) return;
          const innerNow = Date.now();
          const breachDeadline = locked.startedAt.getTime() + locked.slaMinutes * 60_000;
          if (innerNow <= breachDeadline) return;

          const lastInner = await tx.taskEvent.findFirst({
            where: { taskId: t.id, event: 'sla_escalation' },
            orderBy: { createdAt: 'desc' },
          });
          if (lastInner && innerNow - lastInner.createdAt.getTime() < ESCALATION_COOLDOWN_MS)
            return;

          const next = locked.escalationLevel + 1;
          await tx.warehouseTask.update({
            where: { id: t.id },
            data: { escalationLevel: next },
          });
          await tx.taskEvent.create({
            data: {
              taskId: t.id,
              event: 'sla_escalation',
              payload: {
                escalationLevel: next,
                breachedAtTs: breachDeadline,
              } as object,
            },
          });

          /** Notification integrations (email/SMS) — stub until Phase 2 channels exist. */
          this.log.debug(`[sla_notify_stub] task=${t.id} escalation=${next}`);

          const wfTask = await tx.warehouseTask.findUnique({
            where: { id: t.id },
            select: { workflowInstanceId: true },
          });
          if (wfTask?.workflowInstanceId) {
            const inst = await tx.workflowInstance.findUnique({
              where: { id: wfTask.workflowInstanceId },
            });
            if (
              inst &&
              inst.status !== WorkflowInstanceStatus.completed &&
              inst.status !== WorkflowInstanceStatus.cancelled &&
              inst.status !== WorkflowInstanceStatus.degraded
            ) {
              await tx.workflowInstance.update({
                where: { id: inst.id },
                data: { status: WorkflowInstanceStatus.degraded },
              });
            }
          }
        });
      }
    } catch (e) {
      this.log.warn(`sla tick failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
