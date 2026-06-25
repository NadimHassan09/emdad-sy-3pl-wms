import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';

import { ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AuthPrincipal } from '../common/auth/current-user.types';
import { AuditLogService } from '../common/audit/audit-log.service';
import { CompanyAccessService } from '../common/company-access/company-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProductsService } from '../modules/products/products.service';
import { RealtimeService } from '../modules/realtime/realtime.service';

function realtimeMock(): RealtimeService {
  return {
    emitProductCreated: () => undefined,
    emitProductUpdated: () => undefined,
    emitProductArchived: () => undefined,
  } as unknown as RealtimeService;
}

type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  previous_state: unknown;
  new_state: unknown;
  created_at: Date;
};

const companyId = process.env.QA_COMPANY_ID ?? '00000000-0000-4000-8000-000000000001';

let cachedSuperAdmin: AuthPrincipal | null = null;

async function superAdmin(prisma: PrismaClient): Promise<AuthPrincipal> {
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

function companyAccessMock(): CompanyAccessService {
  return {
    resolveWriteCompanyId: () => companyId,
    validateResourceOwnership: () => undefined,
    getReadFilterCompanyId: () => companyId,
    assertSameCompany: () => undefined,
    requireActiveTenant: () => companyId,
  } as unknown as CompanyAccessService;
}

async function fetchProductAudits(
  prisma: PrismaClient,
  productId: string,
  action?: string,
): Promise<AuditRow[]> {
  const rows = await prisma.$queryRaw<AuditRow[]>`
    SELECT id, actor_id, actor_email, actor_role, company_id, action,
           resource_type, resource_id, previous_state, new_state, created_at
    FROM audit_logs
    WHERE resource_type = 'product'
      AND resource_id = ${productId}::uuid
      ${action ? Prisma.sql`AND action = ${action}` : Prisma.empty}
    ORDER BY created_at ASC
  `;
  return rows;
}

async function deleteProduct(prisma: PrismaClient, id: string) {
  await prisma.currentStock.deleteMany({ where: { productId: id } });
  await prisma.lot.deleteMany({ where: { productId: id } });
  await prisma.product.deleteMany({ where: { id } });
}

async function testProductCreateAudit() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const audit = new AuditLogService(prisma);
  const products = new ProductsService(prisma, companyAccessMock(), audit, realtimeMock());
  const user = await superAdmin(raw);
  const tag = Date.now().toString(36);
  const sku = `AUDIT-${tag}`.toUpperCase();

  const created = await products.create(user, {
    companyId,
    name: `Audit integration ${tag}`,
    sku,
    uom: 'piece',
  });

  const rows = await fetchProductAudits(raw, created.id, 'PRODUCT_CREATED');
  assert.equal(rows.length, 1, 'exactly one PRODUCT_CREATED audit row');
  const row = rows[0]!;
  assert.ok(row.actor_id, 'actorId present');
  assert.ok(row.actor_email.includes('@'), 'actorEmail present');
  assert.equal(row.actor_role, 'super_admin');
  assert.equal(row.company_id, companyId);
  assert.equal(row.action, 'PRODUCT_CREATED');
  assert.equal(row.resource_type, 'product');
  assert.equal(row.resource_id, created.id);
  assert.ok(row.created_at instanceof Date, 'timestamp present');
  assert.ok(row.new_state && typeof row.new_state === 'object', 'newState present');
  assert.equal((row.new_state as { sku?: string }).sku, sku);

  await deleteProduct(raw, created.id);
  await raw.$disconnect();
}

async function testProductUpdateAuditHasBeforeAfter() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const audit = new AuditLogService(prisma);
  const products = new ProductsService(prisma, companyAccessMock(), audit, realtimeMock());
  const user = await superAdmin(raw);
  const tag = Date.now().toString(36);
  const sku = `AUDIT-U-${tag}`.toUpperCase();

  const created = await products.create(user, {
    companyId,
    name: `Before ${tag}`,
    sku,
    uom: 'piece',
  });
  const updated = await products.update(created.id, { name: `After ${tag}` }, user);
  const rows = await fetchProductAudits(raw, created.id, 'PRODUCT_UPDATED');
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.ok(row.previous_state, 'previousState on update');
  assert.ok(row.new_state, 'newState on update');
  assert.equal((row.previous_state as { name?: string }).name, `Before ${tag}`);
  assert.equal((row.new_state as { name?: string }).name, `After ${tag}`);
  assert.equal(updated.name, `After ${tag}`);

  await deleteProduct(raw, created.id);
  await raw.$disconnect();
}

async function testAuditSurvivesCommittedTransaction() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const audit = new AuditLogService(prisma);
  const user = await superAdmin(raw);
  const productId = randomUUID();
  const tag = Date.now().toString(36);

  await prisma.$transaction(async (tx) => {
    await tx.product.create({
      data: {
        id: productId,
        companyId,
        name: `Tx audit ${tag}`,
        sku: `TX-${tag}`.toUpperCase(),
        trackingType: 'lot',
        uom: 'piece',
      },
    });
    await audit.logTx(
      tx,
      audit.fromPrincipal(user, {
        action: 'PRODUCT_CREATED',
        resourceType: 'product',
        resourceId: productId,
        companyId,
        newState: { sku: `TX-${tag}`.toUpperCase() },
      }),
    );
  });

  const rows = await fetchProductAudits(raw, productId, 'PRODUCT_CREATED');
  assert.equal(rows.length, 1, 'audit row committed with product transaction');

  await deleteProduct(raw, productId);
  await raw.$disconnect();
}

async function testNoDuplicateAuditOnRetry() {
  const raw = new PrismaClient();
  const prisma = raw as unknown as PrismaService;
  const audit = new AuditLogService(prisma);
  const products = new ProductsService(prisma, companyAccessMock(), audit, realtimeMock());
  const user = await superAdmin(raw);
  const tag = Date.now().toString(36);
  const barcode = `BC-AUDIT-${tag}`;

  const first = await products.create(user, {
    companyId,
    name: `Dup A ${tag}`,
    sku: `DUP-A-${tag}`.toUpperCase(),
    barcode,
    uom: 'piece',
  });

  let duplicateRejected = false;
  try {
    await products.create(user, {
      companyId,
      name: `Dup B ${tag}`,
      sku: `DUP-B-${tag}`.toUpperCase(),
      barcode,
      uom: 'piece',
    });
  } catch (e) {
    duplicateRejected = e instanceof ConflictException;
  }
  assert.ok(duplicateRejected, 'duplicate barcode create must fail');

  const createdRows = await fetchProductAudits(raw, first.id, 'PRODUCT_CREATED');
  assert.equal(createdRows.length, 1, 'only successful create writes audit');

  await deleteProduct(raw, first.id);
  await raw.$disconnect();
}

const cases = [
  { name: 'product create writes PRODUCT_CREATED audit', run: testProductCreateAudit },
  { name: 'product update writes previousState and newState', run: testProductUpdateAuditHasBeforeAfter },
  { name: 'audit row survives committed transaction', run: testAuditSurvivesCommittedTransaction },
  { name: 'failed create does not duplicate audit rows', run: testNoDuplicateAuditOnRetry },
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
  console.log(`\n${cases.length - failed}/${cases.length} audit integration checks passed.`);
}

main();
