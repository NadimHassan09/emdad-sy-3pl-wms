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
        findUnique: jest.fn().mockResolvedValue({ rawResultMeta: {}, trackingNumber: null }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      omsOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      omsReturn: {
        findFirst: jest.fn().mockResolvedValue(null),
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
      carrierCostChange: {
        findMany: jest.fn().mockResolvedValue([]),
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

  it('ignores stale carrier return event if return was rolled back', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-rb',
      outboundOrder: {
        id: 'out-rb',
        orderNumber: 'OUT-RB',
        companyId: 'comp-1',
        omsOrder: {
          id: 'oms-rb',
          orderNumber: 'ORD-RB',
          companyId: 'comp-1',
          status: 'out_for_delivery',
        },
      },
    });

    prismaMock.omsReturn.findFirst.mockResolvedValueOnce({
      id: 'ret-cancelled',
      returnNumber: 'RET-RB-1',
      status: 'cancelled',
      notes: 'Rollback executed on 2026-10-24 by super_admin',
    });

    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-RB',
      eventType: 'SHIPMENT_RETURNED',
      normalizedStatus: 'returned_to_sender',
      carrierReturnStage: 'returned_to_sender',
      notes: 'Late webhook arrival',
      rawPayload: { awb: 'AWB-RB' },
    };

    const res = await service.processTrackingEvent(event);
    expect(res.success).toBe(true);
    expect(res.action).toBe('ignored_rolled_back_return');
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
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
      providerCode: 'BABEL_EXPRESS',
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

  it('does not create a return for failed delivery', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-fail',
      providerCode: 'SILA_SY',
      rawResultMeta: {},
      outboundOrder: {
        id: 'out-fail',
        companyId: 'comp-1',
        status: 'out_for_delivery',
        omsOrder: {
          id: 'oms-fail',
          status: 'out_for_delivery',
          createdBy: 'user-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-FAIL',
        },
      },
    });

    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'sila-fail',
      eventType: 'cargo.status_changed',
      normalizedStatus: 'delivery_failed',
      rawPayload: { id: 'sila-fail', new_status: 'failed' },
    });
    expect(res.action).toBe('order_delivery_failed');
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
    expect(autoReturnMock.cancelUnconfirmedDraftReturns).toHaveBeenCalledWith(
      expect.objectContaining({ omsOrderId: 'oms-fail' }),
    );
  });

  it('opens a pending return even when OMS is already delivered', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-ret',
      providerCode: 'SILA_SY',
      rawResultMeta: {},
      outboundOrder: {
        id: 'out-ret',
        companyId: 'comp-1',
        status: 'delivered',
        omsOrder: {
          id: 'oms-ret',
          status: 'delivered',
          createdBy: 'user-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-RET',
        },
      },
    });
    autoReturnMock.processCarrierReturnEvent.mockResolvedValueOnce({
      success: true,
      returnId: 'ret-1',
      stage: 'returned_to_sender',
    });

    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'sila-ret',
      eventType: 'cargo.returned',
      normalizedStatus: 'returned',
      carrierReturnStage: 'returned_to_sender',
      timestamp: new Date('2026-10-21T12:00:00.000Z'),
      rawPayload: { id: 'sila-ret', new_status: 'returned' },
    });
    expect(res.action).toBe('carrier_return_returned_to_sender');
    expect(autoReturnMock.processCarrierReturnEvent).toHaveBeenCalledWith(
      expect.objectContaining({ omsOrderId: 'oms-ret' }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'returned' }) }),
    );
  });

  it('ignores cargo.cancelled while silaCancel is pending_confirmation and does not PUT cancel', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-pending',
      providerCode: 'SILA_SY',
      rawResultMeta: {
        silaCancel: {
          state: 'pending_confirmation',
          courierCancel: 'pending_confirmation',
          at: '2026-10-21T10:00:00.000Z',
        },
      },
      outboundOrder: {
        id: 'out-pending',
        companyId: 'comp-1',
        status: 'shipped',
        omsOrder: {
          id: 'oms-pending',
          status: 'shipped',
          createdBy: 'user-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-PENDING',
        },
      },
    });

    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'sila-pending',
      eventType: 'cargo.cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { id: 'sila-pending', new_status: 'cancelled' },
    });
    expect(res.action).toBe('sila_cancel_pending_ignored_cargo_cancelled');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
    );
  });

  it('cancels OMS on unsolicited Sila cancel when not pending', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-unsol',
      providerCode: 'SILA_SY',
      rawResultMeta: {},
      outboundOrder: {
        id: 'out-unsol',
        companyId: 'comp-1',
        status: 'shipped',
        omsOrder: {
          id: 'oms-unsol',
          status: 'shipped',
          createdBy: 'user-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-UNSOL',
        },
      },
    });

    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'sila-unsol',
      eventType: 'cargo.cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { id: 'sila-unsol', new_status: 'cancelled' },
    });
    expect(res.action).toBe('order_cancelled_from_sila');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
    );
  });

  it('updates carrier barcode without changing OMS status', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-bar',
      providerCode: 'SILA_SY',
      trackingNumber: null,
      rawResultMeta: {
        silaCancel: { state: 'pending_confirmation', at: '2026-10-21T10:00:00.000Z' },
      },
      outboundOrder: {
        id: 'out-bar',
        companyId: 'comp-1',
        status: 'shipped',
        omsOrder: {
          id: 'oms-bar',
          status: 'shipped',
          createdBy: 'user-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-BAR',
        },
      },
    });
    prismaMock.carrierShipment.findUnique.mockResolvedValue({
      rawResultMeta: {
        silaCancel: { state: 'pending_confirmation', at: '2026-10-21T10:00:00.000Z' },
      },
      trackingNumber: null,
    });

    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'sila-bar',
      eventType: 'cargo.courier_barcode_assigned',
      normalizedStatus: 'unknown',
      rawPayload: {
        id: 'sila-bar',
        courier_barcode: '100537003427',
        shipments: [{ remote_label_code: '100537003427' }],
      },
    });
    expect(res.action).toBe('tracking_recorded:unknown');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { trackingNumber: '100537003427' } }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: expect.anything() }) }),
    );
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawResultMeta: expect.objectContaining({
            silaCancel: expect.objectContaining({ state: 'pending_confirmation' }),
          }),
        }),
      }),
    );
  });

  it('dedups Sila dual terminal events and delivery retries', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce({
      id: 'evt-1',
      status: 'processed',
    });
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      externalEventId: 'sila:cargo-1:delivered:2026-10-21T10:00:00.000Z',
      deliveryId: 'del-2',
      awb: 'cargo-1',
      eventType: 'cargo.delivered',
      normalizedStatus: 'delivered',
      rawPayload: { id: 'cargo-1', new_status: 'delivered' },
    });
    expect(res.action).toBe('skipped_duplicate');
  });

  it('stores X-Sila-Delivery as the idempotency key so retries do not re-apply', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-del',
      providerCode: 'SILA_SY',
      trackingNumber: '100542694368',
      rawResultMeta: {},
      outboundOrder: {
        id: 'out-del',
        companyId: 'comp-1',
        status: 'processing',
        omsOrder: {
          id: 'oms-del',
          status: 'processing',
          createdBy: 'user-1',
          companyId: 'comp-1',
          orderNumber: 'ORD-DEL',
        },
      },
    });
    prismaMock.carrierShipment.findUnique.mockResolvedValue({
      rawResultMeta: {},
      trackingNumber: '100542694368',
    });

    await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      externalEventId: 'sila:cargo-1:unknown:2026-10-21T10:00:00.000Z',
      deliveryId: 'del-retry-1',
      awb: 'cargo-1',
      eventType: 'cargo.courier_barcode_assigned',
      normalizedStatus: 'unknown',
      rawPayload: { id: 'cargo-1', courier_barcode: '100542694368' },
    });

    expect(prismaMock.carrierShipmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalEventId: 'sila-delivery:del-retry-1',
          eventType: 'cargo.courier_barcode_assigned',
        }),
      }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: expect.anything() }) }),
    );
  });

  it('requestSilaCancel while pending only polls and does not PUT cancel again', async () => {
    const pollTracking = jest.fn().mockResolvedValue({
      originalCarrierStatus: 'cancelled',
      rawPayload: { status: 'cancelled' },
    });
    const cancelShipment = jest.fn();
    registryMock.get.mockReturnValue({ pollTracking, cancelShipment });
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'ship-1',
      externalAwb: 'cargo-1',
      rawResultMeta: {
        silaCancel: { state: 'pending_confirmation', courierCancel: 'pending_confirmation', at: 't' },
      },
      provider: {
        connection: { status: 'connected', encryptedUsername: 'key', encryptedPassword: '' },
      },
    });

    const res = await service.requestSilaCancel({ outboundOrderId: 'out-1' });
    expect(res?.outcome).toBe('pending_confirmation');
    expect(pollTracking).toHaveBeenCalledWith({ username: 'key', password: '' }, 'cargo-1');
    expect(cancelShipment).not.toHaveBeenCalled();
  });

  function shipmentWithOms(overrides: {
    omsStatus: string;
    outboundStatus: string;
    providerCode?: string;
    shipmentStatus?: string;
    supersededAt?: Date | null;
    rawResultMeta?: unknown;
    shippingServiceId?: string;
    carrier?: string;
  }) {
    return {
      id: 'ship-life',
      providerCode: overrides.providerCode ?? 'BABEL_EXPRESS',
      status: overrides.shipmentStatus ?? 'created',
      supersededAt: overrides.supersededAt ?? null,
      rawResultMeta: overrides.rawResultMeta ?? {},
      outboundOrder: {
        id: 'out-life',
        orderNumber: 'OUT-LIFE',
        companyId: 'comp-1',
        status: overrides.outboundStatus,
        carrier: overrides.carrier ?? 'Babel Express',
        trackingNumber: 'AWB-LIFE',
        shippingServiceId: overrides.shippingServiceId ?? null,
        omsOrder: {
          id: 'oms-life',
          orderNumber: 'ORD-LIFE',
          companyId: 'comp-1',
          status: overrides.omsStatus,
          carrier: overrides.carrier ?? 'Babel Express',
          trackingNumber: 'AWB-LIFE',
          shippingServiceId: overrides.shippingServiceId ?? null,
          createdBy: 'user-1',
        },
      },
    };
  }

  it('1. definitive cancel from Waiting for Shipping Confirmation unlinks the carrier', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'processing', outboundStatus: 'waiting_for_shipping_details' }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      notes: 'Provider cancelled before confirm',
      rawPayload: { awb: 'AWB-LIFE', n: 1 },
    });
    expect(res.action).toBe('pre_dispatch_carrier_failure_unlocked');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'processing',
          carrier: null,
          shippingProviderCode: null,
          shippingServiceId: null,
          trackingNumber: null,
        }),
      }),
    );
    expect(prismaMock.outboundOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'waiting_for_shipping_details',
          carrier: null,
          trackingNumber: null,
        }),
      }),
    );
  });

  it('2. definitive cancel from Ready to Ship returns the order to Shipping Details', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'ready_to_ship', outboundStatus: 'ready_to_ship' }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      notes: 'Cancelled at dispatch',
      rawPayload: { awb: 'AWB-LIFE', n: 2 },
    });
    expect(res.action).toBe('pre_dispatch_carrier_failure_unlocked');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ready_to_ship', carrier: null }),
      }),
    );
    expect(prismaMock.outboundOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'waiting_for_shipping_details' }),
      }),
    );
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', supersededAt: expect.any(Date) }),
      }),
    );
  });

  it('3. Sila pending cancellation does not release the carrier association', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
        shippingServiceId: 'SILA_SY:cour-1:area',
        rawResultMeta: { silaCancel: { state: 'pending_confirmation' } },
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'AWB-LIFE',
      eventType: 'cargo.cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { event: 'cargo.cancelled', awb: 'AWB-LIFE' },
    });
    expect(res.action).toBe('sila_cancel_pending_ignored_cargo_cancelled');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ carrier: null }) }),
    );
    expect(prismaMock.outboundOrder.update).not.toHaveBeenCalled();
  });

  it('4. delayed event from the old shipment cannot overwrite a newly assigned carrier', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        shipmentStatus: 'failed',
        supersededAt: new Date('2026-10-21T12:00:00Z'),
        carrier: 'New Courier',
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'EnRoute',
      normalizedStatus: 'in_transit',
      rawPayload: { awb: 'AWB-LIFE', delayed: true },
    });
    expect(res.action).toBe('ignored_superseded_shipment');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.outboundOrder.update).not.toHaveBeenCalled();
  });

  it('6. late TARABUT webhook cannot overwrite the current Babel carrier or AWB', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        providerCode: 'SILA_SY',
        shipmentStatus: 'failed',
        supersededAt: new Date('2026-10-22T09:30:00Z'),
        carrier: 'Babel Express',
        shippingServiceId: 'BABEL_EXPRESS:address',
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'TARABUT-OLD-AWB',
      eventType: 'cargo.status',
      normalizedStatus: 'in_transit',
      rawPayload: {
        courier_name: 'ترابط',
        courier_barcode: 'TARABUT-OLD-AWB',
        shipments: [{ remote_label_code: 'TARABUT-OLD-AWB' }],
      },
    });
    expect(res.action).toBe('ignored_superseded_shipment');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.outboundOrder.update).not.toHaveBeenCalled();
  });

  it('late return event from a superseded shipment does not create an active return', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'out_for_delivery',
        outboundStatus: 'out_for_delivery',
        shipmentStatus: 'failed',
        supersededAt: new Date('2026-10-22T09:30:00Z'),
        providerCode: 'BABEL_EXPRESS',
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'ReturnedToSender',
      normalizedStatus: 'returned',
      carrierReturnStage: 'returned_to_sender',
      rawPayload: { awb: 'AWB-LIFE', stale: true },
    });
    expect(res.action).toBe('ignored_superseded_shipment');
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
  });

  it('5. carrier reassignment updates the live carrier only from confirmed Sila data', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'out_for_delivery',
        outboundStatus: 'out_for_delivery',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
        shippingServiceId: 'SILA_SY:old-cour:area-1',
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'AWB-LIFE',
      eventType: 'cargo.status',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { courier_id: 'new-cour', courier: { name: 'Tarabut' } },
    });
    expect(res.success).toBe(true);
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carrier: 'ترابط',
          shippingServiceId: 'SILA_SY:new-cour:area-1',
        }),
      }),
    );

    prismaMock.omsOrder.update.mockClear();
    prismaMock.outboundOrder.update.mockClear();
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'out_for_delivery',
        outboundStatus: 'out_for_delivery',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
        shippingServiceId: 'SILA_SY:old-cour:area-1',
      }),
    );
    await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'AWB-LIFE',
      eventType: 'cargo.status',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { status: 'out_for_delivery' },
    });
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shippingServiceId: expect.anything() }),
      }),
    );
  });

  it('11. duplicate cancellation does not duplicate unlock effects', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'ready_to_ship', outboundStatus: 'ready_to_ship' }),
    );
    const event = {
      providerCode: 'BABEL_EXPRESS' as const,
      awb: 'AWB-LIFE',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled' as const,
      rawPayload: { awb: 'AWB-LIFE', dup: true },
    };
    const first = await service.processTrackingEvent(event);
    expect(first.action).toBe('pre_dispatch_carrier_failure_unlocked');
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce({
      id: 'evt-dup',
      status: 'processed',
    });
    const second = await service.processTrackingEvent(event);
    expect(second.action).toBe('skipped_duplicate');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledTimes(1);
  });

  it('12. Babel Disposed is not a cancellation and Sila OFD is unchanged', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'processing', outboundStatus: 'waiting_for_shipping_details' }),
    );
    const babel = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'Disposed',
      normalizedStatus: 'unknown',
      rawPayload: { type: 'Disposed', awb: 'AWB-LIFE' },
    });
    expect(babel.action).toBe('tracking_recorded:unknown');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.carrierShipment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );

    prismaMock.omsOrder.update.mockClear();
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'shipped',
        outboundStatus: 'shipped',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
      }),
    );
    const sila = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'AWB-LIFE',
      eventType: 'cargo.out_for_delivery',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { event: 'cargo.out_for_delivery' },
    });
    expect(sila.action).toBe('order_out_for_delivery');
  });

  it('1. Sila/carrier acceptance does not auto-advance Emdad operator-confirmed states', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
      }),
    );
    const accepted = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'AWB-LIFE',
      eventType: 'cargo.accepted',
      normalizedStatus: 'in_transit',
      rawPayload: { event: 'cargo.accepted', courier_id: 'cour-1', courier: { name: 'Masarat' } },
    });
    expect(accepted.action).toBe('tracking_recorded:in_transit');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'shipped' }) }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ready_to_ship' }) }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'out_for_delivery' }) }),
    );

    prismaMock.omsOrder.update.mockClear();
    prismaMock.outboundOrder.update.mockClear();
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'ready_to_ship',
        outboundStatus: 'ready_to_ship',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
      }),
    );
    const ofd = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'AWB-LIFE',
      eventType: 'cargo.out_for_delivery',
      normalizedStatus: 'out_for_delivery',
      rawPayload: { event: 'cargo.out_for_delivery' },
    });
    expect(ofd.action).toBe('tracking_recorded:out_for_delivery');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'out_for_delivery' }) }),
    );
  });

  it('keeps Karam with the new AWB and never pairs it with the previous TARABUT AWB', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      ...shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        providerCode: 'SILA_SY',
        carrier: 'TARABUT',
        shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
      }),
      trackingNumber: 'TARABUT-OLD-AWB',
    });
    prismaMock.carrierShipment.findUnique.mockResolvedValue({
      rawResultMeta: {
        courier_name: 'ترابط',
        shipments: [{ remote_label_code: 'TARABUT-OLD-AWB' }],
      },
      trackingNumber: 'TARABUT-OLD-AWB',
    });
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'sila-cargo',
      eventType: 'cargo.status',
      normalizedStatus: 'in_transit',
      rawPayload: {
        courier_id: '9575208d-3587-4d23-84b3-cdc97d09b60e',
        courier: { name: 'Karam' },
        courier_barcode: 'KARAM-NEW-AWB',
        shipments: [{ remote_label_code: 'KARAM-NEW-AWB' }],
      },
    });
    expect(res.action).toBe('tracking_recorded:in_transit');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carrier: 'كرم للشحن',
          shippingServiceId: 'SILA_SY:9575208d-3587-4d23-84b3-cdc97d09b60e:area',
        }),
      }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trackingNumber: null }),
      }),
    );
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trackingNumber: 'KARAM-NEW-AWB' }),
      }),
    );
  });

  it('records ChangedReceiver without advancing OMS to Ready to Ship', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'processing', outboundStatus: 'waiting_for_shipping_details' }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'ChangedReceiver',
      normalizedStatus: 'in_transit',
      rawPayload: { type: 'ChangedReceiver', awb: 'AWB-LIFE' },
    });
    expect(res.action).toBe('tracking_recorded:in_transit');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ready_to_ship' }) }),
    );
  });

  it('does not create a return from CreatedFollowupShipment receiverChange', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'out_for_delivery', outboundStatus: 'out_for_delivery' }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-LIFE',
      eventType: 'CreatedFollowupShipment',
      normalizedStatus: 'unknown',
      rawPayload: {
        type: 'CreatedFollowupShipment',
        awb: 'AWB-LIFE',
        details: { newAwb: 'RET-1', followupType: 'receiverChange' },
      },
    });
    expect(res.action).toBe('tracking_recorded:unknown');
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
    expect(autoReturnMock.processAutomatedReturn).not.toHaveBeenCalled();
  });

  it('10. confirmed courier change without a new AWB shows the new carrier with pending AWB', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      ...shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        providerCode: 'SILA_SY',
        carrier: 'مسارات',
        shippingServiceId: 'SILA_SY:old-cour:area-1',
      }),
      trackingNumber: 'OLD-AWB',
    });
    prismaMock.carrierShipment.findUnique.mockResolvedValue({
      rawResultMeta: {},
      trackingNumber: 'OLD-AWB',
    });
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'OLD-AWB',
      eventType: 'cargo.status',
      normalizedStatus: 'in_transit',
      rawPayload: { courier_id: 'new-cour', courier: { name: 'Tarabut' } },
    });
    expect(res.action).toBe('tracking_recorded:in_transit');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carrier: 'ترابط',
          shippingServiceId: 'SILA_SY:new-cour:area-1',
          trackingNumber: null,
        }),
      }),
    );
  });
});
