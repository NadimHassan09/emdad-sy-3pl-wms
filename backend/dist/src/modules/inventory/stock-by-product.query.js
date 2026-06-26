"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStockByProductSqlContext = buildStockByProductSqlContext;
exports.stockByProductCountSql = stockByProductCountSql;
exports.stockByProductPageSql = stockByProductPageSql;
const client_1 = require("@prisma/client");
const company_read_scope_1 = require("../../common/auth/company-read-scope");
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function resolveInboundLedgerSliceSql(prisma, orderIds) {
    if (orderIds.length === 0) {
        return client_1.Prisma.sql `1 = 0`;
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
    const slices = new Map();
    for (const r of legs) {
        if (!r.toLocationId)
            continue;
        const k = `${r.productId}|${r.lotId ?? '__null'}|${r.toLocationId}`;
        slices.set(k, {
            productId: r.productId,
            locationId: r.toLocationId,
            lotId: r.lotId,
        });
    }
    const values = [...slices.values()];
    if (values.length === 0) {
        return client_1.Prisma.sql `1 = 0`;
    }
    const orParts = values.map((s) => {
        if (s.lotId) {
            return client_1.Prisma.sql `(cs.product_id = ${s.productId}::uuid AND cs.location_id = ${s.locationId}::uuid AND cs.lot_id = ${s.lotId}::uuid)`;
        }
        return client_1.Prisma.sql `(cs.product_id = ${s.productId}::uuid AND cs.location_id = ${s.locationId}::uuid AND cs.lot_id IS NULL)`;
    });
    return client_1.Prisma.sql `(${client_1.Prisma.join(orParts, ' OR ')})`;
}
async function buildStockByProductSqlContext(prisma, companyAccess, user, query) {
    const companyId = (0, company_read_scope_1.readCompanyIdFilterRequired)(companyAccess, user, query.companyId);
    const joins = [
        client_1.Prisma.sql `INNER JOIN products p ON p.id = cs.product_id`,
        client_1.Prisma.sql `INNER JOIN companies c ON c.id = p.company_id`,
    ];
    const conditions = [
        client_1.Prisma.sql `cs.quantity_on_hand > 0`,
    ];
    if (companyId) {
        conditions.push(client_1.Prisma.sql `cs.company_id = ${companyId}::uuid`);
    }
    if (query.productId) {
        conditions.push(client_1.Prisma.sql `cs.product_id = ${query.productId}::uuid`);
    }
    if (query.warehouseId) {
        conditions.push(client_1.Prisma.sql `cs.warehouse_id = ${query.warehouseId}::uuid`);
    }
    if (query.locationId) {
        conditions.push(client_1.Prisma.sql `cs.location_id = ${query.locationId}::uuid`);
    }
    else {
        const locRaw = query.locationBarcodeOrId?.trim();
        if (locRaw) {
            if (UUID_LIKE.test(locRaw)) {
                conditions.push(client_1.Prisma.sql `cs.location_id = ${locRaw}::uuid`);
            }
            else {
                joins.push(client_1.Prisma.sql `INNER JOIN locations loc ON loc.id = cs.location_id`);
                const pattern = `%${locRaw}%`;
                conditions.push(client_1.Prisma.sql `(loc.barcode ILIKE ${pattern} OR loc.full_path ILIKE ${pattern})`);
            }
        }
    }
    if (query.packageId) {
        conditions.push(client_1.Prisma.sql `cs.package_id = ${query.packageId}::uuid`);
    }
    if (query.lotNumber?.trim()) {
        joins.push(client_1.Prisma.sql `INNER JOIN lots lot ON lot.id = cs.lot_id`);
        const pattern = `%${query.lotNumber.trim()}%`;
        conditions.push(client_1.Prisma.sql `lot.lot_number ILIKE ${pattern}`);
    }
    if (query.sku?.trim()) {
        const pattern = `%${query.sku.trim()}%`;
        conditions.push(client_1.Prisma.sql `p.sku ILIKE ${pattern}`);
    }
    if (query.productName?.trim()) {
        const pattern = `%${query.productName.trim()}%`;
        conditions.push(client_1.Prisma.sql `p.name ILIKE ${pattern}`);
    }
    if (query.productBarcode?.trim()) {
        const pattern = `%${query.productBarcode.trim()}%`;
        conditions.push(client_1.Prisma.sql `p.barcode IS NOT NULL AND p.barcode ILIKE ${pattern}`);
    }
    if (query.productSearch?.trim()) {
        const pattern = `%${query.productSearch.trim()}%`;
        conditions.push(client_1.Prisma.sql `(p.name ILIKE ${pattern} OR p.sku ILIKE ${pattern})`);
    }
    if (query.inboundOrderId) {
        conditions.push(await resolveInboundLedgerSliceSql(prisma, [query.inboundOrderId]));
    }
    else if (query.inboundOrderNumber?.trim()) {
        const term = query.inboundOrderNumber.trim();
        const orders = await prisma.inboundOrder.findMany({
            where: {
                orderNumber: { contains: term, mode: 'insensitive' },
                companyId,
            },
            select: { id: true },
            take: 100,
        });
        conditions.push(await resolveInboundLedgerSliceSql(prisma, orders.map((o) => o.id)));
    }
    return {
        joins: client_1.Prisma.join(joins, ' '),
        where: client_1.Prisma.join(conditions, ' AND '),
    };
}
function stockByProductCountSql(ctx) {
    return client_1.Prisma.sql `
    SELECT COUNT(DISTINCT cs.product_id)::int AS total
      FROM current_stock cs
      ${ctx.joins}
     WHERE ${ctx.where}
  `;
}
function stockByProductPageSql(ctx, limit, offset) {
    return client_1.Prisma.sql `
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
//# sourceMappingURL=stock-by-product.query.js.map