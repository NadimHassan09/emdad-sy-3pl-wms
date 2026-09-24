#!/usr/bin/env node
/**
 * One-shot exception: fulfill existing incomplete OMS orders through manual shipping → Out for Delivery.
 *
 * Clears needs_information (legacy import bug), approves, sets WH-001/PACK-001 + WH-001/SHIP-001 plan,
 * and advances outbound through picking → packing → manual shipping → dispatch.
 *
 * Usage (from backend/ with production .env):
 *   node scripts/fulfill-incomplete-oms-exception.cjs --dry-run
 *   node scripts/fulfill-incomplete-oms-exception.cjs
 *   node scripts/fulfill-incomplete-oms-exception.cjs --order OMS-2026-02731
 */
'use strict';

require('dotenv').config();

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const DRY_RUN = process.argv.includes('--dry-run');
const ORDER_FILTER = (() => {
  const i = process.argv.indexOf('--order');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const API_DELAY_MS = Number(process.env.API_DELAY_MS || 700);
const MAX_RETRIES = 8;
/** Legacy import batch that created incomplete orders (Mr Jad WA-20260822-*). */
const IMPORT_BATCH_ID =
  process.env.IMPORT_BATCH_ID || '5fe9127b-621a-4811-a4d1-403efda786b9';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'eng.yousef@emdadsy.com';

const WH001_ID = '00000000-0000-4000-8000-000000000010';
const PACK001_ID = '00000000-0000-4000-8000-000000000030';
const SHIP001_ID = '00000000-0000-4000-8000-000000000031';

const TERMINAL_OUTBOUND = new Set(['shipped', 'delivered', 'returned', 'cancelled']);
const APPROVABLE_OMS = new Set(['confirmed_waiting_for_admin_approval', 'pending_approval']);

const prisma = new PrismaClient();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mintToken() {
  const user = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  if (!user) throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, typ: 'internal', ver: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '4h' },
  );
}

async function api(token, method, path, body, companyId) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (companyId) headers['X-Company-Id'] = companyId;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${method} ${path} → ${res.status} non-JSON: ${text.slice(0, 300)}`);
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = Math.min(60_000, 3000 * 2 ** attempt);
      log(`  rate limited on ${method} ${path}, retry in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok || json.success === false) {
      const msg =
        json?.message ||
        json?.error?.message ||
        (Array.isArray(json?.message) ? json.message.join(', ') : null) ||
        text.slice(0, 500);
      throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
    }

    await sleep(API_DELAY_MS);
    return json.data ?? json;
  }
  throw new Error(`${method} ${path} → exceeded retries`);
}

async function clearIncompleteFlag(order) {
  if (!order.needsInformation) return;
  log(`  DB clear needs_information for ${order.orderNumber}`);
  if (DRY_RUN) return;
  await prisma.omsOrder.update({
    where: { id: order.id },
    data: {
      needsInformation: false,
      addressLine1: order.addressLine1 || order.district || 'General',
    },
  });
}

function buildPlan(outbound) {
  return {
    executionMode: 'admin',
    executionPlan: {
      warehouseId: WH001_ID,
      packingLocationId: PACK001_ID,
      dispatchDockId: SHIP001_ID,
      requiresPacking: outbound.requiresPacking !== false,
      lines: outbound.lines.map((l) => ({
        productId: l.productId,
        orderLineId: l.id,
        expectedQty: Number(l.requestedQuantity),
      })),
      planUpdatedAt: new Date().toISOString(),
    },
  };
}

async function ensurePlan(token, outboundId, companyId) {
  const outbound = await api(token, 'GET', `/outbound-orders/${outboundId}`, null, companyId);
  const plan = outbound.executionPlan;
  const hasPlan =
    plan &&
    plan.warehouseId === WH001_ID &&
    plan.dispatchDockId === SHIP001_ID &&
    plan.packingLocationId === PACK001_ID &&
    Array.isArray(plan.lines) &&
    plan.lines.length > 0;
  if (hasPlan) {
    log(`  Plan already WH-001/PACK-001 + WH-001/SHIP-001 on ${outbound.orderNumber}`);
    return outbound;
  }
  log(`  Plan → WH-001/PACK-001 + WH-001/SHIP-001`);
  const body = buildPlan(outbound);
  if (DRY_RUN) return { ...outbound, executionPlan: body.executionPlan };
  return api(token, 'PATCH', `/outbound-orders/${outboundId}/plan`, body, companyId);
}

