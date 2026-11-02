import { SenaExpressAdapter } from './sena-express.adapter';
import { SenaApiError, SenaExpressHttpClient } from './sena-express.http-client';
import {
  SenaDeliveryZone,
  SenaShipment,
} from './sena-express.types';
import {
  ShippingCreateShipmentInput,
  ShippingCredentials,
  ShippingQuoteInput,
} from '../../shipping-provider.interface';

describe('SenaExpressAdapter', () => {
  let adapter: SenaExpressAdapter;
  let mockHttpClient: jest.Mocked<SenaExpressHttpClient>;
  const credentials: ShippingCredentials = {
    username: 'test-sena-api-key',
    password: 'N/A',
  };

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    adapter = new SenaExpressAdapter(mockHttpClient);
  });

  describe('testConnection', () => {
    it('returns ok: true when zones endpoint succeeds', async () => {
      const zones: SenaDeliveryZone[] = [
        {
          id: 2,
          name: 'الإمارات',
          zone_code: 'UAE',
          display_name: 'United Arab Emirates - Dubai',
          warehouse_id: 3,
          warehouse_name: 'UAE warehouse',
          country: 'United Arab Emirates',
          delivery_price: 25,
        },
      ];
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { zones } });

      const result = await adapter.testConnection(credentials);
      expect(result.ok).toBe(true);
      expect(result.message).toContain('SENA Express connection OK');
      expect(mockHttpClient.get).toHaveBeenCalledWith('zones', credentials);
    });

    it('returns ok: false with friendly error message when unauthorized', async () => {
      mockHttpClient.get.mockRejectedValueOnce(
        new SenaApiError('Unauthorized / Invalid API key', 401),
      );

      const result = await adapter.testConnection(credentials);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Check your SENA API Key');
    });
  });

  describe('getQuote and getServiceOptions', () => {
    const quoteInput: ShippingQuoteInput = {
      city: 'Dubai',
      receiverLat: 25.2,
      receiverLng: 55.27,
      weightKg: 2,
      packageType: 'box',
      deliveryType: 'address',
      pickupType: 'address',
      currency: 'AED',
    };

    const zones: SenaDeliveryZone[] = [
      {
        id: 2,
        name: 'الإمارات',
        zone_code: 'UAE',
        display_name: 'United Arab Emirates - Dubai',
        warehouse_id: 3,
        warehouse_name: 'UAE warehouse',
        country: 'United Arab Emirates',
        delivery_price: 25,
      },
    ];

    it('returns service options matching destination zone', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { zones } });

      const options = await adapter.getServiceOptions(credentials, quoteInput);
      expect(options).toHaveLength(1);
      expect(options[0].price).toBe(25);
      expect(options[0].currency).toBe('AED');
      expect(options[0].serviceId).toBe('SENA_EXPRESS:2');
      expect(options[0].providerName).toBe('شركة سينا (SENA Express)');
    });

    it('returns best quote via getQuote', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { zones } });

      const quote = await adapter.getQuote(credentials, quoteInput);
      expect(quote.price).toBe(25);
      expect(quote.serviceId).toBe('SENA_EXPRESS:2');
    });
  });

  describe('createShipment', () => {
    const createInput: ShippingCreateShipmentInput = {
      reference: 'ORD-100',
      pickup: {
        name: 'Warehouse Sender',
        phoneCountry: '963',
        phoneLocal: '911223344',
        city: 'Damascus',
        address: 'Al-Mazzeh Hwy',
      },
      receiver: {
        name: 'Customer Test',
        phoneCountry: '971',
        phoneLocal: '501234567',
        city: 'Dubai',
        address: 'Deira Street 4',
        lat: 25.2,
        lng: 55.27,
      },
      packageType: 'box',
      weightKg: 2.5,
      deliveryType: 'address',
      pickupType: 'address',
      payer: 'sender',
      codAmount: 150,
      currency: 'AED',
      contents: 'Electronics',
    };

    const zones: SenaDeliveryZone[] = [
      {
        id: 2,
        name: 'الإمارات',
        zone_code: 'UAE',
        display_name: 'United Arab Emirates - Dubai',
        warehouse_id: 3,
        warehouse_name: 'UAE warehouse',
        country: 'United Arab Emirates',
        delivery_price: 25,
      },
    ];

    it('creates shipment successfully and returns awb & trackingNumber', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { zones } });

      const senaShipment: SenaShipment = {
        id: 6676,
        shipment_number: '260080555944',
        reference: 'ORD-100',
        shipment_reference: 'SE0wAkUx4',
        merchant_reference: 'ORD-100',
        fulfillment_type: 'merchant_prepared',
        tracking_url: 'https://syria.sena-express.com/shipments_tracking/260080555944',
        status: 'pending',
        public_status: 'قيد الانتظار',
        idempotent: false,
      };
      mockHttpClient.post.mockResolvedValueOnce({ status: 'success', data: { shipment: senaShipment } });

      const result = await adapter.createShipment(credentials, createInput);
      expect(result.awb).toBe('260080555944');
      expect(result.trackingNumber).toBe('260080555944');
      expect(result.raw).toEqual(senaShipment);
    });

    it('handles idempotent: true duplicate response safely', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { zones } });

      const senaShipment: SenaShipment = {
        id: 6676,
        shipment_number: '260080555944',
        reference: 'ORD-100',
        shipment_reference: 'SE0wAkUx4',
        status: 'customer_confirmed',
        public_status: 'تم تأكيد العميل',
        idempotent: true,
      };
      mockHttpClient.post.mockResolvedValueOnce({ status: 'success', data: { shipment: senaShipment } });

      const result = await adapter.createShipment(credentials, createInput);
      expect(result.awb).toBe('260080555944');
      expect((result.raw as SenaShipment).idempotent).toBe(true);
    });
  });

  describe('cancelShipment', () => {
    it('returns outcome refused without calling undocumented endpoints', async () => {
      const result = await adapter.cancelShipment(credentials, '260080555944');
      expect(result.outcome).toBe('refused');
      expect(result.message).toContain('portal');
      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });
  });

  describe('pollTracking and getTrackingHistory', () => {
    const senaShipment: SenaShipment = {
      id: 6676,
      shipment_number: '260080555944',
      reference: 'ORD-100',
      status: 'out_for_delivery',
      public_status: 'الطلب مع المندوب',
      timeline: [
        {
          status: 'pending',
          public_status: 'قيد الانتظار',
          timestamp: '2026-08-31T09:00:00Z',
        },
        {
          status: 'out_for_delivery',
          public_status: 'الطلب مع المندوب',
          timestamp: '2026-08-31T12:00:00Z',
        },
      ],
    };

    it('polls tracking correctly and maps normalized event', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { shipment: senaShipment } });

      const event = await adapter.pollTracking(credentials, '260080555944');
      expect(event).not.toBeNull();
      expect(event?.awb).toBe('260080555944');
      expect(event?.normalizedStatus).toBe('out_for_delivery');
      expect(event?.notes).toBe('الطلب مع المندوب');
      expect(event?.reference).toBe('ORD-100');
    });

    it('returns unified tracking history with chronological timeline', async () => {
      mockHttpClient.get.mockResolvedValueOnce({ status: 'success', data: { shipment: senaShipment } });

      const result = await adapter.getTrackingHistory(credentials, '260080555944');
      expect(result).not.toBeNull();
      expect(result?.awb).toBe('260080555944');
      expect(result?.events).toHaveLength(2);
      expect(result?.events[0].title).toBe('الطلب مع المندوب');
      expect(result?.events[1].title).toBe('قيد الانتظار');
    });
  });
});
