import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type CompanyUsageTotals = {
  volumeCbm: Prisma.Decimal;
  weightKg: Prisma.Decimal;
};

export type StorageUtilizationSnapshot = {
  usedStorageCbm: Prisma.Decimal;
  reservedStorageCbm: Prisma.Decimal;
  remainingStorageCbm: Prisma.Decimal;
  storageUsagePercent: number;
};

/**
 * Storage billing is derived live from inventory:
 * Used CBM = Σ (current on-hand qty × product.volume_cbm)
 * Product CBM is maintained from L×W×H; missing dims → 0.
 */
@Injectable()
export class BillingUsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sum current inventory quantity × product physical attributes for a client.
   * Uses quantity_on_hand (physical stock). Archived products are excluded.
   * Negative quantities are floored at 0.
   */
  async getCompanyUsage(companyId: string): Promise<CompanyUsageTotals> {
    const rows = await this.prisma.$queryRaw<{ volume: string; weight: string }[]>`
      SELECT
        COALESCE(
          SUM(GREATEST(cs.quantity_on_hand, 0) * COALESCE(p.volume_cbm, 0)),
          0
        )::text AS volume,
        COALESCE(
          SUM(GREATEST(cs.quantity_on_hand, 0) * COALESCE(p.weight_kg, 0)),
          0
        )::text AS weight
      FROM current_stock cs
      INNER JOIN products p ON p.id = cs.product_id
      WHERE cs.company_id = ${companyId}::uuid
        AND cs.quantity_on_hand > 0
        AND p.status <> 'archived'::product_status
    `;
    const row = rows[0];
    return {
      volumeCbm: new Prisma.Decimal(row?.volume ?? '0'),
      weightKg: new Prisma.Decimal(row?.weight ?? '0'),
    };
  }

  /** System-wide used storage across all clients (inventory × product CBM). */
  async getSystemUsedStorageCbm(): Promise<Prisma.Decimal> {
    const rows = await this.prisma.$queryRaw<{ volume: string }[]>`
      SELECT
        COALESCE(
          SUM(GREATEST(cs.quantity_on_hand, 0) * COALESCE(p.volume_cbm, 0)),
          0
        )::text AS volume
      FROM current_stock cs
      INNER JOIN products p ON p.id = cs.product_id
      WHERE cs.quantity_on_hand > 0
        AND p.status <> 'archived'::product_status
    `;
    return new Prisma.Decimal(rows[0]?.volume ?? '0');
  }

  async getSystemReservedStorageCbm(): Promise<Prisma.Decimal> {
    const agg = await this.prisma.billingPlan.aggregate({
      where: { active: true },
      _sum: { reservedVolume: true },
    });
    return agg._sum.reservedVolume ?? new Prisma.Decimal(0);
  }

  async getCompanyReservedStorageCbm(companyId: string): Promise<Prisma.Decimal> {
    const plan = await this.prisma.billingPlan.findFirst({
      where: { companyId, active: true },
      select: { reservedVolume: true },
      orderBy: { updatedAt: 'desc' },
    });
    return plan?.reservedVolume ?? new Prisma.Decimal(0);
  }

  buildUtilizationSnapshot(
    used: Prisma.Decimal,
    reserved: Prisma.Decimal,
  ): StorageUtilizationSnapshot {
    const usedSafe = Prisma.Decimal.max(used, new Prisma.Decimal(0));
    const reservedSafe = Prisma.Decimal.max(reserved, new Prisma.Decimal(0));
    const remaining = Prisma.Decimal.max(
      reservedSafe.sub(usedSafe),
      new Prisma.Decimal(0),
    );
    let storageUsagePercent = 0;
    if (reservedSafe.gt(0)) {
      storageUsagePercent = Math.min(
        100,
        Math.round(Number(usedSafe.div(reservedSafe).mul(1000))) / 10,
      );
      if (!Number.isFinite(storageUsagePercent) || storageUsagePercent < 0) {
        storageUsagePercent = 0;
      }
    }
    return {
      usedStorageCbm: usedSafe,
      reservedStorageCbm: reservedSafe,
      remainingStorageCbm: remaining,
      storageUsagePercent,
    };
  }

  async getCompanyStorageSnapshot(companyId: string): Promise<StorageUtilizationSnapshot> {
    const [usage, reserved] = await Promise.all([
      this.getCompanyUsage(companyId),
      this.getCompanyReservedStorageCbm(companyId),
    ]);
    return this.buildUtilizationSnapshot(usage.volumeCbm, reserved);
  }

  async getSystemStorageSnapshot(): Promise<StorageUtilizationSnapshot> {
    const [used, reserved] = await Promise.all([
      this.getSystemUsedStorageCbm(),
      this.getSystemReservedStorageCbm(),
    ]);
    return this.buildUtilizationSnapshot(used, reserved);
  }
}
