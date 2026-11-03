import { toAccountAmount } from './account-currency';

const rate = { rate: 13000, source: 'manual' };

describe('toAccountAmount', () => {
  it('keeps USD amounts unchanged and needs no rate', () => {
    const r = toAccountAmount(120, 'USD', null)!;
    expect(r.amount.toString()).toBe('120');
    expect(r.fxRate).toBeNull();
  });

  it('treats a missing currency as USD', () => {
    expect(toAccountAmount(5, null, null)!.amount.toString()).toBe('5');
  });

  it('converts SYP to USD with the managed rate and records the rate used', () => {
    const r = toAccountAmount(170000, 'SYP', rate)!;
    expect(r.amount.toString()).toBe('13.0769');
    expect(r.fxRate).toBe(13000);
    expect(r.fxSource).toBe('manual');
  });

  it('refuses a SYP conversion without a rate instead of guessing', () => {
    expect(toAccountAmount(1000, 'SYP', null)).toBeNull();
  });
});
