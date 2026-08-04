/**
 * Soft-reserve stock for open outbound orders that have no active stock_reservations.
 * Targets: draft, pending_approval, allocated, pending_stock.
 *
 * Usage (from backend/, staging DATABASE_URL):
 *   node scripts/backfill-outbound-reservations.cjs           # dry-run
 *   node scripts/backfill-outbound-reservations.cjs --apply   # write
 */
'use strict';

const { PrismaClient, Prisma } = require('@prisma/client');

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const OPEN = ['draft', 'pending_approval', 'allocated', 'pending_stock'];

async function companyStockFefo(tx, companyId, productId, specificLotId) {
  const lotFilter = specificLotId
    ? Prisma.sql`AND cs.lot_id = ${specificLotId}::uuid`
    : Prisma.empty;
  return tx.$queryRaw`
    SELECT cs.location_id, cs.lot_id, cs.quantity_available::text AS quantity_available
      FROM current_stock cs
 LEFT JOIN lots l ON l.id = cs.lot_id
 LEFT JOIN locations loc ON loc.id = cs.location_id
     WHERE cs.company_id = ${companyId}::uuid
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
           cs.last_movement_at ASC NULLS LAST,
           cs.id ASC
  `;
}

async function main() {
  const orders = await prisma.outboundOrder.findMany({
    where: { status: { in: OPEN } },
    include: { lines: true },
    orderBy: { createdAt: 'asc' },
  });

  let need = 0;
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (const order of orders) {
    const active = await prisma.stockReservation.count({
      where: { outboundOrderId: order.id, status: 'active' },
    });
    if (active > 0) {
      skipped += 1;
      continue;
    }
    if (!order.lines.length) {
      skipped += 1;
      continue;
    }
    need += 1;

    if (!APPLY) {
      console.log(
        `[dry-run] would allocate ${order.orderNumber} (${order.status}) lines=${order.lines.length}`,
      );
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const line of order.lines) {
          let remaining = new Prisma.Decimal(line.requestedQuantity.toString());
          const candidates = await companyStockFefo(
            tx,
            order.companyId,
            line.productId,
            line.specificLotId,
          );
          for (const row of candidates) {
            if (remaining.lte(0)) break;
            const avail = new Prisma.Decimal(row.quantity_available);
            const take = remaining.lt(avail) ? remaining : avail;
            if (take.lte(0)) continue;
            await tx.stockReservation.create({
              data: {
                companyId: order.companyId,
                productId: line.productId,
                locationId: row.location_id,
                lotId: row.lot_id,
                outboundOrderId: order.id,
                outboundOrderLineId: line.id,
                quantity: take,
                status: 'active',
              },
            });
            remaining = remaining.minus(take);
          }
          if (remaining.gt(0)) {
            throw new Error(
              `Insufficient stock for ${order.orderNumber} product ${line.productId} (short ${remaining})`,
            );
          }
        }
        await tx.outboundOrder.update({
          where: { id: order.id },
          data: {
            allocationStatus: 'allocated',
            allocatedAt: new Date(),
            ...(order.status === 'draft' || order.status === 'pending_stock'
              ? { status: 'allocated' }
              : {}),
          },
        });
      });
      ok += 1;
      console.log(`[ok] allocated ${order.orderNumber}`);
    } catch (err) {
      failed += 1;
      failures.push(`${order.orderNumber}: ${err.message}`);
      console.error(`[fail] ${order.orderNumber}: ${err.message}`);
    }
  }

  console.log(`\nOpen orders: ${orders.length}`);
  console.log(`Already reserved / empty: ${skipped}`);
  console.log(`Need allocation: ${need}`);
  if (APPLY) {
    console.log(`Allocated: ${ok}`);
    console.log(`Failed: ${failed}`);
    if (failures.length) console.log(failures.join('\n'));
  } else {
    console.log('dry-run only (pass --apply to write)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
