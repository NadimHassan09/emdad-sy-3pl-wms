#!/usr/bin/env node
/**
 * PERF-P2B — ledger endpoint certification (30 samples + EXPLAIN ANALYZE).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/perf-p2b');
const BASE = process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001';
const API = `${BASE.replace(/\/$/, '')}/api`;
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const WAREHOUSE_ID = process.env.PERF_WAREHOUSE_ID ?? '00000000-0000-4000-8000-000000000010';
const EMAIL = process.env.PERF_USER ?? 'superadmin@emdad.example';
const PASSWORD = process.env.PERF_PASSWORD ?? 'demo123';
const SAMPLES = Number(process.env.PERF_SAMPLES ?? 30);

const PATHS = [
  { id: 'audit_limit_100', path: '/inventory/ledger?limit=100&offset=0', targetP95Ms: 200 },
  {
    id: 'warehouse_limit_100',
    path: `/inventory/ledger?limit=100&offset=0&warehouseId=${WAREHOUSE_ID}`,
    targetP95Ms: 300,
  },
  {
    id: 'warehouse_limit_500',
    path: `/inventory/ledger?limit=500&offset=0&warehouseId=${WAREHOUSE_ID}`,
    targetP95Ms: 300,
  },
];

const P2B_BASELINE = {
  audit_limit_100: { p95Ms: 589.3, bytes: 108837, note: 'PERF-P2B-REPORT §4.1 pre-implementation' },
  warehouse_limit_500: { p95Ms: 1298.9, bytes: 524766, note: 'PERF-P2B-REPORT §4.2 UI path limit=500' },
};

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function pgConn() {
  const envText = readFileSync(path.join(ROOT, 'backend/.env'), 'utf8');
  const m = envText.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL missing');
  const u = new URL(m[1].trim());
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function runExplain(label, sql) {
  const c = pgConn();
  const sqlFile = path.join(OUT, `explain-${label}.sql`);
  writeFileSync(sqlFile, `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)\n${sql.trim()}\n`);
  try {
    const out = execSync(
      `psql -h ${c.host} -p ${c.port} -U ${c.user} -d ${c.database} -f ${JSON.stringify(sqlFile)}`,
      { encoding: 'utf8', env: { ...process.env, PGPASSWORD: c.password } },
    );
    writeFileSync(path.join(OUT, `explain-${label}.txt`), out);
    return out;
  } catch (err) {
    const text = String(err.stdout ?? err.message);
    writeFileSync(path.join(OUT, `explain-${label}.txt`), text);
    return text;
  }
}

async function benchScenario(scenario, token) {
  const times = [];
  let status = 0;
  let bytes = 0;
  let total = 0;
  let items = 0;
  const url = `${API}${scenario.path}`;

  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Company-Id': COMPANY_ID,
      },
    });
    const buf = await res.arrayBuffer();
    times.push(performance.now() - start);
    status = res.status;
    bytes = buf.byteLength;
    if (res.ok) {
      const body = JSON.parse(Buffer.from(buf).toString());
      const data = body.data ?? body;
      total = data.total ?? 0;
      items = data.items?.length ?? 0;
    }
    if (i < SAMPLES - 1) await new Promise((r) => setTimeout(r, 25));
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const baseline = P2B_BASELINE[scenario.id];
  const payloadReductionPct =
    baseline?.bytes && bytes
      ? Math.round((1 - bytes / baseline.bytes) * 1000) / 10
      : null;

  return {
    id: scenario.id,
    path: scenario.path,
    samples: SAMPLES,
    status,
    total,
    items,
    bytes,
    avgMs: Math.round(avg * 10) / 10,
    p50Ms: Math.round(percentile(times, 50) * 10) / 10,
    p95Ms: Math.round(percentile(times, 95) * 10) / 10,
    p99Ms: Math.round(percentile(times, 99) * 10) / 10,
    minMs: Math.round(times[0] * 10) / 10,
    maxMs: Math.round(times[times.length - 1] * 10) / 10,
    targetP95Ms: scenario.targetP95Ms,
    p95Pass: percentile(times, 95) < scenario.targetP95Ms,
    baselineP95Ms: baseline?.p95Ms ?? null,
    baselineBytes: baseline?.bytes ?? null,
    payloadReductionPct,
    p95ImprovementPct: baseline?.p95Ms
      ? Math.round((1 - percentile(times, 95) / baseline.p95Ms) * 1000) / 10
      : null,
  };
}

mkdirSync(OUT, { recursive: true });

const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const loginBody = await loginRes.json();
if (!loginBody.success) {
  console.error('Login failed', loginBody);
  process.exit(1);
}
const token = loginBody.data.access_token;

const results = [];
for (let i = 0; i < PATHS.length; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, 2000));
  const result = await benchScenario(PATHS[i], token);
  results.push(result);
  console.log(JSON.stringify(result));
}

const groupCountSql = `
SELECT COUNT(*)::int AS total
  FROM (
    SELECT CASE
      WHEN il.idempotency_key IS NOT NULL
           AND split_part(il.idempotency_key, ':', 1) = 'bm'
           AND cardinality(string_to_array(il.idempotency_key, ':')) >= 4
      THEN split_part(il.idempotency_key, ':', 1) || ':' ||
           split_part(il.idempotency_key, ':', 2) || ':' ||
           split_part(il.idempotency_key, ':', 3) || ':' ||
           split_part(il.idempotency_key, ':', 4)
      ELSE il.reference_type::text || ':' || il.reference_id::text || ':' ||
           il.product_id::text || ':' ||
           CASE il.movement_type
             WHEN 'inbound_receive' THEN 'inbound'
             WHEN 'outbound_pick' THEN 'outbound'
             ELSE 'adjustment'
           END || ':' || il.id::text
    END AS group_key
    FROM inventory_ledger il
    WHERE il.company_id = '${COMPANY_ID}'::uuid
      AND il.movement_type IN (
        'inbound_receive'::movement_type,
        'outbound_pick'::movement_type,
        'adjustment_positive'::movement_type,
        'adjustment_negative'::movement_type
      )
    GROUP BY 1
  ) g`;

const pageSql = `
WITH filtered AS (
  SELECT il.id, il.created_at,
    CASE
      WHEN il.idempotency_key IS NOT NULL
           AND split_part(il.idempotency_key, ':', 1) = 'bm'
           AND cardinality(string_to_array(il.idempotency_key, ':')) >= 4
      THEN split_part(il.idempotency_key, ':', 1) || ':' ||
           split_part(il.idempotency_key, ':', 2) || ':' ||
           split_part(il.idempotency_key, ':', 3) || ':' ||
           split_part(il.idempotency_key, ':', 4)
      ELSE il.reference_type::text || ':' || il.reference_id::text || ':' ||
           il.product_id::text || ':' ||
           CASE il.movement_type
             WHEN 'inbound_receive' THEN 'inbound'
             WHEN 'outbound_pick' THEN 'outbound'
             ELSE 'adjustment'
           END || ':' || il.id::text
    END AS group_key
  FROM inventory_ledger il
  WHERE il.company_id = '${COMPANY_ID}'::uuid
    AND il.movement_type IN (
      'inbound_receive'::movement_type,
      'outbound_pick'::movement_type,
      'adjustment_positive'::movement_type,
      'adjustment_negative'::movement_type
    )
    AND (
      il.from_location_id IN (
        SELECT id FROM locations
         WHERE warehouse_id = '${WAREHOUSE_ID}'::uuid AND status = 'active'
      )
      OR il.to_location_id IN (
        SELECT id FROM locations
         WHERE warehouse_id = '${WAREHOUSE_ID}'::uuid AND status = 'active'
      )
    )
),
groups AS (
  SELECT group_key, MIN(created_at) AS created_at
    FROM filtered
   GROUP BY group_key
)
SELECT * FROM groups ORDER BY created_at DESC LIMIT 100`;

runExplain('group-count', groupCountSql);
runExplain('warehouse-page-limit-100', pageSql);

const summary = {
  generatedAt: new Date().toISOString(),
  samples: SAMPLES,
  companyId: COMPANY_ID,
  warehouseId: WAREHOUSE_ID,
  results,
  allP95Pass: results.every((r) => r.p95Pass),
  implementationNotes: [
    'productTotalAfterAt N+1 removed (PERF-P2C-A)',
    'SQL grouping/sort/pagination (PERF-P2C-B)',
    'Warehouse subquery filter (PERF-P2C-B + P2B)',
    'Business-group COUNT for total (PERF-P2B Phase 2)',
    'Ledger perf indexes migration 20260609160000',
    'ledgerEntry sibling fetch uses warehouse subquery (PERF-P2B P1-1)',
  ],
};

writeFileSync(path.join(OUT, 'benchmark-results.json'), JSON.stringify(summary, null, 2));
writeFileSync(
  path.join(OUT, 'benchmark-summary.txt'),
  [
    `PERF-P2B Implementation Benchmark ${summary.generatedAt}`,
    `Samples per scenario: ${SAMPLES}`,
    '',
    ...results.map(
      (r) =>
        `${r.p95Pass ? 'PASS' : 'FAIL'} ${r.id}: p95=${r.p95Ms}ms (target<${r.targetP95Ms}) baseline=${r.baselineP95Ms ?? 'n/a'}ms payload=${r.bytes}B reduction=${r.payloadReductionPct ?? 'n/a'}%`,
    ),
  ].join('\n'),
);

console.log(JSON.stringify({ allP95Pass: summary.allP95Pass, out: OUT }));
