import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WarehouseTasksService } from './warehouse-tasks.service';

const workerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const companyId = '11111111-1111-1111-1111-111111111111';

function companyAccessMock(): CompanyAccessService {
  return {
    requireReadTenantScope: () => companyId,
    assertSameCompany: () => undefined,
  } as unknown as CompanyAccessService;
}

function buildService(prisma: unknown): WarehouseTasksService {
  return new WarehouseTasksService(
    prisma as PrismaService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    companyAccessMock(),
    { log: jest.fn(), fromPrincipal: jest.fn((_u, p) => p) } as never,
    {} as never,
  );
}

const adminUser: AuthPrincipal = {
  id: 'admin-1',
  role: UserRole.super_admin,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [companyId],
};

const operatorUser: AuthPrincipal = {
  id: 'operator-1',
  role: UserRole.wh_operator,
  companyId,
  tenantScope: 'restricted',
  authorizedCompanyIds: [companyId],
};

describe('WarehouseTasksService.list (lean pagination)', () => {
  it('returns lean rows without runnability flags by default', async () => {
    const leanItem = {
      id: 'task-1',
      taskType: 'pick',
      status: 'pending',
      updatedAt: new Date(),
      workflowInstance: {
        id: 'wi-1',
        companyId,
        referenceType: 'outbound_order',
        referenceId: 'ref-1',
        warehouseId: 'wh-1',
      },
      assignments: [],
    };
    const findMany = jest.fn().mockResolvedValue([leanItem]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      warehouseTask: { findMany, count },
    };
    const service = buildService(prisma);

    const result = await service.list(adminUser, { limit: 25, offset: 0 });

    expect(result).toEqual({
      items: [leanItem],
      total: 1,
      limit: 25,
      offset: 0,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 0,
        orderBy: { updatedAt: 'desc' },
        select: expect.not.objectContaining({
          payload: expect.anything(),
          executionState: expect.anything(),
        }),
      }),
    );
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('requiredSkills');
  });

  it('enriches rows when includeRunnability is true', async () => {
    const item = {
      id: 'task-1',
      taskType: 'pick',
      status: 'pending',
      updatedAt: new Date(),
      workflowInstanceId: 'wi-1',
      workflowInstance: {
        id: 'wi-1',
        companyId,
        referenceType: 'outbound_order',
        referenceId: 'ref-1',
        warehouseId: 'wh-1',
      },
      requiredSkills: [],
      assignments: [{ unassignedAt: null, workerId }],
    };
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([
        {
          id: 'task-1',
          taskType: 'pick',
          status: 'pending',
          workflowInstanceId: 'wi-1',
        },
      ]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      warehouseTask: { findMany, count },
      worker: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = buildService(prisma);

    const result = await service.list(adminUser, {
      limit: 25,
      offset: 0,
      includeRunnability: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toHaveProperty('is_current_runnable');
    expect(result.items[0]).toHaveProperty('runnability_blocked_reason');
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('scopes operator list to assigned worker tasks', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      warehouseTask: { findMany, count },
      worker: {
        findUnique: jest.fn().mockResolvedValue({ id: workerId }),
      },
    };
    const service = buildService(prisma);

    await service.list(operatorUser, { limit: 25, offset: 0, taskType: 'pick' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taskType: 'pick',
          AND: expect.arrayContaining([
            expect.objectContaining({
              assignments: { some: { workerId, unassignedAt: null } },
            }),
            expect.objectContaining({
              workflowInstance: { companyId },
            }),
          ]),
        }),
      }),
    );
  });

  it('returns empty list for operator without worker profile', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      warehouseTask: { findMany, count },
      worker: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = buildService(prisma);

    const result = await service.list(operatorUser, { limit: 25, offset: 0 });

    expect(result).toEqual({ items: [], total: 0, limit: 25, offset: 0 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [] } },
      }),
    );
  });

  it('preserves status and workerId filters for admin', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      warehouseTask: { findMany, count },
    };
    const service = buildService(prisma);

    await service.list(adminUser, {
      limit: 50,
      offset: 100,
      status: 'in_progress',
      workerId,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 100,
        where: expect.objectContaining({
          status: 'in_progress',
          AND: expect.arrayContaining([
            expect.objectContaining({
              assignments: { some: { workerId, unassignedAt: null } },
            }),
          ]),
        }),
      }),
    );
  });
});
