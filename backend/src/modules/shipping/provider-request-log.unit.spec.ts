import { mapCreateShipmentPayload } from './providers/babel-express/babel-shipment.mapper';
import { sanitizeBabelCreatePayload, sanitizeSilaCargoBody } from './provider-request-log';

describe('sanitized provider request', () => {
  it('reads Babel coordinates from the serialized neighbourhood, not from a side field', () => {
    const payload = mapCreateShipmentPayload({
      reference: 'OMS-1',
      payer: 'receiver',
      packageType: 'box',
      weightKg: 1,
      contents: 'goods',
      deliveryType: 'hub',
      pickupType: 'address',
      codAmount: 10000,
      currency: 'USD',
      receiver: {
        name: 'Receiver',
        phoneCountry: '963',
        phoneLocal: '944000111',
        address: 'جرابلس',
        lat: 36.814514,
        lng: 38.009888,
      },
    });
    const sanitized = sanitizeBabelCreatePayload(payload, 'SYP');
    expect(sanitized.latitude).toBe(36.814514);
    expect(sanitized.longitude).toBe(38.009888);
    expect(sanitized.areaId).toBeNull();
    expect(sanitized.deliveryType).toBe('hub');
    expect(sanitized.payer).toBe('receiver');
    expect(sanitized.codAmount).toBe(10000);
    expect(sanitized.codCurrency).toBe('USD');
    expect(sanitized.quoteCurrency).toBe('SYP');
    expect(JSON.stringify(payload)).toContain('36.814514');
  });

  it('reports a Babel neighbourhood id without pretending coordinates were sent', () => {
    const payload = mapCreateShipmentPayload({
      reference: 'OMS-2',
      payer: 'receiver',
      packageType: 'box',
      weightKg: 1,
      contents: 'goods',
      deliveryType: 'hub',
      pickupType: 'address',
      codAmount: 10000,
      currency: 'USD',
      receiver: {
        name: 'Receiver',
        phoneCountry: '963',
        phoneLocal: '944000111',
        address: 'البراغيثي',
        lat: 36.1,
        lng: 36.2,
        neighbourhoodId: 2284,
      },
    });
    const sanitized = sanitizeBabelCreatePayload(payload, 'SYP');
    expect(sanitized.areaId).toBe(2284);
    expect(sanitized.latitude).toBeNull();
    expect(sanitized.longitude).toBeNull();
    expect(JSON.stringify(payload)).not.toContain('36.1');
  });

  it('reads only the fields present on the Sila cargo body', () => {
    const body = {
      recipient: {
        full_name: 'Receiver',
        phone: '+963944000111',
        province: 'الحسكة',
        district: 'القامشلي',
        address_line: 'التفاحية',
        area_id: '8ce5b52a-eeec-405e-8cde-833089ca949c',
      },
      courier_id: 'fd4f088d-243b-4582-bb72-bb97c69b589c',
      service_type: 'home_delivery',
      pay_on_delivery: { amount: 150, currency: 'USD' },
      shipping_paid_by: 'merchant',
    };
    const sanitized = sanitizeSilaCargoBody(body, { quoteCurrency: 'SYP' });
    expect(sanitized.areaId).toBe('8ce5b52a-eeec-405e-8cde-833089ca949c');
    expect(sanitized.latitude).toBeNull();
    expect(sanitized.longitude).toBeNull();
    expect(sanitized.city).toBe('القامشلي');
    expect(sanitized.deliveryType).toBe('home_delivery');
    expect(sanitized.payer).toBe('merchant');
    expect(sanitized.codAmount).toBe(150);
    expect(sanitized.codCurrency).toBe('USD');
    expect(sanitized.serviceId).toBe('fd4f088d-243b-4582-bb72-bb97c69b589c');
    expect(sanitized.quoteCurrency).toBe('SYP');
  });
});
