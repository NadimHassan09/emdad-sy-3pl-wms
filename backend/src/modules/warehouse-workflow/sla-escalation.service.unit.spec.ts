import { WarehouseTaskStatus, WarehouseTaskType, WorkflowInstanceStatus } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';
import { SlaAuditService } from './sla-audit.service';
import { SlaEscalationService } from './sla-escalation.service';
import { SLA_ESCALATION_COOLDOWN_MS } from './sla-breach.util';

function buildService(deps: {
  prisma: object;
  cronLeader?: { runExclusive: jest.Mock };
  notifications?: { notifyManagersSlaBreach: jest.Mock };
  slaAudit?: { escalated: jest.Mock };
}) {
  const cronLeader = deps.cronLeader ?? {
    runExclusive: jest.fn((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  };
  const notifications = deps.notifications ?? {
    notifyManagersSlaBreach: jest.fn().mockResolvedValue(2),
  };
  const slaAudit = deps.slaAudit ?? {
    escalated: jest.fn().mockResolvedValue(undefined),
  };

  return new SlaEscalationService(
    deps.prisma as never,
    cronLeader as never,
    notifications as unknown as NotificationsService,
    slaAudit as unknown as SlaAuditService,
  );
}

describe('SlaEscalationService', () => {
  const taskId = '11111111-1111-4111-8111-111111111111';
  const wfId = '22222222-2222-4222-8222-222222222222';
  const startedAt = new Date(Date.now() - 120 * 60_000);

  const candidate = {
    id: taskId,
    startedAt,
    slaMinutes: 60,
    escalationLevel: 0,
    taskType: WarehouseTaskType.pick,
    workflowInstanceId: wfId,
    workflowInstance: {
      id: wfId,
      companyId: '33333333-3333-4333-8333-333333333333',
      status: WorkflowInstanceStatus.in_progress,
      company: { name: 'Acme Imports' },
      warehouse: { name: 'Main DC', code: 'WH1' },
    },
  };

  it('escalates overdue task, notifies managers, and writes audit trail', async () => {
    const findMany = jest.fn().mockResolvedValue([candidate]);
    const findFirst = jest.fn().mockResolvedValue(null);
    const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        warehouseTask: {
          findUnique: jest.fn().mockResolvedValue(candidate),
          update: jest.fn().mockResolvedValue({}),
        },
        taskEvent: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        workflowInstance: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const notifications = { notifyManagersSlaBreach: jest.fn().mockResolvedValue(2) };
    const slaAudit = { escalated: jest.fn().mockResolvedValue(undefined) };

    const service = buildService({
      prisma: { warehouseTask: { findMany }, taskEvent: { findFirst }, $transaction: transaction },
      notifications,
      slaAudit,
    });

    const count = await service.runTick();

    expect(count).toBe(1);
    expect(notifications.notifyManagersSlaBreach).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        taskTypeLabel: 'Pick',
        escalationLevel: 1,
        companyName: 'Acme Imports',
        warehouseName: 'Main DC',
      }),
    );
    expect(slaAudit.escalated).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        escalationLevel: 1,
        previousLevel: 0,
        notifiedManagers: 2,
      }),
    );
  });

  it('skips tasks still within SLA window', async () => {
    const fresh = {
      ...candidate,
      startedAt: new Date(),
      slaMinutes: 480,
    };
    const service = buildService({
      prisma: {
        warehouseTask: { findMany: jest.fn().mockResolvedValue([fresh]) },
      },
    });

    const count = await service.runTick();
    expect(count).toBe(0);
  });

  it('respects escalation cooldown between events', async () => {
    const findMany = jest.fn().mockResolvedValue([candidate]);
    const findFirst = jest.fn().mockResolvedValue({
      createdAt: new Date(Date.now() - SLA_ESCALATION_COOLDOWN_MS + 60_000),
    });

    const service = buildService({
      prisma: {
        warehouseTask: { findMany },
        taskEvent: { findFirst },
      },
    });

    const count = await service.runTick();
    expect(count).toBe(0);
  });

  it('does not notify when task is not in_progress', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService({
      prisma: { warehouseTask: { findMany } },
    });

    const count = await service.runTick();
    expect(count).toBe(0);
  });
});
