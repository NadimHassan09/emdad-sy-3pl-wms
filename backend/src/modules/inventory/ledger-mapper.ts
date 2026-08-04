import { MovementType, Prisma } from '@prisma/client';

/**
 * Signed inventory delta for API consumers (quantityChange).
 * Stored DB `quantity` remains absolute; sign is applied once here.
 * Negative = stock decrease; positive = stock increase.
 */
export function ledgerSignedQuantity(
  movementType: MovementType,
  quantity: Prisma.Decimal,
): string {
  const neg: MovementType[] = [
    MovementType.outbound_pick,
    MovementType.adjustment_negative,
    MovementType.scrap,
    MovementType.transit_out,
    MovementType.qc_quarantine,
  ];
  const mult = neg.includes(movementType) ? -1 : 1;
  return quantity.mul(mult).toString();
}

/** Primary business movements shown by default on Inventory Ledger. */
export const PRIMARY_LEDGER_MOVEMENTS: MovementType[] = [
  MovementType.inbound_receive,
  MovementType.outbound_pick,
  MovementType.return_receive,
];

/** Internal audit movements — opt-in via includeInternal. */
export const INTERNAL_LEDGER_MOVEMENTS: MovementType[] = [
  MovementType.adjustment_positive,
  MovementType.adjustment_negative,
  MovementType.internal_transfer,
  MovementType.scrap,
  MovementType.qc_quarantine,
  MovementType.qc_release,
  MovementType.putaway,
  MovementType.transit_in,
  MovementType.transit_out,
];

export type LedgerDisplayMovement =
  | 'inbound'
  | 'outbound'
  | 'return'
  | 'adjustment'
  | 'transfer'
  | 'scrap'
  | 'qc';

export function toLedgerDisplayMovement(
  movementType: MovementType,
): LedgerDisplayMovement {
  switch (movementType) {
    case MovementType.inbound_receive:
    case MovementType.transit_in:
      return 'inbound';
    case MovementType.outbound_pick:
    case MovementType.transit_out:
      return 'outbound';
    case MovementType.return_receive:
      return 'return';
    case MovementType.internal_transfer:
      return 'transfer';
    case MovementType.scrap:
      return 'scrap';
    case MovementType.qc_quarantine:
    case MovementType.qc_release:
      return 'qc';
    case MovementType.adjustment_positive:
    case MovementType.adjustment_negative:
    case MovementType.putaway:
    default:
      return 'adjustment';
  }
}
