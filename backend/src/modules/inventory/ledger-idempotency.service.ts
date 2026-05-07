import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LedgerIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent ledger insert: if `idempotencyKey` exists, skips and returns existing ledger UUID.
   */
  async appendIfAbsent(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
    data: Omit<Prisma.InventoryLedgerUncheckedCreateInput, 'idempotencyKey'>,
  ): Promise<{ ledgerId: string; inserted: boolean }> {
    const existing = await tx.ledgerIdempotency.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return { ledgerId: existing.ledgerId, inserted: false };
    }
    const row = await tx.inventoryLedger.create({
      data: { ...data, idempotencyKey },
    });
    await tx.ledgerIdempotency.create({
      data: {
        idempotencyKey,
        ledgerId: row.id,
      },
    });
    return { ledgerId: row.id, inserted: true };
  }
}
