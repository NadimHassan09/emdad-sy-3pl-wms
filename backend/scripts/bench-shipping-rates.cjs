/**
 * Bench Shipping Details rate-fetch (NO send / NO create shipment).
 *
 * Modes:
 *   legacy  — mirrors current UI: unbounded parallel, 2× quoteRates per order
 *   optimized — concurrency pool + 1× quoteRates per order + client dedupe
 *
 * Run: node scripts/bench-shipping-rates.cjs [batchId|auto] [legacy|optimized] [limit]
 */
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');

const BATCH_ARG = process.argv[2] || 'auto';
const MODE = (process.argv[3] || 'legacy').toLowerCase();
const LIMIT = Math.max(1, Number(process.argv[4] || 50));
const CONCURRENCY = Math.max(1, Number(process.env.RATES_CONCURRENCY || 8));

function cacheKey(input) {
  return JSON.stringify({
    packageType: input.packageType,
    weightKg: input.weightKg,
    pickupType: input.pickupType,
    volumeCbm: input.volumeCbm,
    gov: (input.governorate || '').trim(),
    city: (input.city || '').trim(),
    hood: (input.neighborhood || '').trim(),
    parts: (input.parts || []).map((p) => Number(p.weight)),
    cod: input.codAmount ?? null,
    // optimized mode: one call returns both delivery types
    dual: MODE === 'optimized' ? 1 : input.deliveryType,
  });
}

async function runPool(items, concurrency, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const prisma = new PrismaClient();
  const { AppModule } = require('../dist/src/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const shipping = app.get(require('../dist/src/modules/shipping/shipping.service').ShippingService);

  let batchId = BATCH_ARG;
  if (batchId === 'auto') {
    const batches = await prisma.omsBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, batchNumber: true, _count: { select: { orders: true } } },
    });
    const pick =
      batches.find((b) => b._count.orders >= 40 && b._count.orders <= 60) ||
      batches.find((b) => b._count.orders >= 20) ||
      batches[0];
    if (!pick) throw new Error('No OMS batches found');
    batchId = pick.id;
    console.error(`Using batch ${pick.batchNumber} (${pick._count.orders} orders)`);
  }

  const members = await prisma.omsBatchOrder.findMany({
    where: { batchId, removedAt: null },
    select: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          city: true,
          district: true,
          addressLine1: true,
          codAmount: true,
          outboundOrderId: true,
          outboundOrder: {
            select: {
              id: true,
              city: true,
              district: true,
              addressLine1: true,
              shippingWeightKg: true,
              shippingPackageType: true,
              babelNeighbourhoodId: true,
              codAmount: true,
            },
          },
        },
      },
    },
  });

  const orders = members
    .map((m) => m.order)
    .filter((o) => o?.outboundOrderId && o.outboundOrder)
    .slice(0, LIMIT);

  if (orders.length === 0) throw new Error('No linked outbound orders in batch');

  const inflight = new Map();
  const stats = {
    mode: MODE,
    batchId,
    orders: orders.length,
    quoteCalls: 0,
    cacheHits: 0,
    providerErrors: 0,
    quoteMs: [],
  };

  async function quoteOnce(input) {
    const key = cacheKey(input);
    // Optimized mode: coalesce identical destination/weight quotes across orders.
    // Legacy mode: no client dedupe (matches current UI forEach).
    if (MODE === 'optimized' && inflight.has(key)) {
      stats.cacheHits += 1;
      return inflight.get(key);
    }
    const p = (async () => {
      stats.quoteCalls += 1;
      const t0 = Date.now();
      const res = await shipping.quoteDestinationRates(input);
      stats.quoteMs.push(Date.now() - t0);
      stats.providerErrors += (res.errors || []).length;
      return res;
    })();
    if (MODE === 'optimized') inflight.set(key, p);
    return p;
  }

  async function processOrderLegacy(order) {
    const oo = order.outboundOrder;
    const governorate = (oo.city || order.city || '').trim();
    const city = (oo.district || order.district || '').trim();
    const neighborhood = (oo.addressLine1 || order.addressLine1 || '').trim();
    const weightKg = Math.max(Number(oo.shippingWeightKg) || 1, 0.1);
    const codAmount = Number(oo.codAmount ?? order.codAmount) || undefined;
    const base = {
      packageType: oo.shippingPackageType === 'envelope' ? 'envelope' : 'parcel',
      weightKg,
      pickupType: 'hub',
      volumeCbm: 0,
      governorate,
      city: city || governorate,
      neighborhood: neighborhood || city || governorate,
      codAmount,
      neighbourhoodId: oo.babelNeighbourhoodId ?? undefined,
    };
    if (!governorate) return;
    await Promise.all([
      quoteOnce({ ...base, deliveryType: 'address' }),
      quoteOnce({ ...base, deliveryType: 'hub' }),
    ]);
  }

  async function processOrderOptimized(order) {
    const oo = order.outboundOrder;
    const governorate = (oo.city || order.city || '').trim();
    const city = (oo.district || order.district || '').trim();
    const neighborhood = (oo.addressLine1 || order.addressLine1 || '').trim();
    const weightKg = Math.max(Number(oo.shippingWeightKg) || 1, 0.1);
    const codAmount = Number(oo.codAmount ?? order.codAmount) || undefined;
    const base = {
      packageType: oo.shippingPackageType === 'envelope' ? 'envelope' : 'parcel',
      weightKg,
      pickupType: 'hub',
      volumeCbm: 0,
      governorate,
      city: city || governorate,
      neighborhood: neighborhood || city || governorate,
      codAmount,
      neighbourhoodId: oo.babelNeighbourhoodId ?? undefined,
      // single call — backend should return both delivery modes
      deliveryType: 'address',
      includeAllDeliveryTypes: true,
    };
    if (!governorate) return;
    await quoteOnce(base);
  }

  const worker = MODE === 'optimized' ? processOrderOptimized : processOrderLegacy;
  const t0 = Date.now();
  if (MODE === 'legacy') {
    // Unbounded parallel — same as current modal forEach
    await Promise.all(orders.map((o) => worker(o)));
  } else {
    await runPool(orders, CONCURRENCY, worker);
  }
  const totalMs = Date.now() - t0;

  const avgQuote =
    stats.quoteMs.length > 0
      ? Math.round(stats.quoteMs.reduce((a, b) => a + b, 0) / stats.quoteMs.length)
      : 0;

  console.log(
    JSON.stringify(
      {
        ...stats,
        totalMs,
        avgQuoteMs: avgQuote,
        maxQuoteMs: stats.quoteMs.length ? Math.max(...stats.quoteMs) : 0,
        concurrency: MODE === 'optimized' ? CONCURRENCY : 'unbounded',
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
