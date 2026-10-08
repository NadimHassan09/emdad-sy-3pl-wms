/**
 * Staging-only OMS batch stage timing bench.
 * Seeds N waiting_for_confirmation orders, then times Confirm → Approve →
 * Complete Picking → Complete Packing. Stops before Shipping Details.
 *
 * Run: cd backend && node scripts/bench-oms-batch-stages.cjs [count]
 */
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');

const COUNT = Math.max(1, Number(process.argv[2] || 100));
const COMPANY_ID = 'f6fab62a-4536-4002-b07c-bad1eb17bca2'; // Mr Jad — has stock
const PRODUCT_ID = '4b87e112-03b9-4d5a-b157-ee41db5232e6';
const PREFIX = `BENCH-${Date.now()}-`;

function ms(start) {
  return Date.now() - start;
}

async function main() {
  const prisma = new PrismaClient();
  const { AppModule } = require('../dist/src/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const omsBulk = app.get(require('../dist/src/modules/oms/oms-bulk.service').OmsBulkService);
  const outboundBulk = app.get(
    require('../dist/src/modules/outbound/outbound-bulk.service').OutboundBulkService,
  );

  const userRow = await prisma.user.findFirst({
    where: { email: 'superadmin@emdad.example' },
  });
  if (!userRow) throw new Error('superadmin user missing');

  const user = {
    id: userRow.id,
    email: userRow.email,
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  console.log(`\n=== OMS batch stage bench (N=${COUNT}) ===`);
  console.log(`company=${COMPANY_ID} product=${PRODUCT_ID}`);

  // 1) Seed orders
  const tSeed = Date.now();
  const ids = [];
  const shipDate = new Date();
  shipDate.setUTCDate(shipDate.getUTCDate() + 2);
  for (let i = 0; i < COUNT; i++) {
    const orderNumber = `${PREFIX}${String(i + 1).padStart(4, '0')}`;
    const created = await prisma.omsOrder.create({
      data: {
        companyId: COMPANY_ID,
        orderNumber,
        status: 'waiting_for_confirmation',
        destinationAddress: 'Damascus - Bench Street 1',
        requiredShipDate: shipDate,
        recipientName: `Bench Customer ${i + 1}`,
        recipientPhone: '0999000001',
        city: 'Damascus',
        district: 'Mezzeh',
        addressLine1: 'Bench Street 1',
        paymentMethod: 'COD',
        currency: 'USD',
        subtotal: 10,
        shippingFee: 0,
        codAmount: 10,
        requiresPacking: true,
        needsInformation: false,
        submittedAt: new Date(),
        createdBy: user.id,
        lines: {
          create: [
            {
              productId: PRODUCT_ID,
              requestedQuantity: 1,
              lineNumber: 1,
              unitPrice: 10,
              lineTotal: 10,
            },
          ],
        },
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  console.log(`seed_orders: ${ms(tSeed)}ms (${ids.length} orders)`);

  // 2) Confirm
  const tConfirm = Date.now();
  const confirmRes = await omsBulk.confirmBulk(user, ids);
  const confirmMs = ms(tConfirm);
  console.log(
    `confirmBulk: ${confirmMs}ms | ok=${confirmRes.confirmed} fail=${confirmRes.failed} | perOrder=${(confirmMs / COUNT).toFixed(1)}ms`,
  );
  if (confirmRes.failed) {
    console.log('confirm failures sample:', confirmRes.failures.slice(0, 3));
  }

  // 3) Approve
  const tApprove = Date.now();
  const approveRes = await omsBulk.approveBulk(user, ids);
  const approveMs = ms(tApprove);
  console.log(
    `approveBulk: ${approveMs}ms | ok=${approveRes.approved} fail=${approveRes.failed} | perOrder=${(approveMs / COUNT).toFixed(1)}ms`,
  );
  if (approveRes.failed) {
    console.log('approve failures sample:', approveRes.failures.slice(0, 3));
  }

  const outboundIds = approveRes.approvedOrders
    .map((o) => o.outboundOrderId)
    .filter(Boolean);
  console.log(`outbound_ready: ${outboundIds.length}`);

  // 4) Complete picking (Continue to packing)
  const tPick = Date.now();
  const pickRes = await outboundBulk.completePickingBulk(user, outboundIds);
  const pickMs = ms(tPick);
  console.log(
    `completePickingBulk: ${pickMs}ms | ok=${pickRes.completed} fail=${pickRes.failed} | perOrder=${(pickMs / Math.max(outboundIds.length, 1)).toFixed(1)}ms`,
  );
  if (pickRes.failed) {
    console.log('picking failures sample:', pickRes.failures.slice(0, 3));
  }

  // 5) Complete packing (Continue to shipping / shipping details stage)
  const packingEligible = pickRes.completedOrders
    .filter((o) => o.status === 'packing')
    .map((o) => o.outboundOrderId);
  // Also include any that landed packing via refresh
  const packingFromDb = await prisma.outboundOrder.findMany({
    where: { id: { in: outboundIds }, status: 'packing' },
    select: { id: true },
  });
  const packingIds = Array.from(
    new Set([...packingEligible, ...packingFromDb.map((r) => r.id)]),
  );

  let packMs = 0;
  let packRes = { completed: 0, failed: 0, failures: [] };
  if (packingIds.length) {
    const tPack = Date.now();
    packRes = await outboundBulk.completePackingBulk(user, packingIds);
    packMs = ms(tPack);
    console.log(
      `completePackingBulk: ${packMs}ms | ok=${packRes.completed} fail=${packRes.failed} | perOrder=${(packMs / packingIds.length).toFixed(1)}ms`,
    );
    if (packRes.failed) {
      console.log('packing failures sample:', packRes.failures.slice(0, 3));
    }
  } else {
    console.log('completePackingBulk: SKIPPED (no packing-stage orders)');
  }

  const statuses = await prisma.outboundOrder.groupBy({
    by: ['status'],
    where: { id: { in: outboundIds } },
    _count: true,
  });
  console.log(
    'outbound status after run:',
    statuses.map((s) => `${s.status}:${s._count}`).join(', '),
  );

  console.log('\n=== SUMMARY (target ≤1000ms for 100) ===');
  console.log(
    JSON.stringify(
      {
        count: COUNT,
        confirmMs,
        approveMs,
        completePickingMs: pickMs,
        completePackingMs: packMs,
        confirmOk: confirmRes.confirmed,
        approveOk: approveRes.approved,
        pickOk: pickRes.completed,
        packOk: packRes.completed,
      },
      null,
      2,
    ),
  );

  await app.close();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
