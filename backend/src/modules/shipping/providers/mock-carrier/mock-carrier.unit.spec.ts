import { MockCarrierAdapter } from './mock-carrier.adapter';
import { ShippingProviderRegistry } from '../../shipping-provider.registry';
import { classifyShippingError } from '../../shipping-error';
import { MOCK_CARRIER_CODE } from '../../shipping.constants';

const input = {
  receiver: {
    name: 'مستلم',
    phoneCountry: '963',
    phoneLocal: '944000111',
    address: 'الأرمن',
    lat: 34.7,
    lng: 36.7,
  },
  packageType: 'box' as const,
  weightKg: 1,
  contents: 'goods',
  deliveryType: 'address' as const,
  pickupType: 'address' as const,
  payer: 'sender' as const,
  codAmount: 26,
  currency: 'USD',
};

describe('MOCK_CARRIER', () => {
  const adapter = new MockCarrierAdapter();

  it('is absent from the registry unless SHIPPING_MOCK_ENABLED=true', () => {
    const previous = process.env.SHIPPING_MOCK_ENABLED;
    delete process.env.SHIPPING_MOCK_ENABLED;
    const off = new ShippingProviderRegistry({ code: 'BABEL_EXPRESS' } as never, { code: 'SILA_SY' } as never, adapter);
    expect(off.listCodes()).not.toContain(MOCK_CARRIER_CODE);
    process.env.SHIPPING_MOCK_ENABLED = 'true';
    const on = new ShippingProviderRegistry({ code: 'BABEL_EXPRESS' } as never, { code: 'SILA_SY' } as never, adapter);
    expect(on.has(MOCK_CARRIER_CODE)).toBe(true);
    if (previous === undefined) delete process.env.SHIPPING_MOCK_ENABLED;
    else process.env.SHIPPING_MOCK_ENABLED = previous;
  });

  it('returns a success payload and never opens a socket', async () => {
    const result = await adapter.createShipment(
      { username: 'unused', password: 'unused' },
      { ...input, reference: 'OMS-ACME-OK' },
    );
    expect(result.awb).toBe('MOCK-AWB-OMS-ACME-OK');
    expect(result.raw).toMatchObject({
      provider: MOCK_CARRIER_CODE,
      payer: 'sender',
      currency: 'USD',
      codAmount: 26,
      deliveryType: 'address',
    });
  });

  it('scripts field errors and a timeout that lookup does not invent', async () => {
    await expect(
      adapter.createShipment({ username: 'u', password: 'p' }, { ...input, reference: 'MOCK-ADDRESS' }),
    ).rejects.toThrow(/province/);
    await expect(
      adapter.createShipment({ username: 'u', password: 'p' }, { ...input, reference: 'MOCK-PAYER' }),
    ).rejects.toThrow(/Payer as sender/);
    await expect(
      adapter.createShipment({ username: 'u', password: 'p' }, { ...input, reference: 'MOCK-COD' }),
    ).rejects.toThrow(/1000/);
    await expect(
      adapter.createShipment({ username: 'u', password: 'p' }, { ...input, reference: 'MOCK-TIMEOUT' }),
    ).rejects.toThrow(/timeout/);
    expect(await adapter.findShipmentByReference({ username: 'u', password: 'p' }, 'MOCK-TIMEOUT')).toBeNull();
    const found = await adapter.findShipmentByReference(
      { username: 'u', password: 'p' },
      'MOCK-TIMEOUT-FOUND',
    );
    expect(found?.awb).toContain('MOCK-TIMEOUT-FOUND');
    const field = classifyShippingError('receiver phone is invalid');
    expect(field.field).toBe('receiverPhone');
    expect(field.retrySafe).toBe(true);
  });
});
