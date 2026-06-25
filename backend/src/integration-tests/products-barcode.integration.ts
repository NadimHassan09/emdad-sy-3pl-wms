import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';

import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { AuthPrincipal } from '../common/auth/current-user.types';
import { AuditLogService } from '../common/audit/audit-log.service';
import { CompanyAccessService } from '../common/company-access/company-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProductsService } from '../modules/products/products.service';
import { RealtimeService } from '../modules/realtime/realtime.service';

type TestCase = { name: string; run: () => Promise<void> };

const companyId = process.env.QA_COMPANY_ID ?? '00000000-0000-4000-8000-000000000001';

let cachedSuperAdmin: AuthPrincipal | null = null;

async function superAdminPrincipal(prisma: PrismaClient): Promise<AuthPrincipal> {
  if (cachedSuperAdmin) return cachedSuperAdmin;
  const user = await prisma.user.findFirst({
    where: { email: 'superadmin@emdad.example' },
    select: { id: true, email: true, role: true, companyId: true },
  });
  if (!user) throw new Error('Seed user superadmin@emdad.example not found.');
  cachedSuperAdmin = {
    id: user.id,
    role: user.role as AuthPrincipal['role'],
    companyId: user.companyId,
    tenantScope: 'all',
    authorizedCompanyIds: [companyId],
    email: user.email,
  };
  return cachedSuperAdmin;
}

function realtimeMock(): RealtimeService {
  return {
    emitProductCreated: () => undefined,
    emitProductUpdated: () => undefined,
    emitProductArchived: () => undefined,
  } as unknown as RealtimeService;
}

function buildProductsService(prisma: PrismaService): ProductsService {
  const companyAccess = {
    resolveWriteCompanyId: () => companyId,
    validateResourceOwnership: () => undefined,
    getReadFilterCompanyId: () => companyId,
    assertSameCompany: () => undefined,
    requireActiveTenant: () => companyId,
  } as unknown as CompanyAccessService;
  const audit = new AuditLogService(prisma);
  return new ProductsService(prisma, companyAccess, audit, realtimeMock());
}

async function deleteProduct(prisma: PrismaClient, id: string) {
  await prisma.currentStock.deleteMany({ where: { productId: id } });
  await prisma.lot.deleteMany({ where: { productId: id } });
  await prisma.product.deleteMany({ where: { id } });
}

async function testArchivedBarcodeReuse() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const service = buildProductsService(prisma);
  const user = await superAdminPrincipal(raw);
  const tag = Date.now().toString(36);
  const barcode = `BC-ARCH-${tag}`;
  const skuA = `ARCH-A-${tag}`.toUpperCase();
  const skuB = `ARCH-B-${tag}`.toUpperCase();

  const archived = await service.create(user, {
    companyId,
    name: `Archived barcode holder ${tag}`,
    sku: skuA,
    barcode,
  });
  await service.softDelete(archived.id, user);

  const replacement = await service.create(user, {
    companyId,
    name: `Replacement active product ${tag}`,
    sku: skuB,
    barcode,
  });
  assert.equal(replacement.barcode, barcode);

  await deleteProduct(raw, replacement.id);
  await deleteProduct(raw, archived.id);
  await raw.$disconnect();
}

async function testConcurrentBarcodeUpdates() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const service = buildProductsService(prisma);
  const user = await superAdminPrincipal(raw);
  const tag = Date.now().toString(36);
  const barcode = `BC-RACE-${tag}`;
  const skuA = `RACE-A-${tag}`.toUpperCase();
  const skuB = `RACE-B-${tag}`.toUpperCase();

  const a = await service.create(user, {
    companyId,
    name: `Race A ${tag}`,
    sku: skuA,
  });
  const b = await service.create(user, {
    companyId,
    name: `Race B ${tag}`,
    sku: skuB,
  });

  const results = await Promise.allSettled([
    service.update(a.id, { barcode }, user),
    service.update(b.id, { barcode }, user),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter(
    (r) => r.status === 'rejected' && r.reason instanceof ConflictException,
  );
  assert.equal(fulfilled.length, 1, 'exactly one concurrent barcode update must win');
  assert.equal(rejected.length, 1, 'the other concurrent update must conflict');

  await deleteProduct(raw, a.id);
  await deleteProduct(raw, b.id);
  await raw.$disconnect();
}

async function testConcurrentCreateAndUpdateRace() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const service = buildProductsService(prisma);
  const user = await superAdminPrincipal(raw);
  const tag = Date.now().toString(36);
  const barcode = `BC-CRACE-${tag}`;
  const skuHold = `HOLD-${tag}`.toUpperCase();
  const skuNew = `NEW-${tag}`.toUpperCase();

  const holder = await service.create(user, {
    companyId,
    name: `Holder ${tag}`,
    sku: skuHold,
  });

  const results = await Promise.allSettled([
    service.create(user, {
      companyId,
      name: `Concurrent create ${tag}`,
      sku: skuNew,
      barcode,
    }),
    service.update(holder.id, { barcode }, user),
  ]);

  const conflicts = results.filter(
    (r) => r.status === 'rejected' && r.reason instanceof ConflictException,
  );
  const successes = results.filter((r) => r.status === 'fulfilled');
  assert.ok(successes.length >= 1, 'at least one operation must succeed');
  assert.ok(
    conflicts.length + successes.length === 2,
    'race must not leave both operations successful with duplicate barcode',
  );

  const dupCount = await raw.product.count({
    where: {
      companyId,
      barcode,
      status: { in: ['active', 'suspended'] },
    },
  });
  assert.ok(dupCount <= 1, 'at most one active/suspended row may hold the barcode');

  const ids = [holder.id];
  for (const r of results) {
    if (r.status === 'fulfilled' && 'id' in r.value && typeof r.value.id === 'string') {
      ids.push(r.value.id);
    }
  }
  for (const id of [...new Set(ids)]) {
    await deleteProduct(raw, id);
  }
  await raw.$disconnect();
}

const cases: TestCase[] = [
  { name: 'archived product barcode may be reused', run: testArchivedBarcodeReuse },
  { name: 'concurrent barcode updates — one conflict', run: testConcurrentBarcodeUpdates },
  { name: 'concurrent create + update race — at most one holder', run: testConcurrentCreateAndUpdateRace },
];

async function main() {
  let failed = 0;
  for (const tc of cases) {
    try {
      await tc.run();
      console.log(`PASS  ${tc.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL  ${tc.name}`);
      console.error(err);
    }
  }
  if (failed > 0) process.exit(1);
  console.log(`\n${cases.length - failed}/${cases.length} integration checks passed.`);
}

main();
