#!/usr/bin/env node
/**
 * Targeted rollback of accidental OMS fulfillments (Mr Jad allowlist only).
 *
 * Default: --dry-run (no writes).
 *
 * Apply gates (plan):
 *   --apply --limit 1            # Phase 2: exactly one SAFE order
 *   --apply --order OMS-…        # Phase 2: specific SAFE order
 *   --apply --confirm-remaining  # Phase 4: remaining SAFE (after pilot OK)
 *
 * Usage (from backend/ with production .env):
 *   node scripts/rollback-accidental-oms-fulfillment.cjs
 *   node scripts/rollback-accidental-oms-fulfillment.cjs --apply --limit 1
 *   node scripts/rollback-accidental-oms-fulfillment.cjs --apply --confirm-remaining
 */
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { PrismaClient, Prisma } = require('@prisma/client');

const MR_JAD_COMPANY_ID = 'f6fab62a-4536-4002-b07c-bad1eb17bca2';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'eng.yousef@emdadsy.com';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';
const ALLOWLIST_PATH =
  process.env.ALLOWLIST_PATH ||
  path.join(__dirname, 'data', 'accidental-oms-384-order-numbers.txt');
const OUTPUT_DIR =
  process.env.OUTPUT_DIR || path.join(__dirname, 'output');

