import { Injectable } from '@nestjs/common';
import { OmsReturnStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Expected Return Hold (Path A — does NOT touch current_stock).
 *
 * Semantic model:
 * - Physical on_hand / reserved / available live only in current_stock.
 * - Expected returns are open OMS return lines (status requested|approved).
 * - They never increase sellable available until warehouse receipt converts
 *   the hold (return → completed) and posts physical stock via existing
 *   receive/putaway paths.
 *
 * Lifecycle:
 *   draft return created  → hold ACTIVE   (no stock mutation)
 *   warehouse confirm     → hold CONVERTED (physical on_hand ↑ once)
 *   cancel / reject / OFD recovery → hold RELEASED (no stock mutation)
 */
export const EXPECTED_RETURN_HOLD_ACTIVE_STATUSES: OmsReturnStatus[] = [
  OmsReturnStatus.requested,
  OmsReturnStatus.approved,
];

export type ExpectedReturnHoldState = 'active' | 'converted' | 'released' | 'absent';

@Injectable()
export class ExpectedReturnHoldService {
  constructor(private readonly prisma: PrismaService) {}

  /** True when the return still represents an expected (non-physical) hold. */
  isActiveStatus(status: OmsReturnStatus | string): boolean {
    return EXPECTED_RETURN_HOLD_ACTIVE_STATUSES.includes(status as OmsReturnStatus);
  }

  /**
   * Resolve hold state from return status (idempotent derivation — no extra column).
   * completed → converted; cancelled|rejected → released; requested|approved → active.
   */
  holdStateFromStatus(status: OmsReturnStatus | string | null | undefined): ExpectedReturnHoldState {
    if (!status) return 'absent';
    if (status === OmsReturnStatus.completed) return 'converted';
    if (status === OmsReturnStatus.cancelled || status === OmsReturnStatus.rejected) {
      return 'released';
    }
    if (this.isActiveStatus(status)) return 'active';
    return 'absent';
  }

  /**
   * Sum expected-return quantities per product for a company.
   * Does not read or write current_stock — available/on_hand unchanged.
   */
  async sumExpectedByProduct(
    companyId: string,
    productIds?: string[],
    db: PrismaService | Tx = this.prisma,
  ): Promise<Map<string, Prisma.Decimal>> {
    const lines = await db.omsReturnLine.findMany({
      where: {
        ...(productIds && productIds.length > 0 ? { productId: { in: productIds } } : {}),
        omsReturn: {
          companyId,
          status: { in: EXPECTED_RETURN_HOLD_ACTIVE_STATUSES },
        },
      },
      select: { productId: true, quantity: true },
    });

    const out = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const cur = out.get(line.productId) ?? new Prisma.Decimal(0);
      out.set(line.productId, cur.add(line.quantity));
    }
    return out;
  }

  async expectedQuantityForProduct(
    companyId: string,
    productId: string,
    db: PrismaService | Tx = this.prisma,
  ): Promise<Prisma.Decimal> {
    const map = await this.sumExpectedByProduct(companyId, [productId], db);
    return map.get(productId) ?? new Prisma.Decimal(0);
  }

  /**
   * Snapshot of hold for a single OMS return (for events / tests).
   * Calling this after create documents that the hold is active without stock writes.
   */
  async describeHold(
    omsReturnId: string,
    db: PrismaService | Tx = this.prisma,
  ): Promise<{
    omsReturnId: string;
    state: ExpectedReturnHoldState;
    lines: Array<{ productId: string; quantity: string }>;
    totalQuantity: string;
  } | null> {
    const row = await db.omsReturn.findUnique({
      where: { id: omsReturnId },
      select: {
        id: true,
        status: true,
        lines: { select: { productId: true, quantity: true } },
      },
    });
    if (!row) return null;

    const state = this.holdStateFromStatus(row.status);
    let total = new Prisma.Decimal(0);
    const lines = row.lines.map((l) => {
      total = total.add(l.quantity);
      return { productId: l.productId, quantity: l.quantity.toString() };
    });

    return {
      omsReturnId: row.id,
      state,
      lines,
      totalQuantity: total.toString(),
    };
  }

  /**
   * Idempotent "activate" marker: returns current hold description.
   * No current_stock mutation. Safe to call multiple times after draft create.
   */
  async activateHold(
    omsReturnId: string,
    db: PrismaService | Tx = this.prisma,
  ): Promise<{ activated: boolean; state: ExpectedReturnHoldState; totalQuantity: string }> {
    const snap = await this.describeHold(omsReturnId, db);
    if (!snap) {
      return { activated: false, state: 'absent', totalQuantity: '0' };
    }
    // Already converted/released → do not re-activate (idempotent no-op).
    if (snap.state !== 'active') {
      return { activated: false, state: snap.state, totalQuantity: snap.totalQuantity };
    }
    return { activated: true, state: 'active', totalQuantity: snap.totalQuantity };
  }

  /**
   * Idempotent convert check before/after warehouse receipt.
   * Physical stock posting remains the caller's responsibility (receive/putaway).
   * Returns false if hold was already converted or released (caller must not reverse).
   */
  async assertConvertible(
    omsReturnId: string,
    db: PrismaService | Tx = this.prisma,
  ): Promise<{ ok: boolean; state: ExpectedReturnHoldState; reason?: string }> {
    const snap = await this.describeHold(omsReturnId, db);
    if (!snap) return { ok: false, state: 'absent', reason: 'Return not found.' };
    if (snap.state === 'converted') {
      return { ok: false, state: 'converted', reason: 'Hold already converted to physical stock.' };
    }
    if (snap.state === 'released') {
      return { ok: false, state: 'released', reason: 'Hold was released; cannot convert.' };
    }
    if (snap.state !== 'active') {
      return { ok: false, state: snap.state, reason: 'Hold is not active.' };
    }
    return { ok: true, state: 'active' };
  }

  /**
   * Idempotent release eligibility for cancel/reject/carrier recovery.
   * MUST NOT release (or reverse stock) after conversion.
   */
  async assertReleasable(
    omsReturnId: string,
    db: PrismaService | Tx = this.prisma,
  ): Promise<{ ok: boolean; state: ExpectedReturnHoldState; reason?: string }> {
    const snap = await this.describeHold(omsReturnId, db);
    if (!snap) return { ok: false, state: 'absent', reason: 'Return not found.' };
    if (snap.state === 'converted') {
      return {
        ok: false,
        state: 'converted',
        reason: 'Cannot release expected hold after warehouse confirmation.',
      };
    }
    if (snap.state === 'released') {
      // Idempotent: already released — treat as success with no further change.
      return { ok: true, state: 'released', reason: 'Already released.' };
    }
    if (snap.state !== 'active') {
      return { ok: false, state: snap.state, reason: 'Hold is not active.' };
    }
    return { ok: true, state: 'active' };
  }
}
