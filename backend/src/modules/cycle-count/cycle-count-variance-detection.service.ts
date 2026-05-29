import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { hasCycleCountDiscrepancy } from './cycle-count-discrepancy.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CycleCountVarianceDetectionService {
  /**
   * Create variance rows for counted lines where actual ≠ expected.
   * Idempotent — skips lines that already have a variance record.
   */
  async detectFromCount(tx: Tx, cycleCountId: string): Promise<number> {
    const count = await tx.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: { id: true, companyId: true, warehouseId: true },
    });
    if (!count) return 0;

    const lines = await tx.cycleCountLine.findMany({
      where: {
        cycleCountId,
        status: 'counted',
        actualQuantity: { not: null },
        discrepancyQuantity: { not: null },
        variance: null,
      },
      select: {
        id: true,
        productId: true,
        locationId: true,
        lotId: true,
        expectedQuantity: true,
        actualQuantity: true,
        discrepancyQuantity: true,
      },
    });

    let created = 0;
    const now = new Date();
    for (const line of lines) {
      const disc = line.discrepancyQuantity!;
      if (!hasCycleCountDiscrepancy(disc)) continue;
      if (line.actualQuantity == null) continue;

      await tx.cycleCountVariance.create({
        data: {
          cycleCountId: count.id,
          cycleCountLineId: line.id,
          companyId: count.companyId,
          warehouseId: count.warehouseId,
          productId: line.productId,
          locationId: line.locationId,
          lotId: line.lotId,
          expectedQuantity: line.expectedQuantity,
          actualQuantity: line.actualQuantity,
          discrepancyQuantity: disc,
          updatedAt: now,
        },
      });
      created += 1;
    }
    return created;
  }
}
