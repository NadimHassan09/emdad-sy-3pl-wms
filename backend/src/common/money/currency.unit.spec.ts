import {
  allCurrencyValues,
  convertMoney,
  currencyFamily,
  normalizeCurrency,
  wireCurrency,
} from './currency';

const RATE = 13000; // 1 USD = 13,000 old SYP = 130 new SYP

describe('normalizeCurrency', () => {
  it('keeps the three currencies apart', () => {
    expect(normalizeCurrency('USD')).toBe('USD');
    expect(normalizeCurrency('syp')).toBe('SYP');
    expect(normalizeCurrency('SYP_OLD')).toBe('SYP');
    expect(normalizeCurrency('syp new')).toBe('SYP_NEW');
    expect(normalizeCurrency('SYP-NEW')).toBe('SYP_NEW');
  });

  it('treats missing or unknown codes as USD like before', () => {
    expect(normalizeCurrency(null)).toBe('USD');
    expect(normalizeCurrency('EUR')).toBe('USD');
  });
});

describe('convertMoney', () => {
  it('converts new and old pounds with the fixed 100 to 1 relation', () => {
    expect(convertMoney(300, 'SYP_NEW', 'SYP', RATE)!.toString()).toBe('30000');
    expect(convertMoney(30000, 'SYP', 'SYP_NEW', RATE)!.toString()).toBe('300');
  });

  it('converts through USD with the platform rate', () => {
    expect(convertMoney(20, 'USD', 'SYP', RATE)!.toString()).toBe('260000');
    expect(convertMoney(20, 'USD', 'SYP_NEW', RATE)!.toString()).toBe('2600');
    expect(convertMoney(2600, 'SYP_NEW', 'USD', RATE)!.toString()).toBe('20');
  });

  it('needs no rate for the same currency and refuses a pound conversion without one', () => {
    expect(convertMoney(5, 'SYP_NEW', 'SYP_NEW', null)!.toString()).toBe('5');
    expect(convertMoney(5, 'USD', 'SYP', null)).toBeNull();
    expect(convertMoney(300, 'SYP_NEW', 'SYP', null)).toBeNull();
  });
});

describe('allCurrencyValues', () => {
  it('shows one value in the three currencies', () => {
    const v = allCurrencyValues(300, 'SYP_NEW', RATE);
    expect(v.SYP_NEW!.toString()).toBe('300');
    expect(v.SYP!.toString()).toBe('30000');
    expect(v.USD!.toString()).toBe('2.31');
  });
});

describe('carrier wire currency', () => {
  it('sends a carrier USD or SYP only, never a unit', () => {
    expect(wireCurrency('SYP_NEW')).toBe('SYP');
    expect(wireCurrency('SYP')).toBe('SYP');
    expect(wireCurrency('USD')).toBe('USD');
    expect(currencyFamily('SYP_NEW')).toBe('SYP');
  });
});
