import { BadRequestException } from '@nestjs/common';
import { Prisma, ProductUom } from '@prisma/client';

/** UOMs counted as whole units — no fractional quantities on orders or adjustments. */
const DISCRETE_PRODUCT_UOMS = new Set<ProductUom>([
  'piece',
  'box',
  'roll',
  'pallet',
  'carton',
]);

export function isDiscreteProductUom(uom: ProductUom): boolean {
  return DISCRETE_PRODUCT_UOMS.has(uom);
}

export function assertDiscreteUomPositiveIntegerQuantity(
  uom: ProductUom,
  quantity: number,
  fieldLabel: string,
): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestException(
      `${fieldLabel} must be a positive number for products with UOM "${uom}".`,
    );
  }
  if (isDiscreteProductUom(uom)) {
    if (!Number.isInteger(quantity)) {
      throw new BadRequestException(
        `${fieldLabel} must be a whole number (decimals are not allowed) for UOM "${uom}".`,
      );
    }
  } else {
    const dec = new Prisma.Decimal(quantity);
    if (dec.decimalPlaces() > 4) {
      throw new BadRequestException(
        `${fieldLabel} can have at most 4 decimal places for UOM "${uom}".`,
      );
    }
  }
}

export function assertDiscreteUomPositiveIntegerDecimal(
  uom: ProductUom,
  quantity: Prisma.Decimal,
  fieldLabel: string,
): void {
  if (!quantity.isFinite() || quantity.lessThanOrEqualTo(0)) {
    throw new BadRequestException(
      `${fieldLabel} must be greater than zero for products with UOM "${uom}".`,
    );
  }
  if (isDiscreteProductUom(uom)) {
    if (!quantity.modulo(1).equals(0)) {
      throw new BadRequestException(
        `${fieldLabel} must be a whole number (decimals are not allowed) for UOM "${uom}".`,
      );
    }
  } else {
    if (quantity.decimalPlaces() > 4) {
      throw new BadRequestException(
        `${fieldLabel} can have at most 4 decimal places for UOM "${uom}".`,
      );
    }
  }
}

/** Allows zero (e.g. QC failed quantity) but rejects negatives, non-finite, and excess precision. */
export function assertDiscreteUomNonNegativeIntegerDecimal(
  uom: ProductUom,
  quantity: Prisma.Decimal,
  fieldLabel: string,
): void {
  if (!quantity.isFinite() || quantity.lessThan(0)) {
    throw new BadRequestException(
      `${fieldLabel} cannot be negative for products with UOM "${uom}".`,
    );
  }
  if (isDiscreteProductUom(uom)) {
    if (!quantity.modulo(1).equals(0)) {
      throw new BadRequestException(
        `${fieldLabel} must be a whole number (decimals are not allowed) for UOM "${uom}".`,
      );
    }
  } else {
    if (quantity.decimalPlaces() > 4) {
      throw new BadRequestException(
        `${fieldLabel} can have at most 4 decimal places for UOM "${uom}".`,
      );
    }
  }
}
