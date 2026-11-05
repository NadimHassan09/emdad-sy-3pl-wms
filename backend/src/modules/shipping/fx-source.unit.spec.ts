import { hoursToMs, rateMovedEnough } from './fx-source';

describe('fx stability helpers', () => {
  it('ignores moves below the limit and accepts moves at or above it', () => {
    expect(rateMovedEnough(13000, 13050, 0.5)).toBe(false);
    expect(rateMovedEnough(13000, 13065, 0.5)).toBe(true);
    expect(rateMovedEnough(13000, 12935, 0.5)).toBe(true);
  });

  it('always accepts when there is no active rate', () => {
    expect(rateMovedEnough(null, 13000, 5)).toBe(true);
  });

  it('turns hours to milliseconds with a fallback', () => {
    expect(hoursToMs(2, 1)).toBe(7_200_000);
    expect(hoursToMs(null, 99)).toBe(99);
  });
});
