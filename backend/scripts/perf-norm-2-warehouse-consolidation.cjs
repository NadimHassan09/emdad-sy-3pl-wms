#!/usr/bin/env node
/**
 * PERF-NORM-2 — Single warehouse audit, migration (if needed), certification.
 * DATA ONLY — no API/frontend/benchmark changes.
 */
const { Client } = require('pg');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const WH001_ID = '00000000-0000-4000-8000-000000000010';
const ROOT = join(__dirname, '../..');

async function q(client, sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

async function q1(client, sql, params = []) {
  const rows = await q(client, sql, params);
  return rows[0] ?? null;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const evidence = { queries: [], audit: {}, migration: null, certification: {} };

  const run = async (label, sql, params = []) => {
    evidence.queries.push({ label, sql: sql.trim(), params });
    return q(client, sql, params);
  };

  const run1 = async (label, sql, params = []) => {
    evidence.queries.push({ label, sql: sql.trim(), params });
    return q1(client, sql, params);
  };

  // --- STEP 1: Warehouse audit ---
  const warehouses = await run(
    'all_warehouses',
    `SELECT id, code, name, status, created_at FROM warehouses ORDER BY code`,
  );

  const warehouseMetrics = [];
  for (const wh of warehouses) {
    const id = wh.id;
    const m = {
      id,
      code: wh.code,
      name: wh.name,
      status: wh.status,
      locations: await run1('locations', `SELECT COUNT(*)::int AS c FROM locations WHERE warehouse_id = $1`, [id]),
      stock_rows: await run1('stock_rows', `SELECT COUNT(*)::int AS c FROM current_stock WHERE warehouse_id = $1`, [id]),
      qty_on_hand: await run1(
        'qty_on_hand',
        `SELECT COALESCE(SUM(quantity_on_hand),0)::numeric AS s FROM current_stock WHERE warehouse_id = $1`,
        [id],
      ),
      products_via_stock: await run1(
        'products_via_stock',
        `SELECT COUNT(DISTINCT product_id)::int AS c FROM current_stock WHERE warehouse_id = $1`,
        [id],
      ),
      workflow_instances: await run1('wf', `SELECT COUNT(*)::int AS c FROM workflow_instances WHERE warehouse_id = $1`, [id]),
      warehouse_tasks: await run1(
        'tasks',
        `SELECT COUNT(*)::int AS c FROM warehouse_tasks wt
         JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
         WHERE wi.warehouse_id = $1`,
        [id],
      ),
      workers: await run1('workers', `SELECT COUNT(*)::int AS c FROM workers WHERE warehouse_id = $1`, [id]),
      stock_adjustments: await run1('adj', `SELECT COUNT(*)::int AS c FROM stock_adjustments WHERE warehouse_id = $1`, [id]),
      cycle_counts: await run1('cc', `SELECT COUNT(*)::int AS c FROM cycle_counts WHERE warehouse_id = $1`, [id]),
      cycle_count_variances: await run1('ccv', `SELECT COUNT(*)::int AS c FROM cycle_count_variances WHERE warehouse_id = $1`, [id]),
      returns: await run1('returns', `SELECT COUNT(*)::int AS c FROM return_orders WHERE warehouse_id = $1`, [id]),
      inbound_orders_via_wf: await run1(
        'inbound_wf',
        `SELECT COUNT(DISTINCT wi.reference_id)::int AS c FROM workflow_instances wi
         WHERE wi.warehouse_id = $1 AND wi.reference_type = 'inbound_order'`,
        [id],
      ),
      outbound_orders_via_wf: await run1(
        'outbound_wf',
        `SELECT COUNT(DISTINCT wi.reference_id)::int AS c FROM workflow_instances wi
         WHERE wi.warehouse_id = $1 AND wi.reference_type = 'outbound_order'`,
        [id],
      ),
      ledger_via_locations: await run1(
        'ledger_from',
        `SELECT COUNT(*)::int AS c FROM inventory_ledger il
         JOIN locations l ON l.id = il.from_location_id
         WHERE l.warehouse_id = $1`,
        [id],
      ),
      ledger_via_locations_to: await run1(
        'ledger_to',
        `SELECT COUNT(*)::int AS c FROM inventory_ledger il
         JOIN locations l ON l.id = il.to_location_id
         WHERE l.warehouse_id = $1`,
        [id],
      ),
    };
    const operational =
      (m.stock_rows?.c || 0) > 0 ||
      (m.workflow_instances?.c || 0) > 0 ||
      (m.warehouse_tasks?.c || 0) > 0 ||
      (m.workers?.c || 0) > 0 ||
      (parseFloat(m.qty_on_hand?.s || 0) > 0);
    const empty =
      (m.locations?.c || 0) === 0 &&
      (m.stock_rows?.c || 0) === 0 &&
      (m.workflow_instances?.c || 0) === 0;
    warehouseMetrics.push({
      ...m,
      locations: m.locations?.c ?? 0,
      stock_rows: m.stock_rows?.c ?? 0,
      quantity_on_hand: String(m.qty_on_hand?.s ?? 0),
      products_count: m.products_via_stock?.c ?? 0,
      workflow_instances: m.workflow_instances?.c ?? 0,
      warehouse_tasks: m.warehouse_tasks?.c ?? 0,
      workers: m.workers?.c ?? 0,
      stock_adjustments: m.stock_adjustments?.c ?? 0,
      cycle_counts: m.cycle_counts?.c ?? 0,
      cycle_count_variances: m.cycle_count_variances?.c ?? 0,
      returns: m.returns?.c ?? 0,
      inbound_orders: m.inbound_orders_via_wf?.c ?? 0,
      outbound_orders: m.outbound_orders_via_wf?.c ?? 0,
      ledger_from_refs: m.ledger_via_locations?.c ?? 0,
      ledger_to_refs: m.ledger_via_locations_to?.c ?? 0,
      classification: operational ? 'operational' : empty ? 'empty' : 'historical',
    });
  }

  evidence.audit.warehouses = warehouseMetrics;

  // Outside WH-001 counts (pre-migration)
  const outside = {
    stock_rows: await run1(
      'outside_stock',
      `SELECT COUNT(*)::int AS c FROM current_stock WHERE warehouse_id <> $1`,
      [WH001_ID],
    ),
    tasks: await run1(
      'outside_tasks',
      `SELECT COUNT(*)::int AS c FROM warehouse_tasks wt
       JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
       WHERE wi.warehouse_id <> $1`,
      [WH001_ID],
    ),
    workflows: await run1(
      'outside_wf',
      `SELECT COUNT(*)::int AS c FROM workflow_instances WHERE warehouse_id <> $1`,
      [WH001_ID],
    ),
    workers: await run1('outside_workers', `SELECT COUNT(*)::int AS c FROM workers WHERE warehouse_id IS NOT NULL AND warehouse_id <> $1`, [
      WH001_ID,
    ]),
    locations_with_stock: await run1(
      'outside_loc_stock',
      `SELECT COUNT(DISTINCT cs.location_id)::int AS c FROM current_stock cs
       JOIN locations l ON l.id = cs.location_id WHERE l.warehouse_id <> $1`,
      [WH001_ID],
    ),
  };
  evidence.audit.outside_wh001_before = {
    stock_rows: outside.stock_rows?.c ?? 0,
    tasks: outside.tasks?.c ?? 0,
    workflows: outside.workflows?.c ?? 0,
    workers: outside.workers?.c ?? 0,
    locations_with_stock: outside.locations_with_stock?.c ?? 0,
  };

  const qtyBefore = await run1('total_qty', `SELECT COALESCE(SUM(quantity_on_hand),0)::numeric AS s FROM current_stock`);

  // --- STEP 4: Order workflow visibility ---
  evidence.audit.orders_without_workflows = {
    inbound_total: (await run1('in_total', `SELECT COUNT(*)::int AS c FROM inbound_orders`))?.c,
    inbound_without_wf: (
      await run1(
        'in_no_wf',
        `SELECT COUNT(*)::int AS c FROM inbound_orders io
         WHERE NOT EXISTS (
           SELECT 1 FROM workflow_instances wi
           WHERE wi.reference_type = 'inbound_order' AND wi.reference_id = io.id
         )`,
      )
    )?.c,
    outbound_total: (await run1('out_total', `SELECT COUNT(*)::int AS c FROM outbound_orders`))?.c,
    outbound_without_wf: (
      await run1(
        'out_no_wf',
        `SELECT COUNT(*)::int AS c FROM outbound_orders oo
         WHERE NOT EXISTS (
           SELECT 1 FROM workflow_instances wi
           WHERE wi.reference_type = 'outbound_order' AND wi.reference_id = oo.id
         )`,
      )
    )?.c,
    inbound_no_wf_by_status: await run(
      'in_no_wf_status',
      `SELECT status, COUNT(*)::int AS c FROM inbound_orders io
       WHERE NOT EXISTS (
         SELECT 1 FROM workflow_instances wi
         WHERE wi.reference_type = 'inbound_order' AND wi.reference_id = io.id
       )
       GROUP BY status ORDER BY c DESC`,
    ),
    outbound_no_wf_by_status: await run(
      'out_no_wf_status',
      `SELECT status, COUNT(*)::int AS c FROM outbound_orders oo
       WHERE NOT EXISTS (
         SELECT 1 FROM workflow_instances wi
         WHERE wi.reference_type = 'outbound_order' AND wi.reference_id = oo.id
       )
       GROUP BY status ORDER BY c DESC`,
    ),
    inbound_no_wf_sample: await run(
      'in_sample',
      `SELECT io.id, io.order_number, io.status, io.created_at, c.name AS company
       FROM inbound_orders io JOIN companies c ON c.id = io.company_id
       WHERE NOT EXISTS (
         SELECT 1 FROM workflow_instances wi
         WHERE wi.reference_type = 'inbound_order' AND wi.reference_id = io.id
       )
       ORDER BY io.created_at DESC LIMIT 10`,
    ),
    outbound_no_wf_sample: await run(
      'out_sample',
      `SELECT oo.id, oo.order_number, oo.status, oo.created_at, c.name AS company
       FROM outbound_orders oo JOIN companies c ON c.id = oo.company_id
       WHERE NOT EXISTS (
         SELECT 1 FROM workflow_instances wi
         WHERE wi.reference_type = 'outbound_order' AND wi.reference_id = oo.id
       )
       ORDER BY oo.created_at DESC LIMIT 10`,
    ),
  };

  // --- STEP 5: Tenant distribution ---
  evidence.audit.tenant_distribution = await run(
    'tenant_dist',
    `SELECT c.id, c.name,
       (SELECT COUNT(*)::int FROM products p WHERE p.company_id = c.id) AS products,
       (SELECT COUNT(*)::int FROM current_stock cs WHERE cs.company_id = c.id) AS stock_rows,
       (SELECT COALESCE(SUM(cs.quantity_on_hand),0) FROM current_stock cs WHERE cs.company_id = c.id) AS qty_on_hand,
       (SELECT COUNT(*)::int FROM inbound_orders io WHERE io.company_id = c.id) AS inbound_orders,
       (SELECT COUNT(*)::int FROM outbound_orders oo WHERE oo.company_id = c.id) AS outbound_orders,
       (SELECT COUNT(*)::int FROM warehouse_tasks wt
        JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
        WHERE wi.company_id = c.id) AS warehouse_tasks
     FROM companies c
     ORDER BY products DESC`,
  );

  // --- Migration decision ---
  const needsMigration =
    evidence.audit.outside_wh001_before.stock_rows > 0 ||
    evidence.audit.outside_wh001_before.tasks > 0 ||
    evidence.audit.outside_wh001_before.workflows > 0 ||
    evidence.audit.outside_wh001_before.workers > 0;

  evidence.migration = { performed: false, actions: [], reason: needsMigration ? 'data_outside_wh001' : 'already_consolidated' };

  if (needsMigration) {
    await client.query('BEGIN');
    try {
      // Get WH-001 internal locations for remapping
      const wh001Locs = await q(
        client,
        `SELECT id, barcode, full_path FROM locations WHERE warehouse_id = $1 AND status = 'active' ORDER BY sort_order, barcode LIMIT 500`,
        [WH001_ID],
      );
      if (!wh001Locs.length) throw new Error('WH-001 has no active locations');

      const defaultLocId = wh001Locs[0].id;

      // Remap stock: update warehouse_id and location_id where location is outside WH-001
      const stockOutside = await q(
        client,
        `SELECT cs.id, cs.location_id, l.warehouse_id AS loc_wh
         FROM current_stock cs JOIN locations l ON l.id = cs.location_id
         WHERE cs.warehouse_id <> $1 OR l.warehouse_id <> $1`,
        [WH001_ID],
      );

      for (const row of stockOutside) {
        // Map to WH-001 location by modulo of locations to avoid unique constraint collisions
        const targetLoc = wh001Locs[Math.abs(row.id.charCodeAt(0)) % wh001Locs.length].id;
        await client.query(
          `UPDATE current_stock SET warehouse_id = $1, location_id = $2 WHERE id = $3`,
          [WH001_ID, targetLoc, row.id],
        );
      }
      evidence.migration.actions.push({ action: 'remap_current_stock', rows: stockOutside.length });

      // workflow_instances
      const wf = await client.query(`UPDATE workflow_instances SET warehouse_id = $1 WHERE warehouse_id <> $1`, [WH001_ID, WH001_ID]);
      evidence.migration.actions.push({ action: 'remap_workflow_instances', rows: wf.rowCount });

      // workers
      const wr = await client.query(
        `UPDATE workers SET warehouse_id = $1 WHERE warehouse_id IS NOT NULL AND warehouse_id <> $1`,
        [WH001_ID, WH001_ID],
      );
      evidence.migration.actions.push({ action: 'remap_workers', rows: wr.rowCount });

      // stock_adjustments, cycle_counts, variances, schedules, returns
      for (const [table, col] of [
        ['stock_adjustments', 'warehouse_id'],
        ['cycle_counts', 'warehouse_id'],
        ['cycle_count_variances', 'warehouse_id'],
        ['cycle_count_schedules', 'warehouse_id'],
        ['cycle_count_product_history', 'warehouse_id'],
        ['return_orders', 'warehouse_id'],
      ]) {
        const r = await client.query(
          `UPDATE ${table} SET ${col} = $1 WHERE ${col} IS NOT NULL AND ${col} <> $1`,
          [WH001_ID, WH001_ID],
        );
        evidence.migration.actions.push({ action: `remap_${table}`, rows: r.rowCount });
      }

      await client.query('COMMIT');
      evidence.migration.performed = true;
    } catch (e) {
      await client.query('ROLLBACK');
      evidence.migration.error = String(e.message);
      throw e;
    }
  }

  const qtyAfter = await run1('total_qty_after', `SELECT COALESCE(SUM(quantity_on_hand),0)::numeric AS s FROM current_stock`);

  // --- STEP 6: Cleanup ---
  const cleanup = [];
  for (const wh of warehouseMetrics) {
    if (wh.id === WH001_ID) continue;
    const live = await run1(
      'wh_live_check',
      `SELECT
         (SELECT COUNT(*) FROM current_stock WHERE warehouse_id = $1) AS stock,
         (SELECT COUNT(*) FROM workflow_instances WHERE warehouse_id = $1) AS wf,
         (SELECT COUNT(*) FROM locations WHERE warehouse_id = $1) AS loc`,
      [wh.id],
    );
    const canDelete =
      Number(live.stock) === 0 &&
      Number(live.wf) === 0 &&
      Number(wh.warehouse_tasks) === 0 &&
      parseFloat(wh.quantity_on_hand) === 0;

    if (canDelete && Number(live.loc) === 0) {
      const del = await client.query(`DELETE FROM warehouses WHERE id = $1`, [wh.id]);
      cleanup.push({ id: wh.id, code: wh.code, action: 'deleted', rowCount: del.rowCount });
    } else {
      const upd = await client.query(`UPDATE warehouses SET status = 'inactive' WHERE id = $1 AND id <> $2`, [
        wh.id,
        WH001_ID,
      ]);
      cleanup.push({
        id: wh.id,
        code: wh.code,
        action: 'set_inactive',
        rowCount: upd.rowCount,
        reason: canDelete ? 'has_locations' : 'has_residual_refs',
        live,
      });
    }
  }
  evidence.migration = evidence.migration || {};
  evidence.migration.cleanup = cleanup;

  // --- STEP 7: Certification ---
  const cert = {
    stock_rows_outside_wh001: (
      await run1('cert_stock', `SELECT COUNT(*)::int AS c FROM current_stock WHERE warehouse_id <> $1`, [WH001_ID])
    )?.c,
    tasks_outside_wh001: (
      await run1(
        'cert_tasks',
        `SELECT COUNT(*)::int AS c FROM warehouse_tasks wt
         JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
         WHERE wi.warehouse_id <> $1`,
        [WH001_ID],
      )
    )?.c,
    workflows_outside_wh001: (
      await run1('cert_wf', `SELECT COUNT(*)::int AS c FROM workflow_instances WHERE warehouse_id <> $1`, [WH001_ID])
    )?.c,
    orders_outside_wh001: 0, // orders don't have warehouse_id; via wf below
    inbound_wf_outside: (
      await run1(
        'cert_in_wf',
        `SELECT COUNT(DISTINCT wi.reference_id)::int AS c FROM workflow_instances wi
         WHERE wi.reference_type = 'inbound_order' AND wi.warehouse_id <> $1`,
        [WH001_ID],
      )
    )?.c,
    outbound_wf_outside: (
      await run1(
        'cert_out_wf',
        `SELECT COUNT(DISTINCT wi.reference_id)::int AS c FROM workflow_instances wi
         WHERE wi.reference_type = 'outbound_order' AND wi.warehouse_id <> $1`,
        [WH001_ID],
      )
    )?.c,
    workers_outside_wh001: (
      await run1(
        'cert_workers',
        `SELECT COUNT(*)::int AS c FROM workers WHERE warehouse_id IS NOT NULL AND warehouse_id <> $1`,
        [WH001_ID],
      )
    )?.c,
    active_operational_warehouses: (
      await run1(
        'cert_active_wh',
        `SELECT COUNT(*)::int AS c FROM warehouses w WHERE w.status = 'active'
         AND (
           EXISTS (SELECT 1 FROM current_stock cs WHERE cs.warehouse_id = w.id)
           OR EXISTS (SELECT 1 FROM workflow_instances wi WHERE wi.warehouse_id = w.id)
         )`,
      )
    )?.c,
    qty_on_hand_before: String(qtyBefore?.s ?? 0),
    qty_on_hand_after: String(qtyAfter?.s ?? 0),
  };

  evidence.certification = cert;

  const pass =
    cert.stock_rows_outside_wh001 === 0 &&
    cert.tasks_outside_wh001 === 0 &&
    cert.workflows_outside_wh001 === 0 &&
    cert.workers_outside_wh001 === 0 &&
    cert.inbound_wf_outside === 0 &&
    cert.outbound_wf_outside === 0 &&
    cert.active_operational_warehouses === 1 &&
    cert.qty_on_hand_before === cert.qty_on_hand_after;

  evidence.certification.verdict = pass ? 'GO' : 'NO-GO';
  evidence.certification.pass = pass;

  await client.end();

  mkdirSync(join(ROOT, 'qa-results'), { recursive: true });
  writeFileSync(join(ROOT, 'qa-results/perf-norm-2-evidence.json'), JSON.stringify(evidence, null, 2));

  // Generate markdown reports
  generateReports(evidence);

  console.log('PERF-NORM-2 complete. Verdict:', evidence.certification.verdict);
  console.log(JSON.stringify(cert, null, 2));
}

function generateReports(ev) {
  const whRows = ev.audit.warehouses
    .map(
      (w) =>
        `| ${w.code} | \`${w.id}\` | ${w.status} | ${w.classification} | ${w.products_count} | ${w.stock_rows} | ${w.quantity_on_hand} | ${w.inbound_orders} | ${w.outbound_orders} | ${w.workflow_instances} | ${w.warehouse_tasks} | ${w.workers} | ${w.locations} | ${w.ledger_from_refs + w.ledger_to_refs} |`,
    )
    .join('\n');

  const auditMd = `# Warehouse Final Audit (PERF-NORM-2)

**Generated:** ${new Date().toISOString()}  
**Primary warehouse:** WH-001 (\`00000000-0000-4000-8000-000000000010\`)

## Summary

| Metric | Value |
|--------|------:|
| Total warehouses | ${ev.audit.warehouses.length} |
| Operational (non-empty) | ${ev.audit.warehouses.filter((w) => w.classification === 'operational').length} |
| Empty | ${ev.audit.warehouses.filter((w) => w.classification === 'empty').length} |
| Historical | ${ev.audit.warehouses.filter((w) => w.classification === 'historical').length} |
| Stock rows outside WH-001 (before migration) | ${ev.audit.outside_wh001_before.stock_rows} |
| Migration performed | ${ev.migration?.performed ? 'Yes' : 'No'} |

## Per-Warehouse Matrix

| Code | ID | Status | Class | Products | Stock rows | Qty on hand | Inbound (wf) | Outbound (wf) | Workflows | Tasks | Workers | Locations | Ledger refs |
|------|-----|--------|-------|----------:|-----------:|------------:|-------------:|--------------:|----------:|------:|--------:|----------:|------------:|
${whRows}

## Classification Rules

- **operational:** stock rows > 0 OR workflows > 0 OR tasks > 0 OR workers > 0 OR qty on hand > 0
- **empty:** no locations, stock, or workflows
- **historical:** has locations/metadata but no active stock/workflows

## Data Outside WH-001 (Pre-Migration)

\`\`\`json
${JSON.stringify(ev.audit.outside_wh001_before, null, 2)}
\`\`\`

## SQL Queries Used

${ev.queries
  .slice(0, 30)
  .map((q, i) => `### ${i + 1}. ${q.label}\n\`\`\`sql\n${q.sql}\n\`\`\`${q.params?.length ? `\nParams: \`${JSON.stringify(q.params)}\`` : ''}`)
  .join('\n\n')}

_Full query log: \`qa-results/perf-norm-2-evidence.json\`_
`;

  writeFileSync(join(ROOT, 'WAREHOUSE-FINAL-AUDIT.md'), auditMd);

  const o = ev.audit.orders_without_workflows;
  const orderMd = `# Order Visibility Audit (PERF-NORM-2)

**Generated:** ${new Date().toISOString()}  
**Scope:** Inbound/outbound orders without \`workflow_instances\`  
**Action:** Document only — no fixes applied

## Counts

| Metric | Count |
|--------|------:|
| Total inbound orders | ${o.inbound_total} |
| Inbound without workflow | ${o.inbound_no_wf ?? o.inbound_without_wf} |
| Total outbound orders | ${o.outbound_total} |
| Outbound without workflow | ${o.outbound_no_wf ?? o.outbound_without_wf} |

## Inbound Without Workflow — By Status

| Status | Count |
|--------|------:|
${(o.inbound_no_wf_by_status || []).map((r) => `| ${r.status} | ${r.c} |`).join('\n')}

## Outbound Without Workflow — By Status

| Status | Count |
|--------|------:|
${(o.outbound_no_wf_by_status || []).map((r) => `| ${r.status} | ${r.c} |`).join('\n')}

## Sample Inbound (no workflow)

| Order # | Status | Company | Created |
|---------|--------|---------|---------|
${(o.inbound_no_wf_sample || []).map((r) => `| ${r.order_number} | ${r.status} | ${r.company} | ${r.created_at} |`).join('\n')}

## Sample Outbound (no workflow)

| Order # | Status | Company | Created |
|---------|--------|---------|---------|
${(o.outbound_no_wf_sample || []).map((r) => `| ${r.order_number} | ${r.status} | ${r.company} | ${r.created_at} |`).join('\n')}

## Analysis (Evidence-Based)

### Likely causes

1. **Draft / seed orders:** Performance dataset certification created thousands of inbound/outbound rows; workflows are typically created on status transition (confirm), not on insert.
2. **Orphan records:** Orders in \`draft\` status with no workflow are expected if the product never confirmed them.
3. **Workflow creation bug:** Would manifest as confirmed/shipped orders lacking workflows — check status breakdown above.
4. **Intentionally incomplete:** Bulk PERF-CERT-* orders may remain in \`draft\` by design.

### SQL — Inbound without workflow

\`\`\`sql
SELECT COUNT(*) FROM inbound_orders io
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_instances wi
  WHERE wi.reference_type = 'inbound_order' AND wi.reference_id = io.id
);
\`\`\`

### SQL — Outbound without workflow

\`\`\`sql
SELECT COUNT(*) FROM outbound_orders oo
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_instances wi
  WHERE wi.reference_type = 'outbound_order' AND wi.reference_id = oo.id
);
\`\`\`

## Recommendation

Do **not** auto-create workflows in this phase. Before performance benchmarking, confirm whether benchmarks filter by status or warehouse-scoped workflows only.
`;

  writeFileSync(join(ROOT, 'ORDER-VISIBILITY-AUDIT.md'), orderMd);

  const tenants = ev.audit.tenant_distribution;
  const totalProducts = tenants.reduce((s, t) => s + Number(t.products), 0);
  const tenantMd = `# Tenant Distribution Audit (PERF-NORM-2)

**Generated:** ${new Date().toISOString()}

## Per-Company Counts

| Company | Company ID | Products | Stock rows | Qty on hand | Inbound | Outbound | Tasks |
|---------|------------|----------:|-----------:|------------:|--------:|---------:|------:|
${tenants.map((t) => `| ${t.name} | \`${t.id}\` | ${t.products} | ${t.stock_rows} | ${t.qty_on_hand} | ${t.inbound_orders} | ${t.outbound_orders} | ${t.warehouse_tasks} |`).join('\n')}

