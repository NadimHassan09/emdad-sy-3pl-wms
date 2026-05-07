import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { workflowRecoverRequestSchema } from '../../vendor/wms-task-execution/compensation';
import type { ReservationSnapshot } from './task-inventory-effects.service';
import { TaskInventoryEffectsService } from './task-inventory-effects.service';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function reservationRowsFromExec(raw: unknown): ReservationSnapshot[] {
  if (!isRecord(raw)) return [];
  const r = raw.reservations;
  return Array.isArray(r) ? (r as ReservationSnapshot[]) : [];
}

@Injectable()
export class WorkflowRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effects: TaskInventoryEffectsService,
    private readonly cacheInv: CacheInvalidationService,
  ) {}

  async recoverWorkflowInstance(instanceId: string, user: AuthPrincipal, rawBody: unknown) {
    if (!user.companyId) throw new BadRequestException('companyId required.');
    const parsed = workflowRecoverRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WORKFLOW_RECOVER_VALIDATION',
        issues: parsed.error.issues,
      });
    }
    const dryRun = parsed.data.dry_run ?? false;
    const wf = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!wf || wf.companyId !== user.companyId) throw new NotFoundException('Workflow instance not found.');
    if (!['super_admin', 'wh_manager'].includes(user.role)) {
      throw new ForbiddenException('Only warehouse managers may run workflow recovery.');
    }

    const preview: Array<{ code: string; task_id: string; effect: string }> = [];

    for (const action of parsed.data.actions) {
      switch (action.code) {
        case 'RELEASE_RESERVATIONS_OUTBOUND': {
          const task = await this.prisma.warehouseTask.findUnique({
            where: { id: action.task_id },
          });
          if (!task || task.workflowInstanceId !== instanceId) {
            throw new BadRequestException(`Invalid RELEASE task ${action.task_id} for workflow.`);
          }
          const rows = reservationRowsFromExec(task.executionState);
          preview.push({
            code: action.code,
            task_id: action.task_id,
            effect: rows.length === 0 ? 'no_reservations_snapshot' : `release_${rows.length}_rows`,
          });
          break;
        }
        case 'MARK_DAMAGED_QTY': {
          const task = await this.prisma.warehouseTask.findUnique({
            where: { id: action.task_id },
          });
          if (!task || task.workflowInstanceId !== instanceId) {
            throw new BadRequestException(`Invalid MARK_DAMAGED task ${action.task_id} for workflow.`);
          }
          preview.push({
            code: action.code,
            task_id: action.task_id,
            effect: dryRun ? 'dry_run_audit_only' : `audit_qty_${action.qty}`,
          });
          break;
        }
        default:
          break;
      }
    }

    if (dryRun) {
      return { dryRun: true, instanceId, preview };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const action of parsed.data.actions) {
        if (action.code === 'RELEASE_RESERVATIONS_OUTBOUND') {
          const task = await tx.warehouseTask.findUniqueOrThrow({ where: { id: action.task_id } });
          const rows = reservationRowsFromExec(task.executionState);
          if (rows.length > 0) {
            await this.effects.releaseReservations(tx, rows);
          }
          await tx.taskEvent.create({
            data: {
              taskId: action.task_id,
              event: 'compensation_recovery',
              actorId: user.id,
              payload: { code: action.code, reservations: rows.length } as never,
            },
          });
        }
        if (action.code === 'MARK_DAMAGED_QTY') {
          await tx.taskEvent.create({
            data: {
              taskId: action.task_id,
              event: 'compensation_recovery',
              actorId: user.id,
              payload: {
                code: action.code,
                inbound_order_line_id: action.inbound_order_line_id,
                qty: action.qty,
              } as never,
            },
          });
        }
      }
    });

    await this.cacheInv.afterTaskAndStockMutation();
    return { dryRun: false, instanceId, preview };
  }
}
