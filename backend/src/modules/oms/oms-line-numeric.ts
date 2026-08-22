import { BadRequestException } from '@nestjs/common';

/**
 * OMS order line numeric rules (admin + client portal).
 * Quantity: positive whole number (≥ 1). Price (when set): non-negative whole number (≥ 0).
 */
export function assertOmsLinePositiveWholeQuantity(
  quantity: number,
  fieldLabel = 'Requested quantity',
): void {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new BadRequestException(
      `${fieldLabel} must be a positive whole number (no decimals, letters, or zero).`,
    );
  }
}

export function assertOmsLineNonNegativeWholePrice(
  unitPrice: number | null | undefined,
  fieldLabel = 'Unit price',
): void {
  if (unitPrice == null) return;
  if (!Number.isFinite(unitPrice) || !Number.isInteger(unitPrice) || unitPrice < 0) {
    throw new BadRequestException(
      `${fieldLabel} must be a whole number (0 or greater; no decimals or letters).`,
    );
  }
}
