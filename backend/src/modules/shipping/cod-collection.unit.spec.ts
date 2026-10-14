import { codMinimumViolation, convertCodCollection, roundWholeSyp } from './cod-collection';

describe('convertCodCollection', () => {
  it('rounds 58 USD to a whole number of pounds', () => {
    expect(roundWholeSyp(58 * 12345.67)).toBe(716049);
    const result = convertCodCollection({
      orderAmount: 58,
      orderCurrency: 'USD',
      collectionCurrency: 'SYP',
      usdToSypRate: 12345.67,
      rateSource: 'manual',
      rateAt: '2026-10-10T00:00:00.000Z',
    });
    expect(result).toMatchObject({
      amount: 716049,
      currency: 'SYP',
      rate: 12345.67,
      converted: true,
    });
  });

  it('keeps USD unchanged and does not require a rate', () => {
    const result = convertCodCollection({
      orderAmount: 58,
      orderCurrency: 'USD',
      collectionCurrency: 'USD',
      usdToSypRate: null,
    });
    expect(result).toMatchObject({ amount: 58, currency: 'USD', converted: false, rate: null });
  });

  it('does not mutate the original amount when converting', () => {
    const orderAmount = 58;
    convertCodCollection({
      orderAmount,
      orderCurrency: 'USD',
      collectionCurrency: 'SYP',
      usdToSypRate: 13000,
    });
    expect(orderAmount).toBe(58);
  });

  it('refuses conversion without a rate', () => {
    expect(
      convertCodCollection({
        orderAmount: 58,
        orderCurrency: 'USD',
        collectionCurrency: 'SYP',
        usdToSypRate: null,
      }),
    ).toEqual({ error: 'missing_rate' });
  });

  it('applies a confirmed minimum to the converted amount only', () => {
    const converted = convertCodCollection({
      orderAmount: 58,
      orderCurrency: 'USD',
      collectionCurrency: 'SYP',
      usdToSypRate: 12345.67,
    });
    if ('error' in converted) throw new Error('expected conversion');
    expect(
      codMinimumViolation({
        collectionAmount: converted.amount,
        collectionCurrency: converted.currency,
        confirmedMinimum: { SYP: 1000 },
      }),
    ).toBeNull();
    expect(
      codMinimumViolation({
        collectionAmount: 58,
        collectionCurrency: 'SYP',
        confirmedMinimum: { SYP: 1000 },
      }),
    ).toEqual({ minimum: 1000, currency: 'SYP' });
    expect(
      codMinimumViolation({
        collectionAmount: 58,
        collectionCurrency: 'SYP',
        confirmedMinimum: {},
      }),
    ).toBeNull();
  });
});
