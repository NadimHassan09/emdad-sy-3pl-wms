import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InboundService } from '../inbound/inbound.service';
import { OperationalReportsRunner } from './operational-reports.runner';

const admin: AuthPrincipal = {
  id: 'admin-1',
  role: UserRole.wh_manager,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [],
};

function buildRunner(deps: {
  prisma?: unknown;
  inbound?: unknown;
}) {
  return new OperationalReportsRunner(
    deps.prisma as PrismaService,
    deps.inbound as InboundService,
    {
      requireReadTenantScope: () => '11111111-1111-1111-1111-111111111111',
    } as unknown as CompanyAccessService,
  );
}

describe('OperationalReportsRunner', () => {
  it('aggregates worker productivity by assignee', async () => {
    const prisma = {
      warehouseTask: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            taskType: 'pick',
            status: 'completed',
            startedAt: new Date('2026-06-01T08:00:00Z'),
            completedAt: new Date('2026-06-01T10:00:00Z'),
            slaMinutes: 120,
            escalationLevel: 0,
            assignments: [{ worker: { id: 'w1', displayName: 'Ali' } }],
          },
          {
            id: 't2',
            taskType: 'pack',
            status: 'completed',
            startedAt: new Date('2026-06-02T08:00:00Z'),
            completedAt: new Date('2026-06-02T09:00:00Z'),
            slaMinutes: 60,
            escalationLevel: 0,
            assignments: [{ worker: { id: 'w1', displayName: 'Ali' } }],
          },
        ]),
      },
    };
    const runner = buildRunner({ prisma });

    const result = await runner.run(admin, 'worker-productivity', {
      warehouseId: '11111111-1111-1111-1111-111111111111',
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      worker: 'Ali',
      completedTasks: 2,
      pickPackCount: 2,
    });
  });

  it('computes inbound accuracy from line quantities', async () => {
    const inbound = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'in-1',
            orderNumber: 'IN-001',
            status: 'completed',
            company: { name: 'Acme' },
            lines: [
              { expectedQuantity: 10, receivedQuantity: 10 },
              { expectedQuantity: 5, receivedQuantity: 4 },
            ],
          },
        ],
        total: 1,
      }),
    };
    const runner = buildRunner({ inbound });

    const result = await runner.run(admin, 'inbound-accuracy', {
      warehouseId: '11111111-1111-1111-1111-111111111111',
      limit: 50,
      offset: 0,
    });

    expect(result.items[0]).toMatchObject({
      orderNumber: 'IN-001',
      discrepancyLines: 1,
      accuracyPercent: '93%',
    });
  });

  it('summarizes SLA compliance by task type', async () => {
    const prisma = {
      warehouseTask: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            taskType: 'pick',
            status: 'completed',
            startedAt: new Date('2026-06-01T08:00:00Z'),
            completedAt: new Date('2026-06-01T08:30:00Z'),
            slaMinutes: 60,
            escalationLevel: 0,
            assignments: [],
          },
          {
            id: 't2',
            taskType: 'pick',
            status: 'in_progress',
            startedAt: new Date('2020-01-01T08:00:00Z'),
            completedAt: null,
            slaMinutes: 60,
            escalationLevel: 1,
            assignments: [],
          },
        ]),
      },
    };
    const runner = buildRunner({ prisma });

    const result = await runner.run(admin, 'sla-compliance', {
      warehouseId: '11111111-1111-1111-1111-111111111111',
      limit: 50,
      offset: 0,
    });

    expect(result.items[0]).toMatchObject({
      taskType: 'pick',
      totalTasks: 2,
      breachedTasks: 1,
      escalatedTasks: 1,
    });
  });
});
