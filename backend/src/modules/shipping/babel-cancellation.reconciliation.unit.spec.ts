import { ShippingTrackingService } from './shipping-tracking.service';
import { mayCreateShipment } from './shipping-error';
import { PROVIDER_LOOKUP_NOT_FOUND_EVENT } from './shipping-lookup.util';
import type { NormalizedTrackingEvent } from './shipping-provider.interface';

describe('Babel cancellation reconciliation', () => {
  let service: ShippingTrackingService;
  let prismaMock: any;
  let autoReturnMock: any;

  function shipmentWithOms(overrides: {
    omsStatus: string;
    outboundStatus: string;
    providerCode?: string;
    shipmentStatus?: string;
    supersededAt?: Date | null;
    rawResultMeta?: unknown;
    trackingNumber?: string | null;
    carrier?: string;
  }) {
    return {
      id: 'ship-babel-cancel',
      providerCode: overrides.providerCode ?? 'BABEL_EXPRESS',
      status: overrides.shipmentStatus ?? 'created',
      supersededAt: overrides.supersededAt ?? null,
      trackingNumber: overrides.trackingNumber ?? '260303707929',
      externalAwb: '260303707929',
      rawResultMeta: overrides.rawResultMeta ?? {},
      outboundOrder: {
        id: 'out-babel-cancel',
        orderNumber: 'OUT-02291',
        companyId: 'comp-1',
        status: overrides.outboundStatus,
        carrier: overrides.carrier ?? 'Babel Express',
        trackingNumber: overrides.trackingNumber ?? '260303707929',
        omsOrder: {
          id: 'oms-babel-cancel',
          orderNumber: 'OMS-2026-02291',
          companyId: 'comp-1',
          status: overrides.omsStatus,
          carrier: overrides.carrier ?? 'Babel Express',
          trackingNumber: overrides.trackingNumber ?? '260303707929',
          createdBy: 'user-1',
        },
      },
    };
  }

  beforeEach(() => {
    prismaMock = {
      carrierShipmentEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      carrierShipment: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      omsOrder: { findFirst: jest.fn(), update: jest.fn() },
      outboundOrder: { update: jest.fn() },
      omsOrderEvent: { create: jest.fn() },
      omsBatchOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      carrierCostChange: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
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

  it('1. confirmed Babel cancel before handover releases the shipment and returns to Shipping Details', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'processing', outboundStatus: 'waiting_for_shipping_details' }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      notes: 'Reseller cancelled before handover',
      rawPayload: { type: 'Cancelled', awb: '260303707929' },
    });
    expect(res.action).toBe('pre_dispatch_carrier_failure_unlocked');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
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
          trackingNumber: null,
          carrier: null,
        }),
      }),
    );
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', supersededAt: expect.any(Date) }),
      }),
    );
  });

  it('2-3. confirmed cancel clears live carrier/AWB while historical movement keeps the AWB', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'ready_to_ship', outboundStatus: 'ready_to_ship' }),
    );
    await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { type: 'Cancelled', n: 2 },
    });
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trackingNumber: null, carrier: null }),
      }),
    );

    prismaMock.carrierShipmentEvent.findMany.mockResolvedValueOnce([
      {
        createdAt: new Date('2026-10-22T10:00:00.000Z'),
        processedAt: new Date('2026-10-22T10:00:00.000Z'),
        eventType: 'Cancelled',
        normalizedStatus: 'cancelled',
        awb: '260303707929',
      },
    ]);
    const historical = await service.getLocalShipmentMovement({
      shipment: {
        id: 'ship-babel-cancel',
        status: 'failed',
        supersededAt: new Date('2026-10-22T10:00:00.000Z'),
        trackingNumber: '260303707929',
        externalAwb: '260303707929',
        providerCode: 'BABEL_EXPRESS',
      },
      providerName: 'Babel Express',
    });
    expect(historical.shipmentState).toBe('superseded');
    expect(historical.awb).toBe('260303707929');
    expect(historical.cancellationUnconfirmed).toBe(false);
    expect(historical.events[0].title).toBe('Cancelled');
  });

  it('4. temporary Shipment not found or network error does not cancel an active shipment', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'processing', outboundStatus: 'waiting_for_shipping_details' }),
    );
    const notFound: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      externalEventId: `${PROVIDER_LOOKUP_NOT_FOUND_EVENT}:260303707929`,
      eventType: PROVIDER_LOOKUP_NOT_FOUND_EVENT,
      normalizedStatus: 'unknown',
      notes: 'Shipment not found',
      rawPayload: { lookupState: 'not_found', errorMessage: 'Shipment not found' },
    };
    const res = await service.processTrackingEvent(notFound);
    expect(res.action).toBe('provider_lookup_not_found');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.outboundOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.carrierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastErrorSafe: expect.stringMatching(/Cancellation is not confirmed/i),
          rawResultMeta: expect.objectContaining({
            babelLookup: expect.objectContaining({ state: 'not_found' }),
          }),
        }),
      }),
    );
    expect(prismaMock.carrierShipment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );

    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce({
      id: 'evt-nf',
      status: 'processed',
    });
    const duplicateLookup = await service.processTrackingEvent(notFound);
    expect(duplicateLookup.action).toBe('skipped_duplicate');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
  });

  it('5. unknown/pending Babel cancellation does not permit a replacement shipment', () => {
    expect(
      mayCreateShipment({
        hasCreated: true,
        ambiguousOutstanding: false,
        acknowledged: true,
      }),
    ).toEqual({ allow: false, reason: 'created' });
  });

  it('6. duplicate cancellation signals are idempotent', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'processing', outboundStatus: 'waiting_for_shipping_details' }),
    );
    const event: NormalizedTrackingEvent = {
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { type: 'Cancelled', dup: true },
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

  it('7. late events from a cancelled shipment cannot overwrite a replacement', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        shipmentStatus: 'failed',
        supersededAt: new Date('2026-10-22T11:00:00Z'),
        carrier: 'Sila',
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      eventType: 'EnRoute',
      normalizedStatus: 'in_transit',
      rawPayload: { type: 'EnRoute', awb: '260303707929', late: true },
    });
    expect(res.action).toBe('ignored_superseded_shipment');
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalled();
  });

  it('8. cancellation after handover/delivery/return cannot roll back OMS state', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'out_for_delivery', outboundStatus: 'out_for_delivery' }),
    );
    const ofd = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { type: 'Cancelled', stage: 'ofd' },
    });
    expect(ofd.action).toBe('order_carrier_cancelled_failed_delivery');
    expect(prismaMock.omsOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed_delivery' }),
      }),
    );
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'processing' }),
      }),
    );

    prismaMock.omsOrder.update.mockClear();
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({ omsStatus: 'delivered', outboundStatus: 'delivered' }),
    );
    const delivered = await service.processTrackingEvent({
      providerCode: 'BABEL_EXPRESS',
      awb: '260303707929',
      eventType: 'Cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { type: 'Cancelled', stage: 'delivered' },
    });
    expect(delivered.action).toMatch(/tracking_recorded|order_carrier_cancelled_failed_delivery/);
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'processing', trackingNumber: null }),
      }),
    );
  });

  it('9. Sila unsolicited cancellation before handover still unlocks', async () => {
    prismaMock.carrierShipment.findFirst.mockResolvedValueOnce(
      shipmentWithOms({
        omsStatus: 'processing',
        outboundStatus: 'waiting_for_shipping_details',
        providerCode: 'SILA_SY',
        carrier: 'Masarat',
        trackingNumber: 'SILA-AWB',
      }),
    );
    const res = await service.processTrackingEvent({
      providerCode: 'SILA_SY',
      awb: 'SILA-AWB',
      eventType: 'cargo.cancelled',
      normalizedStatus: 'cancelled',
      rawPayload: { event: 'cargo.cancelled', awb: 'SILA-AWB' },
    });
    expect(res.action).toBe('pre_dispatch_carrier_failure_unlocked');
  });
});
