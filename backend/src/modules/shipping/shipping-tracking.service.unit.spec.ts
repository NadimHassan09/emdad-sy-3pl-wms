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
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
      omsBatchOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    registryMock = {
      get: jest.fn(),
    };

    autoReturnMock = {
      processAutomatedReturn: jest.fn(),
      processCarrierReturnEvent: jest.fn(),
      handleCarrierDeliveredEvent: jest.fn().mockResolvedValue({ actionTaken: 'order_delivered' }),
      cancelUnconfirmedDraftReturns: jest.fn().mockResolvedValue({ cancelledIds: [] }),
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

  it('pre-OFD cancel unlocks shipping, undoes confirm, and flags batch issueNote', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-pre',
      outboundOrder: {
        id: 'out-pre',
        orderNumber: 'OUT-PRE',
        companyId: 'comp-1',
        status: 'ready_to_ship',
        carrier: 'Babel Express',
        omsOrder: {
          id: 'oms-pre',
          orderNumber: 'ORD-PRE',
          companyId: 'comp-1',
          status: 'ready_to_ship',
          carrier: 'Babel Express',
          createdBy: 'user-1',
        },
      },
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-CANCEL-PRE',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      notes: 'Cancelled by carrier',
      returnReason: 'Cancelled by carrier',
      rawPayload: { awb: 'AWB-CANCEL-PRE' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('pre_dispatch_carrier_failure_unlocked');
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
    expect(prismaMock.outboundOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'waiting_for_shipping_details',
          trackingNumber: null,
        }),
      }),
    );
    expect(prismaMock.omsBatchOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueNote: expect.stringContaining('Provider cancelled'),
        }),
      }),
    );
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trackingNumber: null }),
      }),
    );
    // Must NOT commercially cancel the OMS order
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelled' }),
      }),
    );
  });

  it('post-OFD cancel maps to failed_delivery without a return draft', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-post',
      outboundOrder: {
        id: 'out-post',
        orderNumber: 'OUT-POST',
        companyId: 'comp-1',
        status: 'out_for_delivery',
        omsOrder: {
          id: 'oms-post',
          orderNumber: 'ORD-POST',
          companyId: 'comp-1',
          status: 'out_for_delivery',
          createdBy: 'user-1',
        },
      },
    });
    autoReturnMock.processCarrierReturnEvent.mockResolvedValueOnce({
      success: true,
      returnId: 'ret-post',
      stage: 'return_created',
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'SILA_SY',
      awb: 'AWB-CANCEL-POST',
      eventType: 'cancelled',
      normalizedStatus: 'cancelled',
      notes: 'Lost package',
      rawPayload: { awb: 'AWB-CANCEL-POST' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('order_carrier_cancelled_failed_delivery');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed_delivery' }),
      }),
    );
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
    expect(prismaMock.omsBatchOrder.updateMany).not.toHaveBeenCalled();
  });

  it('OFD after failed_delivery cancels unconfirmed draft returns', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-ofd',
      outboundOrder: {
        id: 'out-ofd',
        orderNumber: 'OUT-OFD',
        companyId: 'comp-1',
        status: 'out_for_delivery',
        omsOrder: {
          id: 'oms-ofd',
          orderNumber: 'ORD-OFD',
          companyId: 'comp-1',
          status: 'failed_delivery',
          createdBy: 'user-1',
        },
      },
    });
    autoReturnMock.cancelUnconfirmedDraftReturns.mockResolvedValueOnce({
      cancelledIds: ['ret-1'],
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-OFD',
      eventType: 'OutForDelivery',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { awb: 'AWB-OFD' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('order_out_for_delivery_draft_return_cancelled');
    expect(autoReturnMock.cancelUnconfirmedDraftReturns).toHaveBeenCalledWith(
      expect.objectContaining({ omsOrderId: 'oms-ofd' }),
    );
  });
});
