"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockHelpers = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
let StockHelpers = class StockHelpers {
    async lockQuantityOnHand(tx, m) {
        const lid = m.lotId;
        const rows = lid === null
            ? await tx.$queryRaw(client_1.Prisma.sql `
              SELECT quantity_on_hand::text AS q
                FROM current_stock
               WHERE company_id = ${m.companyId}::uuid
                 AND product_id = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL
                 AND package_id IS NULL
               FOR UPDATE
            `)
            : await tx.$queryRaw(client_1.Prisma.sql `
              SELECT quantity_on_hand::text AS q
                FROM current_stock
               WHERE company_id = ${m.companyId}::uuid
                 AND product_id = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lid}::uuid
                 AND package_id IS NULL
               FOR UPDATE
            `);
        const q = rows[0]?.q;
        return q !== null && q !== undefined ? new client_1.Prisma.Decimal(q) : new client_1.Prisma.Decimal(0);
    }
    async readOnHandForUpdate(tx, m) {
        return this.lockQuantityOnHand(tx, {
            companyId: m.companyId,
            productId: m.productId,
            locationId: m.locationId,
            lotId: m.lotId ?? null,
        });
    }
    async upsertPositiveWithMeta(tx, m) {
        const delta = new client_1.Prisma.Decimal(m.quantity.toString());
        const lotId = m.lotId ?? null;
        const before = await this.lockQuantityOnHand(tx, {
            companyId: m.companyId,
            productId: m.productId,
            locationId: m.locationId,
            lotId,
        });
        const after = before.plus(delta);
        if (lotId) {
            await tx.$executeRaw `
        INSERT INTO current_stock
          (company_id, product_id, location_id, warehouse_id, lot_id,
           quantity_on_hand, last_movement_at)
        VALUES
          (${m.companyId}::uuid, ${m.productId}::uuid, ${m.locationId}::uuid,
           ${m.warehouseId}::uuid, ${lotId}::uuid,
           ${delta.toString()}::numeric, NOW())
        ON CONFLICT (company_id, product_id, location_id, lot_id)
          WHERE lot_id IS NOT NULL AND package_id IS NULL
        DO UPDATE SET
          quantity_on_hand  = current_stock.quantity_on_hand + ${delta.toString()}::numeric,
          version           = current_stock.version + 1,
          last_movement_at  = NOW()
      `;
        }
        else {
            await tx.$executeRaw `
        INSERT INTO current_stock
          (company_id, product_id, location_id, warehouse_id,
           quantity_on_hand, last_movement_at)
        VALUES
          (${m.companyId}::uuid, ${m.productId}::uuid, ${m.locationId}::uuid,
           ${m.warehouseId}::uuid,
           ${delta.toString()}::numeric, NOW())
        ON CONFLICT (company_id, product_id, location_id)
          WHERE lot_id IS NULL AND package_id IS NULL
        DO UPDATE SET
          quantity_on_hand  = current_stock.quantity_on_hand + ${delta.toString()}::numeric,
          version           = current_stock.version + 1,
          last_movement_at  = NOW()
      `;
        }
        return { before, after };
    }
    async upsertPositive(tx, m) {
        await this.upsertPositiveWithMeta(tx, m);
    }
    async decrementWithMeta(tx, m) {
        const qtyStr = m.quantity.toString();
        const take = new client_1.Prisma.Decimal(qtyStr);
        const lotId = m.lotId ?? null;
        const before = await this.lockQuantityOnHand(tx, {
            companyId: m.companyId,
            productId: m.productId,
            locationId: m.locationId,
            lotId,
        });
        const affected = lotId === null
            ? await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_on_hand = quantity_on_hand - ${qtyStr}::numeric,
                   version          = version + 1,
                   last_movement_at = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id IS NULL
               AND package_id IS NULL
               AND quantity_on_hand - ${qtyStr}::numeric >= 0
               AND quantity_on_hand - ${qtyStr}::numeric >= quantity_reserved
          `
            : await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_on_hand = quantity_on_hand - ${qtyStr}::numeric,
                   version          = version + 1,
                   last_movement_at = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id = ${lotId}::uuid
               AND quantity_on_hand - ${qtyStr}::numeric >= 0
               AND quantity_on_hand - ${qtyStr}::numeric >= quantity_reserved
          `;
        if (affected === 0) {
            throw new domain_exceptions_1.InsufficientStockException();
        }
        return { before, after: before.minus(take) };
    }
    async decrement(tx, m) {
        await this.decrementWithMeta(tx, m);
    }
    async incrementReservedWithMeta(tx, m) {
        const qtyStr = m.quantity.toString();
        const take = new client_1.Prisma.Decimal(qtyStr);
        const lotId = m.lotId ?? null;
        const beforeAvailRows = lotId === null
            ? await tx.$queryRaw(client_1.Prisma.sql `
              SELECT (quantity_on_hand - quantity_reserved)::text AS available
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL AND package_id IS NULL
               FOR UPDATE
            `)
            : await tx.$queryRaw(client_1.Prisma.sql `
              SELECT (quantity_on_hand - quantity_reserved)::text AS available
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lotId}::uuid AND package_id IS NULL
               FOR UPDATE
            `);
        const beforeAvail = beforeAvailRows[0]?.available
            ? new client_1.Prisma.Decimal(beforeAvailRows[0].available)
            : new client_1.Prisma.Decimal(0);
        if (beforeAvail.lessThan(take)) {
            throw new domain_exceptions_1.InsufficientStockException();
        }
        const affected = lotId === null
            ? await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_reserved = quantity_reserved + ${qtyStr}::numeric,
                   version          = version + 1,
                   last_movement_at = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id IS NULL AND package_id IS NULL
               AND quantity_on_hand - quantity_reserved >= ${qtyStr}::numeric
          `
            : await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_reserved = quantity_reserved + ${qtyStr}::numeric,
                   version          = version + 1,
                   last_movement_at = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id = ${lotId}::uuid AND package_id IS NULL
               AND quantity_on_hand - quantity_reserved >= ${qtyStr}::numeric
          `;
        if (affected === 0) {
            throw new domain_exceptions_1.InsufficientStockException();
        }
        const afterAvail = beforeAvail.minus(take);
        return { before: beforeAvail, after: afterAvail };
    }
    async releaseReservedWithMeta(tx, m) {
        const qtyStr = m.quantity.toString();
        const take = new client_1.Prisma.Decimal(qtyStr);
        const lotId = m.lotId ?? null;
        const resRows = lotId === null
            ? await tx.$queryRaw(client_1.Prisma.sql `
              SELECT quantity_reserved::text AS r
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL AND package_id IS NULL
               FOR UPDATE
            `)
            : await tx.$queryRaw(client_1.Prisma.sql `
              SELECT quantity_reserved::text AS r
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lotId}::uuid AND package_id IS NULL
               FOR UPDATE
            `);
        const beforeRes = resRows[0]?.r ? new client_1.Prisma.Decimal(resRows[0].r) : new client_1.Prisma.Decimal(0);
        if (beforeRes.lessThan(take)) {
            throw new domain_exceptions_1.InsufficientStockException();
        }
        const affected = lotId === null
            ? await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_reserved = quantity_reserved - ${qtyStr}::numeric,
                   version          = version + 1,
                   last_movement_at = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id IS NULL AND package_id IS NULL
               AND quantity_reserved >= ${qtyStr}::numeric
          `
            : await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_reserved = quantity_reserved - ${qtyStr}::numeric,
                   version          = version + 1,
                   last_movement_at = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id = ${lotId}::uuid AND package_id IS NULL
               AND quantity_reserved >= ${qtyStr}::numeric
          `;
        if (affected === 0) {
            throw new domain_exceptions_1.InsufficientStockException();
        }
        return { before: beforeRes, after: beforeRes.minus(take) };
    }
    async decrementShippedWithMeta(tx, m) {
        const qtyStr = m.quantity.toString();
        const take = new client_1.Prisma.Decimal(qtyStr);
        const lotId = m.lotId ?? null;
        const before = await this.lockQuantityOnHand(tx, {
            companyId: m.companyId,
            productId: m.productId,
            locationId: m.locationId,
            lotId,
        });
        const affected = lotId === null
            ? await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_on_hand   = quantity_on_hand - ${qtyStr}::numeric,
                   quantity_reserved  = quantity_reserved - ${qtyStr}::numeric,
                   version            = version + 1,
                   last_movement_at   = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id IS NULL AND package_id IS NULL
               AND quantity_reserved >= ${qtyStr}::numeric
               AND quantity_on_hand - ${qtyStr}::numeric >= 0
          `
            : await tx.$executeRaw `
            UPDATE current_stock
               SET quantity_on_hand   = quantity_on_hand - ${qtyStr}::numeric,
                   quantity_reserved  = quantity_reserved - ${qtyStr}::numeric,
                   version            = version + 1,
                   last_movement_at   = NOW()
             WHERE company_id  = ${m.companyId}::uuid
               AND product_id  = ${m.productId}::uuid
               AND location_id = ${m.locationId}::uuid
               AND lot_id = ${lotId}::uuid AND package_id IS NULL
               AND quantity_reserved >= ${qtyStr}::numeric
               AND quantity_on_hand - ${qtyStr}::numeric >= 0
          `;
        if (affected === 0) {
            throw new domain_exceptions_1.InsufficientStockException();
        }
        return { before, after: before.minus(take) };
    }
};
exports.StockHelpers = StockHelpers;
exports.StockHelpers = StockHelpers = __decorate([
    (0, common_1.Injectable)()
], StockHelpers);
//# sourceMappingURL=stock.helpers.js.map