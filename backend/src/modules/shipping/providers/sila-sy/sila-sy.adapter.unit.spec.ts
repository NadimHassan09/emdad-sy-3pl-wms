import { BadRequestException } from '@nestjs/common';
import { SilaSyAdapter, buildSilaServiceId } from './sila-sy.adapter';
import { SilaSyApiError, SilaSyHttpClient } from './sila-sy.http-client';
import { SILA_SY_CODE } from '../../shipping.constants';

describe('SilaSyAdapter', () => {
  let adapter: SilaSyAdapter;
  let mockHttp: jest.Mocked<SilaSyHttpClient>;

  const credentials = { username: 'sila_live_testkey123', password: '' };

  beforeEach(() => {
    mockHttp = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      getEnvelope: jest.fn(),
    } as unknown as jest.Mocked<SilaSyHttpClient>;
    adapter = new SilaSyAdapter(mockHttp);
  });

  describe('testConnection', () => {
    it('returns ok: true when GET /cargos succeeds', async () => {
      mockHttp.get.mockResolvedValueOnce({ data: [], count: 0 });
      const result = await adapter.testConnection(credentials);
      expect(result).toEqual({ ok: true, message: 'Sila-SY.com connection OK.' });
      expect(mockHttp.get).toHaveBeenCalledWith('cargos?limit=1', 'sila_live_testkey123');
    });

    it('returns user-friendly error on invalid API key error', async () => {
      mockHttp.get.mockRejectedValueOnce(new Error('invalid api key'));
      const result = await adapter.testConnection(credentials);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('rejected these credentials');
    });
  });

  describe('getServiceOptions', () => {
    it('returns empty array when governorate is missing', async () => {
      const results = await adapter.getServiceOptions(credentials, {
        receiverLat: 0,
        receiverLng: 0,
        packageType: 'box',
        weightKg: 2,
        deliveryType: 'address',
      });
      expect(results).toEqual([]);
    });

    it('returns formatted quotes for priced couriers', async () => {
      mockHttp.post.mockResolvedValueOnce({
        area_id: '123',
        couriers: [
          {
            courier_id: 'cour_1',
            name: 'Fast Express',
            delivery_fee: 3.5,
            currency: 'USD',
            estimated_days: 2,
            coverage_note: 'priced',
            logo: 'https://example.com/logo.png',
          },
          {
            courier_id: 'cour_2',
            name: 'Slow Express',
            delivery_fee: 5.0,
            currency: 'USD',
            coverage_note: 'priced',
          },
          {
            courier_id: 'cour_3',
            name: 'Unpriced Express',
            delivery_fee: 0,
            coverage_note: 'not_serviced',
          },
        ],
      });

      const options = await adapter.getServiceOptions(credentials, {
        receiverLat: 0,
        receiverLng: 0,
        packageType: 'box',
        weightKg: 2,
        deliveryType: 'address',
        governorate: 'Damascus',
        city: 'Damascus Center',
      });

      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({
        price: 3.5,
        currency: 'USD',
        serviceId: 'SILA_SY:cour_1:123',
        serviceName: 'Fast Express',
        shippable: true,
        effectiveDeliveryType: 'address',
        estimatedDeliveryMin: 1,
        estimatedDeliveryMax: 2,
        providerName: 'Sila-SY.com',
        logoUrl: 'https://example.com/logo.png',
      });
      expect(options[1].serviceId).toEqual('SILA_SY:cour_2:123');
      expect(options[1].effectiveDeliveryType).toEqual('address');
    });

    it('correctly maps branch delivery for couriers like Masarat and Karam', async () => {
      mockHttp.post.mockResolvedValueOnce({
        area_id: '456',
        couriers: [
          {
            courier_id: 'masarat_id',
            name: 'Masarat Express',
            delivery_fee: 150,
            currency: 'SYP',
            coverage_note: 'priced',
            supports_home_delivery: false,
            supports_pickup_at_branch: true,
          },
        ],
      });

      const hiddenOnHome = await adapter.getServiceOptions(credentials, {
        receiverLat: 0,
        receiverLng: 0,
        packageType: 'box',
        weightKg: 1,
        deliveryType: 'address',
        governorate: 'Aleppo',
        city: 'Abraj',
      });
      expect(hiddenOnHome).toHaveLength(0);

      mockHttp.post.mockResolvedValueOnce({
        area_id: '456',
        couriers: [
          {
            courier_id: 'masarat_id',
            name: 'Masarat Express',
            delivery_fee: 150,
            currency: 'SYP',
            coverage_note: 'priced',
            supports_home_delivery: false,
            supports_pickup_at_branch: true,
          },
        ],
      });

      const options = await adapter.getServiceOptions(credentials, {
        receiverLat: 0,
        receiverLng: 0,
        packageType: 'box',
        weightKg: 1,
        deliveryType: 'hub',
        governorate: 'Aleppo',
        city: 'Abraj',
      });

      expect(options).toHaveLength(1);
      expect(options[0].serviceName).toBe('Masarat Express');
      expect(options[0].effectiveDeliveryType).toBe('hub');
      expect(options[0].currency).toBe('SYP');
      expect(options[0].price).toBe(150);
    });
  });

  describe('getQuote', () => {
    it('returns the cheapest option among available couriers', async () => {
      mockHttp.post.mockResolvedValueOnce({
        couriers: [
          { courier_id: 'expensive', name: 'Expensive', delivery_fee: 10, coverage_note: 'priced' },
          { courier_id: 'cheap', name: 'Cheap', delivery_fee: 3, coverage_note: 'priced' },
        ],
      });

      const quote = await adapter.getQuote(credentials, {
        receiverLat: 0,
        receiverLng: 0,
        packageType: 'box',
        weightKg: 1,
        deliveryType: 'address',
        governorate: 'Aleppo',
      });

      expect(quote.price).toBe(3);
      expect(quote.serviceId).toBe('SILA_SY:cheap');
    });
  });

  describe('createShipment', () => {
    it('throws BadRequestException if serviceId is missing or invalid', async () => {
      await expect(
        adapter.createShipment(credentials, {
          receiver: { name: 'Ali', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus', lat: 0, lng: 0 },
          packageType: 'box',
          weightKg: 2,
          contents: 'Goods',
          deliveryType: 'address',
          pickupType: 'hub',
          payer: 'sender',
          codAmount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('keeps the Sila cargo id when the carrier AWB is not assigned yet', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockResolvedValueOnce({
        id: 'cargo-uuid',
        tracking_token: 'a'.repeat(32),
        barcode: 'SILA-ONLY',
      });
      mockHttp.get.mockResolvedValueOnce(null);
      const res = await adapter.createShipment(credentials, {
        serviceId: 'SILA_SY:cour_123:area_456',
        receiver: { name: 'Omar', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus', lat: 0, lng: 0 },
        packageType: 'box',
        weightKg: 1,
        contents: 'Goods',
        deliveryType: 'address',
        pickupType: 'address',
        payer: 'sender',
        codAmount: 0,
      });
      expect(res.awb).toBe('cargo-uuid');
      expect(res.trackingNumber).toBeUndefined();
      const cargoBody = mockHttp.post.mock.calls.find((call) => call[0] === 'cargos')?.[2] as {
        pay_on_delivery?: { amount: number };
      };
      expect(cargoBody.pay_on_delivery?.amount).toBe(0);
    });

    it('treats 409 duplicate_reference as success and does not suffix-retry', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockRejectedValueOnce(
        new SilaSyApiError(
          'reference already used',
          409,
          {},
          'duplicate_reference',
          {
            existing_cargo_id: 'existing-cargo',
            existing_barcode: 'SILA-EXISTING',
            existing_status: 'in_transit',
          },
        ),
      );
      mockHttp.get.mockResolvedValue({
        id: 'existing-cargo',
        barcode: 'SILA-EXISTING',
        status: 'in_transit',
      });

      const res = await adapter.createShipment(credentials, {
        serviceId: 'SILA_SY:cour_123:area_456',
        reference: 'ORD-1001',
        receiver: { name: 'Omar', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus', lat: 0, lng: 0 },
        packageType: 'box',
        weightKg: 1,
        contents: 'Goods',
        deliveryType: 'address',
        pickupType: 'address',
        payer: 'sender',
        codAmount: 0,
      });

      expect(res.awb).toBe('existing-cargo');
      const cargoPosts = mockHttp.post.mock.calls.filter((call) => call[0] === 'cargos');
      expect(cargoPosts).toHaveLength(1);
      expect(cargoPosts[0][2]).toEqual(expect.objectContaining({ reference: 'ORD-1001' }));
    });

    it('retries with unique reference suffix if 409 duplicate_reference matches a different courier or dead cargo', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockRejectedValueOnce(
        new SilaSyApiError(
          'reference already used',
          409,
          {},
          'duplicate_reference',
          {
            existing_cargo_id: 'ancient-cargo',
            existing_barcode: 'SILA-OLD',
            existing_status: 'returned',
          },
        ),
      );
      mockHttp.get.mockResolvedValueOnce({
        id: 'ancient-cargo',
        courier_id: 'diff_courier',
        status: 'returned',
        created_at: '2026-08-01T00:00:00.000Z',
      });
      mockHttp.post.mockResolvedValueOnce({
        id: 'brand-new-cargo',
        barcode: 'SILA-NEW',
        status: 'confirmed',
      });
      mockHttp.get.mockResolvedValueOnce({
        id: 'brand-new-cargo',
        barcode: 'SILA-NEW',
        status: 'confirmed',
      });

      const res = await adapter.createShipment(credentials, {
        serviceId: 'SILA_SY:cour_123:area_456',
        reference: 'ORD-1001',
        receiver: { name: 'Omar', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus', lat: 0, lng: 0 },
        packageType: 'box',
        weightKg: 1,
        contents: 'Goods',
        deliveryType: 'address',
        pickupType: 'address',
        payer: 'sender',
        codAmount: 0,
      });

      expect(res.awb).toBe('brand-new-cargo');
      const cargoPosts = mockHttp.post.mock.calls.filter((call) => call[0] === 'cargos');
      expect(cargoPosts).toHaveLength(2);
      expect((cargoPosts[1][2] as any).reference).toMatch(/^ORD-1001-\d+$/);
    });

    it('does not send allow_duplicate on possible_duplicate', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockRejectedValueOnce(
        new SilaSyApiError('possible duplicate', 409, {}, 'possible_duplicate', {}),
      );

      await expect(
        adapter.createShipment(credentials, {
          serviceId: 'SILA_SY:cour_123:area_456',
          reference: 'ORD-1001',
          receiver: { name: 'Omar', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus', lat: 0, lng: 0 },
          packageType: 'box',
          weightKg: 1,
          contents: 'Goods',
          deliveryType: 'address',
          pickupType: 'address',
          payer: 'sender',
          codAmount: 0,
        }),
      ).rejects.toThrow(/possible duplicate/i);
      expect(mockHttp.post.mock.calls.some((call) => call[2] && (call[2] as any).allow_duplicate)).toBe(false);
    });

    it('posts cargo payload with parsed courier_id and returns awb', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockResolvedValueOnce({
        id: 'sila_cargo_99',
        barcode: 'SILA-998877',
        tracking_token: 'b'.repeat(32),
        status: 'created',
        shipments: [
          {
            tracking_number: 'SL-TEST-1',
            remote_label_code: 'COURIER-998877',
            remote_barcode: 'COURIER-998877',
          },
        ],
      });

      const res = await adapter.createShipment(credentials, {
        serviceId: 'SILA_SY:cour_123:area_456',
        reference: 'ORD-1001',
        receiver: { name: 'Omar', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus, Syria', lat: 0, lng: 0 },
        packageType: 'box',
        weightKg: 3,
        contents: 'Electronics',
        deliveryType: 'address',
        pickupType: 'hub',
        payer: 'sender',
        codAmount: 15,
        currency: 'USD',
      });

      expect(res.awb).toBe('sila_cargo_99');
      expect(res.trackingNumber).toBe('COURIER-998877');
      expect(mockHttp.post).toHaveBeenCalledWith(
        'cargos',
        'sila_live_testkey123',
        expect.objectContaining({
          courier_id: 'cour_123',
          reference: 'ORD-1001',
          recipient: expect.objectContaining({ full_name: 'Omar', area_id: 'area_456' }),
          pay_on_delivery: { amount: 15, currency: 'USD' },
          shipping_paid_by: 'merchant',
          merchant_pays_shipping: true,
        }),
      );
      expect(mockHttp.post.mock.calls[0][2]).not.toHaveProperty('sender');
    });

    it('folds carrier shipping into COD when payer is receiver (Sila rejects receiver + non-zero COD)', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockResolvedValueOnce({
        id: 'sila_cargo_rec',
        barcode: 'SILA-REC',
        courier_barcode: 'COURIER-REC',
      });

      await adapter.createShipment(credentials, {
        serviceId: 'SILA_SY:cour_123:area_456',
        reference: 'OMS-REC-1',
        receiver: {
          name: 'Nadim Hassan',
          phoneCountry: '963',
          phoneLocal: '999000111',
          address: 'Aleppo test street',
          lat: 0,
          lng: 0,
        },
        packageType: 'box',
        weightKg: 1,
        contents: 'Goods',
        deliveryType: 'address',
        pickupType: 'hub',
        payer: 'receiver',
        codAmount: 20,
        currency: 'USD',
        carrierShippingFee: 3.5,
      });

      expect(mockHttp.post).toHaveBeenCalledWith(
        'cargos',
        'sila_live_testkey123',
        expect.objectContaining({
          pay_on_delivery: { amount: 23.5, currency: 'USD' },
          shipping_paid_by: 'merchant',
          merchant_pays_shipping: true,
        }),
      );
    });

    it('sends pickup address as sender and does not use branch pickup for home delivery', async () => {
      mockHttp.post.mockResolvedValueOnce({ couriers: [] });
      mockHttp.post.mockResolvedValueOnce({
        id: 'cargo-1',
        barcode: 'SILA-1',
        courier_barcode: 'COURIER-1',
      });

      await adapter.createShipment(credentials, {
        serviceId: 'SILA_SY:cour_123:area_456',
        receiver: {
          name: 'Omar',
          phoneCountry: '963',
          phoneLocal: '999111222',
          address: 'Customer street',
          lat: 0,
          lng: 0,
          governorate: 'Damascus',
          neighborhood: 'Mazzeh',
        },
        pickup: {
          name: 'Emdad Aleppo',
          phoneCountry: '963',
          phoneLocal: '944111222',
          address: 'Warehouse street',
          governorate: 'Aleppo',
          city: 'Aleppo',
          neighborhood: 'Warehouse street',
        },
        packageType: 'box',
        weightKg: 1,
        contents: 'Goods',
        deliveryType: 'address',
        pickupType: 'address',
        payer: 'sender',
        codAmount: 0,
      });

      const cargoCall = mockHttp.post.mock.calls.find((call) => call[0] === 'cargos');
      const body = cargoCall?.[2] as {
        sender?: { address_line: string; province?: string };
        recipient: { address_line: string };
        service_type?: string;
      };
      expect(body.sender).toEqual(
        expect.objectContaining({
          full_name: 'Emdad Aleppo',
          phone: '+963944111222',
          province: 'Aleppo',
          address_line: 'Warehouse street',
        }),
      );
      expect(body.recipient.address_line).toBe('Customer street');
      expect(body.service_type).toBe('home_delivery');
    });
  });

  describe('getLabel', () => {
    it('queries GET /cargos/{awb} and returns label_url', async () => {
      mockHttp.get.mockResolvedValueOnce({
        id: 'cargo-1',
        tracking_token: 'SILA-998877',
        label_url: 'https://sila-sy.com/labels/1.pdf',
      });

      const res = await adapter.getLabel(credentials, 'SILA-998877');
      expect(res).toEqual({ url: 'https://sila-sy.com/labels/1.pdf' });
      expect(mockHttp.get).toHaveBeenCalledWith('cargos/SILA-998877', 'sila_live_testkey123');
    });

    it('returns null if barcode not found or call fails', async () => {
      mockHttp.get.mockRejectedValueOnce(new Error('Not found'));
      const res = await adapter.getLabel(credentials, 'INVALID');
      expect(res).toBeNull();
    });
  });

  describe('getTrackingHistory', () => {
    it('uses the tracking timeline and keeps the courier route', async () => {
      mockHttp.get.mockResolvedValueOnce({
        barcode: 'token-ofd',
        current_status: 'out_for_delivery',
        timeline: [
          {
            status: 'processing',
            label_ar: 'processing',
            timestamp: '2026-10-03T10:00:00.000Z',
            note: 'system',
          },
          {
            status: 'out_for_delivery',
            label_ar: 'خارج للتوصيل',
            timestamp: '2026-10-04T12:00:00.000Z',
            note: 'courier',
          },
        ],
      });
      mockHttp.get.mockResolvedValueOnce({
        id: 'cargo-ofd',
        tracking_token: 'token-ofd',
        status: 'out_for_delivery',
        city: 'دمشق',
        updated_at: '2026-10-04T18:00:00.000Z',
        shipments: [
          {
            status: 'out_for_delivery',
            remote_status_raw: 'SCANNED_BY_DRIVER_AND_IN_CAR',
            remote_last_status: {
              deliveryRoute: [
                {
                  name: 'Pending',
                  arabicName: 'طلب جديد',
                  isArrived: true,
                  deliveryDate: '2026-10-03T14:51:02.000+0000',
                },
                {
                  name: 'In transit with Driver',
                  arabicName: 'قيد التوصيل مع السائق',
                  isArrived: true,
                  deliveryDate: '2026-10-04T17:27:34.000+0000',
                },
              ],
            },
          },
        ],
      });

      const res = await adapter.getTrackingHistory(credentials, 'token-ofd');
      expect(mockHttp.get).toHaveBeenCalledWith('cargos/token-ofd/tracking', 'sila_live_testkey123');
      expect(mockHttp.get).toHaveBeenCalledWith('cargos/token-ofd', 'sila_live_testkey123');
      expect(res?.awb).toBe('token-ofd');
      expect(res?.statusLabel).toBe('الشحنة خرجت للتوصيل');
      expect(res?.events.map((event) => event.title)).toEqual([
        'قيد التوصيل مع السائق',
        'خارج للتوصيل',
        'طلب جديد',
        'تم تكوين الشحنة',
      ]);
      expect(res?.events[0].notes).toContain('مع السائق');
      expect(res?.events[1].timestamp).toContain('2026-10-04T12:00:00');
    });

    it('keeps postpone history and the courier reason without treating it as a failed delivery', async () => {
      mockHttp.get.mockResolvedValueOnce({
        barcode: 'token-postponed',
        current_status: 'postponed',
        timeline: [
          {
            status: 'out_for_delivery',
            label_ar: 'خارج للتوصيل',
            timestamp: '2026-10-14T12:08:05.412Z',
            note: 'courier',
          },
          {
            status: 'postponed',
            label_ar: 'postponed',
            timestamp: '2026-10-15T09:12:00.402Z',
            note: 'courier',
          },
        ],
      });
      mockHttp.get.mockResolvedValueOnce({
        id: 'cargo-postponed',
        tracking_token: 'token-postponed',
        status: 'postponed',
        shipments: [
          {
            remote_status_raw: 'POSTPONED_DELIVERY',
            remote_failure_notes: 'تم التنسيق مع الزبون التوصيل السبت',
          },
        ],
      });

      const res = await adapter.getTrackingHistory(credentials, 'token-postponed');
      expect(res?.events).toHaveLength(2);
      expect(res?.events[0].title).toBe('تم تأجيل التسليم');
      expect(res?.events[0].notes).toContain('تم التنسيق مع الزبون التوصيل السبت');
      expect(res?.events[1].title).toBe('خارج للتوصيل');
      expect(res?.statusLabel).toBe('تم تأجيل التسليم');
    });

    it('hides source-tag notes, keeps real notes, and uses courier name', async () => {
      mockHttp.get.mockResolvedValueOnce({
        barcode: 'sila-bar',
        current_status: 'in_transit',
        courier: { name: 'ترابط' },
        timeline: [
          {
            status: 'in_transit',
            label_ar: 'في الطريق',
            label_en: 'In transit',
            timestamp: '2026-10-21T10:00:00.000Z',
            note: 'admin',
          },
          {
            status: 'created',
            label_ar: 'تم الإنشاء',
            timestamp: '2026-10-21T09:00:00.000Z',
            note: 'جارٍ التحضير في المستودع',
          },
        ],
      });
      mockHttp.get.mockResolvedValueOnce({
        id: 'cargo-uuid',
        barcode: 'sila-bar',
        courier: { name: 'ترابط' },
        courier_barcode: '100537003427',
        status: 'in_transit',
      });

      const res = await adapter.getTrackingHistory(credentials, 'cargo-uuid');
      expect(res?.providerName).toBe('ترابط');
      expect(res?.awb).toBe('100537003427');
      expect(res?.events[0].notes).toBeNull();
      expect(res?.events[1].notes).toBe('جارٍ التحضير في المستودع');
    });

    it('does not trust a cargo when the token mismatches', async () => {
      mockHttp.get.mockResolvedValueOnce({});
      mockHttp.get.mockResolvedValueOnce({
        id: 'other-cargo',
        tracking_token: 'other-token',
        status: 'processing',
      });

      const res = await adapter.getTrackingHistory(credentials, 'token-missing');
      expect(res?.events).toEqual([]);
      expect(res?.message).toMatch(/لا توجد بيانات/);
    });
  });

  describe('pollTracking', () => {
    it('returns normalized status for the matched cargo token', async () => {
      mockHttp.get.mockResolvedValueOnce({
        id: 'cargo-1',
        tracking_token: 'tok-1',
        status: 'cancelled',
        updated_at: '2026-09-19T18:48:40.990Z',
      });

      const res = await adapter.pollTracking(credentials, 'tok-1');
      expect(mockHttp.get).toHaveBeenCalledWith('cargos/tok-1', 'sila_live_testkey123');
      expect(res?.awb).toBe('tok-1');
      expect(res?.normalizedStatus).toBe('cancelled');
      expect(res?.eventType).toBe('cancelled');
    });
  });

  describe('normalizeWebhook', () => {
    it('reads tracking_token as AWB', () => {
      const res = adapter.normalizeWebhook({}, {
        tracking_token: 'tok-webhook',
        status: 'out_for_delivery',
        updated_at: '2026-10-04T12:00:00.000Z',
      });
      expect(res?.awb).toBe('tok-webhook');
      expect(res?.normalizedStatus).toBe('out_for_delivery');
    });

    it('records a postponement reason without a return or failed-delivery status', () => {
      const res = adapter.normalizeWebhook({}, {
        tracking_token: 'tok-postponed',
        status: 'postponed',
        remote_failure_notes: 'الزبون غير متاح اليوم',
        updated_at: '2026-10-15T09:12:00.000Z',
      });
      expect(res?.normalizedStatus).toBe('unknown');
      expect(res?.notes).toBe('الزبون غير متاح اليوم');
      expect(res?.returnReason).toBeUndefined();
    });

    it('uses new_status for dual terminal events and delivery id', () => {
      const res = adapter.normalizeWebhook(
        {
          'x-sila-event': 'cargo.delivered',
          'x-sila-delivery': 'del-1',
        },
        {
          event: 'cargo.delivered',
          data: {
            id: 'cargo-1',
            barcode: 'sila-bar',
            reference: 'OMS-1',
            new_status: 'delivered',
            occurred_at: '2026-10-21T10:00:00.000Z',
          },
        },
      );
      expect(res?.normalizedStatus).toBe('delivered');
      expect(res?.externalEventId).toBe('sila:cargo-1:delivered:2026-10-21T10:00:00.000Z');
      expect(res?.deliveryId).toBe('del-1');
      expect(res?.reference).toBe('OMS-1');
    });
  });

  describe('cancelShipment', () => {
    it('maps pending_confirmation without treating it as done', async () => {
      mockHttp.put.mockResolvedValueOnce({
        id: 'cargo-1',
        status: 'cancelled',
        courier_cancel: 'pending_confirmation',
      });
      const res = await adapter.cancelShipment(credentials, 'cargo-1');
      expect(res.outcome).toBe('pending_confirmation');
      expect(mockHttp.put).toHaveBeenCalledTimes(1);
      expect(mockHttp.put).toHaveBeenCalledWith('cargos/cargo-1/cancel', 'sila_live_testkey123', {});
    });

    it('maps confirmed / already / not_needed to cancelled outcomes', async () => {
      mockHttp.put.mockResolvedValueOnce({ id: 'c1', status: 'cancelled', courier_cancel: 'confirmed' });
      await expect(adapter.cancelShipment(credentials, 'c1')).resolves.toEqual(
        expect.objectContaining({ outcome: 'cancelled', courierCancel: 'confirmed' }),
      );
      mockHttp.put.mockResolvedValueOnce({ id: 'c1', status: 'cancelled', courier_cancel: 'already' });
      await expect(adapter.cancelShipment(credentials, 'c1')).resolves.toEqual(
        expect.objectContaining({ outcome: 'already_cancelled' }),
      );
      mockHttp.put.mockResolvedValueOnce({ id: 'c1', status: 'cancelled', courier_cancel: 'not_needed' });
      await expect(adapter.cancelShipment(credentials, 'c1')).resolves.toEqual(
        expect.objectContaining({ outcome: 'cancelled', courierCancel: 'not_needed' }),
      );
    });

    it('maps documented refusal codes to refused', async () => {
      mockHttp.put.mockRejectedValueOnce(
        new SilaSyApiError('locked', 409, {}, 'cargo_locked'),
      );
      await expect(adapter.cancelShipment(credentials, 'c1')).resolves.toEqual(
        expect.objectContaining({ outcome: 'refused', errorCode: 'cargo_locked' }),
      );
      mockHttp.put.mockRejectedValueOnce(
        new SilaSyApiError('window', 409, {}, 'cancel_window_closed'),
      );
      await expect(adapter.cancelShipment(credentials, 'c1')).resolves.toEqual(
        expect.objectContaining({ outcome: 'refused', errorCode: 'cancel_window_closed' }),
      );
      mockHttp.put.mockRejectedValueOnce(
        new SilaSyApiError('refused', 409, {}, 'courier_refused_cancel'),
      );
      await expect(adapter.cancelShipment(credentials, 'c1')).resolves.toEqual(
        expect.objectContaining({ outcome: 'refused', errorCode: 'courier_refused_cancel' }),
      );
    });
  });

  describe('registerWebhook', () => {
    it('registers at Sila and does not ping webhook.test until the secret can be stored', async () => {
      mockHttp.post.mockResolvedValueOnce({
        id: 'wh-1',
        secret: 'whsec_test_once',
      });
      const res = await adapter.registerWebhook(
        credentials,
        'https://staging-admin.emdadsy.com/api/shipping/webhooks/SILA_SY',
        '',
      );
      expect(res.ok).toBe(true);
      expect(res.webhookId).toBe('wh-1');
      expect(res.secret).toBe('whsec_test_once');
      expect(mockHttp.post).toHaveBeenCalledTimes(1);
      expect(mockHttp.post).toHaveBeenCalledWith(
        'webhooks',
        'sila_live_testkey123',
        expect.objectContaining({
          url: 'https://staging-admin.emdadsy.com/api/shipping/webhooks/SILA_SY',
          events: ['*'],
        }),
      );
    });
  });

  describe('verifyWebhook', () => {
    it('accepts sha256 HMAC of the raw body and rejects tampering', () => {
      const crypto = require('crypto') as typeof import('crypto');
      const secret = 'whsec_test';
      const raw = '{"event":"webhook.test"}';
      const sig = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
      expect(adapter.verifyWebhook({ 'x-sila-signature': sig }, raw, secret)).toBe(true);
      expect(adapter.verifyWebhook({ 'x-sila-signature': sig }, '{"event":"tampered"}', secret)).toBe(false);
    });
  });
});
