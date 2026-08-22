import {
  assertCarrierShippingReady,
  assertShippingConfigUnlocked,
  assertShippingIntentReady,
  calculateOrderVolume,
  calculateOrderWeight,
  copyShippingFieldsFromOms,
  isShippingConfigLocked,
  resolveShippingWeightKg,
  sumLineWeightsKg,
} from './shipping-config.util';
import { parsePhoneForBabel } from './providers/babel-express/babel-shipment.mapper';
import { mapCreateShipmentPayload } from './providers/babel-express/babel-shipment.mapper';
import { ShippingMethod } from '@prisma/client';

describe('shipping-config.util', () => {
  it('locks after ready_to_ship', () => {
    expect(isShippingConfigLocked('ready_to_ship')).toBe(true);
    expect(isShippingConfigLocked('picking')).toBe(false);
    expect(isShippingConfigLocked('waiting_for_shipping_details')).toBe(false);
    expect(() => assertShippingConfigUnlocked('ready_to_ship')).toThrow(/locked/i);
  });

  it('intent assert only needs method (+ provider when carrier)', () => {
    expect(() =>
      assertShippingIntentReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
      }),
    ).not.toThrow();
    expect(() =>
      assertShippingIntentReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: null,
      }),
    ).toThrow(/provider/i);
  });

  it('copies OMS shipping config onto outbound create payload', () => {
    const copied = copyShippingFieldsFromOms({
      shippingMethod: ShippingMethod.carrier,
      shippingProviderCode: 'BABEL_EXPRESS',
      shippingReceiverLat: 33.5 as any,
      shippingReceiverLng: 36.3 as any,
      shippingPackageType: 'box' as any,
      shippingContents: 'Phones',
      shippingDeliveryType: 'address' as any,
      shippingPickupType: 'address' as any,
      shippingPayer: 'reseller' as any,
      shippingWeightKg: 1.25 as any,
      shippingPhoneCountry: 'SY',
    });
    expect(copied).toEqual(
      expect.objectContaining({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingContents: 'Phones',
        shippingPhoneCountry: 'SY',
      }),
    );
  });

  it('manual OMS shipping copies as manual (no provider)', () => {
    const copied = copyShippingFieldsFromOms({
      shippingMethod: ShippingMethod.manual,
      shippingProviderCode: null,
      shippingReceiverLat: null,
      shippingReceiverLng: null,
      shippingPackageType: null,
      shippingContents: null,
      shippingDeliveryType: null,
      shippingPickupType: null,
      shippingPayer: null,
      shippingWeightKg: null,
      shippingPhoneCountry: null,
    });
    expect(copied.shippingMethod).toBe(ShippingMethod.manual);
    expect(copied.shippingProviderCode).toBeNull();
  });

  it('requires Babel readiness fields when method=carrier', () => {
    expect(() =>
      assertCarrierShippingReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
      }),
    ).toThrow(/lat\/lng/i);

    expect(() =>
      assertCarrierShippingReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingReceiverLat: 33.5,
        shippingReceiverLng: 36.3,
        shippingPackageType: 'box',
        shippingContents: 'Goods',
        shippingDeliveryType: 'address',
        shippingPickupType: 'address',
        shippingPayer: 'reseller',
        shippingWeightKg: 1.5,
      }),
    ).not.toThrow();

    expect(() =>
      assertCarrierShippingReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        babelNeighbourhoodId: 12345,
        shippingPackageType: 'box',
        shippingContents: 'Goods',
        shippingDeliveryType: 'address',
        shippingPickupType: 'hub',
        shippingPayer: 'sender',
        shippingWeightKg: 1.5,
      }),
    ).not.toThrow();
  });

  it('rejects absurd Babel box weights (common COD/amount mix-up)', () => {
    expect(() =>
      assertCarrierShippingReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingReceiverLat: 33.5,
        shippingReceiverLng: 36.3,
        shippingPackageType: 'box',
        shippingContents: 'Goods',
        shippingDeliveryType: 'address',
        shippingPickupType: 'address',
        shippingPayer: 'reseller',
        shippingWeightKg: 1000,
      }),
    ).toThrow(/too high|200/i);
  });

  it('rejects invalid phone dial codes mistaken for amounts', () => {
    expect(() =>
      assertCarrierShippingReady({
        shippingMethod: ShippingMethod.carrier,
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingReceiverLat: 33.5,
        shippingReceiverLng: 36.3,
        shippingPackageType: 'box',
        shippingContents: 'Goods',
        shippingDeliveryType: 'address',
        shippingPickupType: 'address',
        shippingPayer: 'reseller',
        shippingWeightKg: 2,
        shippingPhoneCountry: '10000',
      }),
    ).toThrow(/dial code/i);
  });

  it('sums product weights for default shipment weight', () => {
    const sum = sumLineWeightsKg(
      [
        { productId: 'a', requestedQuantity: 2 },
        { productId: 'b', requestedQuantity: 1 },
      ],
      new Map([
        ['a', '1.5'],
        ['b', '0.5'],
      ]),
    );
    expect(sum).toBe(3.5);

    expect(
      resolveShippingWeightKg({
        method: ShippingMethod.carrier,
        explicit: undefined,
        lines: [{ productId: 'a', requestedQuantity: 2 }],
        weightByProductId: new Map([['a', '1']]),
      }),
    ).toBe(2);
  });

  it('calculateOrderWeight uses unitWeight × quantity (multi-line)', () => {
    const total = calculateOrderWeight(
      [
        { productId: 'a', requestedQuantity: 5 },
        { productId: 'b', requestedQuantity: 4 },
        { productId: 'c', requestedQuantity: 10 },
      ],
      new Map([
        ['a', 2],
        ['b', 1.5],
        ['c', 0.5],
      ]),
    );
    expect(total).toBe(21);
  });

  it('calculateOrderVolume uses unitVolume × quantity (multi-line)', () => {
    const total = calculateOrderVolume(
      [
        { productId: 'a', requestedQuantity: 5 },
        { productId: 'b', requestedQuantity: 3 },
      ],
      new Map([
        ['a', 0.01],
        ['b', 0.02],
      ]),
    );
    expect(total).toBe(0.11);
  });

  it('does not treat line count as quantity', () => {
    expect(
      calculateOrderWeight(
        [{ productId: 'a', requestedQuantity: 5 }],
        new Map([['a', 2]]),
      ),
    ).toBe(10);
    expect(
      calculateOrderVolume(
        [{ productId: 'a', requestedQuantity: 5 }],
        new Map([['a', 0.01]]),
      ),
    ).toBe(0.05);
  });

  it('manual shipping does not require carrier payload fields', () => {
    expect(() =>
      assertCarrierShippingReady({
        shippingMethod: ShippingMethod.manual,
      }),
    ).not.toThrow();
  });
});

