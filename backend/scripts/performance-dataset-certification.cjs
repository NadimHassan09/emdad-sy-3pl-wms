#!/usr/bin/env node
/**
 * Performance Dataset Certification — mandatory full-scale seed.
 * Run: cd backend && node scripts/performance-dataset-certification.cjs
 */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const p = new PrismaClient();
const ROOT = join(__dirname, '../..');

const TARGETS = {
  products: 10_000,
  stock: 50_000,
  inbound: 5_000,
  outbound: 5_000,
  tasks: 10_000,
  users: 100,
  locations: 2_000,
  warehouses: 200,
};

const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const CREATED_BY = '00000000-0000-4000-8000-0000000000ab';
const DEMO_HASH = '$2b$10$PB7FJt86zYMFtd1AzqVXh.rPfLkoWrUnaN6chSKbWa.8/NG0Yqcji';
const BATCH = 500;

const log = [];
function note(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  log.push(line);
}

async function counts() {
  const [row] = await p.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM products WHERE company_id=${COMPANY_ID}::uuid) AS products,
      (SELECT COUNT(*)::int FROM current_stock WHERE company_id=${COMPANY_ID}::uuid) AS stock,
      (SELECT COUNT(*)::int FROM inbound_orders WHERE company_id=${COMPANY_ID}::uuid) AS inbound,
      (SELECT COUNT(*)::int FROM outbound_orders WHERE company_id=${COMPANY_ID}::uuid) AS outbound,
      (SELECT COUNT(*)::int FROM warehouse_tasks) AS tasks,
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM warehouses) AS warehouses,
      (SELECT COUNT(*)::int FROM locations WHERE status='active') AS locations
  `;
  return row;
}

async function seedUsers(need) {
  if (need <= 0) return 0;
  let created = 0;
  for (let i = 0; i < need; i++) {
    const n = Date.now() + i;
    const email = `perf-cert-user-${n}@emdad.example`;
    try {
      await p.user.create({
        data: {
          id: randomUUID(),
          email,
          passwordHash: DEMO_HASH,
          fullName: `Perf Cert User ${n}`,
          role: 'wh_operator',
          status: 'active',
          companyId: null,
          tokenVersion: 0,
        },
      });
      created++;
    } catch {
      /* skip dup */
    }
  }
  return created;
}

async function seedWarehouses(targetTotal) {
  const current = await p.warehouse.count();
  const need = Math.max(0, targetTotal - current);
  if (need === 0) return 0;
  let created = 0;
  for (let i = 0; i < need; i += BATCH) {
    const batch = Math.min(BATCH, need - i);
    const data = Array.from({ length: batch }, (_, j) => {
      const n = current + i + j + 1;
      return {
        id: randomUUID(),
        name: `Perf Warehouse ${n}`,
        code: `PERF-WH-${String(n).padStart(5, '0')}`,
        city: 'Riyadh',
        country: 'SA',
        status: 'active',
      };
    });
    await p.warehouse.createMany({ data, skipDuplicates: true });
    created += batch;
    note(`  warehouses +${batch} (${created}/${need})`);
  }
  return created;
}

async function seedLocations(targetTotal) {
  const current = await p.location.count({ where: { status: 'active' } });
  const need = Math.max(0, targetTotal - current);
  if (need === 0) return 0;

  const warehouses = await p.warehouse.findMany({
    where: { status: 'active' },
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  if (!warehouses.length) throw new Error('No warehouses');

  let created = 0;
  let globalN = current;
  let whIdx = 0;
  let locInWh = 0;

  while (created < need) {
    const batch = Math.min(BATCH, need - created);
    const data = [];
    for (let b = 0; b < batch; b++) {
      const wh = warehouses[whIdx % warehouses.length];
      locInWh++;
      globalN++;
      data.push({
        id: randomUUID(),
        warehouseId: wh.id,
        name: `Bin ${locInWh}`,
        fullPath: `${wh.code ?? 'WH'}/A-${locInWh}`,
        type: 'internal',
        barcode: `PERF-LOC-${String(globalN).padStart(7, '0')}`,
        status: 'active',
      });
      if (locInWh >= 10) {
        locInWh = 0;
        whIdx++;
      }
    }
    await p.location.createMany({ data, skipDuplicates: true });
    created += batch;
    if (created % 500 === 0) note(`  locations +${created}/${need}`);
  }
  return created;
}

async function seedProducts(need) {
  if (need <= 0) return 0;
  let created = 0;
  const base = Date.now();
  for (let offset = 0; offset < need; offset += BATCH) {
    const batchSize = Math.min(BATCH, need - offset);
    await p.product.createMany({
      data: Array.from({ length: batchSize }, (_, i) => ({
        id: randomUUID(),
        companyId: COMPANY_ID,
        sku: `PERF-CERT-${base}-${offset + i}`,
        name: `Perf Cert Product ${offset + i}`,
        uom: 'piece',
        status: 'active',
        trackingType: 'none',
      })),
      skipDuplicates: true,
    });
    created += batchSize;
    if (created % 2000 === 0) note(`  products +${created}/${need}`);
  }
  return created;
}

/** Stock: 10k products × 5 locations = 50k unique bare positions (constraint workaround). */
async function seedStock(targetTotal) {
  const current = Number((await counts()).stock);
  const need = Math.max(0, targetTotal - current);
  if (need === 0) return 0;

  note('  stock: selecting product/location pairs (5 locations × all products)...');

  const inserted = await p.$executeRawUnsafe(
    `
    WITH prods AS (
      SELECT id FROM products WHERE company_id = $1::uuid ORDER BY sku
    ),
    locs AS (
      SELECT l.id AS location_id, l.warehouse_id
      FROM locations l
      WHERE l.status = 'active' AND l.type = 'internal'
      ORDER BY l.barcode
      LIMIT 5
    ),
    pairs AS (
      SELECT p.id AS product_id, l.location_id, l.warehouse_id
      FROM prods p CROSS JOIN locs l
    )
    INSERT INTO current_stock (
      id, company_id, product_id, location_id, warehouse_id,
      quantity_on_hand, quantity_reserved, status, last_movement_at
    )
    SELECT
      gen_random_uuid(), $1::uuid, product_id, location_id, warehouse_id,
      1::numeric(15,4), 0::numeric(15,4), 'available', NOW()
    FROM pairs
    WHERE NOT EXISTS (
      SELECT 1 FROM current_stock cs
      WHERE cs.company_id = $1::uuid
        AND cs.product_id = pairs.product_id
        AND cs.location_id = pairs.location_id
        AND cs.lot_id IS NULL AND cs.package_id IS NULL
    )
    LIMIT $2
    `,
    COMPANY_ID,
    need,
  );

  return Number(inserted);
}

async function seedInbound(need) {
  if (need <= 0) return 0;
  const products = await p.product.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true },
    take: 200,
  });
  if (!products.length) throw new Error('No products for inbound lines');

  const batchSize = 250;
  let created = 0;
  for (let offset = 0; offset < need; offset += batchSize) {
    const n = Math.min(batchSize, need - offset);
    for (let j = 0; j < n; j++) {
      const idx = offset + j;
      const orderId = randomUUID();
      const prod = products[idx % products.length];
      const onum = `PERF-IN-CERT-${String(idx).padStart(6, '0')}`;
      await p.$executeRawUnsafe(
        `INSERT INTO inbound_orders (id, company_id, order_number, status, expected_arrival_date, created_by, client_reference)
         VALUES ($1::uuid, $2::uuid, $3, 'draft', CURRENT_DATE, $4::uuid, $5)
         ON CONFLICT (order_number) DO NOTHING`,
        orderId,
        COMPANY_ID,
        onum,
        CREATED_BY,
        `PERF-REF-IN-${idx}`,
      );
      await p.$executeRawUnsafe(
        `INSERT INTO inbound_order_lines (id, inbound_order_id, product_id, expected_quantity, line_number, discrepancy_type, qc_status)
         SELECT $1::uuid, io.id, $2::uuid, 1, 1, 'none', 'not_required'
         FROM inbound_orders io WHERE io.order_number = $3`,
        randomUUID(),
        prod.id,
        onum,
      );
    }
    created += n;
    if (created % 500 === 0) note(`  inbound +${created}/${need}`);
  }
  return created;
}

async function seedOutbound(need) {
  if (need <= 0) return 0;
  const products = await p.product.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true },
    take: 200,
  });
  let created = 0;
  const batchSize = 250;
  for (let offset = 0; offset < need; offset += batchSize) {
    const n = Math.min(batchSize, need - offset);
    for (let j = 0; j < n; j++) {
      const idx = offset + j;
      const orderId = randomUUID();
      const prod = products[idx % products.length];
      const onum = `PERF-OUT-CERT-${String(idx).padStart(6, '0')}`;
      await p.$executeRawUnsafe(
        `INSERT INTO outbound_orders (id, company_id, order_number, status, destination_address, required_ship_date, created_by, client_reference)
         VALUES ($1::uuid, $2::uuid, $3, 'draft', $4, CURRENT_DATE, $5::uuid, $6)
         ON CONFLICT (order_number) DO NOTHING`,
        orderId,
        COMPANY_ID,
        onum,
        `Perf Dest ${idx}`,
        CREATED_BY,
        `PERF-REF-OUT-${idx}`,
      );
      await p.$executeRawUnsafe(
        `INSERT INTO outbound_order_lines (id, outbound_order_id, product_id, requested_quantity, line_number, status)
         SELECT $1::uuid, oo.id, $2::uuid, 1, 1, 'pending'
         FROM outbound_orders oo WHERE oo.order_number = $3`,
        randomUUID(),
        prod.id,
        onum,
      );
    }
    created += n;
    if (created % 500 === 0) note(`  outbound +${created}/${need}`);
  }
  return created;
}

/** 2 tasks per inbound order → 10k tasks when 5k inbound exist. */
async function seedTasks(targetTotal) {
  const current = await p.warehouseTask.count();
  const need = Math.max(0, targetTotal - current);
  if (need === 0) return 0;

  const wh = await p.warehouse.findFirst({ where: { status: 'active' } });
  if (!wh) throw new Error('No warehouse for tasks');

  const orders = await p.inboundOrder.findMany({
    where: { companyId: COMPANY_ID, clientReference: { startsWith: 'PERF-REF-IN-' } },
    select: { id: true },
    take: Math.ceil(need / 2) + 100,
  });

  let existingOrders = orders.length;
  if (existingOrders * 2 < need) {
    note(`  tasks: seeding extra inbound orders for workflow references...`);
    await seedInbound(Math.ceil(need / 2) - existingOrders + 50);
  }

  const allOrders = await p.inboundOrder.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: Math.ceil(need / 2) + 500,
  });

  const taskTypes = ['receiving', 'putaway', 'pick', 'pack'];
  let created = 0;
  let orderIdx = 0;

  while (created < need) {
    const order = allOrders[orderIdx % allOrders.length];
    orderIdx++;

    let instanceId = randomUUID();
    try {
      await p.$executeRawUnsafe(
        `INSERT INTO workflow_instances (id, company_id, warehouse_id, reference_type, reference_id, definition_code, status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'inbound_order', $4::uuid, 'inbound_default', 'completed')`,
        instanceId,
        COMPANY_ID,
        wh.id,
        order.id,
      );
    } catch {
      instanceId = randomUUID();
      await p.$executeRawUnsafe(
        `INSERT INTO workflow_instances (id, company_id, warehouse_id, reference_type, reference_id, definition_code, status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'inbound_order', $4::uuid, 'inbound_default', 'cancelled')`,
        instanceId,
        COMPANY_ID,
        wh.id,
        order.id,
      );
    }

    for (let t = 0; t < 2 && created < need; t++) {
      await p.$executeRawUnsafe(
        `INSERT INTO warehouse_tasks (id, workflow_instance_id, task_type, status, payload)
         VALUES ($1::uuid, $2::uuid, $3::warehouse_task_type, 'pending', '{}'::jsonb)`,
        randomUUID(),
        instanceId,
        taskTypes[(created + t) % taskTypes.length],
      );
      created++;
    }
    if (created % 1000 === 0) note(`  tasks +${created}/${need}`);
  }
  return created;
}

async function main() {
  const started = Date.now();
  note('Performance Dataset Certification — generation start');
  const before = await counts();
  note(`Before: ${JSON.stringify(before)}`);

  const created = {
    users: 0,
    warehouses: 0,
    locations: 0,
    products: 0,
    stock: 0,
    inbound: 0,
    outbound: 0,
    tasks: 0,
  };

  note('Phase 1: Users');
  created.users = await seedUsers(Math.max(0, TARGETS.users - Number(before.users)));

  note('Phase 2: Warehouses (target 200)');
  created.warehouses = await seedWarehouses(TARGETS.warehouses);

  note('Phase 3: Locations (target 2000 internal bins)');
  created.locations = await seedLocations(TARGETS.locations);

  note('Phase 4: Products (target 10000)');
  created.products = await seedProducts(Math.max(0, TARGETS.products - Number(before.products)));

  note('Phase 5: Stock (target 50000 — 5 locations × all products)');
  const stockBefore = Number((await counts()).stock);
  await seedStock(TARGETS.stock);
  created.stock = Number((await counts()).stock) - stockBefore;

  note('Phase 6: Inbound orders (target 5000)');
  created.inbound = await seedInbound(Math.max(0, TARGETS.inbound - Number((await counts()).inbound)));

  note('Phase 7: Outbound orders (target 5000)');
  created.outbound = await seedOutbound(Math.max(0, TARGETS.outbound - Number((await counts()).outbound)));

  note('Phase 8: Warehouse tasks (target 10000)');
  created.tasks = await seedTasks(TARGETS.tasks);

  const after = await counts();
  const elapsedSec = Math.round((Date.now() - started) / 1000);

  const met = {
    products: Number(after.products) >= TARGETS.products,
    stock: Number(after.stock) >= TARGETS.stock,
    inbound: Number(after.inbound) >= TARGETS.inbound,
    outbound: Number(after.outbound) >= TARGETS.outbound,
    tasks: Number(after.tasks) >= TARGETS.tasks,
    users: Number(after.users) >= TARGETS.users,
  };
  const allMet = Object.values(met).every(Boolean);

  const result = {
    generatedAt: new Date().toISOString(),
    targets: TARGETS,
    before,
    after,
    created,
    elapsedSec,
    targetsMet: met,
    allTargetsMet: allMet,
    strategy: {
      stock:
        '5 internal locations × all company products = unique (product, location) bare stock rows; avoids uq_stock_bare_position violation',
      locations: 'PERF-LOC-* barcodes across PERF-WH-* warehouses (~10 bins per warehouse)',
      orders: 'PERF-IN/OUT-* with single line each; unique order_number',
      tasks: '2 warehouse_tasks per workflow_instance linked to inbound orders',
      users: 'perf-cert-user-* wh_operator accounts',
    },
    log,
  };

  mkdirSync(join(ROOT, 'qa-results'), { recursive: true });
  writeFileSync(join(ROOT, 'qa-results/performance-dataset-certification.json'), JSON.stringify(result, null, 2));

  note(`After: ${JSON.stringify(after)}`);
  note(`Elapsed: ${elapsedSec}s`);
  note(`All targets met: ${allMet}`);

  if (!allMet) {
    console.error('TARGETS NOT MET', met);
    process.exit(1);
  }

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