async function advanceOutbound(token, outboundId, companyId) {
  for (let guard = 0; guard < 12; guard++) {
    const outbound = await api(token, 'GET', `/outbound-orders/${outboundId}`, null, companyId);
    const status = outbound.status;
    if (TERMINAL_OUTBOUND.has(status)) {
      log(`  Outbound ${outbound.orderNumber} terminal: ${status}`);
      return outbound;
    }

    let step;
    if (['draft', 'pending_approval', 'allocated', 'pending_stock'].includes(status)) {
      step = { action: 'approve', path: `/outbound-orders/${outboundId}/approve`, body: {} };
    } else if (status === 'picking') {
      step = { action: 'complete_picking', path: `/outbound-orders/${outboundId}/complete-picking`, body: {} };
    } else if (status === 'packing' && outbound.requiresPacking !== false) {
      step = { action: 'complete_packing', path: `/outbound-orders/${outboundId}/complete-packing`, body: {} };
    } else if (status === 'waiting_for_shipping_method') {
      step = {
        action: 'select_shipping_method',
        path: `/outbound-orders/${outboundId}/select-shipping-method`,
        body: { shippingMethod: 'manual' },
      };
    } else if (status === 'waiting_for_shipping_details') {
      step = {
        action: 'complete_shipping_details',
        path: `/outbound-orders/${outboundId}/complete-shipping-details`,
        body: {},
      };
    } else if (status === 'ready_to_ship') {
      step = { action: 'complete_dispatch', path: `/outbound-orders/${outboundId}/complete-dispatch`, body: {} };
    } else {
      throw new Error(`Unhandled outbound status ${status} for ${outbound.orderNumber}`);
    }

    log(`  → ${step.action} (${status})`);
    if (DRY_RUN) return outbound;
    await api(token, 'POST', step.path, step.body, companyId);
  }
  throw new Error(`Stage loop exceeded for outbound ${outboundId}`);
}

async function fulfillOrder(token, orderRow) {
  const label = orderRow.orderNumber;
  log(`\n=== ${label} (oms=${orderRow.status}, needsInfo=${orderRow.needsInformation}) ===`);

  if (APPROVABLE_OMS.has(orderRow.status)) {
    await clearIncompleteFlag(orderRow);
    log(`  POST approve OMS`);
    if (!DRY_RUN) {
      await api(token, 'POST', `/oms/orders/${orderRow.id}/approve`, { shippingFee: 0 }, orderRow.companyId);
    }
  } else if (orderRow.status === 'processing' && orderRow.needsInformation) {
    await clearIncompleteFlag(orderRow);
  }

  let oms = DRY_RUN
    ? orderRow
    : await api(token, 'GET', `/oms/orders/${orderRow.id}`, null, orderRow.companyId);
  let outboundId = oms.outboundOrderId || orderRow.outboundOrderId;
  if (!outboundId) throw new Error(`${label}: no linked outbound after approve`);

  await ensurePlan(token, outboundId, orderRow.companyId);
  await advanceOutbound(token, outboundId, orderRow.companyId);

  if (!DRY_RUN) {
    oms = await api(token, 'GET', `/oms/orders/${orderRow.id}`, null, orderRow.companyId);
    log(`  DONE ${label}: oms=${oms.status}`);
    if (oms.status !== 'shipped') {
      throw new Error(`${label}: expected shipped, got ${oms.status}`);
    }
  }
}

async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'} | API=${API_BASE} | admin=${ADMIN_EMAIL}`);

  const orderNumberFilter = ORDER_FILTER ? { orderNumber: ORDER_FILTER } : {};

  const candidates = await prisma.omsOrder.findMany({
    where: {
      importBatchId: IMPORT_BATCH_ID,
      ...orderNumberFilter,
      OR: [
        { needsInformation: true, status: { not: 'cancelled' } },
        {
          status: { in: ['confirmed_waiting_for_admin_approval', 'pending_approval'] },
          needsInformation: false,
          outboundOrderId: null,
        },
        {
          status: 'processing',
          outboundOrder: {
            status: { notIn: ['shipped', 'delivered', 'returned', 'cancelled'] },
          },
        },
      ],
    },
    include: {
      outboundOrder: { select: { id: true, status: true, orderNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  log(`Found ${candidates.length} import-batch order(s) needing fulfillment`);
  if (!candidates.length) return;

  for (const o of candidates) {
    log(
      ` - ${o.orderNumber} | oms=${o.status} | outbound=${o.outboundOrder?.orderNumber ?? '—'} (${o.outboundOrder?.status ?? '—'})`,
    );
  }

  if (DRY_RUN) {
    log('\nDry-run complete — re-run without --dry-run to apply.');
    return;
  }

  const token = await mintToken();
  log('Minted admin JWT');

  const results = { ok: [], failed: [] };
  for (const order of candidates) {
    try {
      await fulfillOrder(token, order);
      results.ok.push(order.orderNumber);
    } catch (err) {
      log(`ERROR ${order.orderNumber}: ${err.message}`);
      results.failed.push({ orderNumber: order.orderNumber, error: err.message });
    }
  }

  log('\n========== SUMMARY ==========');
  log(`Success: ${results.ok.length}`, results.ok.join(', ') || '—');
  log(`Failed:  ${results.failed.length}`);
  for (const f of results.failed) log(`  - ${f.orderNumber}: ${f.error}`);

  const remaining = await prisma.omsOrder.count({ where: { needsInformation: true } });
  log(`Remaining incomplete orders in DB: ${remaining}`);

  if (results.failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