const ARGS = new Set(process.argv.slice(2));
const APPLY = ARGS.has('--apply');
const DRY_RUN = !APPLY;
const CONFIRM_REMAINING = ARGS.has('--confirm-remaining');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? Number(process.argv[i + 1]) : null;
})();
const ORDER_FILTER = (() => {
  const i = process.argv.indexOf('--order');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const prisma = new PrismaClient();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function readAllowlist() {
  const raw = fs.readFileSync(ALLOWLIST_PATH, 'utf8');
  const nums = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const uniq = [...new Set(nums)];
  if (!uniq.length) throw new Error(`Empty allowlist: ${ALLOWLIST_PATH}`);
  return uniq;
}

function assertApplyGate() {
  if (!APPLY) return;
  if (CONFIRM_REMAINING) {
    if (ORDER_FILTER || LIMIT != null) {
      throw new Error('--confirm-remaining cannot be combined with --order or --limit');
    }
    return;
  }
  if (ORDER_FILTER) return;
  if (LIMIT === 1) return;
  throw new Error(
    'Refuse full apply. Use --apply --limit 1 OR --apply --order OMS-… for Phase 2, ' +
      'or --apply --confirm-remaining for Phase 4 after pilot sign-off.',
  );
}

async function mintOperatorId() {
  const user = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  if (!user) throw new Error(`Admin not found: ${ADMIN_EMAIL}`);
  return user;
}

function idemKey(outboundId, productId, locationId, lotId, qty) {
  return `bm:rollback-accidental:${outboundId}:${productId}:${locationId}:${lotId ?? 'null'}:${qty}`;
}

async function loadPickLedger(outboundId) {
  const rows = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: 'outbound_order',
      referenceId: outboundId,
      movementType: 'outbound_pick',
    },
    select: {
      id: true,
      productId: true,
      fromLocationId: true,
      lotId: true,
      quantity: true,
      companyId: true,
      product: { select: { sku: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const locIds = [...new Set(rows.map((r) => r.fromLocationId).filter(Boolean))];
  const locs = locIds.length
    ? await prisma.location.findMany({
        where: { id: { in: locIds } },
        select: { id: true, fullPath: true, warehouseId: true },
      })
    : [];
  const locMap = Object.fromEntries(locs.map((l) => [l.id, l]));
  return rows.map((r) => {
    const loc = r.fromLocationId ? locMap[r.fromLocationId] : null;
    return {
      productId: r.productId,
      sku: r.product?.sku ?? r.productId,
      locationId: r.fromLocationId,
      locationFullPath: loc?.fullPath ?? null,
      warehouseId: loc?.warehouseId ?? null,
      lotId: r.lotId,
      qty: r.quantity.toString(),
    };
  });
}

async function analyzeOrder(orderNumber) {
  const oms = await prisma.omsOrder.findFirst({
    where: { orderNumber },
    include: {
      company: { select: { id: true, name: true } },
      lines: {
        select: {
          productId: true,
          requestedQuantity: true,
          product: { select: { sku: true } },
        },
      },
      outboundOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          shippedAt: true,
          companyId: true,
        },
      },
    },
  });

  const base = {
    orderNumber,
    omsId: oms?.id ?? null,
    companyId: oms?.companyId ?? null,
    companyName: oms?.company?.name ?? null,
    omsStatus: oms?.status ?? null,
    outboundId: oms?.outboundOrderId ?? oms?.outboundOrder?.id ?? null,
    outboundNumber: oms?.outboundOrder?.orderNumber ?? null,
    outboundStatus: oms?.outboundOrder?.status ?? null,
    productLines: (oms?.lines ?? []).map((l) => ({
      sku: l.product?.sku,
      qty: l.requestedQuantity.toString(),
    })),
    ledgerRestorePlan: [],
    reservationCount: 0,
    workflowIds: [],
    taskIds: [],
    workflowCount: 0,
    taskCount: 0,
    manualChargeCount: 0,
    manualChargeIds: [],
    documentCount: 0,
    documentIds: [],
    omsFieldsToClear: [
      'status→confirmed_waiting_for_admin_approval',
      'outbound_order_id→null',
      'approved_at',
      'approved_by',
      'out_for_delivery_at',
      'allocated_at',
      'allocation_status→none',
    ],
    recordsToDelete: [],
    billingNote: null,
    verdict: 'BLOCKED',
    blockerReason: null,
  };

  if (!oms) {
    base.blockerReason = 'OMS order not found';
    return base;
  }
  if (oms.companyId !== MR_JAD_COMPANY_ID) {
    base.blockerReason = `Company mismatch: ${oms.company?.name} (${oms.companyId})`;
    return base;
  }

  // Already rolled back
  if (
    !oms.outboundOrderId &&
    (oms.status === 'confirmed_waiting_for_admin_approval' ||
      oms.status === 'pending_approval')
  ) {
    base.verdict = 'SAFE';
    base.blockerReason = 'ALREADY_ROLLED_BACK (idempotent no-op)';
    base.billingNote = 'skip';
    return base;
  }

  if (oms.status !== 'shipped' && oms.status !== 'out_for_delivery') {
    base.blockerReason = `Unexpected OMS status: ${oms.status}`;
    return base;
  }
  if (!oms.outboundOrderId || !oms.outboundOrder) {
    base.blockerReason = 'OMS shipped but no linked outbound';
    return base;
  }
  if (oms.outboundOrder.status !== 'shipped') {
    base.blockerReason = `Outbound status is ${oms.outboundOrder.status}, expected shipped`;
    return base;
  }

  const outboundId = oms.outboundOrder.id;

  const codCount = await prisma.codRecord.count({
    where: { omsOrderId: oms.id },
  });
  if (codCount > 0) {
    base.blockerReason = `COD records exist: ${codCount}`;
    return base;
  }

  const omsReturnCount = await prisma.omsReturn.count({
    where: { omsOrderId: oms.id },
  });
  if (omsReturnCount > 0) {
    base.blockerReason = `OMS returns exist: ${omsReturnCount}`;
    return base;
  }

  const whReturnCount = await prisma.returnOrder.count({
    where: { originalOutboundOrderId: outboundId },
  });
  if (whReturnCount > 0) {
    base.blockerReason = `Warehouse returns link outbound: ${whReturnCount}`;
    return base;
  }

  const ledgerRestorePlan = await loadPickLedger(outboundId);
  if (!ledgerRestorePlan.length) {
    base.blockerReason = 'No outbound_pick ledger rows for outbound';
    return base;
  }
  for (const s of ledgerRestorePlan) {
    if (!s.locationId || !s.warehouseId) {
      base.blockerReason = `Ledger slice missing location/warehouse for product ${s.sku}`;
      return base;
    }
  }
  base.ledgerRestorePlan = ledgerRestorePlan;

  // Idempotency: if all compensating keys exist, treat as already restored inventory
  const keys = ledgerRestorePlan.map((s) =>
    idemKey(outboundId, s.productId, s.locationId, s.lotId, s.qty),
  );
  const existingKeys = await prisma.ledgerIdempotency.findMany({
    where: { idempotencyKey: { in: keys } },
    select: { idempotencyKey: true },
  });
  const existingSet = new Set(existingKeys.map((k) => k.idempotencyKey));
  base.alreadyRestoredSlices = keys.filter((k) => existingSet.has(k)).length;
  base.pendingRestoreSlices = keys.length - base.alreadyRestoredSlices;

  const reservationCount = await prisma.stockReservation.count({
    where: { outboundOrderId: outboundId },
  });
  base.reservationCount = reservationCount;

  const workflows = await prisma.workflowInstance.findMany({
    where: { referenceType: 'outbound_order', referenceId: outboundId },
    select: { id: true },
  });
  base.workflowIds = workflows.map((w) => w.id);
  base.workflowCount = workflows.length;

  const tasks = workflows.length
    ? await prisma.warehouseTask.findMany({
        where: { workflowInstanceId: { in: base.workflowIds } },
        select: { id: true, taskType: true },
      })
    : [];
  base.taskIds = tasks.map((t) => t.id);
  base.taskCount = tasks.length;
  base.taskTypes = [...new Set(tasks.map((t) => t.taskType))];

  const charges = await prisma.orderManualCharge.findMany({
    where: { referenceType: 'outbound_order', referenceId: outboundId },
    select: { id: true, description: true, totalPrice: true },
  });
  base.manualChargeIds = charges.map((c) => c.id);
  base.manualChargeCount = charges.length;
  base.manualCharges = charges.map((c) => ({
    id: c.id,
    description: c.description,
    total: c.totalPrice.toString(),
  }));

  const docs = await prisma.document.findMany({
    where: { referenceType: 'outbound_order', referenceId: outboundId },
    select: { id: true, type: true, documentNumber: true },
  });
  base.documentIds = docs.map((d) => d.id);
  base.documentCount = docs.length;

  base.recordsToDelete = [
    `outbound_orders:${outboundId}`,
    `outbound_order_lines (cascade)`,
    `stock_reservations x${reservationCount} (cascade)`,
    `carrier_shipments / bulk_shipping_job_items (cascade)`,
    `workflow_instances x${base.workflowCount}`,
    `warehouse_tasks x${base.taskCount}`,
    `documents x${base.documentCount}`,
    `order_manual_charges x${base.manualChargeCount}`,
  ];

  base.billingNote =
    'Outbound shippedAt in cycle will drop from draft invoice outbound count after delete+recalc';
  base.verdict = 'SAFE';
  base.blockerReason = null;
  return base;
}

async function restoreStockSlice(tx, operatorId, outboundId, slice) {
  const key = idemKey(
    outboundId,
    slice.productId,
    slice.locationId,
    slice.lotId,
    slice.qty,
  );
  const existing = await tx.ledgerIdempotency.findUnique({
    where: { idempotencyKey: key },
  });
  if (existing) return { inserted: false, key };

  const qtyStr = String(slice.qty);
  const lotId = slice.lotId ?? null;

  // Lock + increase on-hand (mirrors StockHelpers.upsertPositiveWithMeta)
  if (lotId) {
    await tx.$executeRaw`
      SELECT quantity_on_hand FROM current_stock
       WHERE company_id = ${slice.companyId}::uuid
         AND product_id = ${slice.productId}::uuid
         AND location_id = ${slice.locationId}::uuid
         AND lot_id = ${lotId}::uuid AND package_id IS NULL
       FOR UPDATE`;
    await tx.$executeRaw`
      INSERT INTO current_stock
        (company_id, product_id, location_id, warehouse_id, lot_id,
         quantity_on_hand, last_movement_at)
      VALUES
        (${slice.companyId}::uuid, ${slice.productId}::uuid, ${slice.locationId}::uuid,
         ${slice.warehouseId}::uuid, ${lotId}::uuid,
         ${qtyStr}::numeric, NOW())
      ON CONFLICT (company_id, product_id, location_id, lot_id)
        WHERE lot_id IS NOT NULL AND package_id IS NULL
      DO UPDATE SET
        quantity_on_hand  = current_stock.quantity_on_hand + ${qtyStr}::numeric,
        version           = current_stock.version + 1,
        last_movement_at  = NOW()`;
  } else {
    await tx.$executeRaw`
      SELECT quantity_on_hand FROM current_stock
       WHERE company_id = ${slice.companyId}::uuid
         AND product_id = ${slice.productId}::uuid
         AND location_id = ${slice.locationId}::uuid
         AND lot_id IS NULL AND package_id IS NULL
       FOR UPDATE`;
    await tx.$executeRaw`
      INSERT INTO current_stock
        (company_id, product_id, location_id, warehouse_id,
         quantity_on_hand, last_movement_at)
      VALUES
        (${slice.companyId}::uuid, ${slice.productId}::uuid, ${slice.locationId}::uuid,
         ${slice.warehouseId}::uuid,
         ${qtyStr}::numeric, NOW())
      ON CONFLICT (company_id, product_id, location_id)
        WHERE lot_id IS NULL AND package_id IS NULL
      DO UPDATE SET
        quantity_on_hand  = current_stock.quantity_on_hand + ${qtyStr}::numeric,
        version           = current_stock.version + 1,
        last_movement_at  = NOW()`;
  }

  const ledger = await tx.inventoryLedger.create({
    data: {
      companyId: slice.companyId,
      productId: slice.productId,
      lotId: lotId,
      fromLocationId: null,
      toLocationId: slice.locationId,
      movementType: 'adjustment_positive',
      quantity: new Prisma.Decimal(qtyStr),
      referenceType: 'outbound_order',
      referenceId: outboundId,
      operatorId,
      idempotencyKey: key,
      notes: 'rollback-accidental-oms-fulfillment',
    },
  });
  await tx.ledgerIdempotency.create({
    data: { idempotencyKey: key, ledgerId: ledger.id },
  });
  return { inserted: true, key };
}

async function applyOrder(analysis, operatorId) {
  if (analysis.verdict !== 'SAFE') {
    throw new Error(`Refuse apply BLOCKED: ${analysis.orderNumber}: ${analysis.blockerReason}`);
  }
  if (analysis.blockerReason === 'ALREADY_ROLLED_BACK (idempotent no-op)') {
    return { skipped: true, reason: 'already_rolled_back' };
  }

  const omsId = analysis.omsId;
  const outboundId = analysis.outboundId;

  await prisma.$transaction(
    async (tx) => {
      // Re-read under transaction
      const oms = await tx.omsOrder.findUnique({
        where: { id: omsId },
        select: {
          id: true,
          status: true,
          outboundOrderId: true,
          companyId: true,
          orderNumber: true,
        },
      });
      if (!oms || oms.outboundOrderId !== outboundId) {
        throw new Error(`${analysis.orderNumber}: OMS/outbound link changed mid-flight`);
      }
      if (oms.status !== 'shipped' && oms.status !== 'out_for_delivery') {
        throw new Error(`${analysis.orderNumber}: OMS status changed to ${oms.status}`);
      }

      const companyId = oms.companyId;
      for (const slice of analysis.ledgerRestorePlan) {
        await restoreStockSlice(tx, operatorId, outboundId, {
          ...slice,
          companyId,
        });
      }

      if (analysis.manualChargeIds.length) {
        await tx.orderManualCharge.deleteMany({
          where: { id: { in: analysis.manualChargeIds } },
        });
      }
      if (analysis.documentIds.length) {
        await tx.document.deleteMany({
          where: { id: { in: analysis.documentIds } },
        });
      }
      await tx.workflowInstance.deleteMany({
        where: { referenceType: 'outbound_order', referenceId: outboundId },
      });

      await tx.omsOrder.update({
        where: { id: omsId },
        data: {
          status: 'confirmed_waiting_for_admin_approval',
          outboundOrderId: null,
          approvedAt: null,
          approvedBy: null,
          outForDeliveryAt: null,
          allocatedAt: null,
          allocationStatus: 'none',
        },
      });

      // Delete outbound BEFORE writing the OMS event: DB FK on
      // oms_order_events.outbound_order_id is ON DELETE CASCADE (schema says SetNull
      // but live DB cascades), so an event that still points at the outbound
      // would be wiped with the outbound row.
      await tx.outboundOrder.delete({ where: { id: outboundId } });

      await tx.omsOrderEvent.create({
        data: {
          omsOrderId: omsId,
          outboundOrderId: null,
          companyId,
          eventType: 'oms.rollback_accidental_fulfillment',
          createdBy: operatorId,
          payload: {
            orderNumber: oms.orderNumber,
            outboundOrderId: outboundId,
            reason: 'accidental_script_fulfillment',
            restoreSlices: analysis.ledgerRestorePlan.length,
          },
        },
      });
    },
    { timeout: 120_000 },
  );

  return { skipped: false };
}

async function companyBillingReport() {
  const now = new Date();
  const cycle = await prisma.billingCycle.findFirst({
    where: {
      companyId: MR_JAD_COMPANY_ID,
      status: { in: ['active', 'renewed'] },
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  if (!cycle) {
    return { cycle: null, draftInvoices: [], issuedInvoices: [], note: 'No active billing cycle' };
  }
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: MR_JAD_COMPANY_ID,
      billingCycleId: cycle.id,
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      grandTotal: true,
    },
  });
  const draftInvoices = invoices.filter((i) => i.status === 'draft');
  const issuedInvoices = invoices.filter((i) => i.status !== 'draft');
  const shippedInWindow = await prisma.outboundOrder.count({
    where: {
      companyId: MR_JAD_COMPANY_ID,
      status: 'shipped',
      shippedAt: { gte: cycle.startsAt, lte: now < cycle.endsAt ? now : cycle.endsAt },
    },
  });
  return {
    cycle: {
      id: cycle.id,
      startsAt: cycle.startsAt.toISOString(),
      endsAt: cycle.endsAt.toISOString(),
    },
    draftInvoices: draftInvoices.map((i) => ({
      id: i.id,
      number: i.invoiceNumber,
      total: i.grandTotal.toString(),
    })),
    issuedInvoices: issuedInvoices.map((i) => ({
      id: i.id,
      number: i.invoiceNumber,
      status: i.status,
      total: i.grandTotal.toString(),
    })),
    shippedOutboundCountInCycle: shippedInWindow,
    billingAutoFixOk: issuedInvoices.length === 0,
    note:
      issuedInvoices.length === 0
        ? 'Draft-only: recalc after deletes should drop outbound system lines'
        : 'ISSUED invoices present — may need manual credit; draft recalc alone may not fix issued',
  };
}

async function triggerBillingRecalc(operator) {
  const token = jwt.sign(
    {
      sub: operator.id,
      email: operator.email,
      role: operator.role,
      typ: 'internal',
      ver: operator.tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' },
  );
  const url = `${API_BASE}/billing/preview?companyId=${MR_JAD_COMPANY_ID}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Company-Id': MR_JAD_COMPANY_ID,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Billing preview/recalc failed ${res.status}: ${text.slice(0, 400)}`);
  }
  return text.slice(0, 500);
}

function writeReports(rows, billing, suffix) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUTPUT_DIR, `rollback-${suffix}-${stamp}.json`);
  const csvPath = path.join(OUTPUT_DIR, `rollback-${suffix}-${stamp}.csv`);

  const payload = {
    mode: DRY_RUN ? 'dry-run' : 'apply',
    generatedAt: new Date().toISOString(),
    allowlistPath: ALLOWLIST_PATH,
    summary: {
      total: rows.length,
      safe: rows.filter((r) => r.verdict === 'SAFE').length,
      blocked: rows.filter((r) => r.verdict === 'BLOCKED').length,
      alreadyRolledBack: rows.filter((r) =>
        String(r.blockerReason || '').includes('ALREADY_ROLLED_BACK'),
      ).length,
    },
    billing,
    rows,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const headers = [
    'orderNumber',
    'verdict',
    'blockerReason',
    'omsId',
    'omsStatus',
    'outboundId',
    'outboundNumber',
    'outboundStatus',
    'restoreQtyTotal',
    'restoreSlices',
    'locationPaths',
    'lots',
    'skus',
    'reservationCount',
    'workflowCount',
    'taskCount',
    'manualChargeCount',
    'documentCount',
    'recordsToDelete',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const restoreQty = (r.ledgerRestorePlan || []).reduce(
      (s, x) => s + Number(x.qty),
      0,
    );
    const esc = (v) => {
      const t = v == null ? '' : String(v);
      return `"${t.replace(/"/g, '""')}"`;
    };
    lines.push(
      [
        r.orderNumber,
        r.verdict,
        r.blockerReason,
        r.omsId,
        r.omsStatus,
        r.outboundId,
        r.outboundNumber,
        r.outboundStatus,
        restoreQty,
        (r.ledgerRestorePlan || []).length,
        (r.ledgerRestorePlan || []).map((x) => x.locationFullPath).join('|'),
        (r.ledgerRestorePlan || []).map((x) => x.lotId || 'null').join('|'),
        (r.ledgerRestorePlan || []).map((x) => `${x.sku}:${x.qty}`).join('|'),
        r.reservationCount,
        r.workflowCount,
        r.taskCount,
        r.manualChargeCount,
        r.documentCount,
        (r.recordsToDelete || []).join('; '),
      ]
        .map(esc)
        .join(','),
    );
  }
  fs.writeFileSync(csvPath, lines.join('\n'));
  return { jsonPath, csvPath, summary: payload.summary };
}

