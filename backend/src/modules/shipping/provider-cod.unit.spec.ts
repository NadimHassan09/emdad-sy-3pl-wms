import { resolveCollectionForService, verifiedCodCurrencies, VERIFIED_TARABUT_COURIER_ID } from './provider-cod';
import { BABEL_EXPRESS_CODE, SILA_SY_CODE } from './shipping.constants';

describe('verified COD capabilities', () => {
  it('records only TARABUT home USD and Babel hub USD', () => {
    expect(
      verifiedCodCurrencies({
        providerCode: SILA_SY_CODE,
        serviceName: 'TARABUT',
        deliveryType: 'address',
      }),
    ).toEqual(['USD']);
    expect(
      verifiedCodCurrencies({
        providerCode: SILA_SY_CODE,
        serviceId: `SILA_SY:${VERIFIED_TARABUT_COURIER_ID}:area`,
        deliveryType: 'address',
      }),
    ).toEqual(['USD']);
    expect(
      verifiedCodCurrencies({
        providerCode: BABEL_EXPRESS_CODE,
        serviceId: 'BABEL_EXPRESS:hub',
        deliveryType: 'hub',
      }),
    ).toEqual(['USD']);
  });

  it('does not copy provider-wide support onto an unverified service', () => {
    expect(
      verifiedCodCurrencies({
        providerCode: SILA_SY_CODE,
        serviceName: 'Fatih',
        deliveryType: 'address',
      }),
    ).toEqual([]);
    expect(
      verifiedCodCurrencies({
        providerCode: SILA_SY_CODE,
        serviceName: 'TARABUT',
        deliveryType: 'hub',
      }),
    ).toEqual([]);
    expect(
      verifiedCodCurrencies({
        providerCode: BABEL_EXPRESS_CODE,
        deliveryType: 'address',
      }),
    ).toEqual([]);
  });
});

describe('resolveCollectionForService', () => {
  const tarabut = {
    providerCode: SILA_SY_CODE,
    serviceName: 'TARABUT',
    deliveryType: 'address' as const,
  };

  it('preserves 58 USD when USD is supported, even if a SYP fee exists', () => {
    const result = resolveCollectionForService({
      ...tarabut,
      orderAmount: 58,
      orderCurrency: 'USD',
      requestedCurrency: 'USD',
      mode: 'all',
      usdToSypRate: 13000,
    });
    expect(result).toMatchObject({ ok: true, amount: 58, currency: 'USD', converted: false });
  });

  it('does not convert USD to SYP just because the fee currency is SYP', () => {
    const result = resolveCollectionForService({
      ...tarabut,
      orderAmount: 58,
      orderCurrency: 'USD',
      mode: 'all',
      usdToSypRate: 13000,
    });
    expect(result).toMatchObject({ ok: true, currency: 'USD', converted: false });
  });

  it('keeps SYP on All even when a USD fee exists and an FX rate is configured', () => {
    const result = resolveCollectionForService({
      ...tarabut,
      orderAmount: 100,
      orderCurrency: 'SYP',
      mode: 'all',
      usdToSypRate: 100,
    });
    expect(result).toMatchObject({ ok: true, amount: 100, currency: 'SYP', converted: false });
  });

  it('converts an explicit currency change and reports a missing FX rate', () => {
    const result = resolveCollectionForService({
      ...tarabut,
      orderAmount: 100,
      orderCurrency: 'SYP',
      requestedCurrency: 'USD',
      mode: 'explicit',
      usdToSypRate: null,
    });
    expect(result).toMatchObject({ ok: false, code: 'missing_rate' });
  });

  it('converts only when the user explicitly selected another collection currency', () => {
    const result = resolveCollectionForService({
      ...tarabut,
      orderAmount: 58,
      orderCurrency: 'USD',
      requestedCurrency: 'SYP',
      mode: 'explicit',
      usdToSypRate: 100,
    });
    expect(result).toMatchObject({ ok: true, currency: 'SYP', converted: true, amount: 5800 });
  });

  it('does not mark an unknown service unavailable from a local whitelist', () => {
    const result = resolveCollectionForService({
      providerCode: SILA_SY_CODE,
      serviceName: 'Mersal',
      deliveryType: 'address',
      orderAmount: 58,
      orderCurrency: 'USD',
      mode: 'all',
      usdToSypRate: 13000,
    });
    expect(result).toMatchObject({ ok: true, currency: 'USD', converted: false, amount: 58 });
  });
});
