import { Prisma } from '@prisma/client';

/**
 * FEFO / FIFO walk for a product within one warehouse (respects `quantity_available`).
 *
 * Ordering:
 * 1. Lots with expiry first, earliest expiry first (FEFO).
 * 2. Among same expiry (or no expiry), oldest lot receipt first (`lots.received_at`).
 * 3. Location walk order (aisle / rack / bin) then stock row age (`last_movement_at`).
 */
export async function findWarehouseStockFefo(
  tx: Prisma.TransactionClient,
  companyId: string,
  warehouseId: string,
  productId: string,
  specificLotId?: string | null,
): Promise<
  Array<{
    id: string;
    productId: string;
    locationId: string;
    warehouseId: string;
    lotId: string | null;
    quantityAvailable: Prisma.Decimal;
  }>
> {
  const lotFilter = specificLotId
    ? Prisma.sql`AND cs.lot_id = ${specificLotId}::uuid`
    : Prisma.empty;

  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      product_id: string;
      location_id: string;
      warehouse_id: string;
      lot_id: string | null;
      quantity_available: string;
      expiry_date: Date | null;
      last_movement_at: Date | null;
    }>
  >(Prisma.sql`
    SELECT cs.id,
           cs.product_id,
           cs.location_id,
           cs.warehouse_id,
           cs.lot_id,
           cs.quantity_available::text AS quantity_available,
           l.expiry_date,
           l.received_at,
           cs.last_movement_at
      FROM current_stock cs
 LEFT JOIN lots l ON l.id = cs.lot_id
 LEFT JOIN locations loc ON loc.id = cs.location_id
     WHERE cs.company_id = ${companyId}::uuid
       AND cs.warehouse_id = ${warehouseId}::uuid
       AND cs.product_id = ${productId}::uuid
       AND cs.status = 'available'
       AND cs.quantity_available > 0
       ${lotFilter}
  ORDER BY (l.expiry_date IS NULL),
           l.expiry_date ASC NULLS LAST,
           l.received_at ASC NULLS LAST,
           loc.aisle NULLS LAST,
           loc.rack NULLS LAST,
           loc.bin NULLS LAST,
           loc.coord_x NULLS LAST,
           loc.coord_y NULLS LAST,
           cs.last_movement_at ASC NULLS LAST,
           cs.id ASC
  `);

  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    locationId: r.location_id,
    warehouseId: r.warehouse_id,
    lotId: r.lot_id,
    quantityAvailable: new Prisma.Decimal(r.quantity_available),
  }));
}
