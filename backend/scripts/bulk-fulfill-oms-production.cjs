#!/usr/bin/env node
/**
 * Production one-shot: approve OMS orders and fulfill linked outbounds through manual shipping → Out for Delivery.
 *
 * Targets OMS orders in:
 *   - confirmed_waiting_for_admin_approval / pending_approval (incl. needs_information)
 *   - processing with linked outbound not yet shipped
 *
 * Usage (from backend/, production DATABASE_URL + API on :3000):
 *   node scripts/bulk-fulfill-oms-production.cjs --dry-run
 *   node scripts/bulk-fulfill-oms-production.cjs
 */
'use strict';

const { PrismaClient } = require('@prisma/client');

const DRY_RUN = process.argv.includes('--dry-run');
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@emdad.example';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'demo123';

const prisma = new PrismaClient();

const TERMINAL_OUTBOUND = new Set(['shipped', 'delivered', 'returned', 'cancelled']);
const APPROVABLE_OMS = new Set(['confirmed_waiting_for_admin_approval', 'pending_approval']);

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function api(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${path} → ${res.status} non-JSON: ${text.slice(0, 300)}`);
  }
  if (!res.ok || json.success === false) {
    const msg =
      json?.message ||
      json?.error?.message ||
      (Array.isArray(json?.message) ? json.message.join(', ') : null) ||
      text.slice(0, 500);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json.data ?? json;
}

async function login() {
  const data = await api(null, 'POST', '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!data?.access_token) throw new Error('Login failed — no access_token');
  return data.access_token;
}

async function resolveWarehouseAndLocations(companyId, productIds) {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true },
  });
  if (!warehouses.length) throw new Error('No warehouses found');

  let best = null;
  for (const wh of warehouses) {
    const [outputDock, packingLoc] = await Promise.all([
      prisma.location.findFirst({
        where: { warehouseId: wh.id, type: 'output', status: 'active' },
        orderBy: { fullPath: 'asc' },
        select: { id: true, fullPath: true },
      }),
      prisma.location.findFirst({
        where: { warehouseId: wh.id, type: 'packing', status: 'active' },
        orderBy: { fullPath: 'asc' },
        select: { id: true, fullPath: true },
      }),
    ]);
    if (!outputDock || !packingLoc) continue;

    const stock = await prisma.currentStock.groupBy({
      by: ['productId'],
      where: {
        warehouseId: wh.id,
        companyId,
        productId: { in: productIds },
        status: 'available',
      },
      _sum: { quantityAvailable: true },
    });
    const score = stock.reduce((s, r) => s + Number(r._sum.quantityAvailable || 0), 0);
    if (!best || score > best.score) {
      best = { warehouse: wh, outputDock, packingLoc, score };
    }
  }

  if (!best) {
    const wh = warehouses[0];
    const outputDock = await prisma.location.findFirst({
      where: { warehouseId: wh.id, type: 'output' },
      select: { id: true, fullPath: true },
    });
    const packingLoc = await prisma.location.findFirst({
      where: { warehouseId: wh.id, type: 'packing' },
      select: { id: true, fullPath: true },
    });
    if (!outputDock || !packingLoc) {
      throw new Error(`Warehouse ${wh.code} missing output/packing locations`);
    }
    best = { warehouse: wh, outputDock, packingLoc, score: 0 };
  }
  return best;
}

function buildExecutionPlan(outbound, warehouseCtx) {
  const lines = outbound.lines.map((l) => ({
    productId: l.productId,
    orderLineId: l.id,
    expectedQty: Number(l.requestedQuantity),
  }));
  return {
    executionMode: 'admin',
    executionPlan: {
      warehouseId: warehouseCtx.warehouse.id,
      dispatchDockId: warehouseCtx.outputDock.id,
      packingLocationId: warehouseCtx.packingLoc.id,
      requiresPacking: outbound.requiresPacking !== false,
      lines,
      planUpdatedAt: new Date().toISOString(),
    },
  };
}

async function maybeCompleteIncomplete(token, order) {
  if (!order.needsInformation) return;
  const patch = {
    recipientName: order.recipientName || 'Customer',
    recipientPhone: order.recipientPhone || '0999999999',
    city: order.city || undefined,
    district: order.district || undefined,
    addressLine1: order.addressLine1 || undefined,
    addressLine2: order.addressLine2 || undefined,
    shippingReceiverLat: order.shippingReceiverLat ? Number(order.shippingReceiverLat) : undefined,
    shippingReceiverLng: order.shippingReceiverLng ? Number(order.shippingReceiverLng) : undefined,
  };
  log(`  PATCH incomplete order ${order.orderNumber}`);
  if (DRY_RUN) return;
  await api(token, 'PATCH', `/oms/orders/${order.id}`, patch);
}

async function ensurePlan(token, outboundId, companyId, productIds) {
  const outbound = await api(token, 'GET', `/outbound-orders/${outboundId}`);
  const plan = outbound.executionPlan;
  const hasPlan =
    plan &&
    plan.warehouseId &&
    plan.dispatchDockId &&
    plan.packingLocationId &&
    Array.isArray(plan.lines) &&
    plan.lines.length > 0;
  if (hasPlan) {
    log(`  Plan already set on ${outbound.orderNumber}`);
    return outbound;
  }

  const whCtx = await resolveWarehouseAndLocations(companyId, productIds);
  log(
    `  Plan → warehouse ${whCtx.warehouse.code}, dock ${whCtx.outputDock.fullPath}, pack ${whCtx.packingLoc.fullPath}`,
  );
  const body = buildExecutionPlan(outbound, whCtx);
  if (DRY_RUN) return { ...outbound, executionPlan: body.executionPlan };
  return api(token, 'PATCH', `/outbound-orders/${outboundId}/plan`, body);
}

async function advanceOutbound(token, outboundId) {
  let outbound = await api(token, 'GET', `/outbound-orders/${outboundId}`);
  const requiresPacking = outbound.requiresPacking !== false;

  const steps = [];
  const pushWhile = (cond, action, path, body) => {
    if (cond) steps.push({ action, path, body });
  };

  // Re-fetch loop — execute one stage at a time
  for (let guard = 0; guard < 12; guard++) {
    outbound = await api(token, 'GET', `/outbound-orders/${outboundId}`);
    const status = outbound.status;
    if (TERMINAL_OUTBOUND.has(status)) {
      log(`  Outbound ${outbound.orderNumber} already terminal: ${status}`);
      return outbound;
    }

    let step = null;
    if (['draft', 'pending_approval', 'allocated', 'pending_stock'].includes(status)) {
      step = { action: 'approve', path: `/outbound-orders/${outboundId}/approve`, body: {} };
    } else if (status === 'picking') {
      step = { action: 'complete_picking', path: `/outbound-orders/${outboundId}/complete-picking`, body: {} };
    } else if (status === 'packing' && requiresPacking) {
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
    outbound = await api(token, 'POST', step.path, step.body);
  }
  throw new Error(`Stage loop exceeded for outbound ${outboundId}`);
}

async function fulfillOrder(token, orderRow) {
  const label = orderRow.orderNumber;
  log(`\n=== ${label} (oms=${orderRow.status}, needsInfo=${orderRow.needsInformation}) ===`);

  if (APPROVABLE_OMS.has(orderRow.status)) {
    await maybeCompleteIncomplete(token, orderRow);
    if (!DRY_RUN) {
      const fresh = await prisma.omsOrder.findUnique({ where: { id: orderRow.id } });
      if (fresh?.needsInformation) {
        throw new Error(`${label}: still incomplete after patch — fix address manually`);
      }
    }
    log(`  POST approve OMS`);
    if (!DRY_RUN) {
      await api(token, 'POST', `/oms/orders/${orderRow.id}/approve`, { shippingFee: 0 });
    }
  }

  let oms = DRY_RUN
    ? orderRow
    : await api(token, 'GET', `/oms/orders/${orderRow.id}`);
  let outboundId = oms.outboundOrderId || orderRow.outboundOrderId;
  if (!outboundId) throw new Error(`${label}: no linked outbound after approve`);

  const productIds = (
    await prisma.omsOrderLine.findMany({
      where: { omsOrderId: orderRow.id },
      select: { productId: true },
    })
  ).map((l) => l.productId);

  await ensurePlan(token, outboundId, orderRow.companyId, productIds);
  await advanceOutbound(token, outboundId);

  if (!DRY_RUN) {
    oms = await api(token, 'GET', `/oms/orders/${orderRow.id}`);
    log(`  DONE ${label}: oms=${oms.status}, outbound linked=${oms.outboundOrderId}`);
    if (oms.status !== 'shipped' && oms.status !== 'out_for_delivery') {
      throw new Error(`${label}: expected shipped/out_for_delivery, got ${oms.status}`);
    }
  }
}

async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'} | API=${API_BASE}`);

  const candidates = await prisma.omsOrder.findMany({
    where: {
      OR: [
        { status: { in: ['confirmed_waiting_for_admin_approval', 'pending_approval'] } },
        {
          status: 'processing',
          outboundOrderId: { not: null },
          outboundOrder: { status: { notIn: ['shipped', 'delivered', 'returned', 'cancelled'] } },
        },
      ],
    },
    include: {
      lines: { select: { productId: true } },
      outboundOrder: { select: { id: true, status: true, orderNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  log(`Found ${candidates.length} candidate order(s)`);
  if (!candidates.length) return;

  for (const o of candidates) {
    log(
      ` - ${o.orderNumber} | oms=${o.status} | needsInfo=${o.needsInformation} | outbound=${o.outboundOrder?.orderNumber ?? '—'} (${o.outboundOrder?.status ?? '—'})`,
    );
  }

  if (DRY_RUN) {
    log('\nDry-run complete — re-run without --dry-run to apply.');
    return;
  }

  const token = await login();
  log('Logged in as admin');

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
