import { Injectable } from '@nestjs/common';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuthPrincipal } from '../../../common/auth/current-user.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { StockQueryDto } from '../../inventory/dto/stock-query.dto';
import { InventoryService } from '../../inventory/inventory.service';

/** Per-product totals for the client portal — no warehouse / location / lot objects. */
export interface ClientStockProductRow {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: string;
  uom: string;
  /** Earliest non-null lot expiry among on-hand rows for this product, ISO `YYYY-MM-DD`, or null. */
  expiryDate: string | null;
}

@Injectable()
export class ClientStockService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Per-product on-hand totals for the authenticated client tenant only.
   * Ignores any `companyId` on the query string — always scoped to `client.companyId`.
   */
  async list(client: ClientPrincipal, query: StockQueryDto): Promise<{
    items: ClientStockProductRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const principal: AuthPrincipal = {
      id: client.id,
      companyId: client.companyId,
      role: client.role,
      email: client.email ?? undefined,
    };
    const page = await this.inventory.stockByProductSummary(principal, {
      ...query,
      companyId: client.companyId,
    });

    const productIds = page.items.map((i) => i.productId);
    const minExpiry = await this.minExpiryDateByProduct(client.companyId, productIds);

    return {
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      items: page.items.map((row) => ({
        productId: row.productId,
        productName: row.product.name,
        sku: row.product.sku,
        totalQuantity: row.totalQuantity,
        uom: row.product.uom,
        expiryDate: minExpiry.get(row.productId) ?? null,
      })),
    };
  }

  /** Earliest expiry date per product among on-hand rows that have a lot with an expiry. */
  private async minExpiryDateByProduct(
    companyId: string,
    productIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (productIds.length === 0) return out;

    const rows = await this.prisma.currentStock.findMany({
      where: {
        companyId,
        productId: { in: productIds },
        quantityOnHand: { gt: 0 },
        lotId: { not: null },
        lot: { expiryDate: { not: null } },
      },
      select: {
        productId: true,
        lot: { select: { expiryDate: true } },
      },
    });

    const best = new Map<string, Date>();
    for (const r of rows) {
      const exp = r.lot?.expiryDate;
      if (!exp) continue;
      const cur = best.get(r.productId);
      if (cur === undefined || exp < cur) best.set(r.productId, exp);
    }
    for (const [pid, d] of best) {
      out.set(pid, d.toISOString().slice(0, 10));
    }
    return out;
  }
}
