import {
  isBabelAddressDeliveryAvailable,
  mapCreateShipmentPayload,
  resolveBabelPayer,
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

  it('coerces sender payer to receiver; keeps reseller', () => {
    expect(resolveBabelPayer('sender')).toBe('receiver');
    expect(resolveBabelPayer('receiver')).toBe('receiver');
    expect(resolveBabelPayer('reseller')).toBe('reseller');
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
    expect(payload.shipment.cod).toEqual({ amount: 0, currency: 'USD' });
    expect(payload.shipment.payer).toBe('reseller');
  });

  it('sends receiver to Babel when stored payer is sender', () => {
    const payload = mapCreateShipmentPayload({
      receiver: {
        name: 'Ali',
        phoneCountry: '963',
        phoneLocal: '999000111',
        address: 'Street 1',
        lat: 33.5,
        lng: 36.3,
        neighbourhoodId: 1,
      },
      packageType: 'box',
      weightKg: 1,
      contents: 'Goods',
      deliveryType: 'address',
      pickupType: 'hub',
      payer: 'sender',
      codAmount: 0,
      currency: 'USD',
    });
    expect(payload.shipment.payer).toBe('receiver');
  });

  it('keeps USD COD currency for non-zero COD (does not force SYP)', () => {
    const payload = mapCreateShipmentPayload({
      receiver: {
        name: 'Ali',
        phoneCountry: '963',
        phoneLocal: '999000111',
        address: 'Street 1',
        lat: 33.5,
        lng: 36.3,
        neighbourhoodId: 1,
      },
      packageType: 'box',
      weightKg: 1,
      contents: 'Goods',
      deliveryType: 'hub',
      pickupType: 'hub',
      payer: 'receiver',
      codAmount: 50,
      currency: 'USD',
    });
    expect(payload.shipment.cod).toEqual({ amount: 50, currency: 'USD' });
  });

  it('maps multi-unit parts by weight', () => {
    const payload = mapCreateShipmentPayload({
      receiver: {
        name: 'Ali',
        phoneCountry: '963',
        phoneLocal: '999000111',
        address: 'Street 1',
        lat: 33.5,
        lng: 36.3,
        neighbourhoodId: 12,
      },
      packageType: 'box',
      weightKg: 3,
      parts: [{ weight: 1 }, { weight: 1 }, { weight: 1 }],
      contents: 'Goods',
      deliveryType: 'hub',
      pickupType: 'hub',
      payer: 'reseller',
      codAmount: 0,
      currency: 'USD',
    });
    expect(payload.shipment.parts).toEqual([{ weight: 1 }, { weight: 1 }, { weight: 1 }]);
  });
});
