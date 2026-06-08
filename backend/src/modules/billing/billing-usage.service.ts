import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type CompanyUsageTotals = {
  volumeCbm: Prisma.Decimal;
  weightKg: Prisma.Decimal;
};

@Injectable()
export class BillingUsageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sum on-hand quantity × product physical attributes for a client tenant. */
  async getCompanyUsage(companyId: string): Promise<CompanyUsageTotals> {
    const rows = await this.prisma.$queryRaw<{ volume: string; weight: string }[]>`
      SELECT
        COALESCE(SUM(cs.quantity_on_hand * COALESCE(p.volume_cbm, 0)), 0)::text AS volume,
        COALESCE(SUM(cs.quantity_on_hand * COALESCE(p.weight_kg, 0)), 0)::text AS weight
      FROM current_stock cs
      INNER JOIN products p ON p.id = cs.product_id
      WHERE cs.company_id = ${companyId}::uuid
        AND cs.quantity_on_hand > 0
    `;
    const row = rows[0];
    return {
      volumeCbm: new Prisma.Decimal(row?.volume ?? '0'),
      weightKg: new Prisma.Decimal(row?.weight ?? '0'),
    };
  }
}
