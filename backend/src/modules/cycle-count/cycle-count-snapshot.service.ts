import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CYCLE_COUNT_LOCATION_TYPES } from './cycle-count.constants';

export interface CycleCountSnapshotRow {
  productId: string;
  locationId: string;
  lotId: string | null;
  expectedQuantity: Prisma.Decimal;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class CycleCountSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build inventory snapshot lines from `current_stock` (package_id IS NULL only).
   */
  async buildSnapshotRows(
    tx: Tx,
    opts: {
      companyId: string;
      warehouseId: string;
      productIds?: string[];
      includeZeroOnHand: boolean;
    },
  ): Promise<CycleCountSnapshotRow[]> {
    const rows = await tx.currentStock.findMany({
      where: {
        companyId: opts.companyId,
        warehouseId: opts.warehouseId,
        packageId: null,
        ...(opts.productIds?.length ? { productId: { in: opts.productIds } } : {}),
        ...(opts.includeZeroOnHand ? {} : { quantityOnHand: { gt: 0 } }),
        location: { type: { in: CYCLE_COUNT_LOCATION_TYPES } },
      },
      select: {
        productId: true,
        locationId: true,
        lotId: true,
        quantityOnHand: true,
      },
      orderBy: [{ productId: 'asc' }, { locationId: 'asc' }, { lotId: 'asc' }],
    });

    const seen = new Set<string>();
    const out: CycleCountSnapshotRow[] = [];
    for (const r of rows) {
      const key = `${r.productId}:${r.locationId}:${r.lotId ?? 'null'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        productId: r.productId,
        locationId: r.locationId,
        lotId: r.lotId,
        expectedQuantity: r.quantityOnHand,
      });
    }
    return out;
  }

  async insertLines(
    tx: Tx,
    cycleCountId: string,
    rows: CycleCountSnapshotRow[],
    defaultAssignedWorkerId?: string | null,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await tx.cycleCountLine.createMany({
      data: rows.map((r) => ({
        cycleCountId,
        productId: r.productId,
        locationId: r.locationId,
        lotId: r.lotId,
        expectedQuantity: r.expectedQuantity,
        assignedWorkerId: defaultAssignedWorkerId ?? undefined,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }
}