async function main() {
  assertApplyGate();
  const allowlist = readAllowlist();
  log(
    `Mode=${DRY_RUN ? 'DRY-RUN' : 'APPLY'} | allowlist=${allowlist.length} | file=${ALLOWLIST_PATH}`,
  );
  if (ORDER_FILTER) log(`Filter --order ${ORDER_FILTER}`);
  if (LIMIT != null) log(`Filter --limit ${LIMIT}`);
  if (CONFIRM_REMAINING) log('Filter --confirm-remaining');

  let targets = allowlist;
  if (ORDER_FILTER) {
    if (!allowlist.includes(ORDER_FILTER)) {
      throw new Error(`${ORDER_FILTER} is not in the allowlist`);
    }
    targets = [ORDER_FILTER];
  }

  const operator = await mintOperatorId();
  log(`Operator ${operator.email} (${operator.id})`);

  const billing = await companyBillingReport();
  log('Billing report:', JSON.stringify(billing, null, 2));

  /** @type {any[]} */
  const analyses = [];
  for (const orderNumber of targets) {
    const a = await analyzeOrder(orderNumber);
    analyses.push(a);
    const tag = a.verdict === 'SAFE' ? 'SAFE' : 'BLOCKED';
    log(
      `${tag} ${orderNumber} oms=${a.omsStatus} out=${a.outboundNumber || '—'}(${a.outboundStatus || '—'}) ` +
        `slices=${(a.ledgerRestorePlan || []).length} ` +
        `${a.blockerReason ? '| ' + a.blockerReason : ''}`,
    );
  }

  let toApply = analyses.filter((a) => a.verdict === 'SAFE');
  // Prefer actionable SAFE (not already rolled back) for --limit 1
  const actionable = toApply.filter(
    (a) => !String(a.blockerReason || '').includes('ALREADY_ROLLED_BACK'),
  );

  if (APPLY) {
    let batch = actionable;
    if (ORDER_FILTER) {
      batch = analyses.filter((a) => a.orderNumber === ORDER_FILTER && a.verdict === 'SAFE');
    } else if (LIMIT != null) {
      batch = actionable.slice(0, LIMIT);
    } else if (CONFIRM_REMAINING) {
      batch = actionable;
    }

    log(`Applying ${batch.length} order(s)…`);
    const results = { ok: [], skipped: [], failed: [] };
    for (const a of batch) {
      try {
        const r = await applyOrder(a, operator.id);
        if (r.skipped) {
          results.skipped.push(a.orderNumber);
          log(`SKIP ${a.orderNumber}: ${r.reason}`);
        } else {
          results.ok.push(a.orderNumber);
          log(`APPLIED ${a.orderNumber}`);
        }
      } catch (err) {
        results.failed.push({ orderNumber: a.orderNumber, error: err.message });
        log(`FAIL ${a.orderNumber}: ${err.message}`);
      }
    }

    if (results.ok.length) {
      try {
        const preview = await triggerBillingRecalc(operator);
        log('Billing recalc via preview OK:', preview.slice(0, 200));
      } catch (err) {
        log('WARN billing recalc failed:', err.message);
      }
    }

    const paths = writeReports(analyses, { ...billing, applyResults: results }, 'apply');
    log('Reports:', paths.jsonPath, paths.csvPath);
    log('Apply summary:', JSON.stringify(results));
    if (results.failed.length) process.exitCode = 1;
  } else {
    const paths = writeReports(analyses, billing, 'dry-run');
    log('\n========== DRY-RUN SUMMARY ==========');
    log(`Total:   ${analyses.length}`);
    log(`SAFE:    ${analyses.filter((a) => a.verdict === 'SAFE').length}`);
    log(
      `  of which already rolled back: ${
        analyses.filter((a) => String(a.blockerReason || '').includes('ALREADY_ROLLED_BACK'))
          .length
      }`,
    );
    log(`BLOCKED: ${analyses.filter((a) => a.verdict === 'BLOCKED').length}`);
    log(`Actionable SAFE (need apply): ${actionable.length}`);
    log(`Reports:\n  ${paths.csvPath}\n  ${paths.jsonPath}`);
    log('Billing auto-fix OK (no issued):', billing.billingAutoFixOk);
    log('\nNext: review report, then Phase 2: --apply --limit 1');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
