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

  it('keeps address pickup and does not coerce it to hub', () => {
    expect(resolveBabelPickupType('address')).toBe('address');
    expect(resolveBabelPickupType(undefined)).toBe('address');
    expect(resolveBabelPickupType('hub')).toBe('hub');
  });

  it('keeps sender payer; does not coerce to receiver', () => {
    expect(resolveBabelPayer('sender')).toBe('sender');
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
    expect(payload.shipment.pickupType).toBe('address');
    expect(payload.shipment.cod).toEqual({ amount: 0, currency: 'USD' });
    expect(payload.shipment.payer).toBe('reseller');
    expect(payload.shipment.sender).toBeUndefined();
  });

  it('sends the pickup party as shipment.sender when pickup is address', () => {
    const payload = mapCreateShipmentPayload({
      receiver: {
        name: 'Ali',
        phoneCountry: '963',
        phoneLocal: '999000111',
        address: 'Customer street',
        lat: 33.5,
        lng: 36.3,
        neighbourhoodId: 1,
      },
      pickup: {
        name: 'Emdad Aleppo',
        phoneCountry: '963',
        phoneLocal: '944111222',
        address: 'Warehouse street, Aleppo',
        neighbourhoodId: 88,
      },
      packageType: 'box',
      weightKg: 1,
      contents: 'Goods',
      deliveryType: 'address',
      pickupType: 'address',
      payer: 'sender',
      codAmount: 0,
      currency: 'USD',
    });
    expect(payload.shipment.pickupType).toBe('address');
    expect(payload.shipment.deliveryType).toBe('address');
    expect(payload.shipment.sender).toEqual({
      name: 'Emdad Aleppo',
      phone: { country: '963', phone: '944111222' },
      address: 'Warehouse street, Aleppo',
      neighbourhood: { id: 88 },
    });
    expect(payload.shipment.receiver.address).toBe('Customer street');
  });

  it('sends sender to Babel when stored payer is sender', () => {
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
    expect(payload.shipment.payer).toBe('sender');
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
