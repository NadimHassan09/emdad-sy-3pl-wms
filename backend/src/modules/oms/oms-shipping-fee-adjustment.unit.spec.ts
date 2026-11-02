import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { OmsBulkService } from './oms-bulk.service';
import { OmsOrdersService } from './oms-orders.service';

describe('Manual Shipping Fee Adjustment', () => {
  const superAdminUser: AuthPrincipal = {
    id: 'user-super-admin',
    email: 'admin@test.com',
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const whManagerUser: AuthPrincipal = {
    id: 'user-wh-manager',
    email: 'manager@test.com',
    role: 'wh_manager',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const unauthorizedOperator: AuthPrincipal = {
    id: 'user-op',
    email: 'op@test.com',
    role: 'wh_operator',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const clientAdminUser: AuthPrincipal = {
    id: 'user-client',
    email: 'client@test.com',
    role: 'client_admin',
    companyId: 'company-1',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['company-1'],
  };

  let mockPrisma: any;
  let mockEvents: any;
  let mockRealtime: any;
  let ordersService: OmsOrdersService;
  let bulkService: OmsBulkService;

  beforeEach(() => {
    mockEvents = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockRealtime = {
      emitOmsOrderEvent: jest.fn(),
      emitOutboundOrderUpdated: jest.fn(),
    };

    const makeMockOrder = (overrides: any = {}) => ({
      id: 'order-1',
      orderNumber: 'ORD-1001',
      companyId: 'company-1',
      status: 'delivered',
      shippingFee: new Prisma.Decimal(5),
      subtotal: new Prisma.Decimal(105),
      outboundOrderId: 'outbound-1',
      clientShippingRateAppliedAt: null,
      clientShippingRateBreakdown: null,
      lines: [
        {
          id: 'line-1',
          requestedQuantity: new Prisma.Decimal(2),
          unitPrice: new Prisma.Decimal(50),
          lineTotal: new Prisma.Decimal(100),
        },
      ],
      ...overrides,
    });

    const ordersMap = new Map<string, any>();
    ordersMap.set('order-1', makeMockOrder({ id: 'order-1', orderNumber: 'ORD-1001', status: 'delivered' }));
    ordersMap.set('order-cancelled', makeMockOrder({ id: 'order-cancelled', orderNumber: 'ORD-CANCELLED', status: 'cancelled' }));
    ordersMap.set('order-returned', makeMockOrder({ id: 'order-returned', orderNumber: 'ORD-RETURNED', status: 'returned' }));
    ordersMap.set('order-waiting', makeMockOrder({ id: 'order-waiting', orderNumber: 'ORD-WAITING', status: 'waiting_for_confirmation' }));

    mockPrisma = {
      omsOrder: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(ordersMap.get(where.id) ?? null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const ids: string[] = where?.id?.in ?? [];
          return Promise.resolve(
            ids.map((id) => ordersMap.get(id) || { id, orderNumber: `ORD-${id}` }),
          );
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const existing = ordersMap.get(where.id) ?? makeMockOrder({ id: where.id });
          const updated = {
            ...existing,
            ...data,
          };
          ordersMap.set(where.id, updated);
          return Promise.resolve(updated);
        }),
      },
      outboundOrder: {
        update: jest.fn().mockResolvedValue({ id: 'outbound-1' }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
    };

    ordersService = new OmsOrdersService(
      mockPrisma as any,
      {} as any, // outbound
      {} as any, // companyAccess
      {} as any, // allocation
      mockEvents as any, // events
      {} as any, // sync
      mockRealtime as any, // realtime
      {} as any, // cod
      {} as any, // shipping
      {} as any, // shippingTracking
      {} as any, // geo
      {} as any, // autoReturn
      {} as any, // shippingFees
      {} as any, // billingAccess
      {} as any, // traceability
    );

    bulkService = new OmsBulkService(ordersService, mockPrisma as any);
  });

  describe('Authorization checks', () => {
    it('rejects unauthorized wh_operator', async () => {
      await expect(
        ordersService.adjustShippingFee(unauthorizedOperator, 'order-1', { shippingFee: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects client_admin', async () => {
      await expect(
        ordersService.adjustShippingFee(clientAdminUser, 'order-1', { shippingFee: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows super_admin and wh_manager', async () => {
      const res1 = await ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: 8 });
      expect(res1.shippingFee).toBe('8');

      const res2 = await ordersService.adjustShippingFee(whManagerUser, 'order-1', { shippingFee: 12 });
      expect(res2.shippingFee).toBe('12');
    });
  });

  describe('Validation', () => {
    it('rejects negative shipping fees', async () => {
      await expect(
        ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: -5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-numeric shipping fees', async () => {
      await expect(
        ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: NaN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts zero shipping fee', async () => {
      const res = await ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: 0 });
      expect(res.shippingFee).toBe('0');
      expect(res.subtotal).toBe('100'); // 100 merchandise + 0 shipping
    });

    it('throws NotFoundException if order does not exist', async () => {
      await expect(
        ordersService.adjustShippingFee(superAdminUser, 'non-existent', { shippingFee: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Order status eligibility & invariants', () => {
    it('allows adjustment on delivered orders without changing order status', async () => {
      const res = await ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: 15 });
      expect(res.status).toBe('delivered');
      expect(mockPrisma.omsOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ status: expect.anything() }),
        }),
      );
    });

    it('allows adjustment on cancelled orders without changing status', async () => {
      const res = await ordersService.adjustShippingFee(superAdminUser, 'order-cancelled', { shippingFee: 15 });
      expect(res.status).toBe('cancelled');
    });

    it('allows adjustment on returned orders without changing status', async () => {
      const res = await ordersService.adjustShippingFee(superAdminUser, 'order-returned', { shippingFee: 20 });
      expect(res.status).toBe('returned');
    });

    it('allows adjustment on waiting_for_confirmation orders without changing status', async () => {
      const res = await ordersService.adjustShippingFee(superAdminUser, 'order-waiting', { shippingFee: 10 });
      expect(res.status).toBe('waiting_for_confirmation');
    });

    it('updates dependent subtotal correctly', async () => {
      // Line total is 100, new fee is 25 => subtotal should be 125
      const res = await ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: 25 });
      expect(res.subtotal).toBe('125');
      expect(res.difference).toBe('20'); // 25 - 5
    });

    it('does not mutate carrier quotes, tracking numbers, or carrier shipment records', async () => {
      await ordersService.adjustShippingFee(superAdminUser, 'order-1', { shippingFee: 25 });
      // Only updates outboundOrder.shippingFee, never carrier fields
      expect(mockPrisma.outboundOrder.update).toHaveBeenCalledWith({
        where: { id: 'outbound-1' },
        data: { shippingFee: new Prisma.Decimal(25) },
      });
    });
  });

  describe('Audit history and invoice protection', () => {
    it('records shipping_fee.adjusted audit event with reason and diff', async () => {
      await ordersService.adjustShippingFee(
        superAdminUser,
        'order-1',
        { shippingFee: 12, reason: 'Weight correction' },
        { mode: 'single' },
      );

      expect(mockEvents.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          omsOrderId: 'order-1',
          eventType: 'shipping_fee.adjusted',
          createdBy: superAdminUser.id,
          payload: expect.objectContaining({
            orderId: 'order-1',
            orderNumber: 'ORD-1001',
            previousShippingFee: '5',
            newShippingFee: '12',
            difference: '7',
            reason: 'Weight correction',
            mode: 'single',
            isInvoiceClosed: false,
          }),
        }),
      );
    });

    it('detects issued/paid invoices, preserves invoice lines, and records reference in audit', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({
        id: 'inv-101',
        invoiceNumber: 'INV-2026-0001',
        status: 'paid',
      });

      const res = await ordersService.adjustShippingFee(
        superAdminUser,
        'order-1',
        { shippingFee: 14, reason: 'Post-invoice correction' },
      );

      expect(res.invoiceNumber).toBe('INV-2026-0001');
      expect(res.isInvoiceClosed).toBe(true);

      // Verify audit record contains invoice details
      expect(mockEvents.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: expect.objectContaining({
            invoiceNumber: 'INV-2026-0001',
            invoiceStatus: 'paid',
            isInvoiceClosed: true,
          }),
        }),
      );
    });
  });

  describe('Bulk adjustment', () => {
    it('Mode 1: applies the same shipping fee to all selected orders', async () => {
      const res = await bulkService.adjustShippingFeeBulk(superAdminUser, {
        ids: ['order-1', 'order-cancelled'],
        shippingFee: 7.5,
        reason: 'Bulk promo rate',
      });

      expect(res.requested).toBe(2);
      expect(res.updated).toBe(2);
      expect(res.failed).toBe(0);
      expect(res.updatedOrders).toHaveLength(2);
      expect(res.updatedOrders[0].newShippingFee).toBe('7.5');
      expect(res.updatedOrders[1].newShippingFee).toBe('7.5');
    });

    it('Mode 2: applies individual shipping fees per order', async () => {
      const res = await bulkService.adjustShippingFeeBulk(superAdminUser, {
        items: [
          { id: 'order-1', shippingFee: 3, reason: 'Small package' },
          { id: 'order-returned', shippingFee: 18, reason: 'Heavy package' },
        ],
      });

      expect(res.requested).toBe(2);
      expect(res.updated).toBe(2);
      expect(res.failed).toBe(0);
      expect(res.updatedOrders.find((o) => o.id === 'order-1')?.newShippingFee).toBe('3');
      expect(res.updatedOrders.find((o) => o.id === 'order-returned')?.newShippingFee).toBe('18');
    });

    it('handles partial failures and reports individual error details', async () => {
      const res = await bulkService.adjustShippingFeeBulk(superAdminUser, {
        items: [
          { id: 'order-1', shippingFee: 10 },
          { id: 'order-nonexistent', shippingFee: 10 },
        ],
      });

      expect(res.requested).toBe(2);
      expect(res.updated).toBe(1);
      expect(res.failed).toBe(1);
      expect(res.failures).toHaveLength(1);
      expect(res.failures[0].id).toBe('order-nonexistent');
      expect(res.failures[0].error).toMatch(/not found/i);
    });
  });
});
