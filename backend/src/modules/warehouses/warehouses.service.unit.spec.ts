import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { WarehousesService } from './warehouses.service';

describe('WarehousesService - Location Counts & List', () => {
  it('returns warehouses with computed location counts without N+1 queries', async () => {
    const prisma = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'wh-1',
            code: 'WH-001',
            name: 'Main Warehouse',
            status: 'active',
            _count: { locations: 12 },
          },
          {
            id: 'wh-2',
            code: 'WH-002',
            name: 'Secondary Warehouse',
            status: 'active',
            _count: { locations: 0 },
          },
        ]),
      },
    } as unknown as PrismaService;

    const realtime = { emitWarehouseCreated: jest.fn() } as unknown as RealtimeService;
    const audit = { log: jest.fn(), fromPrincipal: jest.fn() } as unknown as AuditLogService;

    const service = new WarehousesService(prisma, realtime, audit);

    const result = await service.list();

    expect(result.length).toBe(2);
    expect(result[0].locationCount).toBe(12);
    expect(result[1].locationCount).toBe(0);

    const callArgs = (prisma.warehouse.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.include).toEqual({
      _count: { select: { locations: true } },
    });
  });

  it('findById includes locationCount from relation count', async () => {
    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wh-1',
          code: 'WH-001',
          name: 'Main Warehouse',
          status: 'active',
          _count: { locations: 5 },
        }),
      },
    } as unknown as PrismaService;

    const realtime = { emitWarehouseCreated: jest.fn() } as unknown as RealtimeService;
    const audit = { log: jest.fn(), fromPrincipal: jest.fn() } as unknown as AuditLogService;

    const service = new WarehousesService(prisma, realtime, audit);

    const result = await service.findById('wh-1');

    expect(result.id).toBe('wh-1');
    expect(result.locationCount).toBe(5);
  });
});
