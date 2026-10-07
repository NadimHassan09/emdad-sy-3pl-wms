import { describe, expect, it } from 'vitest';

import {
  computeLineStatus,
  computeMissingQty,
  parseQtyInput,
  validateReceivingLineQuantities,
} from './receiving-utils';

describe('receiving quantity validation', () => {
  it('flags overage when received + damaged exceeds expected (screenshot case)', () => {
    expect(computeLineStatus(10, 10, 11)).toBe('overage');
    expect(
      validateReceivingLineQuantities(10, '10', '11'),
    ).toMatch(/exceeds expected/);
  });

  it('does not treat received == expected with zero damage as overage', () => {
    expect(computeLineStatus(10, 10, 0)).toBe('complete');
    expect(validateReceivingLineQuantities(10, '10', '')).toBeNull();
  });

  it('allows received + damaged == expected', () => {
    expect(computeLineStatus(10, 7, 3)).toBe('complete');
    expect(validateReceivingLineQuantities(10, '7', '3')).toBeNull();
    expect(computeMissingQty(10, 7, 3)).toBe(0);
  });

  it('rejects negative received or damaged input', () => {
    expect(parseQtyInput('-1')).toEqual({ ok: false, reason: 'negative' });
    expect(validateReceivingLineQuantities(10, '-1', '0')).toMatch(/negative/);
    expect(validateReceivingLineQuantities(10, '1', '-2')).toMatch(/negative/);
  });

  it('rejects received alone above expected', () => {
    expect(computeLineStatus(10, 12, 0)).toBe('overage');
    expect(validateReceivingLineQuantities(10, '12', '0')).toMatch(/exceeds expected/);
  });

  it('computes missing without going negative when overage', () => {
    expect(computeMissingQty(10, 10, 11)).toBe(0);
  });

  it('marks shortage when under expected with no overage', () => {
    expect(computeLineStatus(10, 6, 0)).toBe('shortage');
    expect(validateReceivingLineQuantities(10, '6', '0')).toBeNull();
  });
});
