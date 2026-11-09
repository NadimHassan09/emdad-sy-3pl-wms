import { Prisma } from '@prisma/client';

import { computeProductVolumeCbm } from '../products/product-volume.util';
import {
  computeFulfillmentFee,
  type FulfillmentRule,
} from './on-demand/billing-fulfillment-pricing.util';

/** Pure helpers mirroring BillingAutomationService incentive math. */
function incentiveResult(input: {
  deliveredCount: number;
  threshold: number;
  discountPct: number;
  omsRule: FulfillmentRule;
}) {
  const qualifies = input.deliveredCount >= input.threshold;
  const perOrder = input.omsRule.enabled
    ? computeFulfillmentFee(input.omsRule, {
        linesCount: input.omsRule.includedLines || 1,
        weightKg: 0,
      })
    : new Prisma.Decimal(0);
  const fulfillmentTotal = perOrder.mul(input.deliveredCount).toDecimalPlaces(2);
  const discountAmount = qualifies
    ? fulfillmentTotal.mul(input.discountPct).div(100).toDecimalPlaces(2).negated()
    : new Prisma.Decimal(0);
  return { qualifies, fulfillmentTotal, discountAmount };
}

describe('Billing automation — storage CBM + incentive', () => {
  it('storage: zero / missing dimensions → 0 CBM with warning path', () => {
    expect(Number(computeProductVolumeCbm(null, 10, 10))).toBe(0);
    expect(Number(computeProductVolumeCbm(100, null, 50))).toBe(0);
    expect(Number(computeProductVolumeCbm(100, 50, 40))).toBeCloseTo(0.2, 6);
  });

  it('storage: mixed lines sum qty × unit CBM', () => {
    const lines = [
      { qty: 5, cbm: computeProductVolumeCbm(100, 100, 100) }, // 1 × 5
      { qty: 10, cbm: computeProductVolumeCbm(null, 50, 50) }, // 0
    ];
    const total = lines.reduce((s, l) => s.plus(l.cbm.mul(l.qty)), new Prisma.Decimal(0));
    expect(Number(total)).toBe(5);
    expect(Number(total.mul(10).toDecimalPlaces(2))).toBe(50); // $10/m³
  });

  it('incentive: 499 = no, 500 = yes, 501 = yes', () => {
    const omsRule: FulfillmentRule = {
      enabled: true,
      baseFee: 2,
      includedLines: 1,
      extraLineFee: 0,
      includedWeightKg: 0,
      extraKgFee: 0,
    };
    expect(incentiveResult({ deliveredCount: 499, threshold: 500, discountPct: 20, omsRule }).qualifies).toBe(
      false,
    );
    expect(
      Number(
        incentiveResult({ deliveredCount: 499, threshold: 500, discountPct: 20, omsRule }).discountAmount,
      ),
    ).toBe(0);

    const at500 = incentiveResult({ deliveredCount: 500, threshold: 500, discountPct: 20, omsRule });
    expect(at500.qualifies).toBe(true);
    expect(Number(at500.fulfillmentTotal)).toBe(1000);
    expect(Number(at500.discountAmount)).toBe(-200);

    const at501 = incentiveResult({ deliveredCount: 501, threshold: 500, discountPct: 20, omsRule });
    expect(at501.qualifies).toBe(true);
    expect(Number(at501.discountAmount)).toBe(-200.4);
  });
});
