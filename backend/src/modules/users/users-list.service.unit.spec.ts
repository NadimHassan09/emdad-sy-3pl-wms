import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from './users.service';

const companyId = '11111111-1111-1111-1111-111111111111';

function companyAccessMock(): CompanyAccessService {
  return {
    assertCompanyAccess: () => undefined,
    resolveWriteCompanyId: () => companyId,
    requireActiveTenant: () => companyId,
  } as unknown as CompanyAccessService;
}

function buildService(prisma: unknown): UsersService {
  return new UsersService(
    prisma as PrismaService,
    {} as never,
    companyAccessMock(),
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

describe('UsersService.list (server pagination)', () => {
  it('returns paginated rows with total', async () => {
    const row = {
      id: 'user-1',
      email: 'a@example.com',
      fullName: 'Alice',
      phone: null,
      role: UserRole.wh_manager,
      status: 'active',
      companyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      lastActivityAt: null,
      company: null,
      worker: null,
    };
    const findMany = jest.fn().mockResolvedValue([row]);
    const count = jest.fn().mockResolvedValue(50);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      user: { findMany, count },
    };
    const service = buildService(prisma);

    const result = await service.list(adminUser, {
      kind: 'system',
      limit: 20,
      offset: 40,
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'user-1',
          email: 'a@example.com',
          kind: 'system',
          workerProfile: null,
        }),
      ],
      total: 50,
      limit: 20,
      offset: 40,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 40,
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ companyId: null }]),
        }),
      }),
    );
  });

  it('applies search and role filters server-side', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      user: { findMany, count },
    };
    const service = buildService(prisma);

    await service.list(adminUser, {
      kind: 'client',
      search: 'alice',
      role: UserRole.client_admin,
      companyId,
      limit: 20,
      offset: 0,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { companyId: { not: null } },
            { companyId },
            { role: UserRole.client_admin },
            {
              OR: [
                { fullName: { contains: 'alice', mode: 'insensitive' } },
                { email: { contains: 'alice', mode: 'insensitive' } },
              ],
            },
          ]),
        },
      }),
    );
  });

  it('scopes restricted tenant client users to authorized companies', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      user: { findMany, count },
    };
    const service = buildService(prisma);

    const restrictedUser: AuthPrincipal = {
      ...adminUser,
      tenantScope: 'restricted',
      authorizedCompanyIds: [companyId],
    };

    await service.list(restrictedUser, { kind: 'client', limit: 20, offset: 0 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { companyId: { not: null } },
            { companyId: { in: [companyId] } },
          ]),
        },
      }),
    );
  });
});
