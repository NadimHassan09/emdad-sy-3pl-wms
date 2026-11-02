import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocationStatus, LocationType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LocationsService } from './locations.service';

const wh1Id = '00000000-0000-4000-8000-000000000010';
const wh2Id = '00000000-0000-4000-8000-000000000020';

function mockRealtime(): RealtimeService {
  return {
    emitLocationCreated: jest.fn(),
    emitLocationUpdated: jest.fn(),
  } as unknown as RealtimeService;
}

describe('LocationsService - Multi-Warehouse & Parent Hierarchy', () => {
  it('creates a root-level location when parent is omitted', async () => {
    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({
          id: wh1Id,
          code: 'WH-001',
          name: 'Main Warehouse',
        }),
      },
      location: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'loc-root-1',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    const result = await service.create({
      warehouseId: wh1Id,
      name: 'Aisle 1',
      type: LocationType.iss,
    });

    expect(result.warehouseId).toBe(wh1Id);
    expect(result.parentId).toBeUndefined();
    expect(result.fullPath).toBe('WH-001/Aisle 1');
  });

  it('creates a child location under a valid parent in the same warehouse', async () => {
    const parentLoc = {
      id: 'parent-1',
      warehouseId: wh1Id,
      parentId: null,
      fullPath: 'WH-001/Aisle 1',
      barcode: 'WH-001-A1',
      status: LocationStatus.active,
    };

    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({
          id: wh1Id,
          code: 'WH-001',
          name: 'Main Warehouse',
        }),
      },
      location: {
        findUnique: jest.fn().mockResolvedValue(parentLoc),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'loc-child-1',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    const result = await service.create({
      warehouseId: wh1Id,
      parentId: 'parent-1',
      name: 'Shelf A',
      type: LocationType.internal,
    });

    expect(result.warehouseId).toBe(wh1Id);
    expect(result.parentId).toBe('parent-1');
    expect(result.fullPath).toBe('WH-001/Aisle 1/Shelf A');
  });

  it('rejects assigning a parent belonging to a different warehouse', async () => {
    const foreignParent = {
      id: 'parent-wh2',
      warehouseId: wh2Id, // Different warehouse!
      parentId: null,
      fullPath: 'WH-002/Zone X',
      barcode: 'WH-002-ZX',
      status: LocationStatus.active,
    };

    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({
          id: wh1Id,
          code: 'WH-001',
          name: 'Main Warehouse',
        }),
      },
      location: {
        findUnique: jest.fn().mockResolvedValue(foreignParent),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    await expect(
      service.create({
        warehouseId: wh1Id,
        parentId: 'parent-wh2',
        name: 'Rack 1',
        type: LocationType.internal,
      }),
    ).rejects.toThrow(new BadRequestException('Parent location belongs to a different warehouse.'));
  });

  it('rejects assigning an archived location as parent', async () => {
    const archivedParent = {
      id: 'parent-archived',
      warehouseId: wh1Id,
      parentId: null,
      fullPath: 'WH-001/Old Section',
      barcode: 'WH-001-OLD',
      status: LocationStatus.archived, // Archived!
    };

    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({
          id: wh1Id,
          code: 'WH-001',
          name: 'Main Warehouse',
        }),
      },
      location: {
        findUnique: jest.fn().mockResolvedValue(archivedParent),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    await expect(
      service.create({
        warehouseId: wh1Id,
        parentId: 'parent-archived',
        name: 'Rack 1',
        type: LocationType.internal,
      }),
    ).rejects.toThrow(new BadRequestException('Cannot assign an archived location as parent.'));
  });

  it('detects circular parent references in the hierarchy chain', async () => {
    // Chain: A -> B -> A (circular)
    const prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({
          id: wh1Id,
          code: 'WH-001',
        }),
      },
      location: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'loc-A') {
            return Promise.resolve({
              id: 'loc-A',
              warehouseId: wh1Id,
              parentId: 'loc-B',
              status: LocationStatus.active,
            });
          }
          if (where.id === 'loc-B') {
            return Promise.resolve({
              id: 'loc-B',
              warehouseId: wh1Id,
              parentId: 'loc-A', // points back to A
              status: LocationStatus.active,
            });
          }
          return Promise.resolve(null);
        }),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    await expect(
      service.create({
        warehouseId: wh1Id,
        parentId: 'loc-A',
        name: 'Child Node',
      }),
    ).rejects.toThrow(new BadRequestException('Circular location parent reference detected.'));
  });

  it('rejects setting parent to self on update', async () => {
    const existing = {
      id: 'loc-1',
      warehouseId: wh1Id,
      parentId: null,
      name: 'Aisle 1',
      barcode: 'WH-001-A1',
      status: LocationStatus.active,
      warehouse: { id: wh1Id, code: 'WH-001' },
    };

    const prisma = {
      location: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    await expect(
      service.update('loc-1', {
        parentId: 'loc-1',
      }),
    ).rejects.toThrow(new BadRequestException('A location cannot be its own parent.'));
  });

  it('rejects setting parent to a descendant on update (cycle prevention)', async () => {
    // loc-1 is root, loc-2 is child of loc-1
    const loc1 = {
      id: 'loc-1',
      warehouseId: wh1Id,
      parentId: null,
      name: 'Aisle 1',
      barcode: 'WH-001-A1',
      status: LocationStatus.active,
      warehouse: { id: wh1Id, code: 'WH-001' },
    };
    const loc2 = {
      id: 'loc-2',
      warehouseId: wh1Id,
      parentId: 'loc-1',
      name: 'Shelf A',
      status: LocationStatus.active,
    };

    const prisma = {
      location: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'loc-1') return Promise.resolve(loc1);
          if (where.id === 'loc-2') return Promise.resolve(loc2);
          return Promise.resolve(null);
        }),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    // Trying to make loc-1 a child of loc-2 should fail
    await expect(
      service.update('loc-1', {
        parentId: 'loc-2',
      }),
    ).rejects.toThrow(
      new BadRequestException('Cannot set parent to a descendant location (cycle detected).'),
    );
  });

  it('lookup filters excludeId and confines results to the requested warehouse', async () => {
    const prisma = {
      $transaction: jest.fn().mockImplementation(([findManyPromise, countPromise]) => {
        return Promise.all([findManyPromise, countPromise]);
      }),
      location: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'loc-other',
            name: 'Aisle 2',
            fullPath: 'WH-001/Aisle 2',
            barcode: 'WH-001-A2',
            _count: { children: 0 },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;

    const service = new LocationsService(prisma, mockRealtime());

    const result = await service.lookup({
      warehouseId: wh1Id,
      excludeId: 'loc-self',
      limit: 25,
      offset: 0,
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('loc-other');
    const findManyCall = (prisma.location.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.AND).toEqual(
      expect.arrayContaining([
        { warehouseId: wh1Id },
        { id: { not: 'loc-self' } },
      ]),
    );
  });
});
