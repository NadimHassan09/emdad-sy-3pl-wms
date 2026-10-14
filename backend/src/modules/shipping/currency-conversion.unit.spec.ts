import {
  comparableValueUsd,
  effectiveComparableCost,
  getFxRateSnapshot,
  toComparableUsd,
  FX_FALLBACK_USD_TO_SYP,
  FX_SOURCE_ENV,
  FX_SOURCE_FALLBACK,
} from './currency-conversion';

describe('currency-conversion', () => {
  const snap = {
    usdToSypRate: 14500,
    source: 'test',
    timestamp: '2026-10-03T00:00:00.000Z',
  };

  it('reads env rate with source metadata', () => {
    const fromEnv = getFxRateSnapshot({ USD_TO_SYP_RATE: '12000' } as NodeJS.ProcessEnv);
    expect(fromEnv.usdToSypRate).toBe(12000);
    expect(fromEnv.source).toBe(FX_SOURCE_ENV);
    expect(fromEnv.timestamp).toMatch(/^\d{4}-/);

    const fallback = getFxRateSnapshot({} as NodeJS.ProcessEnv);
    expect(fallback.usdToSypRate).toBe(FX_FALLBACK_USD_TO_SYP);
    expect(fallback.source).toBe(FX_SOURCE_FALLBACK);
  });

  it('normalizes SYP vs USD for comparison', () => {
    // 100 SYP ≈ 0.0069 USD; 2 USD is much more expensive
    expect(toComparableUsd(100, 'SYP', snap)).toBeCloseTo(100 / 14500, 6);
    expect(toComparableUsd(2, 'USD', snap)).toBe(2);
    expect(toComparableUsd(100, 'SYP', snap)).toBeLessThan(toComparableUsd(2, 'USD', snap));
  });

  it('effectiveComparableCost prefers preferred currency from prices[]', () => {
    const cost = effectiveComparableCost({
      price: 2,
      currency: 'USD',
      prices: [
        { price: 2, currency: 'USD' },
        { price: 100, currency: 'SYP' },
      ],
      preferredCurrency: 'SYP',
    });
    expect(cost).toEqual({ amount: 100, currency: 'SYP' });
  });

  it('comparableValueUsd uses effective cost not raw mismatched currency', () => {
    const a = comparableValueUsd(
      { price: 100, currency: 'SYP', prices: [{ price: 100, currency: 'SYP' }] },
      snap,
    );
    const b = comparableValueUsd(
      { price: 2, currency: 'USD', prices: [{ price: 2, currency: 'USD' }] },
      snap,
    );
    expect(a).toBeLessThan(b);
  });
});
