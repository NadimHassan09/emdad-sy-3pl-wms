/**
 * Unified Order Execution §10.3 — deterministic executionMode backfill (staging).
 *
 * Rules:
 * - NULL + plannable + no workflow → admin
 * - NULL + workflow exists / in progress → workers
 * - NULL + terminal → admin
 * - Explicit workers with open tasks → leave unchanged
 * - executionPlan null → leave null
 *
 * Usage (from backend/, staging DATABASE_URL):
 *   node scripts/backfill-execution-mode.cjs           # dry-run
 *   node scripts/backfill-execution-mode.cjs --apply   # write
 */
'use strict';

const { PrismaClient } = require('@prisma/client');

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient();

const INBOUND_PLANNABLE = ['draft', 'pending_approval'];
const INBOUND_TERMINAL = ['completed', 'cancelled'];
const OUTBOUND_PLANNABLE = ['draft', 'pending_approval', 'allocated', 'pending_stock'];
const OUTBOUND_TERMINAL = ['shipped', 'delivered', 'returned', 'cancelled'];

async function hasWorkflow(referenceType, referenceId) {
  const row = await prisma.workflowInstance.findFirst({
    where: { referenceType, referenceId },
    select: { id: true, status: true },
  });
  return !!row;
}

async function backfillTable({ label, findMany, updateMany, plannable, terminal, refType }) {
  const nulls = await findMany({
    where: { executionMode: null },
    select: { id: true, status: true, orderNumber: true },
  });

  const counts = { adminPlannable: 0, workersWorkflow: 0, adminTerminal: 0, adminOther: 0 };
  const updates = { admin: [], workers: [] };

  for (const row of nulls) {
    const wf = await hasWorkflow(refType, row.id);
    let mode = 'admin';
    if (wf) {
      mode = 'workers';
      counts.workersWorkflow += 1;
    } else if (plannable.includes(row.status)) {
      counts.adminPlannable += 1;
    } else if (terminal.includes(row.status)) {
      counts.adminTerminal += 1;
    } else {
      // in-progress without workflow row (rare) → admin cosmetic default per normalize
      counts.adminOther += 1;
    }
    updates[mode].push(row.id);
  }

  console.log(`\n[${label}] null executionMode: ${nulls.length}`);
  console.log(`  → admin (plannable, no wf): ${counts.adminPlannable}`);
  console.log(`  → workers (has workflow):   ${counts.workersWorkflow}`);
  console.log(`  → admin (terminal):         ${counts.adminTerminal}`);
  console.log(`  → admin (other):            ${counts.adminOther}`);

  if (!APPLY) {
    console.log(`  dry-run only (pass --apply to write)`);
    return { nulls: nulls.length, ...counts };
  }

  if (updates.admin.length) {
    await updateMany({
      where: { id: { in: updates.admin }, executionMode: null },
      data: { executionMode: 'admin' },
    });
  }
  if (updates.workers.length) {
    await updateMany({
      where: { id: { in: updates.workers }, executionMode: null },
      data: { executionMode: 'workers' },
    });
  }
  console.log(`  applied admin=${updates.admin.length} workers=${updates.workers.length}`);
  return { nulls: nulls.length, ...counts, appliedAdmin: updates.admin.length, appliedWorkers: updates.workers.length };
}

async function main() {
  console.log(`executionMode backfill (${APPLY ? 'APPLY' : 'DRY-RUN'})`);

  const inbound = await backfillTable({
    label: 'inbound_orders',
    findMany: (args) => prisma.inboundOrder.findMany(args),
    updateMany: (args) => prisma.inboundOrder.updateMany(args),
    plannable: INBOUND_PLANNABLE,
    terminal: INBOUND_TERMINAL,
    refType: 'inbound_order',
  });

  const outbound = await backfillTable({
    label: 'outbound_orders',
    findMany: (args) => prisma.outboundOrder.findMany(args),
    updateMany: (args) => prisma.outboundOrder.updateMany(args),
    plannable: OUTBOUND_PLANNABLE,
    terminal: OUTBOUND_TERMINAL,
    refType: 'outbound_order',
  });

  console.log('\nSummary', { inbound, outbound });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
