import { carrierSypUnit, rateForCarrierUnit, sypUnitOfRate } from './carrier-currency';
import { resolveCollectionForService } from './provider-cod';
import { comparableValueUsd, toComparableUsd, type FxRateSnapshot } from './currency-conversion';

const snapshot: FxRateSnapshot = { usdToSypRate: 13000, source: 'test', timestamp: '2026-11-03T00:00:00Z' };

describe('carrier SYP unit', () => {
  it('knows Babel as new pound and leaves unconfirmed carriers alone', () => {
    expect(carrierSypUnit('BABEL_EXPRESS')).toBe('new');
    expect(carrierSypUnit('babel_express')).toBe('new');
    expect(carrierSypUnit('SENA_EXPRESS')).toBeNull();
    expect(carrierSypUnit(null)).toBeNull();
  });

  it('reads the unit of a rate from its size and refuses the ambiguous middle', () => {
    expect(sypUnitOfRate(13000)).toBe('old');
    expect(sypUnitOfRate(130)).toBe('new');
    expect(sypUnitOfRate(1500)).toBeNull();
    expect(sypUnitOfRate(0)).toBeNull();
  });

  it('rescales the platform rate into the carrier unit', () => {
    expect(rateForCarrierUnit(13000, 'new')).toBe(130);
    expect(rateForCarrierUnit(13000, 'old')).toBe(13000);
    expect(rateForCarrierUnit(13000, null)).toBe(13000);
    expect(rateForCarrierUnit(130, 'old')).toBe(13000);
    expect(rateForCarrierUnit(1500, 'new')).toBe(1500);
  });

  it('prices Babel 300 new SYP near 2.3 USD instead of 0.023', () => {
    expect(toComparableUsd(300, 'SYP', snapshot, 'new')).toBeCloseTo(2.307, 2);
    expect(toComparableUsd(300, 'SYP', snapshot)).toBeCloseTo(0.023, 3);
    expect(
      comparableValueUsd({ price: 300, currency: 'SYP', providerCode: 'BABEL_EXPRESS' }, snapshot),
    ).toBeCloseTo(2.307, 2);
  });

  it('never rescales USD prices', () => {
    expect(toComparableUsd(2.5, 'USD', snapshot, 'new')).toBe(2.5);
  });

  it('collects COD in the carrier pound unit', () => {
    const base = {
      orderAmount: 20,
      orderCurrency: 'USD',
      requestedCurrency: 'SYP',
      mode: 'explicit' as const,
      usdToSypRate: 13000,
    };
    const babel = resolveCollectionForService({ ...base, providerCode: 'BABEL_EXPRESS' });
    const sena = resolveCollectionForService({ ...base, providerCode: 'SENA_EXPRESS' });
    expect(babel.ok && babel.amount).toBe(2600);
    expect(sena.ok && sena.amount).toBe(260000);
  });
});
