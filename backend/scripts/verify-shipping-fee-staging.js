/**
 * Staging-only check: location groups, weight boundaries, and a 500→600 SYP
 * carrier cost update that leaves the client shipping fee unchanged.
 * Removes the rows it creates.
 */
const fs = require('fs');
const { PrismaClient, Prisma } = require('@prisma/client');
const { quoteClientShippingRate } = require('../dist/src/modules/shipping/shipping-fee.calculator');
const { decideCarrierCostUpdate } = require('../dist/src/modules/shipping/carrier-cost.update');

function databaseUrl() {
  const line = fs.readFileSync('.env', 'utf8').split('\n').find((row) => row.startsWith('DATABASE_URL='));
  let raw = line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  const url = new URL(raw);
  if (url.pathname !== '/wms_db_staging') {
    throw new Error('Refusing to run outside wms_db_staging');
  }
  return raw;
}

process.env.DATABASE_URL = databaseUrl();
const prisma = new PrismaClient();
const SEP = '\u001f';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function main() {
  const atBase = quoteClientShippingRate({
    baseRate: 3,
    baseWeightKg: 10,
    incrementKg: 5,
    incrementCharge: 1,
    weightKg: 10,
  });
  const justOver = quoteClientShippingRate({
    baseRate: 3,
    baseWeightKg: 10,
    incrementKg: 5,
    incrementCharge: 1,
    weightKg: 10.0001,
  });
  const onStep = quoteClientShippingRate({
    baseRate: 3,
    baseWeightKg: 10,
    incrementKg: 5,
    incrementCharge: 1,
    weightKg: 15,
  });
  assert(atBase.amount === 3 && atBase.increments === 0, 'base boundary');
  assert(justOver.amount === 4 && justOver.increments === 1, 'just above base');
  assert(onStep.amount === 4 && onStep.increments === 1, 'exact increment boundary');

  const cityA = `حلب${SEP}أتارب`;
  const cityB = `إدلب${SEP}أرمناز`;
  const townKey = `حلب${SEP}أبو قلقل${SEP}أم جرن منبج`;
  const groupA = await prisma.shippingFeeGroup.create({
    data: {
      nameAr: 'تحقق مدينة',
      nameEn: 'verify-city',
      areaCategory: 'region',
      baseRate: new Prisma.Decimal('3.0000'),
      active: true,
      locations: { create: [{ locationKey: cityA, level: 'city_region', governorate: 'حلب', cityRegion: 'أتارب' }] },
    },
  });
  const groupB = await prisma.shippingFeeGroup.create({
    data: {
      nameAr: 'تحقق ريف',
      nameEn: 'verify-rural',
      areaCategory: 'rural',
      baseRate: new Prisma.Decimal('5.0000'),
      active: true,
      locations: { create: [{ locationKey: cityB, level: 'city_region', governorate: 'إدلب', cityRegion: 'أرمناز' }] },
    },
  });
  const groupTown = await prisma.shippingFeeGroup.create({
    data: {
      nameAr: 'تحقق بلدة',
      areaCategory: 'custom',
      baseRate: new Prisma.Decimal('7.0000'),
      active: true,
      locations: {
        create: [{
          locationKey: townKey,
          level: 'town',
          governorate: 'حلب',
          cityRegion: 'أبو قلقل',
          townNeighborhood: 'أم جرن منبج',
        }],
      },
    },
  });

  const cityRate = await prisma.shippingFeeGroupLocation.findFirst({
    where: { locationKey: cityA, group: { active: true } },
    include: { group: true },
  });
  const ruralRate = await prisma.shippingFeeGroupLocation.findFirst({
    where: { locationKey: cityB, group: { active: true } },
    include: { group: true },
  });
  const townRate = await prisma.shippingFeeGroupLocation.findFirst({
    where: { locationKey: { in: [townKey, cityA] }, group: { active: true } },
    include: { group: true },
    orderBy: { level: 'desc' },
  });
  assert(Number(cityRate.group.baseRate) === 3, 'city group rate');
  assert(Number(ruralRate.group.baseRate) === 5, 'rural group rate');
  const specific = [townKey, cityA]
    .map((key) => (key === townRate.locationKey ? townRate : null))
    .find(Boolean);
  const townMatch = await prisma.shippingFeeGroupLocation.findUnique({
    where: { locationKey: townKey },
    include: { group: true },
  });
  assert(Number(townMatch.group.baseRate) === 7, 'town override beats the city group');

  let overlapRejected = false;
  try {
    await prisma.shippingFeeGroupLocation.create({
      data: {
        groupId: groupB.id,
        locationKey: cityA,
        level: 'city_region',
        governorate: 'حلب',
        cityRegion: 'أتارب',
      },
    });
  } catch {
    overlapRejected = true;
  }
  assert(overlapRejected, 'overlapping location assignment rejected');

  const outbound = await prisma.outboundOrder.findFirst({
    where: { omsOrder: { shippingFee: { not: null } } },
    select: { id: true, omsOrder: { select: { id: true, shippingFee: true } } },
  });
  const provider = await prisma.shippingProvider.findFirst({ where: { code: 'SILA_SY' } });
  assert(outbound && provider, 'staging outbound and Sila provider exist');
  const feeBefore = outbound.omsOrder?.shippingFee?.toString() ?? null;

  const shipment = await prisma.carrierShipment.create({
    data: {
      outboundOrderId: outbound.id,
      providerId: provider.id,
      providerCode: 'SILA_SY',
      status: 'pending',
      externalAwb: `FEE-VERIFY-${Date.now()}`,
      shippingCost: new Prisma.Decimal('500.0000'),
      currency: 'SYP',
      shippingCostEventAt: new Date('2026-10-16T10:00:00Z'),
    },
  });
  await prisma.carrierCostChange.create({
    data: {
      carrierShipmentId: shipment.id,
      amount: new Prisma.Decimal('500.0000'),
      currency: 'SYP',
      providerCode: 'SILA_SY',
      externalEventId: `fee-verify-500-${shipment.id}`,
      eventAt: new Date('2026-10-16T10:00:00Z'),
      source: 'webhook',
      applied: true,
    },
  });

  const stored = {
    amount: 500,
    currency: 'SYP',
    eventAt: new Date('2026-10-16T10:00:00Z'),
    appliedEventIds: [`fee-verify-500-${shipment.id}`],
  };
  const duplicate = decideCarrierCostUpdate({
    providerCode: 'SILA_SY',
    raw: { delivery_fee: 600, currency: 'SYP' },
    externalEventId: `fee-verify-500-${shipment.id}`,
    eventAt: new Date('2026-10-16T12:00:00Z'),
    stored,
  });
  const stale = decideCarrierCostUpdate({
    providerCode: 'SILA_SY',
    raw: { delivery_fee: 450, currency: 'SYP' },
    externalEventId: `fee-verify-old-${shipment.id}`,
    eventAt: new Date('2026-10-16T09:00:00Z'),
    stored,
  });
  const missing = decideCarrierCostUpdate({
    providerCode: 'SILA_SY',
    raw: { price: 600, cod_amount: 100 },
    externalEventId: `fee-verify-missing-${shipment.id}`,
    eventAt: new Date('2026-10-16T12:00:00Z'),
    stored,
  });
  const update = decideCarrierCostUpdate({
    providerCode: 'SILA_SY',
    raw: { delivery_fee: 600, currency: 'SYP' },
    externalEventId: `fee-verify-600-${shipment.id}`,
    eventAt: new Date('2026-10-16T11:00:00Z'),
    stored,
  });
  assert(duplicate.action === 'skipped_duplicate', 'duplicate');
  assert(stale.action === 'skipped_stale', 'stale');
  assert(missing.action === 'ignored_no_cost', 'missing cost');
  assert(update.action === 'applied' && update.amount === 600, '500 to 600');

  await prisma.carrierShipment.update({
    where: { id: shipment.id },
    data: {
      shippingCost: new Prisma.Decimal(update.amount),
      currency: 'SYP',
      shippingCostEventAt: new Date('2026-10-16T11:00:00Z'),
      shippingCostSource: 'webhook',
    },
  });
  await prisma.carrierCostChange.create({
    data: {
      carrierShipmentId: shipment.id,
      previousAmount: new Prisma.Decimal('500.0000'),
      previousCurrency: 'SYP',
      amount: new Prisma.Decimal('600.0000'),
      currency: 'SYP',
      providerCode: 'SILA_SY',
      externalEventId: `fee-verify-600-${shipment.id}`,
      eventAt: new Date('2026-10-16T11:00:00Z'),
      source: 'webhook',
      applied: true,
    },
  });

  const saved = await prisma.carrierShipment.findUnique({ where: { id: shipment.id } });
  const feeAfter = outbound.omsOrder
    ? (await prisma.omsOrder.findUnique({ where: { id: outbound.omsOrder.id }, select: { shippingFee: true } })).shippingFee?.toString() ?? null
    : null;
  assert(saved.shippingCost.toString() === '600', `stored cost ${saved.shippingCost}`);
  assert(feeBefore === feeAfter, `client fee changed from ${feeBefore} to ${feeAfter}`);

  await prisma.carrierShipment.delete({ where: { id: shipment.id } });
  await prisma.shippingFeeGroup.deleteMany({ where: { id: { in: [groupA.id, groupB.id, groupTown.id] } } });

  const leftover = await prisma.shippingFeeGroup.count({
    where: { id: { in: [groupA.id, groupB.id, groupTown.id] } },
  });
  assert(leftover === 0, 'verification groups removed');
  console.log(JSON.stringify({
    cityRate: 3,
    ruralRate: 5,
    townOverride: 7,
    weightAtBaseKg10: atBase.amount,
    weightJustOverBase: justOver.amount,
    weightAt15kg: onStep.amount,
    carrierCostBefore: 500,
    carrierCostAfter: Number(saved.shippingCost),
    clientShippingFeeBefore: feeBefore,
    clientShippingFeeAfter: feeAfter,
    duplicate: duplicate.action,
    stale: stale.action,
    missingCost: missing.action,
    cleanup: 'removed verification shipment and groups',
  }));
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
