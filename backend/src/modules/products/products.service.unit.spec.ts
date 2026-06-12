import { ConflictException } from '@nestjs/common';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { ProductsService } from './products.service';

const companyId = '11111111-1111-1111-1111-111111111111';
const productAId = '22222222-2222-2222-2222-222222222222';
const productBId = '33333333-3333-3333-3333-333333333333';
const createdAt = new Date('2026-01-01T00:00:00.000Z');

function productRow(
  overrides: Partial<{
    id: string;
    companyId: string;
    name: string;
    sku: string;
    barcode: string | null;
    status: string;
  }> = {},
) {
  return {
    id: productAId,
    companyId,
    name: 'Product A',
    sku: 'SKU1',
    barcode: 'BC-OLD',
    description: null,
    trackingType: 'none',
    uom: 'piece',
    expiryTracking: false,
    minStockThreshold: 0,
    status: 'active',
    createdAt,
    company: { id: companyId, name: 'Test Co' },
    ...overrides,
  };
}

function companyAccessMock(): CompanyAccessService {
  return {
    resolveWriteCompanyId: () => companyId,
    validateResourceOwnership: () => undefined,
    getReadFilterCompanyId: () => companyId,
    assertSameCompany: () => undefined,
    requireActiveTenant: () => companyId,
  } as unknown as CompanyAccessService;
}

function auditMock() {
  return {
    log: jest.fn().mockResolvedValue(undefined),
    fromPrincipal: jest.fn((_u: unknown, patch: unknown) => patch),
  };
}

function billingAccessMock(): BillingAccessService {
  return {
    assertOperationalBilling: jest.fn().mockResolvedValue(undefined),
    getOperationalAccess: jest.fn().mockResolvedValue({
      operationalAllowed: true,
      accountStatus: 'active',
      daysRemaining: 30,
    }),
  } as unknown as BillingAccessService;
}

function buildService(prisma: unknown): ProductsService {
  return new ProductsService(
    prisma as PrismaService,
    companyAccessMock(),
    auditMock() as never,
    {
      emitProductCreated: jest.fn(),
      emitProductUpdated: jest.fn(),
      emitProductArchived: jest.fn(),
    } as never,
    billingAccessMock(),
  );
}

describe('ProductsService barcode enforcement', () => {
  const user: AuthPrincipal = {
    id: 'user-1',
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [companyId],
  };

  it('create with unique explicit barcode succeeds', async () => {
    const created = productRow({ barcode: 'BC-UNIQUE-1', sku: 'SKU1' });
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn(),
          product: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(created),
          },
        }),
      ),
    };
    const service = buildService(prisma);
    const result = await service.create(user, {
      companyId,
      name: 'Product A',
      sku: 'SKU1',
      barcode: 'BC-UNIQUE-1',
    });
    expect(result).toEqual(created);
  });

  it('create with duplicate barcode throws ConflictException', async () => {
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn(),
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: productBId }),
            create: jest.fn(),
          },
        }),
      ),
    };
    const service = buildService(prisma);
    await expect(
      service.create(user, {
        companyId,
        name: 'Product B',
        sku: 'SKU2',
        barcode: 'BC-DUP',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update barcode to unique value succeeds', async () => {
    const product = productRow({ barcode: 'BC-OLD' });
    const updated = productRow({ barcode: 'BC-NEW' });
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const service = buildService(prisma);
    const result = await service.update(productAId, { barcode: 'BC-NEW' }, user);
    expect(result.barcode).toBe('BC-NEW');
  });

  it('update barcode to existing barcode throws ConflictException', async () => {
    const product = productRow({ barcode: 'BC-OLD' });
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        findFirst: jest.fn().mockResolvedValue({ id: productBId }),
        update: jest.fn(),
      },
    };
    const service = buildService(prisma);
    await expect(
      service.update(productAId, { barcode: 'BC-TAKEN' }, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update without changing barcode skips conflict lookup', async () => {
    const product = productRow({ barcode: 'BC-SAME' });
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(productRow({ barcode: 'BC-SAME', name: 'Renamed' })),
      },
    };
    const service = buildService(prisma);
    await service.update(productAId, { name: 'Renamed', barcode: 'BC-SAME' }, user);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });
});
