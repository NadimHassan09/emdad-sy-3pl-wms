import {
  isBabelAddressDeliveryAvailable,
  mapCreateShipmentPayload,
  resolveBabelPickupType,
} from './babel-shipment.mapper';

describe('babel-shipment.mapper', () => {
  it('detects unavailable door delivery when dropoff is null', () => {
    expect(isBabelAddressDeliveryAvailable({ pickup: 0, dropoff: null, shipping: 20000 })).toBe(
      false,
    );
    expect(isBabelAddressDeliveryAvailable({ pickup: 0, dropoff: 1500, shipping: 13000 })).toBe(
      true,
    );
  });

  it('normalizes warehouse pickup to hub', () => {
    expect(resolveBabelPickupType('address')).toBe('hub');
    expect(resolveBabelPickupType('hub')).toBe('hub');
  });

  it('maps create payload with neighbourhood id and required cod currency', () => {
    const payload = mapCreateShipmentPayload({
      reference: 'OMS-1',
      receiver: {
        name: 'Ali',
        phoneCountry: '963',
        phoneLocal: '999000111',
        address: 'Street 1',
        lat: 33.5,
        lng: 36.3,
        neighbourhoodId: 4278,
      },
      packageType: 'box',
      weightKg: 2,
      contents: 'Goods',
      deliveryType: 'address',
      pickupType: 'address',
      payer: 'reseller',
      codAmount: 0,
      currency: 'USD',
    });

    expect(payload.shipment.receiver.neighbourhood).toEqual({ id: 4278 });
    expect(payload.shipment.pickupType).toBe('hub');
    expect(payload.shipment.cod).toEqual({ amount: 0, currency: 'SYP' });
  });
});
