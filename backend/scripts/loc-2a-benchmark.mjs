#!/usr/bin/env node
/**
 * LOC-2A benchmark: hierarchical list vs legacy full scan patterns.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function loadEnv() {
  const env = {};
  for (const p of [resolve(root, 'backend/.env'), resolve(root, 'frontend/.env')]) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch {
      /* skip */
    }
  }
  return env;
}

const env = loadEnv();
const pg = (env.DATABASE_URL || '').split('?')[0];
const PGPASS = env.POSTGRES_ADMIN_PASSWORD || 'Xa9DypRDA4HksBMpqw2';

function psql(sql) {
  return execSync(`psql "${pg}" -t -A`, {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: PGPASS },
    input: sql,
  });
}

function timed(fn) {
  const t0 = performance.now();
  const result = fn();
  return { ms: Math.round((performance.now() - t0) * 100) / 100, result };
}

async function httpBench() {
  const base = (env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
  const email = env.PERF_LOGIN_EMAIL || 'admin@emdad.sy';
  const password = env.PERF_LOGIN_PASSWORD || 'Admin123!';

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) return { error: `login ${loginRes.status}` };
  const loginJson = await loginRes.json();
  const token = loginJson.data?.accessToken ?? loginJson.accessToken;

  const whRes = await fetch(`${base}/warehouses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const whJson = await whRes.json();
  const warehouses = whJson.data ?? whJson;
  const wh = warehouses.find((w) => w.code === 'WH-001') ?? warehouses[0];
  if (!wh) return { error: 'no warehouse' };

  const rootsRes = await fetch(
    `${base}/locations?warehouseId=${wh.id}&limit=50&offset=0`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const rootsJson = await rootsRes.json();
  const roots = rootsJson.data ?? rootsJson;
  const normZone = roots.items?.find((l) => l.name === 'NORM' || l.fullPath?.includes('/NORM'));
  const childrenRes = await fetch(
    `${base}/locations?warehouseId=${wh.id}&parentId=${normZone?.id ?? roots.items?.[0]?.id}&limit=50&offset=0`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const childrenJson = await childrenRes.json();
  const children = childrenJson.data ?? childrenJson;
  const aisleId = children.items?.find((l) => l.name?.includes('NORM-A'))?.id ?? children.items?.[0]?.id;

  async function call(label, url) {
    const t0 = performance.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const ms = Math.round(performance.now() - t0);
    const json = await res.json();
    const data = json.data ?? json;
    return { label, status: res.status, ms, total: data.total, items: data.items?.length ?? 0 };
  }

  const runs = [];
  for (const spec of [
    ['roots_page1', `${base}/locations?warehouseId=${wh.id}&limit=50&offset=0`],
    ['children_aisle_p1', `${base}/locations?warehouseId=${wh.id}&parentId=${aisleId}&limit=50&offset=0`],
    ['children_aisle_p100', `${base}/locations?warehouseId=${wh.id}&parentId=${aisleId}&limit=50&offset=4950`],
    ['children_search', `${base}/locations?warehouseId=${wh.id}&parentId=${aisleId}&search=BIN-00100&limit=50`],
    ['tree_deprecated', `${base}/locations/tree?warehouseId=${wh.id}`],
  ]) {
    runs.push(await call(...spec));
  }

  return { warehouseId: wh.id, aisleParentId: aisleId, runs };
}

function main() {
  const whId = psql("SELECT id FROM warehouses WHERE code='WH-001' LIMIT 1;").trim();
  const aisleId = psql(`
    SELECT id FROM locations
    WHERE warehouse_id='${whId}' AND name='Aisle NORM-A' LIMIT 1;
  `).trim();

  const sqlBench = [];

  const explainRoots = psql(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id FROM locations
    WHERE warehouse_id='${whId}' AND parent_id IS NULL AND status='active'
    ORDER BY sort_order ASC, name ASC
    LIMIT 50 OFFSET 0;
  `);

  const explainChildren = psql(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id FROM locations
    WHERE warehouse_id='${whId}' AND parent_id='${aisleId}' AND status='active'
    ORDER BY sort_order ASC, name ASC
    LIMIT 50 OFFSET 0;
  `);

  const explainCount = psql(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT COUNT(*)::int FROM locations
    WHERE warehouse_id='${whId}' AND parent_id='${aisleId}' AND status='active';
  `);

  const legacyFull = timed(() =>
    psql(`
      SELECT COUNT(*) FROM locations WHERE warehouse_id='${whId}';
    `).trim(),
  );

  sqlBench.push(
    { name: 'legacy_full_count_wh', ms: legacyFull.ms, rows: legacyFull.result },
    { name: 'roots_explain', plan: explainRoots.trim() },
    { name: 'children_explain', plan: explainChildren.trim() },
    { name: 'children_count_explain', plan: explainCount.trim() },
  );

  return { whId, aisleId, sqlBench };
}

const sql = main();
httpBench()
  .then((http) => {
    const out = { generatedAt: new Date().toISOString(), sql, http };
    const path = resolve(root, 'qa-results/LOC-2A-benchmark.json');
    writeFileSync(path, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
