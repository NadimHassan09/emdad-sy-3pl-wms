import { BadRequestException } from '@nestjs/common';
import { SilaSyAdapter, buildSilaServiceId } from './sila-sy.adapter';
import { SilaSyHttpClient } from './sila-sy.http-client';
import { SILA_SY_CODE } from '../../shipping.constants';

describe('SilaSyAdapter', () => {
  let adapter: SilaSyAdapter;
  let mockHttp: jest.Mocked<SilaSyHttpClient>;

  const credentials = { username: 'sila_live_testkey123', password: '' };

  beforeEach(() => {
    mockHttp = {
      get: jest.fn(),
      post: jest.fn(),
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

      const options = await adapter.getServiceOptions(credentials, {
        receiverLat: 0,
        receiverLng: 0,
        packageType: 'box',
        weightKg: 1,
        deliveryType: 'address',
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

    it('rejects a Sila barcode when the courier tracking number is missing', async () => {
      mockHttp.post.mockResolvedValueOnce({ barcode: 'SILA-ONLY' });
      await expect(
        adapter.createShipment(credentials, {
          serviceId: 'SILA_SY:cour_123:area_456',
          receiver: { name: 'Omar', phoneCountry: '963', phoneLocal: '999111222', address: 'Damascus', lat: 0, lng: 0 },
          packageType: 'box',
          weightKg: 1,
          contents: 'Goods',
          deliveryType: 'address',
          pickupType: 'address',
          payer: 'sender',
          codAmount: 0,
        }),
      ).rejects.toThrow(/courier tracking number/i);
    });

    it('posts cargo payload with parsed courier_id and returns awb', async () => {
      mockHttp.post.mockResolvedValueOnce({
        id: 'sila_cargo_99',
        barcode: 'SILA-998877',
        tracking_number: 'COURIER-998877',
        status: 'created',
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

      expect(res.awb).toBe('SILA-998877');
      expect(res.trackingNumber).toBe('COURIER-998877');
      expect(mockHttp.post).toHaveBeenCalledWith(
        'cargos',
        'sila_live_testkey123',
        expect.objectContaining({
          courier_id: 'cour_123',
          reference: 'ORD-1001',
          recipient: expect.objectContaining({ full_name: 'Omar', area_id: 'area_456' }),
          pay_on_delivery: { amount: 15, currency: 'USD' },
          shipping_paid_by: 'sender',
          merchant_pays_shipping: true,
        }),
      );
      expect(mockHttp.post.mock.calls[0][2]).not.toHaveProperty('sender');
    });

    it('sends pickup address as sender and does not use branch pickup for home delivery', async () => {
      mockHttp.post.mockResolvedValueOnce({
        barcode: 'SILA-1',
        tracking_number: 'COURIER-1',
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

      const body = mockHttp.post.mock.calls[0][2] as {
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
      expect(body.service_type).toBeUndefined();
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
    it('uses GET /cargos/{token} and builds timeline from deliveryRoute', async () => {
      mockHttp.get.mockResolvedValueOnce({
        id: 'cargo-ofd',
        tracking_token: 'token-ofd',
        status: 'out_for_delivery',
        city: 'دمشق',
        updated_at: '2026-10-04T18:00:00.000Z',
        shipments: [
          {
            status: 'out_for_delivery',
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
      expect(mockHttp.get).toHaveBeenCalledWith('cargos/token-ofd', 'sila_live_testkey123');
      expect(res?.awb).toBe('token-ofd');
      expect(res?.statusLabel).toBe('الشحنة خرجت للتوصيل');
      expect(res?.events.length).toBeGreaterThanOrEqual(2);
      expect(res?.events[0].title).toContain('قيد التوصيل');
      expect(res?.events[0].timestamp).toContain('2026-10-04');
    });

    it('does not trust list endpoint items[0] when cargo token mismatches', async () => {
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
  });
});
