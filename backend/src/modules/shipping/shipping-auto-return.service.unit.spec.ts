import { ShippingAutoReturnService } from './shipping-auto-return.service';
import { OmsOrderStatus, OmsReturnStatus } from '@prisma/client';

describe('ShippingAutoReturnService', () => {
  let service: ShippingAutoReturnService;
  let prismaMock: any;
  let realtimeMock: any;
  let stockHelpersMock: any;
  let ledgerMock: any;
  let codRecordsMock: any;

  beforeEach(() => {
    prismaMock = {
      omsOrder: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      omsReturn: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      omsReturnLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      outboundOrder: {
        update: jest.fn(),
      },
      stockReservation: {
        findFirst: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-admin-1', email: 'admin@emdad.sy' }),
      },
      omsOrderEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    realtimeMock = {
      emitOmsOrderEvent: jest.fn(),
      emitOmsReturnEvent: jest.fn(),
    };

    stockHelpersMock = {
      upsertPositiveWithMeta: jest.fn(),
    };

    ledgerMock = {
      appendIfAbsent: jest.fn(),
    };

    codRecordsMock = {
      markReturnedForOrder: jest.fn(),
      generateForDeliveredOrder: jest.fn(),
    };

    const expectedReturnHoldMock = {
      activateHold: jest.fn().mockResolvedValue({
        activated: true,
        state: 'active',
        totalQuantity: '2',
      }),
      assertConvertible: jest.fn().mockResolvedValue({ ok: true, state: 'active' }),
      assertReleasable: jest.fn().mockResolvedValue({ ok: true, state: 'active' }),
    };

    service = new ShippingAutoReturnService(
      prismaMock,
      realtimeMock,
      stockHelpersMock,
      ledgerMock,
      codRecordsMock,
      expectedReturnHoldMock as never,
    );
  });

  describe('processCarrierReturnEvent', () => {
    it('creates a pending receipt return without restocking on return_created', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'OMS-2026-001',
        companyId: 'comp-1',
        status: OmsOrderStatus.shipped,
        lines: [
          { productId: 'prod-1', requestedQuantity: { sub: () => 2 }, unitPrice: null, specificLotId: null },
        ],
        outboundOrder: { id: 'out-1' },
      };
      prismaMock.omsOrder.findUnique.mockResolvedValueOnce(order);
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null); // no completed return
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null); // no active return draft
      prismaMock.omsReturn.create.mockResolvedValueOnce({
        id: 'ret-1',
        returnNumber: 'RET-001',
        status: OmsReturnStatus.requested,
      });

      const res = await service.processCarrierReturnEvent({
        omsOrderId: 'ord-1',
        awb: 'AWB-100',
        stage: 'return_created',
        reason: 'Customer cancelled',
        originalStatus: 'CreatedFollowupShipment',
      });

      expect(res.success).toBe(true);
      expect(res.returnId).toBe('ret-1');
      expect(res.stage).toBe('return_created');

      // Crucial: Stock and Ledger MUST NOT be called!
      expect(stockHelpersMock.upsertPositiveWithMeta).not.toHaveBeenCalled();
      expect(ledgerMock.appendIfAbsent).not.toHaveBeenCalled();

      expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OmsOrderStatus.return_pending_receipt }),
        }),
      );

      // Return draft created with carrierReturnStage = return_created
      expect(prismaMock.omsReturn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            carrierReturnStage: 'return_created',
            carrierOriginalStatus: 'CreatedFollowupShipment',
            carrierAwb: 'AWB-100',
          }),
        }),
      );
    });

    it('still creates a pending return when OMS is already delivered', async () => {
      const order = {
        id: 'ord-del',
        orderNumber: 'OMS-2026-002',
        companyId: 'comp-1',
        status: OmsOrderStatus.delivered,
        lines: [
          { productId: 'prod-1', requestedQuantity: { sub: () => 1 }, unitPrice: null, specificLotId: null },
        ],
        outboundOrder: { id: 'out-del' },
      };
      prismaMock.omsOrder.findUnique.mockResolvedValueOnce(order);
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null);
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null);
      prismaMock.omsReturn.create.mockResolvedValueOnce({
        id: 'ret-del',
        returnNumber: 'RET-002',
        status: OmsReturnStatus.requested,
      });

      const res = await service.processCarrierReturnEvent({
        omsOrderId: 'ord-del',
        awb: 'AWB-DEL',
        stage: 'returned_to_sender',
      });
      expect(res.success).toBe(true);
      expect(res.returnId).toBe('ret-del');
      expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OmsOrderStatus.return_pending_receipt }),
        }),
      );
      expect(stockHelpersMock.upsertPositiveWithMeta).not.toHaveBeenCalled();
    });

    it('never restocks on returned_to_sender — warehouse confirm owns inventory', async () => {
      const order = {
        id: 'ord-rts',
        orderNumber: 'OMS-RTS',
        companyId: 'comp-1',
        status: OmsOrderStatus.return_pending_receipt,
        lines: [],
      };
      prismaMock.omsOrder.findUnique.mockResolvedValueOnce(order);
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null);
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce({
        id: 'ret-rts',
        status: OmsReturnStatus.requested,
        carrierReturnStage: 'returning_to_sender',
        carrierAwb: 'AWB-RTS',
      });
      prismaMock.omsReturn.update.mockResolvedValueOnce({
        id: 'ret-rts',
        carrierReturnStage: 'returned_to_sender',
      });

      const res = await service.processCarrierReturnEvent({
        omsOrderId: 'ord-rts',
        awb: 'AWB-RTS',
        stage: 'returned_to_sender',
      });

      expect(res.success).toBe(true);
      expect(stockHelpersMock.upsertPositiveWithMeta).not.toHaveBeenCalled();
      expect(ledgerMock.appendIfAbsent).not.toHaveBeenCalled();
      expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OmsOrderStatus.returned }),
        }),
      );
    });

    it('updates existing return draft stage without modifying stock on returning_to_sender', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'OMS-2026-001',
        companyId: 'comp-1',
        status: OmsOrderStatus.failed_delivery,
        lines: [],
      };
      prismaMock.omsOrder.findUnique.mockResolvedValueOnce(order);
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null); // no completed return
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce({
        id: 'ret-1',
        status: OmsReturnStatus.requested,
        carrierReturnStage: 'return_created',
        carrierAwb: 'AWB-100',
      });
      prismaMock.omsReturn.update.mockResolvedValueOnce({
        id: 'ret-1',
        carrierReturnStage: 'returning_to_sender',
      });

      const res = await service.processCarrierReturnEvent({
        omsOrderId: 'ord-1',
        awb: 'AWB-100',
        stage: 'returning_to_sender',
      });

      expect(res.success).toBe(true);
      expect(stockHelpersMock.upsertPositiveWithMeta).not.toHaveBeenCalled();
      expect(ledgerMock.appendIfAbsent).not.toHaveBeenCalled();
      expect(prismaMock.omsReturn.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ret-1' },
          data: expect.objectContaining({
            carrierReturnStage: 'returning_to_sender',
          }),
        }),
      );
    });
  });

  describe('confirmWarehouseReturnReceipt', () => {
    it('restocks inventory, logs ledger entries, and sets order status to returned', async () => {
      const omsReturn = {
        id: 'ret-1',
        returnNumber: 'RET-001',
        status: OmsReturnStatus.requested,
        lines: [
          { productId: 'prod-1', quantity: 2, lotId: 'lot-1' },
        ],
        omsOrder: {
          id: 'ord-1',
          orderNumber: 'OMS-2026-001',
          companyId: 'comp-1',
          outboundOrderId: 'out-1',
          outboundOrder: { id: 'out-1' },
        },
      };
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce(omsReturn);
      prismaMock.stockReservation.findFirst.mockResolvedValueOnce({
        location: { warehouseId: 'wh-1' },
      });
      prismaMock.location.findFirst.mockResolvedValueOnce({
        id: 'loc-returns',
      });

      const user: any = { id: 'operator-1', companyId: 'comp-1', role: 'admin' };
      const res = await service.confirmWarehouseReturnReceipt(user, 'ret-1');

      expect(res.success).toBe(true);

      // Inventory restock must have been invoked
      expect(stockHelpersMock.upsertPositiveWithMeta).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          companyId: 'comp-1',
          productId: 'prod-1',
          quantity: 2,
          locationId: 'loc-returns',
          warehouseId: 'wh-1',
        }),
      );

      // Ledger entry appended
      expect(ledgerMock.appendIfAbsent).toHaveBeenCalledWith(
        prismaMock,
        expect.stringContaining('return:warehouse_confirm:ret-1'),
        expect.objectContaining({
          productId: 'prod-1',
          toLocationId: 'loc-returns',
          movementType: 'return_receive',
        }),
      );

      // Order status set to returned
      expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            status: OmsOrderStatus.returned,
          }),
        }),
      );

      // Return status set to completed with warehouseConfirmedAt
      expect(prismaMock.omsReturn.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ret-1' },
          data: expect.objectContaining({
            status: OmsReturnStatus.completed,
            carrierReturnStage: 'warehouse_confirmed',
            warehouseConfirmedBy: 'operator-1',
          }),
        }),
      );

      // COD return synced
      expect(codRecordsMock.markReturnedForOrder).toHaveBeenCalledWith('ord-1', user);
    });

    it('does not restock twice when the return is already completed', async () => {
      prismaMock.omsReturn.findUnique.mockResolvedValueOnce({
        id: 'ret-1',
        status: OmsReturnStatus.completed,
        lines: [],
        omsOrder: { id: 'ord-1' },
      });
      const user: any = { id: 'operator-1', role: 'wh_operator' };
      const res = await service.confirmWarehouseReturnReceipt(user, 'ret-1');
      expect(res.success).toBe(true);
      expect(stockHelpersMock.upsertPositiveWithMeta).not.toHaveBeenCalled();
    });

    it('rejects client users from confirming warehouse receipt', async () => {
      const user: any = { id: 'client-1', role: 'client_admin', companyId: 'comp-1' };
      await expect(service.confirmWarehouseReturnReceipt(user, 'ret-1')).rejects.toThrow(
        /warehouse staff/i,
      );
      expect(prismaMock.omsReturn.findUnique).not.toHaveBeenCalled();
    });

    it('does not invent a return when Field Delivery has none', async () => {
      prismaMock.omsReturn.findFirst.mockResolvedValueOnce(null);
      const user: any = { id: 'operator-1', role: 'wh_operator' };
      const res = await service.confirmWarehouseReturnReceiptForOrder(user, 'ord-fd');
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/Field Delivery is not a return/i);
      expect(prismaMock.omsReturn.create).not.toHaveBeenCalled();
    });
  });

  describe('duplicate provider return events', () => {
    it('reuses the active return instead of creating a second one', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'OMS-1',
        companyId: 'comp-1',
        status: OmsOrderStatus.failed_delivery,
        lines: [],
      };
      const existing = {
        id: 'ret-1',
        status: OmsReturnStatus.requested,
        carrierReturnStage: 'return_created',
        carrierAwb: 'AWB-1',
      };
      prismaMock.omsOrder.findUnique.mockResolvedValue(order);
      prismaMock.omsReturn.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      prismaMock.omsReturn.update.mockResolvedValue({ ...existing, carrierReturnStage: 'returning_to_sender' });

      const first = await service.processCarrierReturnEvent({
        omsOrderId: 'ord-1',
        awb: 'AWB-1',
        stage: 'returning_to_sender',
      });
      expect(first.returnId).toBe('ret-1');
      expect(prismaMock.omsReturn.create).not.toHaveBeenCalled();
    });
  });

  describe('handleCarrierDeliveredEvent', () => {
    it('cancels unconfirmed return draft, sets order delivered, and triggers COD', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'OMS-2026-001',
        companyId: 'comp-1',
        status: OmsOrderStatus.failed_delivery,
        outboundOrder: { id: 'out-1' },
        omsReturns: [
          { id: 'ret-draft-1', returnNumber: 'RET-001', status: OmsReturnStatus.requested },
        ],
      };
      prismaMock.omsOrder.findUnique.mockResolvedValueOnce(order);

      const res = await service.handleCarrierDeliveredEvent({
        omsOrderId: 'ord-1',
        awb: 'AWB-DELIV',
        notes: 'Delivered safely',
      });

      expect(res.actionTaken).toBe('order_delivered_draft_return_cancelled');

      // Unconfirmed return cancelled
      expect(prismaMock.omsReturn.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ret-draft-1' },
          data: expect.objectContaining({
            status: OmsReturnStatus.cancelled,
          }),
        }),
      );

      // Order marked delivered
      expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: expect.objectContaining({
            status: OmsOrderStatus.delivered,
          }),
        }),
      );

      // COD triggered
      expect(codRecordsMock.generateForDeliveredOrder).toHaveBeenCalled();
    });

    it('rejects delivered rollback and flags conflict if return was already completed in warehouse', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'OMS-2026-001',
        companyId: 'comp-1',
        status: OmsOrderStatus.returned,
        outboundOrder: { id: 'out-1' },
        omsReturns: [
          { id: 'ret-completed-1', returnNumber: 'RET-001', status: OmsReturnStatus.completed },
        ],
      };
      prismaMock.omsOrder.findUnique.mockResolvedValueOnce(order);

      const res = await service.handleCarrierDeliveredEvent({
        omsOrderId: 'ord-1',
        awb: 'AWB-DELIV',
      });

      expect(res.actionTaken).toBe('carrier_delivered_conflict_ignored');

      // Order must NOT be changed to delivered!
      expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();

      // Conflict logged
      expect(prismaMock.omsOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'carrier.delivered_conflict_ignored',
          }),
        }),
      );
    });
  });
});