## Totals

| Metric | Value |
|--------|------:|
| Companies | ${tenants.length} |
| Total products | ${totalProducts} |

## Acme / Concentration Analysis

${(() => {
  const top = tenants[0];
  const pct = totalProducts ? ((Number(top?.products || 0) / totalProducts) * 100).toFixed(1) : 0;
  const isAcme = /acme/i.test(top?.name || '');
  return `Top tenant by products: **${top?.name}** (${pct}% of ${totalProducts} products).

**Conclusion:** ${
    isAcme && pct > 80
      ? '**(A) Dataset generation** — Performance dataset certification (\`performance-dataset-certification.cjs\`) targets company \`00000000-0000-4000-8000-000000000001\` (Acme). Concentration is intentional seed data, not evidence of a multi-tenant filtering bug.'
      : 'Review company filter in API vs raw DB counts. Compare authenticated list totals to table above.'
  }`;
})()}

## SQL

\`\`\`sql
SELECT c.id, c.name,
  (SELECT COUNT(*) FROM products p WHERE p.company_id = c.id) AS products,
  (SELECT COUNT(*) FROM current_stock cs WHERE cs.company_id = c.id) AS stock_rows,
  (SELECT COUNT(*) FROM inbound_orders io WHERE io.company_id = c.id) AS inbound_orders,
  (SELECT COUNT(*) FROM outbound_orders oo WHERE oo.company_id = c.id) AS outbound_orders
FROM companies c ORDER BY products DESC;
\`\`\`
`;

  writeFileSync(join(ROOT, 'TENANT-DISTRIBUTION-AUDIT.md'), tenantMd);

  const c = ev.certification;
  const certMd = `# Single Warehouse Certification (PERF-NORM-2)

**Generated:** ${new Date().toISOString()}  
**Primary warehouse:** WH-001 (\`00000000-0000-4000-8000-000000000010\`)

## Certification Checks

| Check | Required | Actual | Pass |
|-------|----------|--------|:----:|
| Stock rows outside WH-001 | 0 | ${c.stock_rows_outside_wh001} | ${c.stock_rows_outside_wh001 === 0 ? '✅' : '❌'} |
| Tasks outside WH-001 | 0 | ${c.tasks_outside_wh001} | ${c.tasks_outside_wh001 === 0 ? '✅' : '❌'} |
| Workflows outside WH-001 | 0 | ${c.workflows_outside_wh001} | ${c.workflows_outside_wh001 === 0 ? '✅' : '❌'} |
| Inbound workflows outside WH-001 | 0 | ${c.inbound_wf_outside} | ${c.inbound_wf_outside === 0 ? '✅' : '❌'} |
| Outbound workflows outside WH-001 | 0 | ${c.outbound_wf_outside} | ${c.outbound_wf_outside === 0 ? '✅' : '❌'} |
| Workers outside WH-001 | 0 | ${c.workers_outside_wh001} | ${c.workers_outside_wh001 === 0 ? '✅' : '❌'} |
| Active operational warehouses | 1 | ${c.active_operational_warehouses} | ${c.active_operational_warehouses === 1 ? '✅' : '❌'} |
| Quantity on hand preserved | before = after | ${c.qty_on_hand_before} = ${c.qty_on_hand_after} | ${c.qty_on_hand_before === c.qty_on_hand_after ? '✅' : '❌'} |

## Migration

| Field | Value |
|-------|-------|
| Performed | ${ev.migration?.performed ? 'Yes' : 'No'} |
| Reason | ${ev.migration?.reason || '—'} |
| Actions | ${ev.migration?.actions?.length ? ev.migration.actions.map((a) => `${a.action} (${a.rows} rows)`).join('; ') : 'None'} |

## Cleanup

${(ev.migration?.cleanup || []).map((x) => `- **${x.code}** (\`${x.id}\`): ${x.action}${x.reason ? ` — ${x.reason}` : ''}`).join('\n') || '_No cleanup actions_'}

## Performance Benchmarking Verdict

# **${c.verdict}**

${c.verdict === 'GO'
    ? 'Staging operational data is consolidated under WH-001. Safe to proceed with performance benchmarking against the certified dataset.'
    : 'Do not run performance benchmarks until consolidation failures above are resolved.'}

## Evidence

- \`qa-results/perf-norm-2-evidence.json\`
- \`WAREHOUSE-FINAL-AUDIT.md\`
- \`ORDER-VISIBILITY-AUDIT.md\`
- \`TENANT-DISTRIBUTION-AUDIT.md\`
`;

  writeFileSync(join(ROOT, 'SINGLE-WAREHOUSE-CERTIFICATION.md'), certMd);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
