import {
  mapCreateShipmentPayload,
  mapSenaShipmentToResult,
  mapSenaStatusToNormalized,
  matchSenaZone,
  parseSenaZoneIdFromServiceId,
} from './sena-express.mapper';
import { SenaDeliveryZone, SenaShipment } from './sena-express.types';
import { ShippingCreateShipmentInput } from '../../shipping-provider.interface';

describe('SenaExpressMapper', () => {
  const sampleZones: SenaDeliveryZone[] = [
    {
      id: 2,
      name: 'الإمارات',
      zone_code: 'UAE',
      display_name: 'United Arab Emirates - SENA EXPRESS UAE - الإمارات',
      warehouse_id: 3,
      warehouse_name: 'UAE warehouse',
      country: 'United Arab Emirates',
      delivery_price: null,
    },
    {
      id: 10,
      name: 'دمشق',
      zone_code: 'DAMASCUS',
      display_name: 'Damascus Zone - دمشق',
      warehouse_id: 1,
      warehouse_name: 'Main Damascus',
      country: 'Syria',
      delivery_price: 15000,
    },
  ];

  describe('parseSenaZoneIdFromServiceId', () => {
    it('parses zone ID from serviceId', () => {
      expect(parseSenaZoneIdFromServiceId('SENA_EXPRESS:zone_10')).toBe(10);
      expect(parseSenaZoneIdFromServiceId('SENA_EXPRESS:2')).toBe(2);
      expect(parseSenaZoneIdFromServiceId('OTHER_CARRIER:10')).toBeNull();
      expect(parseSenaZoneIdFromServiceId(undefined)).toBeNull();
    });
  });

  describe('matchSenaZone', () => {
    it('matches zone by exact zone_code or city', () => {
      expect(matchSenaZone(sampleZones, { city: 'UAE' })?.id).toBe(2);
      expect(matchSenaZone(sampleZones, { city: 'دمشق' })?.id).toBe(10);
    });

    it('matches zone by display_name or country', () => {
      expect(matchSenaZone(sampleZones, { country: 'United Arab Emirates' } as any)?.id).toBe(2);
      expect(matchSenaZone(sampleZones, { address: 'Damascus highway' })?.id).toBe(10);
    });

    it('falls back to first zone if no term matches', () => {
      expect(matchSenaZone(sampleZones, { city: 'NonExistentCity' })?.id).toBe(2);
    });

    it('returns null if zones list is empty', () => {
      expect(matchSenaZone([], { city: 'Damascus' })).toBeNull();
    });
  });

  describe('mapSenaStatusToNormalized', () => {
    it('maps in-transit and processing statuses', () => {
      expect(mapSenaStatusToNormalized('pending')).toBe('in_transit');
      expect(mapSenaStatusToNormalized('awaiting_pickup')).toBe('in_transit');
      expect(mapSenaStatusToNormalized('awaiting_address_confirmation')).toBe('in_transit');
      expect(mapSenaStatusToNormalized('customer_confirmed')).toBe('in_transit');
      expect(mapSenaStatusToNormalized('rescheduled')).toBe('in_transit');
    });

    it('maps out_for_delivery to out_for_delivery', () => {
      expect(mapSenaStatusToNormalized('out_for_delivery')).toBe('out_for_delivery');
    });

    it('maps delivered to delivered', () => {
      expect(mapSenaStatusToNormalized('delivered')).toBe('delivered');
    });

    it('maps return statuses', () => {
      expect(mapSenaStatusToNormalized('in_return')).toBe('returning_to_sender');
      expect(mapSenaStatusToNormalized('returned_to_sender')).toBe('returned_to_sender');
      expect(mapSenaStatusToNormalized('returned')).toBe('returned_to_sender');
    });

    it('maps failure and problems to delivery_failed', () => {
      expect(mapSenaStatusToNormalized('refused')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('delivery_attempts_completed')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('delivery_failed')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('client_no_response')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('customer_not_responding')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('phone_off')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('shipment_problem')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('damaged')).toBe('delivery_failed');
      expect(mapSenaStatusToNormalized('lost')).toBe('delivery_failed');
    });

    it('maps cancelled to cancelled', () => {
      expect(mapSenaStatusToNormalized('cancelled')).toBe('cancelled');
    });

    it('returns unknown for undefined or unrecognized status', () => {
      expect(mapSenaStatusToNormalized(undefined)).toBe('unknown');
      expect(mapSenaStatusToNormalized('custom_status')).toBe('unknown');
    });
  });

  describe('mapCreateShipmentPayload', () => {
    const baseInput: ShippingCreateShipmentInput = {
      reference: 'ORD-99881',
      pickup: {
        name: 'Warehouse Sender',
        phoneCountry: '963',
        phoneLocal: '911223344',
        city: 'Damascus',
        address: 'Al-Mazzeh Hwy',
      },
      receiver: {
        name: 'Omar Test',
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
      items: [
        {
          name: 'Item 1',
          sku: 'SKU-001',
          quantity: 2,
          price: 75,
          weight: 1.2,
        },
      ],
      contents: 'Electronics',
    };

    it('maps input correctly into SenaCreateShipmentPayload', () => {
      const payload = mapCreateShipmentPayload(baseInput, 2);

      expect(payload.reference).toBe('ORD-99881');
      expect(payload.fulfillment_type).toBe('merchant_prepared');
      expect(payload.delivery_zone_id).toBe(2);
      expect(payload.customer_name).toBe('Omar Test');
      expect(payload.customer_phone).toBe('971501234567');
      expect(payload.city).toBe('Dubai');
      expect(payload.address).toBe('Deira Street 4');
      expect(payload.cod_amount).toBe(150);
      expect(payload.currency).toBe('AED');
      expect(payload.pickup_address?.contact_name).toBe('Warehouse Sender');
      expect(payload.pickup_address?.phone).toBe('963911223344');
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0]).toEqual({
        name: 'Item 1',
        sku: 'SKU-001',
        barcode: undefined,
        product_id: undefined,
        quantity: 2,
        price: 75,
        weight: 1.2,
      });
    });

    it('creates default item if items array is omitted', () => {
      const noItemsInput = { ...baseInput, items: undefined };
      const payload = mapCreateShipmentPayload(noItemsInput, 2);

      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].name).toBe('Electronics');
      expect(payload.items[0].sku).toBe('ORD-99881');
      expect(payload.items[0].quantity).toBe(1);
      expect(payload.items[0].price).toBe(150);
    });
  });

  describe('mapSenaShipmentToResult', () => {
    it('maps successful response with tracking details', () => {
      const senaShipment: SenaShipment = {
        id: 6676,
        shipment_number: '260080555944',
        reference: 'ORD-99881',
        shipment_reference: 'SE0wAkUx4',
        merchant_reference: 'ORD-99881',
        fulfillment_type: 'merchant_prepared',
        tracking_url: 'https://syria.sena-express.com/shipments_tracking/260080555944',
        status: 'pending',
        public_status: 'قيد الانتظار',
        idempotent: false,
      };

      const result = mapSenaShipmentToResult(senaShipment);

      expect(result.awb).toBe('260080555944');
      expect(result.trackingNumber).toBe('260080555944');
      expect(result.raw).toEqual(senaShipment);
    });

    it('maps multipart barcodes if present in shipment', () => {
      const senaShipment: SenaShipment = {
        id: 6676,
        shipment_number: '260080555944',
        reference: 'ORD-99881',
        status: 'pending',
        part_barcodes: ['PART-1', 'PART-2'],
      };

      const result = mapSenaShipmentToResult(senaShipment);
      expect(result.partBarcodes).toEqual(['PART-1', 'PART-2']);
    });
  });
});
