import { BadRequestException } from '@nestjs/common';
import { Prisma, ProductUom } from '@prisma/client';

import { assertDiscreteUomNonNegativeIntegerDecimal } from '../../common/utils/discrete-uom-quantity';

const MAX_QTY = new Prisma.Decimal('999999999.9999');

export function parseActualQuantity(raw: string): Prisma.Decimal {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new BadRequestException('actualQuantity is required.');
  }
  let actual: Prisma.Decimal;
  try {
    actual = new Prisma.Decimal(trimmed);
  } catch {
    throw new BadRequestException('actualQuantity must be a valid number.');
  }
  if (!actual.isFinite()) {
    throw new BadRequestException('actualQuantity must be a finite number.');
  }
  if (actual.lessThan(0)) {
    throw new BadRequestException('actualQuantity cannot be negative.');
  }
  if (actual.greaterThan(MAX_QTY)) {
    throw new BadRequestException('actualQuantity exceeds the allowed maximum.');
  }
  return actual;
}

export function validateActualQuantityForProduct(
  uom: ProductUom,
  actual: Prisma.Decimal,
): void {
  assertDiscreteUomNonNegativeIntegerDecimal(uom, actual, 'Counted quantity');
}
