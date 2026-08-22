import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  assertReceivingQuantitiesWithinExpected,
  parseDamagedQtyFromNotes,
  resolveDamagedQty,
} from './receiving-qty.validation';

describe('receiving-qty.validation', () => {
  const d = (n: string | number) => new Prisma.Decimal(n);

  describe('parseDamagedQtyFromNotes', () => {
    it('parses damaged:N from discrepancy notes', () => {
      expect(parseDamagedQtyFromNotes('damaged:11').toString()).toBe('11');
      expect(parseDamagedQtyFromNotes('note · damaged:3 · expiry:2026-01-01').toString()).toBe('3');
    });

    it('returns 0 when absent', () => {
      expect(parseDamagedQtyFromNotes(null).toString()).toBe('0');
      expect(parseDamagedQtyFromNotes('no damage here').toString()).toBe('0');
    });
  });

  describe('resolveDamagedQty', () => {
    it('prefers explicit damaged_qty over notes', () => {
      expect(resolveDamagedQty('5', 'damaged:11').toString()).toBe('5');
    });

    it('falls back to notes when damaged_qty omitted', () => {
      expect(resolveDamagedQty(undefined, 'damaged:11').toString()).toBe('11');
    });
  });

  describe('assertReceivingQuantitiesWithinExpected', () => {
    it('rejects the screenshot case: expected 10, received 10, damaged 11', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(10),
          damagedQty: d(11),
          lineId: 'line-1',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(10),
          damagedQty: d(11),
        }),
      ).toThrow(/exceeds expected/);
    });

    it('rejects negative received or damaged', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(-1),
          damagedQty: d(0),
        }),
      ).toThrow(/negative/);
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(1),
          damagedQty: d(-2),
        }),
      ).toThrow(/negative/);
    });

    it('rejects when prior received + new qty would exceed expected', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(6),
          damagedQty: d(0),
          priorReceived: d(5),
        }),
      ).toThrow(/would exceed expected/);
    });

    it('rejects when prior + received + damaged exceeds expected', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(4),
          damagedQty: d(2),
          priorReceived: d(5),
        }),
      ).toThrow(/would exceed expected/);
    });

    it('allows exact fill: received + damaged = expected', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(7),
          damagedQty: d(3),
        }),
      ).not.toThrow();
    });

    it('allows under-receipt (short close case)', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(8),
          damagedQty: d(0),
        }),
      ).not.toThrow();
    });

    it('allows remaining fill after prior receive', () => {
      expect(() =>
        assertReceivingQuantitiesWithinExpected({
          expected: d(10),
          receivedQty: d(4),
          damagedQty: d(1),
          priorReceived: d(5),
        }),
      ).not.toThrow();
    });
  });
});
