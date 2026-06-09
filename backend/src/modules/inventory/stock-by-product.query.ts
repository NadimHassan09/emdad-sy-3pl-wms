import { Prisma } from '@prisma/client';

import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockQueryDto } from './dto/stock-query.dto';

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StockByProductSqlContext = {
  joins: Prisma.Sql;
  where: Prisma.Sql;
};

export type StockByProductRow = {
  product_id: string;
  total_quantity: string;
  sku: string;
  name: string;
  uom: string;
  barcode: string | null;
  company_id: string;
  company_name: string;
};

async function resolveInboundLedgerSliceSql(
  prisma: PrismaService,
  orderIds: string[],
): Promise<Prisma.Sql> {
  if (orderIds.length === 0) {
    return Prisma.sql`1 = 0`;
  }

  const legs = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: 'inbound_order',
      referenceId: { in: orderIds },
      movementType: 'inbound_receive',
      toLocationId: { not: null },
    },
    select: { productId: true, lotId: true, toLocationId: true },
  });

  const slices = new Map<string, { productId: string; locationId: string; lotId: string | null }>();
  for (const r of legs) {
    if (!r.toLocationId) continue;
    const k = `${r.productId}|${r.lotId ?? '__null'}|${r.toLocationId}`;
    slices.set(k, {
      productId: r.productId,
      locationId: r.toLocationId,
      lotId: r.lotId,
    });
  }

  const values = [...slices.values()];
  if (values.length === 0) {
    return Prisma.sql`1 = 0`;
  }

  const orParts = values.map((s) => {
    if (s.lotId) {
      return Prisma.sql`(cs.product_id = ${s.productId}::uuid AND cs.location_id = ${s.locationId}::uuid AND cs.lot_id = ${s.lotId}::uuid)`;
    }
    return Prisma.sql`(cs.product_id = ${s.productId}::uuid AND cs.location_id = ${s.locationId}::uuid AND cs.lot_id IS NULL)`;
  });

  return Prisma.sql`(${Prisma.join(orParts, ' OR ')})`;
}

export async function buildStockByProductSqlContext(
  prisma: PrismaService,
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  query: StockQueryDto,
): Promise<StockByProductSqlContext> {
  const companyId = readCompanyIdFilterRequired(companyAccess, user, query.companyId);

  const joins: Prisma.Sql[] = [
    Prisma.sql`INNER JOIN products p ON p.id = cs.product_id`,
    Prisma.sql`INNER JOIN companies c ON c.id = p.company_id`,
  ];

  const conditions: Prisma.Sql[] = [
    Prisma.sql`cs.quantity_on_hand > 0`,
    Prisma.sql`cs.company_id = ${companyId}::uuid`,
  ];

  if (query.productId) {
    conditions.push(Prisma.sql`cs.product_id = ${query.productId}::uuid`);
  }
  if (query.warehouseId) {
    conditions.push(Prisma.sql`cs.warehouse_id = ${query.warehouseId}::uuid`);
  }

  if (query.locationId) {
    conditions.push(Prisma.sql`cs.location_id = ${query.locationId}::uuid`);
  } else {
    const locRaw = query.locationBarcodeOrId?.trim();
    if (locRaw) {
      if (UUID_LIKE.test(locRaw)) {
        conditions.push(Prisma.sql`cs.location_id = ${locRaw}::uuid`);
      } else {
        joins.push(Prisma.sql`INNER JOIN locations loc ON loc.id = cs.location_id`);
        const pattern = `%${locRaw}%`;
        conditions.push(
          Prisma.sql`(loc.barcode ILIKE ${pattern} OR loc.full_path ILIKE ${pattern})`,
        );
      }
    }
  }

  if (query.packageId) {
    conditions.push(Prisma.sql`cs.package_id = ${query.packageId}::uuid`);
  }

  if (query.lotNumber?.trim()) {
    joins.push(Prisma.sql`INNER JOIN lots lot ON lot.id = cs.lot_id`);
    const pattern = `%${query.lotNumber.trim()}%`;
    conditions.push(Prisma.sql`lot.lot_number ILIKE ${pattern}`);
  }

  if (query.sku?.trim()) {
    const pattern = `%${query.sku.trim()}%`;
    conditions.push(Prisma.sql`p.sku ILIKE ${pattern}`);
  }

  if (query.productName?.trim()) {
    const pattern = `%${query.productName.trim()}%`;
    conditions.push(Prisma.sql`p.name ILIKE ${pattern}`);
  }

  if (query.productBarcode?.trim()) {
    const pattern = `%${query.productBarcode.trim()}%`;
    conditions.push(Prisma.sql`p.barcode IS NOT NULL AND p.barcode ILIKE ${pattern}`);
  }

  if (query.productSearch?.trim()) {
    const pattern = `%${query.productSearch.trim()}%`;
    conditions.push(Prisma.sql`(p.name ILIKE ${pattern} OR p.sku ILIKE ${pattern})`);
  }

  if (query.inboundOrderId) {
    conditions.push(await resolveInboundLedgerSliceSql(prisma, [query.inboundOrderId]));
  } else if (query.inboundOrderNumber?.trim()) {
    const term = query.inboundOrderNumber.trim();
    const orders = await prisma.inboundOrder.findMany({
      where: {
        orderNumber: { contains: term, mode: 'insensitive' },
        companyId,
      },
      select: { id: true },
      take: 100,
    });
    conditions.push(
      await resolveInboundLedgerSliceSql(
        prisma,
        orders.map((o) => o.id),
      ),
    );
  }

  return {
    joins: Prisma.join(joins, ' '),
    where: Prisma.join(conditions, ' AND '),
  };
}

export function stockByProductCountSql(ctx: StockByProductSqlContext): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(DISTINCT cs.product_id)::int AS total
      FROM current_stock cs
      ${ctx.joins}
     WHERE ${ctx.where}
  `;
}

export function stockByProductPageSql(
  ctx: StockByProductSqlContext,
  limit: number,
  offset: number,
): Prisma.Sql {
  return Prisma.sql`
    SELECT cs.product_id,
           SUM(cs.quantity_on_hand)::text AS total_quantity,
           p.sku,
           p.name,
           p.uom::text AS uom,
           p.barcode,
           c.id AS company_id,
           c.name AS company_name
      FROM current_stock cs
      ${ctx.joins}
     WHERE ${ctx.where}
     GROUP BY cs.product_id, p.id, p.sku, p.name, p.uom, p.barcode, c.id, c.name
     ORDER BY p.name ASC
     LIMIT ${limit}
    OFFSET ${offset}
  `;
}
