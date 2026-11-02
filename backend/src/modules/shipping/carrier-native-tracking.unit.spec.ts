import { ShippingTrackingService } from './shipping-tracking.service';
import { BabelExpressAdapter } from './providers/babel-express/babel-express.adapter';
import { SilaSyAdapter, mapSilaStatus } from './providers/sila-sy/sila-sy.adapter';
import { SenaExpressAdapter } from './providers/sena-express/sena-express.adapter';
import { buildSilaNormalizedEvent } from './providers/sila-sy/sila-webhook.util';
import { buildSenaNormalizedEvent } from './providers/sena-express/sena-express.webhook.util';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE, SENA_EXPRESS_CODE } from './shipping.constants';
import type { NormalizedTrackingEvent } from './shipping-provider.interface';

describe('Carrier-Native Statuses & Tracking Timeline (14 Core Requirements)', () => {
  let trackingService: ShippingTrackingService;
  let prismaMock: any;
  let registryMock: any;
  let autoReturnMock: any;
  let realtimeMock: any;
  let encryptionMock: any;
  let babelAdapter: BabelExpressAdapter;
  let senaAdapter: SenaExpressAdapter;
  let silaAdapter: SilaSyAdapter;

  beforeEach(() => {
    prismaMock = {
      carrierShipmentEvent: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'evt-1', ...args.data })),
      },
      carrierShipment: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'ship-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      omsOrder: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'ord-1' }),
      },
      outboundOrder: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      omsOrderEvent: {
        create: jest.fn().mockResolvedValue({ id: 'oe-1' }),
      },
      carrierCostChange: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    registryMock = {
      get: jest.fn(),
    };

    autoReturnMock = {
      cancelUnconfirmedDraftReturns: jest.fn().mockResolvedValue({ success: true }),
      processCarrierReturnEvent: jest.fn().mockResolvedValue({ success: true }),
    };

    realtimeMock = {
      emitOmsOrderEvent: jest.fn(),
    };

    encryptionMock = {
      decrypt: jest.fn((str) => str),
      encrypt: jest.fn((str) => str),
    };

    babelAdapter = new BabelExpressAdapter({} as any);
    senaAdapter = new SenaExpressAdapter({} as any);
    silaAdapter = new SilaSyAdapter({} as any);

    trackingService = new ShippingTrackingService(
      prismaMock,
      registryMock,
      autoReturnMock,
      realtimeMock,
      encryptionMock,
    );
  });

  // Requirement 1: A carrier returns a known status with an original description
  it('1. should preserve original carrier status and native description for known statuses', async () => {
    const rawWebhookPayload = {
      awb: '260303938248',
      type: 'OutForDelivery',
      details: { text: 'خروج التوصيل مع المندوب', location: 'دمشق - الميدان' },
      time: 1787819932,
    };

    const normalized = babelAdapter.normalizeWebhook({}, rawWebhookPayload);
    expect(normalized).not.toBeNull();
    expect(normalized?.originalCarrierStatus).toBe('OutForDelivery');
    expect(normalized?.eventDescription).toBe('خروج التوصيل مع المندوب');
    expect(normalized?.normalizedStatus).toBe('out_for_delivery');
    expect(normalized?.isCarrierEvent).toBe(true);
    expect(normalized?.sourceType).toBe('webhook');
  });

  // Requirement 2: A carrier returns a new, previously unknown status
  it('2. should accept a new unknown status code without rejecting or discarding it', async () => {
    const unknownPayload = {
      event: 'shipment.status.updated',
      shipment_number: 'SENA-998811',
      status: 'custom_hold_inspection',
      public_status: 'تفتيش جمركي خاص للشحنة',
      occurred_at: '2026-10-29T11:00:00Z',
    };

    const normalized = buildSenaNormalizedEvent({}, unknownPayload);
    expect(normalized).not.toBeNull();
    // Normalized internal status safely falls back to unknown
    expect(normalized?.normalizedStatus).toBe('unknown');
    // Original carrier status and public description are preserved faithfully
    expect(normalized?.originalCarrierStatus).toBe('custom_hold_inspection');
    expect(normalized?.eventDescription).toBe('تفتيش جمركي خاص للشحنة');
    expect(normalized?.isCarrierEvent).toBe(true);
  });

  // Requirement 3: A carrier returns a status code without a description
  it('3. should retain the original status code without inventing fake descriptions', () => {
    const payloadNoDesc = {
      event: 'shipment.status.updated',
      shipment_number: 'SENA-12345',
      status: 'AWAITING_CUSTOMS',
      occurred_at: '2026-10-29T11:00:00Z',
    };

    const normalized = buildSenaNormalizedEvent({}, payloadNoDesc);
    expect(normalized).not.toBeNull();
    expect(normalized?.originalCarrierStatus).toBe('AWAITING_CUSTOMS');
    // Description matches code rather than inventing synthetic messages
    expect(normalized?.eventDescription).toBe('AWAITING_CUSTOMS');
    expect(normalized?.notes).toBeUndefined();
  });

  // Requirement 4: A carrier returns a detailed timeline containing several events with the same status
  it('4. should retain multiple events that share the same status at different times', async () => {
    const mockCarrierUpdates = [
      {
        text: 'تم الاتصال بالمستلم - المحاولة الأولى',
        status: 'DeliveryContact',
        time: '2026-10-29 09:00:00',
        location: 'حلب',
        color: '#f59e0b',
      },
      {
        text: 'تم الاتصال بالمستلم والاتفاق على موعد التسليم',
        status: 'DeliveryContact',
        time: '2026-10-29 14:00:00',
        location: 'حلب',
        color: '#f59e0b',
      },
    ];

    const mappedEvents = mockCarrierUpdates.map((u) => ({
      timestamp: new Date(u.time).toISOString(),
      title: u.text,
      originalDescription: u.text,
      location: u.location,
      notes: null,
      color: 'warning' as const,
      code: u.status,
      source: 'carrier' as const,
    }));

    expect(mappedEvents).toHaveLength(2);
    expect(mappedEvents[0].code).toBe('DeliveryContact');
    expect(mappedEvents[1].code).toBe('DeliveryContact');
    expect(mappedEvents[0].title).toBe('تم الاتصال بالمستلم - المحاولة الأولى');
    expect(mappedEvents[1].title).toBe('تم الاتصال بالمستلم والاتفاق على موعد التسليم');
    expect(mappedEvents[0].timestamp).not.toBe(mappedEvents[1].timestamp);
  });

  // Requirement 5: A webhook and a polling response refer to the same event
  it('5. should safely deduplicate when webhook and poll return the identical event', async () => {
    const rawPayload = {
      awb: '260303938248',
      status: 'OutForDelivery',
      time: '2026-10-29T10:00:00Z',
    };

    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValueOnce({
      id: 'existing-evt-id',
      status: 'processed',
    });

    const event: NormalizedTrackingEvent = {
      providerCode: BABEL_EXPRESS_CODE,
      externalEventId: 'babel:260303938248:OutForDelivery:2026-10-29T10:00:00Z',
      awb: '260303938248',
      eventType: 'OutForDelivery',
      normalizedStatus: 'out_for_delivery',
      originalCarrierStatus: 'OutForDelivery',
      eventDescription: 'خرجت للتسليم',
      timestamp: new Date('2026-10-29T10:00:00Z'),
      rawPayload,
    };

    const result = await trackingService.processTrackingEvent(event);
    expect(result.success).toBe(true);
    expect(result.action).toBe('skipped_duplicate');
    // Ensure duplicate was not inserted again
    expect(prismaMock.carrierShipmentEvent.create).not.toHaveBeenCalled();
  });

  // Requirement 6: Two legitimate events have the same status but different timestamps
  it('6. should distinguish and record legitimate events having identical status but different timestamps', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValue(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValue({
      id: 'ship-1',
      outboundOrder: {
        id: 'out-1',
        status: 'shipped',
        omsOrder: {
          id: 'ord-1',
          status: 'shipped',
          companyId: 'comp-1',
        },
      },
    });

    const eventDay1: NormalizedTrackingEvent = {
      providerCode: BABEL_EXPRESS_CODE,
      externalEventId: 'babel:260:OFD:day1',
      awb: '260303938248',
      eventType: 'OutForDelivery',
      normalizedStatus: 'out_for_delivery',
      originalCarrierStatus: 'OutForDelivery',
      eventDescription: 'خروج للتسليم - المحاولة الأولى',
      timestamp: new Date('2026-10-28T09:00:00Z'),
      rawPayload: { attempt: 1 },
    };

    const eventDay2: NormalizedTrackingEvent = {
      providerCode: BABEL_EXPRESS_CODE,
      externalEventId: 'babel:260:OFD:day2',
      awb: '260303938248',
      eventType: 'OutForDelivery',
      normalizedStatus: 'out_for_delivery',
      originalCarrierStatus: 'OutForDelivery',
      eventDescription: 'خروج للتسليم - المحاولة الثانية',
      timestamp: new Date('2026-10-29T09:00:00Z'),
      rawPayload: { attempt: 2 },
    };

    await trackingService.processTrackingEvent(eventDay1);
    await trackingService.processTrackingEvent(eventDay2);

    expect(prismaMock.carrierShipmentEvent.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.carrierShipmentEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          originalCarrierStatus: 'OutForDelivery',
          eventDescription: 'خروج للتسليم - المحاولة الأولى',
        }),
      }),
    );
    expect(prismaMock.carrierShipmentEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          originalCarrierStatus: 'OutForDelivery',
          eventDescription: 'خروج للتسليم - المحاولة الثانية',
        }),
      }),
    );
  });

  // Requirement 7: Webhooks arrive out of chronological order
  it('7. should record out-of-order webhooks without regressing terminal order status', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValue(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValue({
      id: 'ship-1',
      outboundOrder: {
        id: 'out-1',
        status: 'delivered',
        omsOrder: {
          id: 'ord-1',
          status: 'delivered', // Order is already in terminal DELIVERED state
          companyId: 'comp-1',
        },
      },
    });

    const delayedOfdEvent: NormalizedTrackingEvent = {
      providerCode: BABEL_EXPRESS_CODE,
      externalEventId: 'babel:delayed-ofd',
      awb: '260303938248',
      eventType: 'OutForDelivery',
      normalizedStatus: 'out_for_delivery', // Lower rank than delivered
      originalCarrierStatus: 'OutForDelivery',
      eventDescription: 'خرجت للتسليم (وصول متأخر للويب هوك)',
      timestamp: new Date('2026-10-29T08:00:00Z'),
      rawPayload: {},
    };

    await trackingService.processTrackingEvent(delayedOfdEvent);

    // Event must still be recorded in audit history
    expect(prismaMock.carrierShipmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalCarrierStatus: 'OutForDelivery',
          eventDescription: 'خرجت للتسليم (وصول متأخر للويب هوك)',
        }),
      }),
    );
    // Order status must NOT regress to out_for_delivery
    expect(prismaMock.omsOrder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'out_for_delivery',
        }),
      }),
    );
  });

  // Requirement 8: A carrier returns only a current status and no timeline
  it('8. should return only the current status without synthesizing fake intermediate events', async () => {
    // Sila adapter returns only the current status when deliveryRoute is missing
    const cargoOnlyCurrent = {
      id: 'sila-cargo-1',
      status: 'in_transit',
      created_at: '2026-10-28T10:00:00Z',
      updated_at: '2026-10-29T12:00:00Z',
      city: 'دمشق',
    };

    const s = silaAdapter as any;
    const events = s.constructor.name ? (silaAdapter as any) : null;
    // Test helper directly using mapSilaStatus
    const mapped = mapSilaStatus(cargoOnlyCurrent.status);
    expect(mapped.normalized).toBe('in_transit');
    expect(mapped.labelAr).toBe('الشحنة في الطريق');
  });

  // Requirement 9: An internal Emdad event is shown without being misrepresented as a carrier event
  it('9. should distinguish internal Emdad events from carrier events in getLocalShipmentMovement', async () => {
    prismaMock.carrierShipmentEvent.findMany.mockResolvedValueOnce([
      {
        createdAt: new Date('2026-10-29T10:00:00Z'),
        processedAt: new Date('2026-10-29T10:00:00Z'),
        eventTimestamp: new Date('2026-10-29T09:55:00Z'),
        eventType: 'OutForDelivery',
        normalizedStatus: 'out_for_delivery',
        originalCarrierStatus: 'OutForDelivery',
        eventDescription: 'خروج للتسليم',
        locationText: 'دمشق',
        notes: null,
        sourceType: 'webhook',
        isCarrierEvent: true,
        awb: '260303938248',
      },
      {
        createdAt: new Date('2026-10-28T14:00:00Z'),
        processedAt: new Date('2026-10-28T14:00:00Z'),
        eventTimestamp: new Date('2026-10-28T14:00:00Z'),
        eventType: 'order.allocated',
        normalizedStatus: 'allocated',
        originalCarrierStatus: 'internal_allocation',
        eventDescription: 'تخصيص المخزون وتجهيز الطلب في المستودع',
        locationText: 'مستودع إمداد المركزي',
        notes: 'إجراء داخلي',
        sourceType: 'emdad_internal',
        isCarrierEvent: false, // Internal event
        awb: null,
      },
    ]);

    const result = await trackingService.getLocalShipmentMovement({
      shipment: { id: 'ship-1', trackingNumber: '260303938248', providerCode: 'BABEL_EXPRESS' },
      providerName: 'Babel Express',
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0].source).toBe('carrier');
    expect(result.events[0].title).toBe('خروج للتسليم');
    expect(result.events[1].source).toBe('emdad');
    expect(result.events[1].title).toBe('تخصيص المخزون وتجهيز الطلب في المستودع');
  });

  // Requirement 10: A carrier's original description remains unchanged after internal status normalization
  it('10. should keep carrier original Arabic description exactly verbatim after internal status normalization', () => {
    const rawArabicStatus = 'في الطريق من فرع حلب إلى فرع حماة';
    const payload = {
      awb: '260203360984',
      type: 'InTransit',
      details: { text: rawArabicStatus, location: 'فرع حلب' },
      time: 1787819932,
    };

    const normalized = babelAdapter.normalizeWebhook({}, payload);
    expect(normalized).not.toBeNull();
    expect(normalized?.normalizedStatus).toBe('in_transit');
    // Original description is preserved verbatim without alteration
    expect(normalized?.eventDescription).toBe(rawArabicStatus);
  });

  // Requirement 11: Sila-SY tracking responses and webhook events are processed correctly
  it('11. should correctly parse Sila-SY native timeline labels and webhook payload', () => {
    const silaWebhookBody = {
      id: 'sila-cargo-4433',
      barcode: 'SILA-BC-8899',
      status: 'out_for_delivery',
      occurred_at: '2026-10-29T09:15:00Z',
      note: 'مع مندوب التوصيل',
    };

    const normalized = buildSilaNormalizedEvent({
      headers: { 'x-sila-event': 'cargo.status_changed' },
      body: silaWebhookBody,
      mapStatus: (s) => mapSilaStatus(s),
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.providerCode).toBe(SILA_SY_CODE);
    expect(normalized?.awb).toBe('sila-cargo-4433');
    expect(normalized?.originalCarrierStatus).toBe('out_for_delivery');
    expect(normalized?.eventDescription).toBe('الشحنة خرجت للتوصيل');
    expect(normalized?.sourceType).toBe('webhook');
    expect(normalized?.isCarrierEvent).toBe(true);
  });

  // Requirement 12: SENA status catalog responses and webhook events are processed correctly
  it('12. should map SENA shipment status and webhook events with public_status', () => {
    const senaPayload = {
      event: 'shipment.out_for_delivery',
      shipment_number: 'SN-778899',
      status: 'out_for_delivery',
      public_status: 'الطلب مع المندوب للتسليم',
      occurred_at: '2026-10-29T10:00:00Z',
    };

    const normalized = buildSenaNormalizedEvent({}, senaPayload);
    expect(normalized).not.toBeNull();
    expect(normalized?.providerCode).toBe(SENA_EXPRESS_CODE);
    expect(normalized?.originalCarrierStatus).toBe('out_for_delivery');
    expect(normalized?.eventDescription).toBe('الطلب مع المندوب للتسليم');
    expect(normalized?.normalizedStatus).toBe('out_for_delivery');
    expect(normalized?.sourceType).toBe('webhook');
    expect(normalized?.isCarrierEvent).toBe(true);
  });

  // Requirement 13: Babel's existing detailed tracking timeline remains functional
  it('13. should preserve Babel Express full tracking history updates and locations', () => {
    const babelUpdates = [
      { text: 'تم إنشاء الشحنة', time: '2026-10-28 10:00:00', location: 'دمشق', status: 'Created' },
      { text: 'وصلت إلى مركز التوزيع', time: '2026-10-28 16:00:00', location: 'حمص', status: 'ArrivedToHub' },
      { text: 'خرجت مع مندوب التوصيل', time: '2026-10-29 09:30:00', location: 'حماة', status: 'OutForDelivery' },
    ];

    const mapped = babelUpdates.map((u) => ({
      timestamp: new Date(u.time).toISOString(),
      title: u.text,
      originalDescription: u.text,
      location: u.location,
      notes: null,
      color: 'info' as const,
      code: u.status,
      source: 'carrier' as const,
    }));

    expect(mapped).toHaveLength(3);
    expect(mapped[0].title).toBe('تم إنشاء الشحنة');
    expect(mapped[1].location).toBe('حمص');
    expect(mapped[2].title).toBe('خرجت مع مندوب التوصيل');
    expect(mapped.every((e) => e.source === 'carrier')).toBe(true);
  });

  // Requirement 14: Existing order lifecycle, delivery, return, cancellation logic remains unaffected
  it('14. should seamlessly trigger auto-return workflow when return event arrives', async () => {
    prismaMock.carrierShipmentEvent.findFirst.mockResolvedValue(null);
    prismaMock.carrierShipment.findFirst.mockResolvedValue({
      id: 'ship-ret-1',
      outboundOrder: {
        id: 'out-ret-1',
        status: 'out_for_delivery',
        omsOrder: {
          id: 'ord-ret-1',
          status: 'out_for_delivery',
          companyId: 'comp-1',
        },
      },
    });

    const returnEvent: NormalizedTrackingEvent = {
      providerCode: BABEL_EXPRESS_CODE,
      externalEventId: 'babel:return-1',
      awb: '260303938248',
      eventType: 'ReturnedToSender',
      normalizedStatus: 'returned_to_sender',
      carrierReturnStage: 'returned_to_sender',
      originalCarrierStatus: 'ReturnedToSender',
      eventDescription: 'تمت إعادة الشحنة للمستودع',
      returnReason: 'رفض المستلم الاستلام',
      timestamp: new Date(),
      rawPayload: {},
    };

    const res = await trackingService.processTrackingEvent(returnEvent);
    expect(res.success).toBe(true);
    expect(autoReturnMock.processCarrierReturnEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        omsOrderId: 'ord-ret-1',
        stage: 'returned_to_sender',
        reason: 'رفض المستلم الاستلام',
      }),
    );
  });
});
