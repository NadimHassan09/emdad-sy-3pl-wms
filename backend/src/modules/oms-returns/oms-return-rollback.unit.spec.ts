import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, OmsReturnStatus, OmsOrderStatus, MovementType, LedgerRefType } from '@prisma/client';
import { OmsReturnsService } from './oms-returns.service';
import type { AuthPrincipal } from '../../common/auth/current-user.types';

describe('OmsReturnsService - rollbackReturn', () => {
  let service: OmsReturnsService;
  let prismaMock: any;
  let companyAccessMock: any;
  let warehouseReturnsMock: any;
  let codMock: any;
  let realtimeMock: any;
  let stockHelpersMock: any;
  let ledgerMock: any;

  const superAdminUser: AuthPrincipal = {
    id: 'user-admin-1',
    email: 'admin@emdad.sy',
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const whManagerUser: AuthPrincipal = {
    id: 'user-whm-1',
    email: 'whm@emdad.sy',
    role: 'wh_manager',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const clientAdminUser: AuthPrincipal = {
    id: 'user-client-1',
    email: 'client@emdad.sy',
    role: 'client_admin',
    companyId: 'comp-1',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['comp-1'],
  };

  beforeEach(() => {
    prismaMock = {
      omsReturn: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      omsOrder: {
        update: jest.fn(),
      },
      outboundOrder: {
        update: jest.fn(),
      },
      omsOrderEvent: {
        create: jest.fn(),
      },
      codAdjustment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      codRecord: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryLedger: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    companyAccessMock = {
      assertCompanyAccess: jest.fn(),
      validateResourceOwnership: jest.fn(),
    };

    warehouseReturnsMock = {};
    codMock = {};
    realtimeMock = {
      emitOmsReturnEvent: jest.fn(),
      emitOmsOrderEvent: jest.fn(),
      emitInventoryChanged: jest.fn(),
    };
    stockHelpersMock = {
      decrementWithMeta: jest.fn().mockResolvedValue(undefined),
    };
    ledgerMock = {
      appendIfAbsent: jest.fn().mockResolvedValue({ id: 'ledger-new-1' }),
    };

    service = new OmsReturnsService(
      prismaMock,
      companyAccessMock,
      warehouseReturnsMock,
      codMock,
      realtimeMock,
      stockHelpersMock,
      ledgerMock,
    );
  });

  describe('Authorization checks', () => {
    it('rejects client_admin with ForbiddenException', async () => {
      await expect(
        service.rollbackReturn('ret-1', clientAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects client_staff role with ForbiddenException', async () => {
      const clientStaffUser: AuthPrincipal = {
        id: 'user-staff-1',
        email: 'staff@example.com',
        role: 'client_staff',
        companyId: 'comp-1',
        tenantScope: 'restricted',
        authorizedCompanyIds: ['comp-1'],
      };

      await expect(
        service.rollbackReturn('ret-1', clientStaffUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Return pre-condition validations', () => {
    it('throws BadRequestException if return is not completed', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        status: OmsReturnStatus.requested,
        companyId: 'comp-1',
      });

      await expect(
        service.rollbackReturn('ret-1', superAdminUser),
      ).rejects.toThrow(/Only confirmed-received returns can be rolled back/);
    });

    it('returns idempotency response if return was already rolled back (cancelled)', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        status: OmsReturnStatus.cancelled,
        notes: 'Rollback executed on 2026-10-24 by super_admin',
        companyId: 'comp-1',
        returnNumber: 'RET-001',
        omsOrderId: 'order-1',
        omsOrder: { orderNumber: 'ORD-001', status: OmsOrderStatus.out_for_delivery },
      });

      const result = await service.rollbackReturn('ret-1', superAdminUser);
      expect(result.restoredStatus).toBe(OmsOrderStatus.out_for_delivery);
      expect(result.message).toContain('already rolled back');
      expect(stockHelpersMock.decrementWithMeta).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if compensating movements already exist', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        status: OmsReturnStatus.completed,
        companyId: 'comp-1',
        omsOrderId: 'order-1',
        omsOrder: { orderNumber: 'ORD-001', status: OmsOrderStatus.returned },
      });

      prismaMock.inventoryLedger.findFirst.mockResolvedValueOnce({ id: 'comp-ledger-1' });

      await expect(
        service.rollbackReturn('ret-1', superAdminUser),
      ).rejects.toThrow(/This return was already rolled back/);
    });
  });

  describe('Stock safety validations', () => {
    it('throws BadRequestException if stock row does not exist in Returns location', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        returnNumber: 'RET-001',
        status: OmsReturnStatus.completed,
        companyId: 'comp-1',
        omsOrderId: 'order-1',
        lines: [
          {
            id: 'line-1',
            productId: 'prod-1',
            quantity: new Prisma.Decimal('5'),
            product: { sku: 'SKU-001' },
          },
        ],
        omsOrder: {
          id: 'order-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-001',
          outboundOrder: { carrierShipments: [] },
        },
      });

      prismaMock.inventoryLedger.findMany.mockResolvedValueOnce([
        {
          id: 'mov-1',
          companyId: 'comp-1',
          productId: 'prod-1',
          lotId: null,
          toLocationId: 'loc-returns',
          quantity: new Prisma.Decimal('5'),
          movementType: MovementType.return_receive,
        },
      ]);

      // Mock $queryRaw returning empty row (no stock found)
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.rollbackReturn('ret-1', superAdminUser),
      ).rejects.toThrow(/No stock found at the return location/);
    });

    it('throws BadRequestException if stock was partially or fully consumed / transferred', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        returnNumber: 'RET-001',
        status: OmsReturnStatus.completed,
        companyId: 'comp-1',
        omsOrderId: 'order-1',
        lines: [
          {
            id: 'line-1',
            productId: 'prod-1',
            quantity: new Prisma.Decimal('5'),
            product: { sku: 'SKU-001' },
          },
        ],
        omsOrder: {
          id: 'order-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-001',
          outboundOrder: { carrierShipments: [] },
        },
      });

      prismaMock.inventoryLedger.findMany.mockResolvedValueOnce([
        {
          id: 'mov-1',
          companyId: 'comp-1',
          productId: 'prod-1',
          lotId: null,
          toLocationId: 'loc-returns',
          quantity: new Prisma.Decimal('5'),
          movementType: MovementType.return_receive,
        },
      ]);

      // Stock row exists, but available is only 2 (required 5)
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          quantity_on_hand: '2',
          quantity_reserved: '0',
        },
      ]);

      await expect(
        service.rollbackReturn('ret-1', superAdminUser),
      ).rejects.toThrow(/has already been transferred, reserved, or consumed/);
    });
  });

  describe('Successful rollback execution & state restoration', () => {
    it('restores omsOrder to out_for_delivery when carrier shipment is active', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        returnNumber: 'RET-001',
        status: OmsReturnStatus.completed,
        companyId: 'comp-1',
        omsOrderId: 'order-1',
        lines: [
          {
            id: 'line-1',
            productId: 'prod-1',
            quantity: new Prisma.Decimal('3'),
            product: { sku: 'SKU-ABC' },
          },
        ],
        omsOrder: {
          id: 'order-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-001',
          outboundOrder: {
            id: 'out-1',
            carrierShipments: [
              {
                id: 'ship-1',
                externalAwb: 'AWB123456',
                status: 'created',
                supersededAt: null,
              },
            ],
          },
        },
      });

      prismaMock.inventoryLedger.findMany.mockResolvedValueOnce([
        {
          id: 'mov-1',
          companyId: 'comp-1',
          productId: 'prod-1',
          lotId: null,
          toLocationId: 'loc-returns',
          quantity: new Prisma.Decimal('3'),
          movementType: MovementType.return_receive,
        },
      ]);

      // Available stock is sufficient (10 - 2 = 8, required 3)
      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          quantity_on_hand: '10',
          quantity_reserved: '2',
        },
      ]);

      // COD adjustment exists
      prismaMock.codAdjustment.findUnique.mockResolvedValueOnce({
        id: 'adj-1',
        codRecordId: 'cod-1',
        amount: new Prisma.Decimal('-50000'),
      });
      prismaMock.codAdjustment.findMany.mockResolvedValueOnce([]);
      prismaMock.codRecord.findUnique.mockResolvedValueOnce({
        id: 'cod-1',
        status: 'returned',
        originalAmount: new Prisma.Decimal('50000'),
      });

      const result = await service.rollbackReturn('ret-1', whManagerUser);

      expect(result.restoredStatus).toBe(OmsOrderStatus.out_for_delivery);
      expect(result.carrierReactivationStatus).toBe('active');

      // Verify stock helper called with quantity 3
      expect(stockHelpersMock.decrementWithMeta).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          productId: 'prod-1',
          locationId: 'loc-returns',
          quantity: 3,
        }),
      );

      // Verify compensating ledger movement appended
      expect(ledgerMock.appendIfAbsent).toHaveBeenCalledWith(
        prismaMock,
        'return:rollback:ret-1:mov-1',
        expect.objectContaining({
          movementType: MovementType.adjustment_negative,
          referenceType: LedgerRefType.return_order,
          referenceId: 'ret-1',
          quantity: new Prisma.Decimal('3'),
        }),
      );

      // Verify return marked cancelled
      expect(prismaMock.omsReturn.update).toHaveBeenCalledWith({
        where: { id: 'ret-1' },
        data: expect.objectContaining({
          status: OmsReturnStatus.cancelled,
        }),
      });

      // Verify order restored to out_for_delivery
      expect(prismaMock.omsOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: OmsOrderStatus.out_for_delivery,
          returnedAt: null,
        }),
      });

      // Verify COD adjustment deleted and status restored to pending
      expect(prismaMock.codAdjustment.delete).toHaveBeenCalledWith({
        where: { id: 'adj-1' },
      });
      expect(prismaMock.codRecord.update).toHaveBeenCalledWith({
        where: { id: 'cod-1' },
        data: { status: 'pending' },
      });

      // Verify audit event
      expect(prismaMock.omsOrderEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          omsOrderId: 'order-1',
          eventType: 'return.rollback_completed',
        }),
      });
    });

    it('falls back to ready_to_ship when carrier shipment was cancelled', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-2',
        returnNumber: 'RET-002',
        status: OmsReturnStatus.completed,
        companyId: 'comp-1',
        omsOrderId: 'order-2',
        lines: [
          {
            id: 'line-2',
            productId: 'prod-2',
            quantity: new Prisma.Decimal('1'),
            product: { sku: 'SKU-XYZ' },
          },
        ],
        omsOrder: {
          id: 'order-2',
          companyId: 'comp-1',
          orderNumber: 'ORD-002',
          outboundOrder: {
            id: 'out-2',
            carrierShipments: [], // No active non-superseded shipment
          },
        },
      });

      prismaMock.inventoryLedger.findMany.mockResolvedValueOnce([
        {
          id: 'mov-2',
          companyId: 'comp-1',
          productId: 'prod-2',
          lotId: null,
          toLocationId: 'loc-returns',
          quantity: new Prisma.Decimal('1'),
          movementType: MovementType.return_receive,
        },
      ]);

      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          quantity_on_hand: '5',
          quantity_reserved: '0',
        },
      ]);
      prismaMock.codAdjustment.findUnique.mockResolvedValueOnce(null);

      const result = await service.rollbackReturn('ret-2', superAdminUser);

      expect(result.restoredStatus).toBe(OmsOrderStatus.ready_to_ship);
      expect(result.message).toContain('جاهز للشحن');

      // Verify order restored to ready_to_ship
      expect(prismaMock.omsOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-2' },
        data: expect.objectContaining({
          status: OmsOrderStatus.ready_to_ship,
          returnedAt: null,
        }),
      });
    });
  });
});
