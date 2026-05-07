import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { InsufficientStockException } from '../../common/errors/domain-exceptions';

type Tx = Prisma.TransactionClient;

export interface PositiveMovement {
  companyId: string;
  productId: string;
  locationId: string;
  warehouseId: string;
  lotId?: string | null;
  quantity: number | string;
}

export interface NegativeMovement {
  companyId: string;
  productId: string;
  locationId: string;
  lotId?: string | null;
  quantity: number | string;
}

export interface QuantityMeta {
  before: Prisma.Decimal;
  after: Prisma.Decimal;
}

/**
 * Atomic stock helpers inside a DB transaction.
 * Prefer upsertPositiveWithMeta / decrementWithMeta so callers can populate
 * inventory_ledger.quantity_before / quantity_after at write time.
 */
@Injectable()
export class StockHelpers {
  /**
   * Read current quantity_on_hand FOR UPDATE (or return 0 when no row).
   */
  private async lockQuantityOnHand(
    tx: Tx,
    m: Pick<PositiveMovement, 'companyId' | 'productId' | 'locationId'> & { lotId: string | null },
  ): Promise<Prisma.Decimal> {
    const lid = m.lotId;
    const rows =
      lid === null
        ? await tx.$queryRaw<Array<{ q: string | null }>>(
            Prisma.sql`
              SELECT quantity_on_hand::text AS q
                FROM current_stock
               WHERE company_id = ${m.companyId}::uuid
                 AND product_id = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL
                 AND package_id IS NULL
               FOR UPDATE
            `,
          )
        : await tx.$queryRaw<Array<{ q: string | null }>>(
            Prisma.sql`
              SELECT quantity_on_hand::text AS q
                FROM current_stock
               WHERE company_id = ${m.companyId}::uuid
                 AND product_id = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lid}::uuid
                 AND package_id IS NULL
               FOR UPDATE
            `,
          );
    const q = rows[0]?.q;
    return q !== null && q !== undefined ? new Prisma.Decimal(q) : new Prisma.Decimal(0);
  }

  /** Lock row and return quantity on hand (snapshot for adjustments / DB trigger alignment). */
  async readOnHandForUpdate(
    tx: Tx,
    m: {
      companyId: string;
      productId: string;
      locationId: string;
      lotId?: string | null;
    },
  ): Promise<Prisma.Decimal> {
    return this.lockQuantityOnHand(tx, {
      companyId: m.companyId,
      productId: m.productId,
      locationId: m.locationId,
      lotId: m.lotId ?? null,
    });
  }

