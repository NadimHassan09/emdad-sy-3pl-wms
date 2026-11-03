import { Prisma } from '@prisma/client';
import {
  computeFulfillmentFee,
  computeStorageFee,
  inclusiveDays,
  settlementStatement,
} from './billing-fulfillment-pricing.util';

const rule = {
  enabled: true,
  baseFee: 2,
  includedLines: 1,
  extraLineFee: 0.5,
  includedWeightKg: 5,
  extraKgFee: 0.25,
};

describe('computeFulfillmentFee', () => {
  it('charges the base fee for a small one-line order', () => {
    expect(computeFulfillmentFee(rule, { linesCount: 1, weightKg: 5 }).toString()).toBe('2');
  });

  it('adds a fee per extra line', () => {
    expect(computeFulfillmentFee(rule, { linesCount: 4, weightKg: 1 }).toString()).toBe('3.5');
  });

  it('adds a fee per extra kilogram, including fractions', () => {
    expect(computeFulfillmentFee(rule, { linesCount: 1, weightKg: 9.5 }).toString()).toBe('3.13');
  });

  it('combines lines and weight', () => {
    expect(computeFulfillmentFee(rule, { linesCount: 3, weightKg: 7 }).toString()).toBe('3.5');
  });

  it('charges nothing when the rule is disabled', () => {
    expect(computeFulfillmentFee({ ...rule, enabled: false }, { linesCount: 9, weightKg: 99 }).toString()).toBe('0');
  });

  it('never goes negative', () => {
    expect(computeFulfillmentFee({ ...rule, baseFee: -10 }, { linesCount: 1, weightKg: 0 }).toString()).toBe('0');
  });
});

describe('storage fee', () => {
  it('pro-rates a 30-day fee by the days in the period', () => {
    expect(computeStorageFee({ enabled: true, baseFee: 30 }, 15).toString()).toBe('15');
    expect(computeStorageFee({ enabled: true, baseFee: 100 }, 10).toString()).toBe('33.33');
  });

  it('is zero when disabled or the period is empty', () => {
    expect(computeStorageFee({ enabled: false, baseFee: 30 }, 15).toString()).toBe('0');
    expect(computeStorageFee({ enabled: true, baseFee: 30 }, 0).toString()).toBe('0');
  });

  it('counts both ends of the period', () => {
    expect(inclusiveDays(new Date('2026-11-01'), new Date('2026-11-15'))).toBe(15);
    expect(inclusiveDays(new Date('2026-11-03'), new Date('2026-11-03'))).toBe(1);
  });
});

describe('settlementStatement', () => {
  it('deducts the full amount when the balance covers it', () => {
    const s = settlementStatement({ balance: 100, owed: 30 });
    expect(s.deducted.toString()).toBe('30');
    expect(s.balanceAfter.toString()).toBe('70');
    expect(s.remainingDue.toString()).toBe('0');
    expect(s.fullySettled).toBe(true);
  });

  it('deducts only what the balance holds and leaves the rest due', () => {
    const s = settlementStatement({ balance: 20, owed: new Prisma.Decimal(50) });
    expect(s.deducted.toString()).toBe('20');
    expect(s.balanceAfter.toString()).toBe('0');
    expect(s.remainingDue.toString()).toBe('30');
    expect(s.fullySettled).toBe(false);
  });

  it('never deducts from a zero or negative balance', () => {
    expect(settlementStatement({ balance: 0, owed: 10 }).deducted.toString()).toBe('0');
    expect(settlementStatement({ balance: -5, owed: 10 }).deducted.toString()).toBe('0');
  });
});
