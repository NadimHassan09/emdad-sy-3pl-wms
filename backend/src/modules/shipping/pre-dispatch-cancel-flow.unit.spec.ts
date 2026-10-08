import { ShippingTrackingService } from './shipping-tracking.service';
import type { NormalizedTrackingEvent } from './shipping-provider.interface';

/**
 * Critical E2E-shaped unit flow:
 * Send→Confirm (ready_to_ship) → carrier cancel webhook → unlock + red issueNote.
 * Re-send eligibility is implied by shipment status=failed (no created AWB left).
 */
describe('Critical pre-dispatch cancel flow', () => {
  let service: ShippingTrackingService;
  let prismaMock: any;
  let autoReturnMock: any;

  beforeEach(() => {
    prismaMock = {
      carrierShipmentEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      carrierShipment: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      omsOrder: { findFirst: jest.fn(), update: jest.fn() },
      outboundOrder: { update: jest.fn() },
      omsOrderEvent: { create: jest.fn() },
      omsBatchOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    autoReturnMock = {
      processCarrierReturnEvent: jest.fn(),
      handleCarrierDeliveredEvent: jest.fn(),
      cancelUnconfirmedDraftReturns: jest.fn(),
    };
    service = new ShippingTrackingService(
      prismaMock,
      { get: jest.fn() } as any,
      autoReturnMock,
      { emitOmsOrderEvent: jest.fn() } as any,
      { decrypt: (s: string) => s } as any,
    );
  });

  it('Send→Confirm→Waiting→Cancel webhook → unlock + batch RED reason', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce({
      id: 'cs-1',
      externalAwb: 'AWB-CRIT',
      providerCode: 'BABEL_EXPRESS',
      status: 'created',
      outboundOrder: {
        id: 'out-1',
        status: 'ready_to_ship',
        companyId: 'c1',
        carrier: 'Babel Express',
        trackingNumber: 'AWB-CRIT',
        omsOrder: {
          id: 'oms-1',
          orderNumber: 'OMS-CRIT',
          companyId: 'c1',
          status: 'ready_to_ship',
          carrier: 'Babel Express',
          trackingNumber: 'AWB-CRIT',
          createdBy: 'u1',
        },
      },
    });

    const cancelEvent: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: 'AWB-CRIT',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      notes: 'Waiting for dispatch cancelled',
      returnReason: 'Waiting for dispatch cancelled',
      originalCarrierStatus: 'Cancelled',
      rawPayload: { type: 'Cancelled', awb: 'AWB-CRIT' },
    };

    const res = await service.processTrackingEvent(cancelEvent);

    expect(res.action).toBe('pre_dispatch_carrier_failure_unlocked');

    // Confirm removed
    expect(prismaMock.outboundOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'out-1' },
        data: expect.objectContaining({
          status: 'waiting_for_shipping_details',
          trackingNumber: null,
        }),
      }),
    );

    // Tracking cleared on OMS
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { trackingNumber: null },
      }),
    );

    // Shipment superseded (failed) so re-send is eligible
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          lastErrorSafe: expect.stringMatching(/Provider cancelled/i),
        }),
      }),
    );

    // Batch row RED + reason + carrier + AWB visible in issueNote
    expect(prismaMock.omsBatchOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { omsOrderId: 'oms-1', removedAt: null },
        data: {
          issueNote: expect.stringMatching(
            /Provider cancelled:.*Carrier: Babel Express.*AWB: AWB-CRIT/,
          ),
        },
      }),
    );

    // Must not create return draft or commercially cancel
    expect(autoReturnMock.processCarrierReturnEvent).not.toHaveBeenCalled();
  });
});
