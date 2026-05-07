import { MovementType, Prisma } from '@prisma/client';

/** Positive = inward / increase; negative = outward / decrease (UI convention). */
export function ledgerSignedQuantity(
  movementType: MovementType,
  quantity: Prisma.Decimal,
): string {
  const neg: MovementType[] = [
    'outbound_pick',
    'adjustment_negative',
    'scrap',
    'transit_out',
    'qc_quarantine',
  ];
  const mult = neg.includes(movementType) ? -1 : 1;
  return quantity.mul(mult).toString();
}
