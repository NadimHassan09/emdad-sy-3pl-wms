import { countWeightIncrements, quoteClientShippingRate, quoteExternalPerKg } from './shipping-fee.calculator';

const rule = { baseWeightKg: 10, incrementKg: 5, incrementCharge: 1 };

describe('client shipping weight increments', () => {
  it('charges only the base rate at and below the included weight', () => {
    expect(countWeightIncrements(10, rule)).toBe(0);
    expect(countWeightIncrements(9.9999, rule)).toBe(0);
    expect(quoteClientShippingRate({ ...rule, baseRate: 3, weightKg: 10 }).amount).toBe(3);
  });

  it('charges one increment for any weight just above the base', () => {
    expect(countWeightIncrements(10.0001, rule)).toBe(1);
    expect(quoteClientShippingRate({ ...rule, baseRate: 3, weightKg: 10.0001 }).amount).toBe(4);
  });

  it('charges one increment exactly on the next boundary and two just above it', () => {
    expect(countWeightIncrements(15, rule)).toBe(1);
    expect(quoteClientShippingRate({ ...rule, baseRate: 3, weightKg: 15 }).amount).toBe(4);
    expect(countWeightIncrements(15.0001, rule)).toBe(2);
    expect(quoteClientShippingRate({ ...rule, baseRate: 3, weightKg: 20 }).amount).toBe(5);
  });

  it('uses each group base rate independently of the weight rule', () => {
    expect(quoteClientShippingRate({ ...rule, baseRate: 4, weightKg: 12 }).amount).toBe(5);
    expect(quoteClientShippingRate({ ...rule, baseRate: 5, weightKg: 12 }).amount).toBe(6);
  });

  it('rejects missing or non-positive weight and increment values', () => {
    expect(() => countWeightIncrements(0, rule)).toThrow(/greater than zero/);
    expect(() => countWeightIncrements(8, { ...rule, incrementKg: 0 })).toThrow(/increment/);
    expect(() => quoteClientShippingRate({ ...rule, baseRate: -1, weightKg: 8 })).toThrow(/Base rate/);
  });

  it('prices external shipments per kilogram without the local increment rule', () => {
    expect(quoteExternalPerKg(2.5, 3.5)).toBe(8.75);
  });
});
