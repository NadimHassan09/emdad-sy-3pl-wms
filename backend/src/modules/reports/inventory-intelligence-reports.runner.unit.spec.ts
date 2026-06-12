import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OutboundService } from '../outbound/outbound.service';
import {
  expiryAgingBucket,
  InventoryIntelligenceReportsRunner,
  stockMovementAgingBucket,
} from './inventory-intelligence-reports.runner';

const admin: AuthPrincipal = {
  id: 'admin-1',
  role: UserRole.wh_manager,
  companyId: null,
  tenantScope: 'all',
  authorizedCompanyIds: [],
};

const warehouseId = '11111111-1111-1111-1111-111111111111';

function buildRunner(deps: {
  prisma?: unknown;
  inventory?: unknown;
  outbound?: unknown;
}) {
  return new InventoryIntelligenceReportsRunner(
    deps.prisma as PrismaService,
    deps.inventory as InventoryService,
    deps.outbound as OutboundService,
    {
      requireReadTenantScope: () => warehouseId,
    } as unknown as CompanyAccessService,
  );
}

describe('inventory intelligence bucket helpers', () => {
  it('classifies stock movement aging', () => {
    expect(stockMovementAgingBucket(null)).toBe('No movement');
    expect(stockMovementAgingBucket(15)).toBe('0–30 days');
    expect(stockMovementAgingBucket(45)).toBe('31–90 days');
    expect(stockMovementAgingBucket(120)).toBe('91–180 days');
    expect(stockMovementAgingBucket(200)).toBe('180+ days');
  });

  it('classifies lot expiry aging', () => {
    expect(expiryAgingBucket(null)).toBe('No expiry');
    expect(expiryAgingBucket(-1)).toBe('Expired');
    expect(expiryAgingBucket(10)).toBe('0–30 days');
    expect(expiryAgingBucket(60)).toBe('31–90 days');
    expect(expiryAgingBucket(120)).toBe('91–180 days');
    expect(expiryAgingBucket(365)).toBe('180+ days');
  });
});

describe('InventoryIntelligenceReportsRunner', () => {
  it('builds stock aging rows from last movement', async () => {
    const inventory = {
      stock: jest.fn().mockResolvedValue({
        items: [
          {
            id: 's1',
            companyId: 'c1',
            productId: 'p1',
            lastMovementAt: new Date('2024-01-01T00:00:00Z'),
            quantityOnHand: 12,
            product: { sku: 'SKU-1', name: 'Widget' },
            location: { fullPath: 'A-01' },
          },
        ],
        total: 1,
      }),
    };
    const prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Acme' }]),
      },
    };
    const runner = buildRunner({ inventory, prisma });

    const result = await runner.run(admin, 'stock-aging', {
      warehouseId,
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      sku: 'SKU-1',
      client: 'Acme',
      agingBucket: '180+ days',
      stagnant: 'yes',
    });
  });

  it('filters lot expiry by aging bucket', async () => {
    const inventory = {
      stock: jest.fn().mockResolvedValue({
        items: [
          {
            id: 's1',
            quantityOnHand: 5,
            product: { sku: 'SKU-2', name: 'Perishable' },
            location: { fullPath: 'B-02' },
            lot: { lotNumber: 'L-1', expiryDate: new Date('2026-06-20T00:00:00Z') },
          },
          {
            id: 's2',
            quantityOnHand: 3,
            product: { sku: 'SKU-3', name: 'Stable' },
            location: { fullPath: 'B-03' },
            lot: { lotNumber: 'L-2', expiryDate: new Date('2027-01-01T00:00:00Z') },
          },
        ],
        total: 2,
      }),
    };
    const runner = buildRunner({ inventory, prisma: {} });

    const result = await runner.run(admin, 'lot-expiry', {
      warehouseId,
      status: '0–30 days',
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      lot: 'L-1',
      agingBucket: '0–30 days',
    });
  });

  it('summarizes capacity utilization for a warehouse', async () => {
    const prisma = {
      location: {
        count: jest
          .fn()
          .mockResolvedValueOnce(100)
          .mockResolvedValueOnce(40),
      },
      currentStock: {
        findMany: jest.fn().mockResolvedValue([
          {
            locationId: 'loc-1',
            productId: 'p1',
            quantityOnHand: 10,
            location: { fullPath: 'A-01', name: 'A-01' },
          },
          {
            locationId: 'loc-1',
            productId: 'p2',
            quantityOnHand: 5,
            location: { fullPath: 'A-01', name: 'A-01' },
          },
        ]),
      },
    };
    const runner = buildRunner({ prisma });

    const result = await runner.run(admin, 'capacity-utilization', {
      warehouseId,
      limit: 50,
      offset: 0,
    });

    expect(result.items[0]).toMatchObject({
      id: 'summary',
      utilization: '40% (40 / 100 locations)',
    });
    expect(result.items[1]).toMatchObject({
      location: 'A-01',
      skuCount: '2',
      totalQty: '15',
    });
  });

  it('computes return rate by client', async () => {
    const outbound = {
      list: jest.fn().mockResolvedValue({
        items: [
          { companyId: 'c1', company: { name: 'Acme' } },
          { companyId: 'c1', company: { name: 'Acme' } },
          { companyId: 'c2', company: { name: 'Beta' } },
        ],
        total: 3,
      }),
    };
    const prisma = {
      returnOrder: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', companyId: 'c1', company: { name: 'Acme' } },
        ]),
      },
    };
    const runner = buildRunner({ outbound, prisma });

    const result = await runner.run(admin, 'return-rate', {
      warehouseId,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      limit: 50,
      offset: 0,
    });

    expect(result.items[0]).toMatchObject({
      client: 'Acme',
      outboundOrders: 2,
      returnOrders: 1,
      returnRatePercent: '50%',
    });
    expect(result.items[1]).toMatchObject({
      client: 'Beta',
      outboundOrders: 1,
      returnOrders: 0,
      returnRatePercent: '0%',
    });
  });
});
