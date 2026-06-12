import { CycleCountStatus, UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CycleCountService } from './cycle-count.service';

const companyId = '11111111-1111-1111-1111-111111111111';
const warehouseId = '22222222-2222-2222-2222-222222222222';
const workerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function companyAccessMock(): CompanyAccessService {
  return {
    requireReadTenantScope: () => companyId,
    resolveWriteCompanyId: () => companyId,
    validateResourceOwnership: () => undefined,
  } as unknown as CompanyAccessService;
}

function buildService(prisma: unknown): CycleCountService {
  return new CycleCountService(
    prisma as PrismaService,
    companyAccessMock(),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
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

describe('CycleCountService.list (server pagination)', () => {
  it('returns paginated session rows', async () => {
    const item = { id: 'cc-1', status: CycleCountStatus.scheduled };
    const findMany = jest.fn().mockResolvedValue([item]);
    const count = jest.fn().mockResolvedValue(10);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      cycleCount: { findMany, count },
    };
    const service = buildService(prisma);

    const result = await service.list(adminUser, {
      companyId,
      warehouseId,
      limit: 25,
      offset: 0,
    });

    expect(result).toEqual({
      items: [item],
      total: 10,
      limit: 25,
      offset: 0,
    });
  });

  it('applies worker, discrepancy, and date filters server-side', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      cycleCount: { findMany, count },
    };
    const service = buildService(prisma);

    await service.list(adminUser, {
      companyId,
      warehouseId,
      assignedWorkerId: workerId,
      discrepancyOnly: 'yes',
      createdFrom: '2026-06-01',
      createdTo: '2026-06-30',
      limit: 25,
      offset: 0,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          warehouseId,
          assignedWorkerId: workerId,
          status: CycleCountStatus.pending_review,
          createdAt: expect.objectContaining({
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.999Z'),
          }),
        }),
      }),
    );
  });
});

describe('CycleCountService.listProductHistory (server pagination)', () => {
  it('returns paginated product history with overdue filter', async () => {
    const item = { id: 'hist-1', product: { id: 'p1', sku: 'SKU', name: 'Prod' } };
    const findMany = jest.fn().mockResolvedValue([item]);
    const count = jest.fn().mockResolvedValue(5);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      cycleCountProductHistory: { findMany, count },
    };
    const service = buildService(prisma);

    const result = await service.listProductHistory(adminUser, {
      companyId,
      warehouseId,
      overdueOnly: 'yes',
      lastCountedFrom: '2026-01-01',
      limit: 25,
      offset: 0,
    });

    expect(result.items).toEqual([item]);
    expect(result.total).toBe(5);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          warehouseId,
          nextDueAt: { lt: expect.any(Date) },
          lastCountedAt: expect.objectContaining({
            gte: new Date('2026-01-01T00:00:00.000Z'),
          }),
        }),
        take: 25,
        skip: 0,
      }),
    );
  });
});
