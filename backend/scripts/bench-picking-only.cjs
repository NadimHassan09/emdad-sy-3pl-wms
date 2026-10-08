/**
 * Bench completePickingBulk only: seed → confirm → approve → time picking.
 * Run: node scripts/bench-picking-only.cjs [count]
 */
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');

const COUNT = Math.max(1, Number(process.argv[2] || 100));
const COMPANY_ID = 'f6fab62a-4536-4002-b07c-bad1eb17bca2';
const PRODUCT_ID = '6c8008f9-dbb5-4496-adce-c4b157daa5c7';
const PREFIX = `PICKBENCH-${Date.now()}-`;

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
  const userRow = await prisma.user.findFirst({ where: { email: 'superadmin@emdad.example' } });
  const user = {
    id: userRow.id,
    email: userRow.email,
    role: 'super_admin',
    companyId: null,
    tenantScope: 'all',
    authorizedCompanyIds: [],
  };

  const shipDate = new Date();
  shipDate.setUTCDate(shipDate.getUTCDate() + 2);
  const ids = [];
  for (let i = 0; i < COUNT; i++) {
    const created = await prisma.omsOrder.create({
      data: {
        companyId: COMPANY_ID,
        orderNumber: `${PREFIX}${String(i + 1).padStart(4, '0')}`,
        status: 'waiting_for_confirmation',
        destinationAddress: 'Damascus - Pick Bench',
        requiredShipDate: shipDate,
        recipientName: `Pick Bench ${i + 1}`,
        recipientPhone: '0999000002',
        city: 'Damascus',
        district: 'Mezzeh',
        addressLine1: 'Pick Bench 1',
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

  await omsBulk.confirmBulk(user, ids);
  const approveRes = await omsBulk.approveBulk(user, ids);
  const outboundIds = approveRes.approvedOrders.map((o) => o.outboundOrderId).filter(Boolean);

  const t0 = Date.now();
  const pickRes = await outboundBulk.completePickingBulk(user, outboundIds);
  const pickMs = Date.now() - t0;
  console.log(
    JSON.stringify(
      {
        count: COUNT,
        outbound: outboundIds.length,
        pickMs,
        ok: pickRes.completed,
        fail: pickRes.failed,
        perOrder: Number((pickMs / Math.max(outboundIds.length, 1)).toFixed(1)),
        failures: pickRes.failures?.slice(0, 2) ?? [],
      },
      null,
      2,
    ),
  );

  await app.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
