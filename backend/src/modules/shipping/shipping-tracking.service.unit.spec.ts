import { ShippingTrackingService } from './shipping-tracking.service';
import { NormalizedTrackingEvent } from './shipping-provider.interface';

describe('ShippingTrackingService', () => {
  let service: ShippingTrackingService;
  let prismaMock: any;
  let registryMock: any;
  let autoReturnMock: any;
  let realtimeMock: any;
  let encryptionMock: any;

  beforeEach(() => {
    prismaMock = {
      carrierShipmentEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      carrierShipment: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      omsOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      outboundOrder: {
        update: jest.fn(),
      },
      omsOrderEvent: {
        create: jest.fn(),
      },
    };

    registryMock = {
      get: jest.fn(),
    };

    autoReturnMock = {
      processAutomatedReturn: jest.fn(),
      processCarrierReturnEvent: jest.fn(),
      handleCarrierDeliveredEvent: jest.fn().mockResolvedValue({ actionTaken: 'order_delivered' }),
    };

    realtimeMock = {
      emitOmsOrderEvent: jest.fn(),
    };

    encryptionMock = {
      decrypt: jest.fn((str) => str),
    };

    service = new ShippingTrackingService(
      prismaMock,
      registryMock,
      autoReturnMock,
      realtimeMock,
      encryptionMock,
    );
  });

  it('skips duplicate events idempotently when event already processed', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce({
      id: 'event-123',
      status: 'processed',
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      externalEventId: 'ext-evt-1',
      awb: 'AWB999',
      eventType: 'SHIPMENT_DELIVERED',
      normalizedStatus: 'delivered',
      rawPayload: { type: 'DELIVERED', awb: 'AWB999' },
    };

    const result = await service.processTrackingEvent(event);
    expect(result.success).toBe(true);
    expect(result.action).toBe('skipped_duplicate');
    expect(prismaMock.carrierShipment.findFirst).not.toHaveBeenCalled();
  });

  it('handles unmatched AWBs gracefully without throwing errors', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(null);

    const event: NormalizedTrackingEvent = {
      providerCode: 'SILA_SY',
      awb: 'NONEXISTENT_AWB',
      eventType: 'CARGO_STATUS',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { barcode: 'NONEXISTENT_AWB' },
    };

    const result = await service.processTrackingEvent(event);
    expect(result.success).toBe(false);
    expect(result.action).toBe('unmatched_awb');
    expect(prismaMock.carrierShipmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'unmatched_awb',
          awb: 'NONEXISTENT_AWB',
        }),
      }),
    );
  });

  it('updates order to delivered and prevents status regression', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-1',
      outboundOrder: {
        id: 'out-1',
        orderNumber: 'OUT-001',
        companyId: 'comp-1',
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'ORD-001',
          companyId: 'comp-1',
          status: 'out_for_delivery',
          createdBy: 'user-1',
        },
      },
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB123',
      eventType: 'SHIPMENT_DELIVERED',
      normalizedStatus: 'delivered',
      rawPayload: { awb: 'AWB123' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('order_delivered');
    expect(autoReturnMock.handleCarrierDeliveredEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        omsOrderId: 'oms-1',
        awb: 'AWB123',
      }),
    );

    // Now attempt a regression event (e.g. out_for_delivery after delivered)
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-1',
      outboundOrder: {
        id: 'out-1',
        orderNumber: 'OUT-001',
        companyId: 'comp-1',
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'ORD-001',
          companyId: 'comp-1',
          status: 'delivered',
          createdBy: 'user-1',
        },
      },
    });

    const regEvent: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB123',
      eventType: 'OUT_FOR_DELIVERY',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { awb: 'AWB123', step: 2 },
    };

    const regRes = await service.processTrackingEvent(regEvent);
    expect(regRes.success).toBe(true);
    // Should NOT have called omsOrder.update because rank regression is blocked
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
  });

  it('triggers carrier return event when carrier reports returned', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-2',
      outboundOrder: {
        id: 'out-2',
        orderNumber: 'OUT-002',
        companyId: 'comp-1',
        omsOrder: {
          id: 'oms-2',
          orderNumber: 'ORD-002',
          companyId: 'comp-1',
          status: 'shipped',
          createdBy: 'user-1',
        },
      },
    });
    autoReturnMock.processCarrierReturnEvent.mockResolvedValueOnce({
      success: true,
      returnId: 'ret-100',
      stage: 'returned_to_sender',
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-RET',
      eventType: 'SHIPMENT_RETURNED',
      normalizedStatus: 'returned_to_sender',
      carrierReturnStage: 'returned_to_sender',
      notes: 'Customer refused delivery',
      returnReason: 'Customer refused delivery',
      originalCarrierStatus: 'SHIPMENT_RETURNED',
      rawPayload: { awb: 'AWB-RET' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('carrier_return_returned_to_sender');
    expect(autoReturnMock.processCarrierReturnEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        omsOrderId: 'oms-2',
        awb: 'AWB-RET',
        stage: 'returned_to_sender',
        reason: 'Customer refused delivery',
      }),
    );
  });

  it('delegates delivered event to handleCarrierDeliveredEvent', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-3',
      outboundOrder: {
        id: 'out-3',
        orderNumber: 'OUT-003',
        companyId: 'comp-1',
        omsOrder: {
          id: 'oms-3',
          orderNumber: 'ORD-003',
          companyId: 'comp-1',
          status: 'shipped',
          createdBy: 'user-1',
        },
      },
    });
    autoReturnMock.handleCarrierDeliveredEvent.mockResolvedValueOnce({
      actionTaken: 'order_delivered_draft_return_cancelled',
      message: 'Order delivered and draft return cancelled',
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-DELIV',
      eventType: 'DELIVERED',
      normalizedStatus: 'delivered',
      notes: 'Delivered to customer',
      rawPayload: { awb: 'AWB-DELIV' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('order_delivered_draft_return_cancelled');
    expect(autoReturnMock.handleCarrierDeliveredEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        omsOrderId: 'oms-3',
        awb: 'AWB-DELIV',
      }),
    );
  });
});
