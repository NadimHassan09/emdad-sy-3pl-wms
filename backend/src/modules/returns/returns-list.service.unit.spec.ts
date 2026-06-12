import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReturnsService } from './returns.service';

const companyId = '11111111-1111-1111-1111-111111111111';

function companyAccessMock(): CompanyAccessService {
  return {
    requireReadTenantScope: () => companyId,
    resolveWriteCompanyId: () => companyId,
    validateResourceOwnership: () => undefined,
  } as unknown as CompanyAccessService;
}

function buildService(prisma: unknown): ReturnsService {
  return new ReturnsService(
    prisma as PrismaService,
    companyAccessMock(),
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

describe('ReturnsService.list (server pagination)', () => {
  it('returns paginated items with total', async () => {
    const row = {
      id: 'ret-1',
      companyId,
      orderNumber: 'RET-001',
      status: 'draft',
      createdAt: new Date(),
      completedAt: null,
      company: { id: companyId, name: 'Co' },
      originalOutbound: null,
      _count: { lines: 1 },
      lines: [{ expectedQuantity: 1, receivedQuantity: 0, disposition: null, product: { sku: 'SKU1' } }],
    };
    const findMany = jest.fn().mockResolvedValue([row]);
    const count = jest.fn().mockResolvedValue(42);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      returnOrder: { findMany, count },
    };
    const service = buildService(prisma);

    const result = await service.list(adminUser, {
      companyId,
      limit: 25,
      offset: 50,
    });

    expect(result.total).toBe(42);
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(50);
    expect(result.items).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 50,
        where: expect.objectContaining({ companyId }),
      }),
    );
  });

  it('applies status and date filters server-side', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      returnOrder: { findMany, count },
    };
    const service = buildService(prisma);

    await service.list(adminUser, {
      companyId,
      status: 'completed',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      limit: 25,
      offset: 0,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          status: 'completed',
          createdAt: expect.objectContaining({
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-01-31T23:59:59.999Z'),
          }),
        }),
      }),
    );
  });

  it('applies orderSearch filter server-side', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      returnOrder: { findMany, count },
    };
    const service = buildService(prisma);

    await service.list(adminUser, {
      companyId,
      orderSearch: 'RET-99',
      limit: 25,
      offset: 0,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ orderNumber: { contains: 'RET-99', mode: 'insensitive' } }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});
