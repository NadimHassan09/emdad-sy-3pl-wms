import { BadRequestException } from '@nestjs/common';

import {
  assertOmsLineNonNegativeWholePrice,
  assertOmsLinePositiveWholeQuantity,
} from './oms-line-numeric';

describe('oms-line-numeric', () => {
  describe('assertOmsLinePositiveWholeQuantity', () => {
    it('allows positive integers', () => {
      expect(() => assertOmsLinePositiveWholeQuantity(1)).not.toThrow();
      expect(() => assertOmsLinePositiveWholeQuantity(404)).not.toThrow();
    });

    it('rejects decimals, zero, negatives, and non-integers', () => {
      expect(() => assertOmsLinePositiveWholeQuantity(404.6555)).toThrow(BadRequestException);
      expect(() => assertOmsLinePositiveWholeQuantity(0)).toThrow(BadRequestException);
      expect(() => assertOmsLinePositiveWholeQuantity(-3)).toThrow(BadRequestException);
      expect(() => assertOmsLinePositiveWholeQuantity(Number.NaN)).toThrow(BadRequestException);
      expect(() => assertOmsLinePositiveWholeQuantity(1.5)).toThrow(BadRequestException);
    });
  });

  describe('assertOmsLineNonNegativeWholePrice', () => {
    it('allows zero, positive integers, and omitted', () => {
      expect(() => assertOmsLineNonNegativeWholePrice(0)).not.toThrow();
      expect(() => assertOmsLineNonNegativeWholePrice(100)).not.toThrow();
      expect(() => assertOmsLineNonNegativeWholePrice(undefined)).not.toThrow();
      expect(() => assertOmsLineNonNegativeWholePrice(null)).not.toThrow();
    });

    it('rejects decimals and negatives', () => {
      expect(() => assertOmsLineNonNegativeWholePrice(10.5)).toThrow(BadRequestException);
      expect(() => assertOmsLineNonNegativeWholePrice(-1)).toThrow(BadRequestException);
    });
  });
});
