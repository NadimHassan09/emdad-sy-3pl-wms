import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InboundTraceabilityService } from './inbound-traceability.service';

describe('InboundTraceabilityService', () => {
  let service: InboundTraceabilityService;
  let prisma: any;
  let companyAccess: any;

  const mockAdminUser: AuthPrincipal = {
    id: 'user-admin-1',
    email: 'admin@emdad.test',
    role: 'super_admin',
    tenantScope: 'all',
    authorizedCompanyIds: ['company-1'],
    companyId: 'company-1',
  };

  const mockClientUserOtherCompany: AuthPrincipal = {
    id: 'user-client-2',
    email: 'client@other.test',
    role: 'client_admin',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['company-other'],
    companyId: 'company-other',
  };

  beforeEach(() => {
    prisma = {
      inboundSourceAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'alloc-new', ...args.data })),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(0) } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inboundOrderLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      lot: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      omsOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    companyAccess = {
      validateResourceOwnership: jest.fn((user: AuthPrincipal, resource: { companyId: string }) => {
        if (user.role.startsWith('client_') && user.companyId !== resource.companyId) {
          throw new ForbiddenException('Access to company resource denied.');
        }
      }),
    };

    service = new InboundTraceabilityService(
      prisma as unknown as PrismaService,
      companyAccess as unknown as CompanyAccessService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Single Inbound Order fulfillment', () => {
    it('allocates and reports traceability for an OMS order fulfilled from a single Inbound Order', async () => {
      const tx = prisma;
      const candidateInboundLine = {
        id: 'inb-line-1',
        productId: 'prod-A',
        receivedQuantity: new Prisma.Decimal(10),
        expectedLotNumber: null,
        order: {
          id: 'inb-1001',
          orderNumber: 'INB-1001',
          status: 'completed',
          completedAt: new Date('2026-01-01'),
          confirmedAt: new Date('2026-01-01'),
          createdAt: new Date('2026-01-01'),
        },
      };

      tx.inboundOrderLine.findMany.mockResolvedValueOnce([candidateInboundLine]);

      await service.allocateInboundSources(tx, {
        companyId: 'company-1',
        omsOrderId: 'oms-order-1',
        outboundOrderId: 'out-1',
        lines: [
          {
            outboundOrderLineId: 'out-line-1',
            omsOrderLineId: 'oms-line-1',
            productId: 'prod-A',
            requestedQty: 5,
          },
        ],
      });

      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledTimes(1);
      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-1',
          omsOrderId: 'oms-order-1',
          omsOrderLineId: 'oms-line-1',
          outboundOrderId: 'out-1',
          outboundOrderLineId: 'out-line-1',
          productId: 'prod-A',
          inboundOrderId: 'inb-1001',
          inboundOrderLineId: 'inb-line-1',
          lotId: null,
          quantity: new Prisma.Decimal(5),
          status: 'allocated',
        },
      });
    });
  });

  describe('2. Sourcing the same SKU from two different Inbound Orders', () => {
    it('splits requested quantity across two inbound receipts in FIFO order', async () => {
      const tx = prisma;
      const inbound1 = {
        id: 'inb-line-1',
        productId: 'prod-A',
        receivedQuantity: new Prisma.Decimal(1),
        expectedLotNumber: null,
        order: {
          id: 'inb-1001',
          orderNumber: 'INB-1001',
          status: 'completed',
          completedAt: new Date('2026-01-01'),
          confirmedAt: new Date('2026-01-01'),
          createdAt: new Date('2026-01-01'),
        },
      };
      const inbound2 = {
        id: 'inb-line-2',
        productId: 'prod-A',
        receivedQuantity: new Prisma.Decimal(5),
        expectedLotNumber: null,
        order: {
          id: 'inb-1015',
          orderNumber: 'INB-1015',
          status: 'completed',
          completedAt: new Date('2026-01-02'),
          confirmedAt: new Date('2026-01-02'),
          createdAt: new Date('2026-01-02'),
        },
      };

      tx.inboundOrderLine.findMany.mockResolvedValueOnce([inbound1, inbound2]);

      await service.allocateInboundSources(tx, {
        companyId: 'company-1',
        omsOrderId: 'oms-order-1',
        outboundOrderId: 'out-1',
        lines: [
          {
            outboundOrderLineId: 'out-line-1',
            omsOrderLineId: 'oms-line-1',
            productId: 'prod-A',
            requestedQty: 2,
          },
        ],
      });

      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledTimes(2);
      expect(tx.inboundSourceAllocation.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          inboundOrderId: 'inb-1001',
          quantity: new Prisma.Decimal(1),
        }),
      });
      expect(tx.inboundSourceAllocation.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          inboundOrderId: 'inb-1015',
          quantity: new Prisma.Decimal(1),
        }),
      });
    });
  });

  describe('3. Multiple products sourced from different Inbound Orders', () => {
    it('sources Product A from INB-1001 and Product B from INB-1020', async () => {
      const tx = prisma;
      const inbA = {
        id: 'line-A',
        productId: 'prod-A',
        receivedQuantity: new Prisma.Decimal(10),
        order: { id: 'inb-1001', orderNumber: 'INB-1001', status: 'completed' },
      };
      const inbB = {
        id: 'line-B',
        productId: 'prod-B',
        receivedQuantity: new Prisma.Decimal(8),
        order: { id: 'inb-1020', orderNumber: 'INB-1020', status: 'completed' },
      };

      tx.inboundOrderLine.findMany
        .mockResolvedValueOnce([inbA])
        .mockResolvedValueOnce([inbB]);

      await service.allocateInboundSources(tx, {
        companyId: 'company-1',
        omsOrderId: 'oms-order-multi',
        lines: [
          { productId: 'prod-A', requestedQty: 3 },
          { productId: 'prod-B', requestedQty: 4 },
        ],
      });

      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledTimes(2);
      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-A',
            inboundOrderId: 'inb-1001',
            quantity: new Prisma.Decimal(3),
          }),
        }),
      );
      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-B',
            inboundOrderId: 'inb-1020',
            quantity: new Prisma.Decimal(4),
          }),
        }),
      );
    });
  });

  describe('4. Older order with no reliable source history', () => {
    it('returns "source_not_recorded" when multiple historical receipts exist and none was explicitly recorded', async () => {
      prisma.omsOrder.findUnique.mockResolvedValueOnce({
        id: 'oms-old-1',
        companyId: 'company-1',
        status: 'shipped',
        createdAt: new Date('2025-05-01'),
        confirmedAt: new Date('2025-05-02'),
        lines: [
          {
            id: 'line-1',
            productId: 'prod-legacy',
            requestedQuantity: new Prisma.Decimal(5),
            product: { id: 'prod-legacy', sku: 'SKU-LEGACY', name: 'Legacy Product' },
          },
        ],
        outboundOrder: { id: 'out-old-1', orderNumber: 'OUT-OLD-1', status: 'shipped' },
      });

      // No explicit allocations exist
      prisma.inboundSourceAllocation.findMany.mockResolvedValueOnce([]);

      // Multiple candidate historical receipts existed before this order
      prisma.inboundOrderLine.findMany.mockResolvedValueOnce([
        { order: { id: 'inb-1', orderNumber: 'INB-001' } },
        { order: { id: 'inb-2', orderNumber: 'INB-002' } },
      ]);

      const result = await service.getTraceabilityForOrder('oms-old-1', mockAdminUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        omsOrderLineId: 'line-1',
        productId: 'prod-legacy',
        productSku: 'SKU-LEGACY',
        productName: 'Legacy Product',
        inboundOrderId: null,
        inboundOrderNumber: null,
        quantity: '5',
        status: 'source_not_recorded',
        isHistoricalFallback: false,
      });
    });

    it('reliably attributes to the single historical inbound order when only 1 ever existed', async () => {
      prisma.omsOrder.findUnique.mockResolvedValueOnce({
        id: 'oms-old-single',
        companyId: 'company-1',
        status: 'shipped',
        createdAt: new Date('2025-05-01'),
        confirmedAt: new Date('2025-05-02'),
        lines: [
          {
            id: 'line-1',
            productId: 'prod-single-hist',
            requestedQuantity: new Prisma.Decimal(3),
            product: { id: 'prod-single-hist', sku: 'SKU-SINGLE', name: 'Single Inbound Product' },
          },
        ],
        outboundOrder: { id: 'out-old-2', orderNumber: 'OUT-OLD-2', status: 'shipped' },
      });

      prisma.inboundSourceAllocation.findMany.mockResolvedValueOnce([]);

      // Exactly 1 historical inbound order existed
      prisma.inboundOrderLine.findMany.mockResolvedValueOnce([
        { order: { id: 'inb-only-one', orderNumber: 'INB-SOLO' } },
      ]);

      const result = await service.getTraceabilityForOrder('oms-old-single', mockAdminUser);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        omsOrderLineId: 'line-1',
        productId: 'prod-single-hist',
        productSku: 'SKU-SINGLE',
        productName: 'Single Inbound Product',
        inboundOrderId: 'inb-only-one',
        inboundOrderNumber: 'INB-SOLO',
        quantity: '3',
        status: 'fulfilled',
        isHistoricalFallback: true,
      });
    });
  });

  describe('5. Partially fulfilled order', () => {
    it('displays only the source allocations that are actually recorded for the fulfilled quantities', async () => {
      prisma.omsOrder.findUnique.mockResolvedValueOnce({
        id: 'oms-partial-1',
        companyId: 'company-1',
        status: 'processing',
        lines: [
          {
            id: 'line-1',
            productId: 'prod-A',
            requestedQuantity: new Prisma.Decimal(10),
            product: { id: 'prod-A', sku: 'SKU-A', name: 'Product A' },
          },
        ],
        outboundOrder: { id: 'out-partial-1', orderNumber: 'OUT-PARTIAL-1', status: 'picking' },
      });

      // Partial allocation recorded: 4 units from INB-1001
      prisma.inboundSourceAllocation.findMany.mockResolvedValueOnce([
        {
          id: 'alloc-1',
          omsOrderLineId: 'line-1',
          productId: 'prod-A',
          quantity: new Prisma.Decimal(4),
          status: 'allocated',
          inboundOrder: { id: 'inb-1001', orderNumber: 'INB-1001' },
          product: { id: 'prod-A', sku: 'SKU-A', name: 'Product A' },
          lot: null,
        },
      ]);

      const result = await service.getTraceabilityForOrder('oms-partial-1', mockAdminUser);

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe('4');
      expect(result[0].inboundOrderNumber).toBe('INB-1001');
      expect(result[0].status).toBe('allocated');
    });
  });

  describe('6. Prevention of duplicate allocations during retries', () => {
    it('credits existing allocations and avoids creating duplicates when retried', async () => {
      const tx = prisma;

      // Existing allocation already covers the full requested quantity of 5
      tx.inboundSourceAllocation.findMany.mockResolvedValueOnce([
        {
          id: 'alloc-existing-1',
          quantity: new Prisma.Decimal(5),
          status: 'allocated',
        },
      ]);

      await service.allocateInboundSources(tx, {
        companyId: 'company-1',
        omsOrderId: 'oms-order-1',
        lines: [
          {
            productId: 'prod-A',
            requestedQty: 5,
          },
        ],
      });

      // No new allocations should be created!
      expect(tx.inboundSourceAllocation.create).not.toHaveBeenCalled();
    });

    it('allocates only the shortfall if partially reserved previously', async () => {
      const tx = prisma;

      // Existing allocation covers 2 of 5 requested units
      tx.inboundSourceAllocation.findMany.mockResolvedValueOnce([
        {
          id: 'alloc-existing-1',
          quantity: new Prisma.Decimal(2),
          status: 'allocated',
        },
      ]);

      const candidateInbound = {
        id: 'line-inb-1',
        productId: 'prod-A',
        receivedQuantity: new Prisma.Decimal(10),
        order: { id: 'inb-1001', orderNumber: 'INB-1001', status: 'completed' },
      };

      tx.inboundOrderLine.findMany.mockResolvedValueOnce([candidateInbound]);

      await service.allocateInboundSources(tx, {
        companyId: 'company-1',
        omsOrderId: 'oms-order-1',
        lines: [
          {
            productId: 'prod-A',
            requestedQty: 5,
          },
        ],
      });

      // Should allocate only the 3 shortfall units
      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledTimes(1);
      expect(tx.inboundSourceAllocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: new Prisma.Decimal(3),
          }),
        }),
      );
    });
  });

  describe('7. Authorization and access control', () => {
    it('throws ForbiddenException when a client user accesses an order from another company', async () => {
      prisma.omsOrder.findUnique.mockResolvedValueOnce({
        id: 'oms-other-comp',
        companyId: 'company-1', // belongs to company 1
        lines: [],
      });

      await expect(
        service.getTraceabilityForOrder('oms-other-comp', mockClientUserOtherCompany),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when order does not exist', async () => {
      prisma.omsOrder.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getTraceabilityForOrder('non-existent-order', mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('8. Correct aggregation of source quantities in the OMS Order details API', () => {
    it('formats and aggregates the exact example from the feature requirements', async () => {
      prisma.omsOrder.findUnique.mockResolvedValueOnce({
        id: 'oms-example-order',
        companyId: 'company-1',
        status: 'shipped',
        lines: [
          {
            id: 'line-1',
            productId: 'prod-A',
            requestedQuantity: new Prisma.Decimal(2),
            product: { id: 'prod-A', sku: 'SKU-A', name: 'Product A' },
          },
          {
            id: 'line-2',
            productId: 'prod-B',
            requestedQuantity: new Prisma.Decimal(1),
            product: { id: 'prod-B', sku: 'SKU-B', name: 'Product B' },
          },
        ],
        outboundOrder: { id: 'out-example', orderNumber: 'OUT-100', status: 'shipped' },
      });

      prisma.inboundSourceAllocation.findMany.mockResolvedValueOnce([
        {
          id: 'alloc-1',
          omsOrderLineId: 'line-1',
          productId: 'prod-A',
          quantity: new Prisma.Decimal(1),
          status: 'fulfilled',
          inboundOrder: { id: 'inb-1001-id', orderNumber: 'INB-1001' },
          product: { id: 'prod-A', sku: 'SKU-A', name: 'Product A' },
          lot: null,
        },
        {
          id: 'alloc-2',
          omsOrderLineId: 'line-1',
          productId: 'prod-A',
          quantity: new Prisma.Decimal(1),
          status: 'fulfilled',
          inboundOrder: { id: 'inb-1015-id', orderNumber: 'INB-1015' },
          product: { id: 'prod-A', sku: 'SKU-A', name: 'Product A' },
          lot: null,
        },
        {
          id: 'alloc-3',
          omsOrderLineId: 'line-2',
          productId: 'prod-B',
          quantity: new Prisma.Decimal(1),
          status: 'fulfilled',
          inboundOrder: { id: 'inb-1020-id', orderNumber: 'INB-1020' },
          product: { id: 'prod-B', sku: 'SKU-B', name: 'Product B' },
          lot: null,
        },
      ]);

      const result = await service.getTraceabilityForOrder('oms-example-order', mockAdminUser);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        {
          id: 'alloc-1',
          omsOrderLineId: 'line-1',
          productId: 'prod-A',
          productSku: 'SKU-A',
          productName: 'Product A',
          inboundOrderId: 'inb-1001-id',
          inboundOrderNumber: 'INB-1001',
          quantity: '1',
          status: 'fulfilled',
          lotNumber: null,
          isHistoricalFallback: false,
        },
        {
          id: 'alloc-2',
          omsOrderLineId: 'line-1',
          productId: 'prod-A',
          productSku: 'SKU-A',
          productName: 'Product A',
          inboundOrderId: 'inb-1015-id',
          inboundOrderNumber: 'INB-1015',
          quantity: '1',
          status: 'fulfilled',
          lotNumber: null,
          isHistoricalFallback: false,
        },
        {
          id: 'alloc-3',
          omsOrderLineId: 'line-2',
          productId: 'prod-B',
          productSku: 'SKU-B',
          productName: 'Product B',
          inboundOrderId: 'inb-1020-id',
          inboundOrderNumber: 'INB-1020',
          quantity: '1',
          status: 'fulfilled',
          lotNumber: null,
          isHistoricalFallback: false,
        },
      ]);
    });
  });

  describe('Fulfillment and release hooks', () => {
    it('marks allocations fulfilled on order dispatch or ship', async () => {
      const tx = prisma;
      await service.markFulfilled(tx, { outboundOrderId: 'out-1' });

      expect(tx.inboundSourceAllocation.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [{ outboundOrderId: 'out-1' }],
          status: 'allocated',
        },
        data: { status: 'fulfilled' },
      });
    });

    it('releases allocated reservations on cancel, preserving fulfilled historical records', async () => {
      const tx = prisma;
      await service.releaseAllocations(tx, { outboundOrderId: 'out-1' });

      expect(tx.inboundSourceAllocation.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [{ outboundOrderId: 'out-1' }],
          status: 'allocated',
        },
        data: { status: 'released' },
      });
    });
  });
});
