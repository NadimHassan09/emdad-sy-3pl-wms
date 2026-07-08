import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OmsReportsRunner } from './oms-reports.runner';

const companyId = '11111111-1111-1111-1111-111111111111';

const adminUser: AuthPrincipal = {
  id: 'admin-1',
  role: UserRole.super_admin,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [companyId],
};

function buildRunner(prisma: unknown): OmsReportsRunner {
  return new OmsReportsRunner(
    prisma as PrismaService,
    {
      assertCompanyAccess: jest.fn(),
    } as unknown as CompanyAccessService,
  );
}

describe('OmsReportsRunner.codReport', () => {
  it('returns paginated COD rows', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'OUT-1',
        company: { name: 'Acme' },
        recipientName: 'Ali',
        codAmount: { toString: () => '50' },
        codStatus: 'pending',
        currency: 'SYP',
        codCollectedAt: null,
        codRemittedAt: null,
        status: 'allocated',
        createdAt: new Date('2026-07-01'),
      },
    ]);
    const runner = buildRunner({
      outboundOrder: { findMany },
    });

    const page = await runner.run(adminUser, 'cod-report', {
      companyId,
      limit: 25,
      offset: 0,
    });

    expect(page.total).toBe(1);
    expect(page.items[0]?.orderNumber).toBe('OUT-1');
    expect(page.items[0]?.codAmount).toBe('50');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentMethod: 'COD', companyId }),
      }),
    );
  });
});
