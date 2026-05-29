import { Prisma } from '@prisma/client';

/** Server-side variance: actual − expected (stored; not exposed to blind worker UI). */
export function computeCycleCountDiscrepancy(
  expected: Prisma.Decimal,
  actual: Prisma.Decimal,
): Prisma.Decimal {
  return actual.minus(expected);
}

export function hasCycleCountDiscrepancy(discrepancy: Prisma.Decimal): boolean {
  return !discrepancy.isZero();
}
