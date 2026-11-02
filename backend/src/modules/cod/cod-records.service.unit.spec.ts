import { NotFoundException } from '@nestjs/common';

import { CodRecordsService } from './cod-records.service';

const CLIENT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLIENT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function adminUser() {
  return {
    id: 'user-1',
    role: 'super_admin' as const,
    companyId: null,
    tenantScope: 'all' as const,
    authorizedCompanyIds: [],
    email: 'admin@example.com',
  };
}

function restrictedUser() {
  return {
    id: 'user-2',
    role: 'wh_operator' as const,
    companyId: CLIENT_A,
    tenantScope: 'restricted' as const,
    authorizedCompanyIds: [CLIENT_A],
    email: 'op@example.com',
  };
}

function serializedDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cod-1',
    companyId: CLIENT_A,
    omsOrderId: 'oms-1',
    originalAmount: { add: () => ({ toString: () => '100' }) },
    currency: 'USD',
    status: 'available',
    notes: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    updatedAt: new Date('2026-10-20T00:00:00.000Z'),
    availableAt: new Date('2026-10-20T00:00:00.000Z'),
    paidOutAt: null,
    company: { id: CLIENT_A, name: 'Client A' },
    omsOrder: {
      id: 'oms-1',
      orderNumber: 'OMS-1',
      status: 'delivered',
      recipientName: 'Buyer',
      paymentMethod: 'COD',
      trackingNumber: 'AWB-1',
      outboundOrderId: 'out-1',
      outboundOrder: { id: 'out-1', orderNumber: 'OUT-1', trackingNumber: 'AWB-1' },
    },
    adjustments: [],
    ...overrides,
  };
}

describe('CodRecordsService list and export', () => {
  let prisma: any;
  let companyAccess: any;
  let service: CodRecordsService;
  let findMany: jest.Mock;
  let count: jest.Mock;
  let pdf: { logo: string; fontFaceCss: string; renderHtml: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    findMany = jest.fn();
    count = jest.fn();
    prisma = {
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          $executeRaw: jest.fn(),
          codRecord: { findMany, count },
        }),
      ),
      company: { findUnique: jest.fn().mockResolvedValue({ name: 'Client A' }) },
    };
    companyAccess = {
      assertCompanyAccess: jest.fn(),
      requireReadTenantScope: jest.fn((user: { companyId?: string | null }) => user.companyId),
      validateResourceOwnership: jest.fn(),
    };
    pdf = {
      logo: 'data:image/png;base64,AAA',
      fontFaceCss: '',
      renderHtml: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new CodRecordsService(
      prisma,
      companyAccess,
      { emitCodUpdated: jest.fn() } as any,
      pdf as any,
      config as any,
    );
  });

  it('filters by client and keeps pagination totals on the server', async () => {
    findMany.mockResolvedValue([serializedDbRow()]);
    count.mockResolvedValue(21);
    const result = await service.list(adminUser(), {
      companyId: CLIENT_A,
      status: 'available',
      limit: 10,
      offset: 10,
    });
    expect(companyAccess.assertCompanyAccess).toHaveBeenCalledWith(adminUser(), CLIENT_A);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: CLIENT_A, status: 'available' }),
        take: 10,
        skip: 10,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({ companyId: CLIENT_A, status: 'available' }),
    });
    expect(result.total).toBe(21);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.companyId).toBe(CLIENT_A);
  });

  it('All Clients does not add a companyId filter for global admins', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await service.list(adminUser(), { limit: 50, offset: 0 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('restricted users cannot export another client', async () => {
    companyAccess.assertCompanyAccess.mockImplementation(() => {
      throw new NotFoundException('Resource not found.');
    });
    await expect(
      service.exportXlsx(restrictedUser(), { companyId: CLIENT_B, limit: 50, offset: 0 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('export walks every page of matching records', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) =>
      serializedDbRow({
        id: `cod-${i}`,
        originalAmount: { add: () => ({ toString: () => '1' }) },
      }),
    );
    const page2 = [
      serializedDbRow({
        id: 'cod-last',
        originalAmount: { add: () => ({ toString: () => '2' }) },
      }),
    ];
    findMany.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    const { buffer, filename } = await service.exportXlsx(adminUser(), {
      companyId: CLIENT_A,
      limit: 50,
      offset: 0,
    });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0][0].skip).toBe(0);
    expect(findMany.mock.calls[0][0].take).toBe(500);
    expect(findMany.mock.calls[1][0].skip).toBe(500);
    expect(filename).toBe('COD_Report_Client_A.xlsx');
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('PDF export reuses the same matching records and client filename', async () => {
    findMany.mockResolvedValue([serializedDbRow()]);
    const { buffer, filename } = await service.exportPdf(adminUser(), {
      companyId: CLIENT_A,
      limit: 50,
      offset: 0,
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(filename).toBe('COD_Report_Client_A.pdf');
    expect(buffer.toString('utf8', 0, 8)).toContain('%PDF');
    expect(pdf.renderHtml).toHaveBeenCalledTimes(1);
    const html = pdf.renderHtml.mock.calls[0][0] as string;
    expect(html).toContain('OMS-1');
    expect(html).toContain('Buyer');
    expect(html).not.toContain('AWB-1');
    expect(html).not.toContain('Export date/time');
  });
});
