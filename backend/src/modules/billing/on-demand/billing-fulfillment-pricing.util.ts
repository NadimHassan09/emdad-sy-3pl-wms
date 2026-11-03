import { Prisma } from '@prisma/client';

/** How a fulfillment fee scales with the order: a base fee, plus extra lines and extra weight. */
export type FulfillmentRule = {
  enabled: boolean;
  baseFee: Prisma.Decimal.Value;
  includedLines: number;
  extraLineFee: Prisma.Decimal.Value;
  includedWeightKg: Prisma.Decimal.Value;
  extraKgFee: Prisma.Decimal.Value;
};

export type FulfillmentOrderMetrics = {
  /** Number of distinct products (SKU lines) on the order. */
  linesCount: number;
  weightKg: Prisma.Decimal.Value;
};

const ZERO = new Prisma.Decimal(0);

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Fulfillment fee for one order: base + extra lines x extraLineFee + extra kg x extraKgFee.
 * A disabled rule charges nothing. Fees are never negative.
 */
export function computeFulfillmentFee(rule: FulfillmentRule, order: FulfillmentOrderMetrics): Prisma.Decimal {
  if (!rule.enabled) return ZERO;
  const base = new Prisma.Decimal(rule.baseFee);
  const extraLines = Math.max(0, Math.floor(order.linesCount) - Math.max(0, rule.includedLines));
  const extraKg = Prisma.Decimal.max(
    ZERO,
    new Prisma.Decimal(order.weightKg).minus(new Prisma.Decimal(rule.includedWeightKg)),
  );
  const fee = base
    .plus(new Prisma.Decimal(rule.extraLineFee).times(extraLines))
    .plus(new Prisma.Decimal(rule.extraKgFee).times(extraKg));
  return roundMoney(Prisma.Decimal.max(ZERO, fee));
}

/** Storage is charged per 30 days, pro-rated by the days in the invoice period (inclusive). */
export function computeStorageFee(rule: Pick<FulfillmentRule, 'enabled' | 'baseFee'>, periodDays: number): Prisma.Decimal {
  if (!rule.enabled || periodDays <= 0) return ZERO;
  return roundMoney(new Prisma.Decimal(rule.baseFee).times(periodDays).div(30));
}

export function inclusiveDays(from: Date, to: Date): number {
  const ms = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) -
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

/** Statement shown on a settled invoice: the balance held, the amount owed, and what is left. */
export function settlementStatement(input: { balance: Prisma.Decimal.Value; owed: Prisma.Decimal.Value }) {
  const balance = new Prisma.Decimal(input.balance);
  const owed = new Prisma.Decimal(input.owed);
  const deducted = Prisma.Decimal.max(ZERO, Prisma.Decimal.min(balance, owed));
  return {
    balanceBefore: balance,
    owed,
    deducted,
    balanceAfter: balance.minus(deducted),
    remainingDue: owed.minus(deducted),
    fullySettled: owed.minus(deducted).lte(ZERO),
  };
}
