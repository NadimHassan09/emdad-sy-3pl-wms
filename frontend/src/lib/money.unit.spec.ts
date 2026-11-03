import { describe, expect, it } from 'vitest';
import { allCurrencyValues, convertMoney, currencyFamily, formatEquivalents, formatMoney, normalizeCurrency } from './money';

const RATE = 13000;

describe('money', () => {
  it('keeps old pound, new pound and dollar apart', () => {
    expect(normalizeCurrency('SYP')).toBe('SYP');
    expect(normalizeCurrency('SYP_NEW')).toBe('SYP_NEW');
    expect(normalizeCurrency('USD')).toBe('USD');
    expect(currencyFamily('SYP_NEW')).toBe('SYP');
  });

  it('converts with 100 old = 1 new and the platform rate', () => {
    expect(convertMoney(300, 'SYP_NEW', 'SYP', RATE)).toBe(30000);
    expect(convertMoney(20, 'USD', 'SYP_NEW', RATE)).toBe(2600);
    expect(convertMoney(5, 'SYP_NEW', 'SYP_NEW', null)).toBe(5);
    expect(convertMoney(5, 'USD', 'SYP', null)).toBeNull();
  });

  it('shows one value in all three currencies', () => {
    const v = allCurrencyValues(300, 'SYP_NEW', RATE);
    expect(v.SYP).toBe(30000);
    expect(v.USD).toBeCloseTo(2.3077, 3);
  });

  it('labels the unit of every pound amount', () => {
    expect(formatMoney(300, 'SYP_NEW')).toBe('300 new SYP');
    expect(formatMoney(30000, 'SYP')).toBe('30,000 old SYP');
    expect(formatMoney(2.5, 'USD')).toBe('$2.50');
    expect(formatEquivalents(300, 'SYP_NEW', RATE)).toBe('≈ $2.31 · 30,000 old SYP');
  });
});
