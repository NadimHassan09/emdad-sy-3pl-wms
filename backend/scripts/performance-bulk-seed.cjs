/** Run: cd backend && node scripts/performance-bulk-seed.cjs */
const { PrismaClient, Prisma } = require('@prisma/client');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');

const p = new PrismaClient();
const ROOT = join(__dirname, '../..');
const TARGET_PRODUCTS = Number(process.env.PERF_TARGET_PRODUCTS ?? 2000);
const TARGET_STOCK = Number(process.env.PERF_TARGET_STOCK ?? 5000);
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const BATCH = 500;

async function counts() {
  const [products, stock, inbound, outbound, users, tasks] = await Promise.all([
    p.product.count({ where: { companyId: COMPANY_ID } }),
    p.currentStock.count({ where: { companyId: COMPANY_ID } }),
    p.inboundOrder.count({ where: { companyId: COMPANY_ID } }),
    p.outboundOrder.count({ where: { companyId: COMPANY_ID } }),
    p.user.count(),
    p.warehouseTask.count(),
  ]);
  return { products, stock, inbound, outbound, users, tasks };
}

async function main() {
  const started = Date.now();
  const before = await counts();
  console.log('Before:', before);

  const wh =
    (await p.warehouse.findFirst({ where: { id: '00000000-0000-4000-8000-000000000010' } })) ??
    (await p.warehouse.findFirst({ where: { status: 'active' } }));
  if (!wh) throw new Error('No warehouse');
  let loc = await p.location.findFirst({
    where: { warehouseId: wh.id, status: 'active', type: 'internal' },
  });
  if (!loc) {
    loc = await p.location.findFirst({ where: { warehouseId: wh.id, status: 'active' } });
  }
  if (!loc) throw new Error('No location');

  const needProducts = Math.max(0, TARGET_PRODUCTS - before.products);
  let productsCreated = 0;
  const base = Date.now();
  for (let offset = 0; offset < needProducts; offset += BATCH) {
    const batchSize = Math.min(BATCH, needProducts - offset);
    await p.product.createMany({
      data: Array.from({ length: batchSize }, (_, i) => ({
        id: randomUUID(),
        companyId: COMPANY_ID,
        sku: `PERF-${base}-${offset + i}`,
        name: `Perf Product ${offset + i}`,
        uom: 'piece',
        status: 'active',
        trackingType: 'none',
      })),
      skipDuplicates: true,
    });
    productsCreated += batchSize;
  }

  const allProducts = await p.product.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true },
    take: 500,
  });

  const needStock = Math.max(0, TARGET_STOCK - before.stock);
  let stockCreated = 0;
  for (let i = 0; i < needStock; i += BATCH) {
    const batchSize = Math.min(BATCH, needStock - i);
    await p.currentStock.createMany({
      data: Array.from({ length: batchSize }, (_, j) => ({
        id: randomUUID(),
        companyId: COMPANY_ID,
        warehouseId: wh.id,
        locationId: loc.id,
        productId: allProducts[(i + j) % allProducts.length].id,
        quantityOnHand: new Prisma.Decimal((j % 50) + 1),
        status: 'available',
      })),
      skipDuplicates: true,
    });
    stockCreated += batchSize;
  }

  const after = await counts();
  const result = {
    generatedAt: new Date().toISOString(),
    targets: { products: TARGET_PRODUCTS, stock: TARGET_STOCK },
    before,
    after,
    created: { products: productsCreated, stock: stockCreated },
    elapsedSec: Math.round((Date.now() - started) / 1000),
  };

  mkdirSync(join(ROOT, 'qa-results'), { recursive: true });
  writeFileSync(join(ROOT, 'qa-results/performance-seed-result.json'), JSON.stringify(result, null, 2));
  console.log('After:', after);
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
