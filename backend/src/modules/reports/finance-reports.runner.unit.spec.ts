import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  daysPastDue,
  FinanceReportsRunner,
  receivablesAgingBucket,
} from './finance-reports.runner';

const financeUser: AuthPrincipal = {
  id: 'fin-1',
  role: UserRole.finance,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [],
};

function buildRunner(prisma: unknown) {
  return new FinanceReportsRunner(prisma as PrismaService);
}

describe('finance aging helpers', () => {
  it('classifies receivables aging buckets', () => {
    expect(receivablesAgingBucket(0)).toBe('Current');
    expect(receivablesAgingBucket(-5)).toBe('Current');
    expect(receivablesAgingBucket(15)).toBe('1–30 days');
    expect(receivablesAgingBucket(45)).toBe('31–60 days');
    expect(receivablesAgingBucket(75)).toBe('61–90 days');
    expect(receivablesAgingBucket(120)).toBe('90+ days');
  });

  it('computes days past due from due date', () => {
    const due = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-11T00:00:00Z');
    expect(daysPastDue(due, now)).toBe(10);
  });
});

describe('FinanceReportsRunner', () => {
  it('aggregates revenue by client with date filter', async () => {
    const prisma = {
      invoice: {
        groupBy: jest.fn().mockResolvedValue([
          {
            companyId: 'c1',
            _sum: { totalAmount: { toString: () => '1500.00' } },
            _count: { id: 3 },
          },
        ]),
      },
      company: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Acme' }]),
      },
    };
    const runner = buildRunner(prisma);

    const result = await runner.run(financeUser, 'revenue-by-client', {
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      limit: 50,
      offset: 0,
    });

    expect(prisma.invoice.groupBy).toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({
      client: 'Acme',
      invoiceCount: 3,
      revenue: '1500.00',
    });
  });

  it('builds receivables aging rows with bucket filter', async () => {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            invoiceNumber: 'INV-001',
            status: 'overdue',
            totalAmount: { toString: () => '500.00' },
            issuedAt: new Date('2026-03-01T00:00:00Z'),
            company: { name: 'Acme', paymentTermsDays: 30 },
          },
          {
            id: 'inv-2',
            invoiceNumber: 'INV-002',
            status: 'open',
            totalAmount: { toString: () => '200.00' },
            issuedAt: new Date('2026-06-01T00:00:00Z'),
            company: { name: 'Beta', paymentTermsDays: 30 },
          },
        ]),
      },
    };
    const runner = buildRunner(prisma);

    const result = await runner.run(financeUser, 'receivables-aging', {
      status: '61–90 days',
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      invoiceNumber: 'INV-001',
      client: 'Acme',
      agingBucket: '61–90 days',
    });
  });
});
