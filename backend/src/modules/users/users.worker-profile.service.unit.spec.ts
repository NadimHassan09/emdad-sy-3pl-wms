import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus, WorkerOperationalStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UsersService } from './users.service';

const companyId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';
const workerId = '33333333-3333-3333-3333-333333333333';
const warehouseId = '44444444-4444-4444-4444-444444444444';

function companyAccessMock(): CompanyAccessService {
  return {
    assertCompanyAccess: () => undefined,
    requireActiveTenant: () => companyId,
    validateResourceOwnership: () => undefined,
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
  companyId,
  tenantScope: 'all',
  authorizedCompanyIds: [companyId],
};

describe('UsersService worker profile', () => {
  it('provisions a worker profile for an operator without one', async () => {
    const createdWorker = {
      id: workerId,
      status: WorkerOperationalStatus.active,
      warehouseId: null,
      roles: [{ role: 'receiver' }, { role: 'picker' }],
      warehouse: null,
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          companyId: null,
          role: UserRole.wh_operator,
          status: UserStatus.active,
          fullName: 'Operator One',
          worker: null,
        }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: companyId }),
      },
      warehouse: {
        findUnique: jest.fn(),
      },
      worker: {
        create: jest.fn().mockResolvedValue(createdWorker),
      },
    };
    const service = buildService(prisma);

    const result = await service.upsertWorkerProfile(
      userId,
      { roles: ['receiver', 'picker'] },
      adminUser,
    );

    expect(result.id).toBe(workerId);
    expect(result.roles).toEqual(['receiver', 'picker']);
    expect(prisma.worker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          companyId,
          roles: expect.any(Object),
        }),
      }),
    );
  });

  it('rejects provisioning without roles', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          companyId: null,
          role: UserRole.wh_operator,
          status: UserStatus.active,
          fullName: 'Operator One',
          worker: null,
        }),
      },
    };
    const service = buildService(prisma);

    await expect(service.upsertWorkerProfile(userId, {}, adminUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects worker profile for non-operator users', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          companyId: null,
          role: UserRole.wh_manager,
          worker: null,
        }),
      },
    };
    const service = buildService(prisma);

    await expect(
      service.getWorkerProfile(userId, adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects linking a worker already assigned to another user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          companyId: null,
          role: UserRole.wh_operator,
          status: UserStatus.active,
          fullName: 'Operator One',
          worker: null,
        }),
      },
      worker: {
        findUnique: jest.fn().mockResolvedValue({
          id: workerId,
          companyId,
          userId: 'other-user',
          displayName: 'Taken Worker',
        }),
      },
    };
    const service = buildService(prisma);

    await expect(
      service.upsertWorkerProfile(
        userId,
        { linkWorkerId: workerId, roles: ['receiver'] },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unknown warehouse on update', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          companyId: null,
          role: UserRole.wh_operator,
          status: UserStatus.active,
          fullName: 'Operator One',
          worker: {
            id: workerId,
            status: WorkerOperationalStatus.active,
            warehouseId: null,
            roles: [{ role: 'receiver' }],
            warehouse: null,
          },
        }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: companyId }),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = buildService(prisma);

    await expect(
      service.upsertWorkerProfile(userId, { warehouseId }, adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
