import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Receiving quantity integrity rules (keep aligned with
 * `frontend/src/pages/tasks/receiving/receiving-utils.ts`).
 *
 * received + damaged + missing must never exceed expected.
 * Missing is derived (expected − received − damaged) and must be ≥ 0.
 */

export function parseDamagedQtyFromNotes(notes?: string | null): Prisma.Decimal {
  if (!notes?.trim()) return new Prisma.Decimal(0);
  const m = /(?:^|\s|·)damaged:([\d.]+)/i.exec(notes);
  if (!m?.[1]) return new Prisma.Decimal(0);
  try {
    const d = new Prisma.Decimal(m[1]);
    return d.isNeg() ? new Prisma.Decimal(0) : d;
  } catch {
    return new Prisma.Decimal(0);
  }
}

export function resolveDamagedQty(
  damagedQty: string | number | null | undefined,
  discrepancyNotes?: string | null,
): Prisma.Decimal {
  if (damagedQty !== undefined && damagedQty !== null && String(damagedQty).trim() !== '') {
    try {
      return new Prisma.Decimal(damagedQty);
    } catch {
      throw new BadRequestException('Damaged quantity must be a valid number.');
    }
  }
  return parseDamagedQtyFromNotes(discrepancyNotes);
}

export type ReceivingQtyCheckInput = {
  expected: Prisma.Decimal;
  /** Quantity being posted as good received on this write. */
  receivedQty: Prisma.Decimal;
  damagedQty: Prisma.Decimal;
  /** Already posted receivedQuantity on the inbound line (before this write). */
  priorReceived?: Prisma.Decimal;
  lineId?: string;
};

/**
 * Rejects negative qtys and any allocation that would exceed expected.
 * `allow_short_close` must NEVER bypass this — short close only permits under-receipt.
 */
export function assertReceivingQuantitiesWithinExpected(input: ReceivingQtyCheckInput): void {
  const { expected, receivedQty, damagedQty } = input;
  const prior = input.priorReceived ?? new Prisma.Decimal(0);
  const lineHint = input.lineId ? ` for line ${input.lineId}` : '';

  if (receivedQty.isNeg()) {
    throw new BadRequestException(`Received quantity cannot be negative${lineHint}.`);
  }
  if (damagedQty.isNeg()) {
    throw new BadRequestException(`Damaged quantity cannot be negative${lineHint}.`);
  }

  const payloadAccounted = receivedQty.add(damagedQty);
  if (payloadAccounted.greaterThan(expected)) {
    throw new BadRequestException(
      `Received + damaged (${payloadAccounted.toString()}) exceeds expected (${expected.toString()})${lineHint}.`,
    );
  }

  const totalAccounted = prior.add(receivedQty).add(damagedQty);
  if (totalAccounted.greaterThan(expected)) {
    throw new BadRequestException(
      `Total received + damaged (${totalAccounted.toString()}) would exceed expected (${expected.toString()})${lineHint}.`,
    );
  }
}
