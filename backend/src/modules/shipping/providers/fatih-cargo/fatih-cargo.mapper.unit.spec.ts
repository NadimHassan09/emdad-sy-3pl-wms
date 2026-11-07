import {
  formatPhoneForFatih,
  mapCreateShipmentPayload,
  mapFatihStatusToNormalized,
  matchFatihCity,
  parseFatihCityIdFromServiceId,
  pickFatihWeightCategory,
} from './fatih-cargo.mapper';

describe('fatih-cargo.mapper', () => {
  it('parses city id from serviceId', () => {
    expect(parseFatihCityIdFromServiceId('FATIH_CARGO:690')).toBe(690);
    expect(parseFatihCityIdFromServiceId('other:1')).toBeNull();
  });

  it('matches city by Arabic name fold', () => {
    const cities = [
      { id: 1, name: 'ابطع - درعا', governorate: { id: 356, name: 'محافظة درعا' } },
      { id: 2, name: 'حلب', governorate: { id: 1, name: 'محافظة حلب' } },
    ];
    expect(matchFatihCity(cities, { city: 'ابطع' })?.id).toBe(1);
    expect(matchFatihCity(cities, { governorate: 'حلب' })?.id).toBe(2);
  });

  it('formats Syrian phones as local 09…', () => {
    expect(formatPhoneForFatih('963', '999123456')).toBe('0999123456');
    expect(formatPhoneForFatih('963', '0999123456')).toBe('0999123456');
  });

  it('picks the lightest weight category that covers the parcel', () => {
    const cats = [
      { id: 1, name: '0-1', max_weight_kg: 1 },
      { id: 2, name: '1-5', max_weight_kg: 5 },
      { id: 3, name: '5+', max_weight_kg: 20 },
    ];
    expect(pickFatihWeightCategory(cats, 0.5)?.id).toBe(1);
    expect(pickFatihWeightCategory(cats, 3)?.id).toBe(2);
    expect(pickFatihWeightCategory(cats, 12)?.id).toBe(3);
  });

  it('maps create payload with COD and recipient payer', () => {
    const payload = mapCreateShipmentPayload(
      {
        reference: 'ORD-1',
        receiver: {
          name: 'Nadim Hassan',
          phoneCountry: '963',
          phoneLocal: '944000000',
          address: 'Test street',
          lat: 0,
          lng: 0,
          city: 'حلب',
        },
        packageType: 'box',
        weightKg: 1,
        contents: 'TEST ORDER',
        deliveryType: 'address',
        pickupType: 'address',
        payer: 'receiver',
        codAmount: 25,
        currency: 'USD',
      },
      690,
      13,
      6,
      5,
    );
    expect(payload.recipient.city_id).toBe(690);
    expect(payload.recipient.phone).toBe('0944000000');
    expect(payload.cod).toEqual({ amount: 25, currency: 'USD' });
    expect(payload.shipping_fee_paid_by).toBe('recipient');
  });

  it('normalizes Fatih statuses', () => {
    expect(mapFatihStatusToNormalized('delivered')).toBe('delivered');
    expect(mapFatihStatusToNormalized('canceled')).toBe('cancelled');
    expect(mapFatihStatusToNormalized('returning')).toBe('returning_to_sender');
    expect(mapFatihStatusToNormalized('in_transit')).toBe('in_transit');
  });
});
