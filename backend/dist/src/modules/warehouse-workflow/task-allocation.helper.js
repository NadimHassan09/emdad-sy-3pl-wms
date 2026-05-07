"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findWarehouseStockFefo = findWarehouseStockFefo;
const client_1 = require("@prisma/client");
async function findWarehouseStockFefo(tx, companyId, warehouseId, productId, specificLotId) {
    const lotFilter = specificLotId
        ? client_1.Prisma.sql `AND cs.lot_id = ${specificLotId}::uuid`
        : client_1.Prisma.empty;
    const rows = await tx.$queryRaw(client_1.Prisma.sql `
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
        quantityAvailable: new client_1.Prisma.Decimal(r.quantity_available),
    }));
}
//# sourceMappingURL=task-allocation.helper.js.map