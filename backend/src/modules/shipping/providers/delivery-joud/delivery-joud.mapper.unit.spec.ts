import {
  formatPhoneForJoud,
  mapCreateOrderParams,
  mapJoudOrderToResult,
  mapJoudStatusToNormalized,
  matchJoudArea,
  parseJoudAreaFromServiceId,
  unwrapJoudList,
  unwrapJoudOrder,
} from './delivery-joud.mapper';

describe('delivery-joud.mapper', () => {
  it('parses area token from serviceId', () => {
    expect(parseJoudAreaFromServiceId('DELIVERY_JOUD:42')).toBe('42');
    expect(parseJoudAreaFromServiceId('DELIVERY_JOUD:حلب')).toBe('حلب');
  });

  it('matches area by name', () => {
    const areas = [
      { id: 1, name: 'دمشق' },
      { id: 2, name: 'حلب' },
    ];
    expect(matchJoudArea(areas, { city: 'حلب' })?.id).toBe(2);
    expect(matchJoudArea(areas, { serviceArea: '1' })?.name).toBe('دمشق');
  });

  it('formats phones', () => {
    expect(formatPhoneForJoud('963', '944123456')).toBe('0944123456');
  });

  it('maps create order with COD unpaid and fee on sender', () => {
    const params = mapCreateOrderParams(
      {
        reference: 'T-1',
        receiver: {
          name: 'Nadim Hassan',
          phoneCountry: '963',
          phoneLocal: '944000000',
          address: 'Test',
          lat: 0,
          lng: 0,
          city: 'حلب',
        },
        packageType: 'box',
        weightKg: 1,
        contents: 'TEST ORDER',
        deliveryType: 'address',
        pickupType: 'address',
        payer: 'sender',
        codAmount: 10,
        currency: 'USD',
      },
      'حلب',
      '1',
    );
    expect(params.customer_area).toBe('حلب');
    expect(params.cost).toBe(10);
    expect(params.paid).toBe(false);
    expect(params.delivery_fee_on_sender).toBe(true);
    expect(params.delivery_fee_on_customer).toBe(false);
  });

  it('maps order result identity', () => {
    expect(mapJoudOrderToResult({ barcode: 'JOUD-9', id: 1 }).awb).toBe('JOUD-9');
    expect(mapJoudOrderToResult({ name: 'S0001' }).awb).toBe('S0001');
    expect(
      mapJoudOrderToResult({ name: 'OMS-2026-08688', barcode: '3960023548', id: 9 }).awb,
    ).toBe('3960023548');
    expect(mapJoudOrderToResult({ name: 'OMS-2026-08688', id: 9 }).trackingNumber).toBe(
      'OMS-2026-08688',
    );
  });

  it('normalizes Arabic/English statuses', () => {
    expect(mapJoudStatusToNormalized('تم التسليم')).toBe('delivered');
    expect(mapJoudStatusToNormalized('ملغي')).toBe('cancelled');
    expect(mapJoudStatusToNormalized('in_transit')).toBe('in_transit');
  });

  it('unwraps Olivery { status, response } list envelope from get_areas', () => {
    const raw = {
      status: 200,
      response: [
        { id: 62, name: 'دمشق' },
        { id: 64, name: 'ريف دمشق' },
      ],
      message: 'Success',
    };
    const list = unwrapJoudList<{ id: number; name: string }>(raw);
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('دمشق');
  });

  it('unwraps order under response object', () => {
    expect(unwrapJoudOrder({ status: 200, response: { barcode: '3960023609', name: 'S1' } })?.barcode).toBe(
      '3960023609',
    );
  });
});