  /** Increase stock; returns qty on hand immediately before vs after applying delta. */
  async upsertPositiveWithMeta(tx: Tx, m: PositiveMovement): Promise<QuantityMeta> {
    const delta = new Prisma.Decimal(m.quantity.toString());
    const lotId = m.lotId ?? null;
    const before = await this.lockQuantityOnHand(tx, {
      companyId: m.companyId,
      productId: m.productId,
      locationId: m.locationId,
      lotId,
    });
    const after = before.plus(delta);

    if (lotId) {
      await tx.$executeRaw`
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
    } else {
      await tx.$executeRaw`
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

  /** Legacy — prefer upsertPositiveWithMeta when writing ledger audit columns. */
  async upsertPositive(tx: Tx, m: PositiveMovement): Promise<void> {
    await this.upsertPositiveWithMeta(tx, m);
  }

  /** Decrease stock; returns qty on hand before vs after decrement. */
  async decrementWithMeta(tx: Tx, m: NegativeMovement): Promise<QuantityMeta> {
    const qtyStr = m.quantity.toString();
    const take = new Prisma.Decimal(qtyStr);
    const lotId = m.lotId ?? null;

    const before = await this.lockQuantityOnHand(tx, {
      companyId: m.companyId,
      productId: m.productId,
      locationId: m.locationId,
      lotId,
    });

    const affected =
      lotId === null
        ? await tx.$executeRaw`
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
        : await tx.$executeRaw`
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
      throw new InsufficientStockException();
    }

    return { before, after: before.minus(take) };
  }

  async decrement(tx: Tx, m: NegativeMovement): Promise<void> {
    await this.decrementWithMeta(tx, m);
  }

  /**
   * Reserve available stock (increment `quantity_reserved`) with row lock.
   * Fails if `quantity_available` would go negative.
   */
  async incrementReservedWithMeta(
    tx: Tx,
    m: NegativeMovement,
  ): Promise<QuantityMeta> {
    const qtyStr = m.quantity.toString();
    const take = new Prisma.Decimal(qtyStr);
    const lotId = m.lotId ?? null;

    const beforeAvailRows =
      lotId === null
        ? await tx.$queryRaw<Array<{ available: string }>>(
            Prisma.sql`
              SELECT (quantity_on_hand - quantity_reserved)::text AS available
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL AND package_id IS NULL
               FOR UPDATE
            `,
          )
        : await tx.$queryRaw<Array<{ available: string }>>(
            Prisma.sql`
              SELECT (quantity_on_hand - quantity_reserved)::text AS available
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lotId}::uuid AND package_id IS NULL
               FOR UPDATE
            `,
          );

    const beforeAvail = beforeAvailRows[0]?.available
      ? new Prisma.Decimal(beforeAvailRows[0].available)
      : new Prisma.Decimal(0);

    if (beforeAvail.lessThan(take)) {
      throw new InsufficientStockException();
    }

    const affected =
      lotId === null
        ? await tx.$executeRaw`
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
        : await tx.$executeRaw`
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
      throw new InsufficientStockException();
    }

    const afterAvail = beforeAvail.minus(take);
    return { before: beforeAvail, after: afterAvail };
  }

  async releaseReservedWithMeta(
    tx: Tx,
    m: NegativeMovement,
  ): Promise<QuantityMeta> {
    const qtyStr = m.quantity.toString();
    const take = new Prisma.Decimal(qtyStr);
    const lotId = m.lotId ?? null;

    const resRows =
      lotId === null
        ? await tx.$queryRaw<Array<{ r: string }>>(
            Prisma.sql`
              SELECT quantity_reserved::text AS r
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id IS NULL AND package_id IS NULL
               FOR UPDATE
            `,
          )
        : await tx.$queryRaw<Array<{ r: string }>>(
            Prisma.sql`
              SELECT quantity_reserved::text AS r
                FROM current_stock
               WHERE company_id  = ${m.companyId}::uuid
                 AND product_id  = ${m.productId}::uuid
                 AND location_id = ${m.locationId}::uuid
                 AND lot_id = ${lotId}::uuid AND package_id IS NULL
               FOR UPDATE
            `,
          );

    const beforeRes = resRows[0]?.r ? new Prisma.Decimal(resRows[0].r) : new Prisma.Decimal(0);
    if (beforeRes.lessThan(take)) {
      throw new InsufficientStockException();
    }

    const affected =
      lotId === null
        ? await tx.$executeRaw`
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
        : await tx.$executeRaw`
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
      throw new InsufficientStockException();
    }

    return { before: beforeRes, after: beforeRes.minus(take) };
  }

  /**
   * Ship from a row that was reserved: decrement both on-hand and reserved by the same delta.
   */
  async decrementShippedWithMeta(
    tx: Tx,
    m: NegativeMovement,
  ): Promise<QuantityMeta> {
    const qtyStr = m.quantity.toString();
    const take = new Prisma.Decimal(qtyStr);
    const lotId = m.lotId ?? null;

    const before = await this.lockQuantityOnHand(tx, {
      companyId: m.companyId,
      productId: m.productId,
      locationId: m.locationId,
      lotId,
    });

    const affected =
      lotId === null
        ? await tx.$executeRaw`
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
        : await tx.$executeRaw`
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
      throw new InsufficientStockException();
    }

    return { before, after: before.minus(take) };
  }
}