describe('babel-shipment.mapper', () => {
  it('maps createShipment payload with coordinates neighbourhood', () => {
    const payload = mapCreateShipmentPayload({
      reference: 'OMS-1',
      receiver: {
        name: 'Ali',
        phoneCountry: '963',
        phoneLocal: '944000000',
        address: 'Damascus',
        lat: 33.5,
        lng: 36.3,
      },
      packageType: 'box',
      weightKg: 2,
      contents: 'Clothes',
      deliveryType: 'address',
      pickupType: 'hub',
      payer: 'reseller',
      codAmount: 0,
      currency: 'USD',
    });
    expect(payload.shipment.receiver.neighbourhood).toEqual({
      coordinates: { lat: 33.5, lng: 36.3 },
    });
    expect(payload.shipment.parts[0].weight).toBe(2);
    expect(payload.shipment.reference).toBe('OMS-1');
  });

  it('parses Syrian phones and explicit dial codes', () => {
    expect(parsePhoneForBabel('+963944123456')).toEqual({
      country: '963',
      phone: '944123456',
    });
    expect(parsePhoneForBabel('0944123456')).toEqual({
      country: '963',
      phone: '944123456',
    });
    expect(parsePhoneForBabel('944123456', '963')).toEqual({
      country: '963',
      phone: '944123456',
    });
    expect(parsePhoneForBabel('0944123456', 'SY')).toEqual({
      country: '963',
      phone: '944123456',
    });
    // Amounts mistaken for dial codes are ignored; Syria default still applies for 0-prefix phones.
    expect(parsePhoneForBabel('01501701022', '10000')).toEqual({
      country: '963',
      phone: '1501701022',
    });
  });
});
