import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service';

export const SLA_AUDIT_ACTIONS = {
  TASK_ESCALATED: 'sla.task.escalated',
  TASK_BREACHED: 'sla.task.breached',
} as const;

@Injectable()
export class SlaAuditService {
  constructor(private readonly audit: AuditLogService) {}

  escalated(input: {
    companyId: string;
    taskId: string;
    previousLevel: number;
    escalationLevel: number;
    slaMinutes: number;
    breachedAt: Date;
    notifiedManagers: number;
    workflowInstanceId?: string | null;
  }): Promise<void> {
    return this.audit.logBestEffort({
      actorId: null,
      actorEmail: 'sla-monitor@system.local',
      actorName: 'SLA Monitor',
      actorRole: 'system',
      companyId: input.companyId,
      action: SLA_AUDIT_ACTIONS.TASK_ESCALATED,
      resourceType: 'warehouse_task',
      resourceId: input.taskId,
      previousState: {
        escalationLevel: input.previousLevel,
      },
      newState: {
        escalationLevel: input.escalationLevel,
        slaMinutes: input.slaMinutes,
        breachedAt: input.breachedAt.toISOString(),
        notifiedManagers: input.notifiedManagers,
        workflowInstanceId: input.workflowInstanceId ?? null,
      },
    });
  }
}
