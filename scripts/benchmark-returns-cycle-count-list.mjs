#!/usr/bin/env node
/**
 * Returns & Cycle Count list pagination benchmark.
 *
 * Usage: node scripts/benchmark-returns-cycle-count-list.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outFile = resolve(root, 'docs/perf/returns-cycle-count-benchmark.json');

function loadEnv() {
  const paths = [resolve(root, 'frontend/.env'), resolve(root, 'backend/.env')];
  const env = {};
  for (const p of paths) {
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

const env = { ...process.env, ...loadEnv() };
const base =
  env.API_BASE_URL?.replace(/\/$/, '') ||
  env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:3001/api';
const companyId = env.VITE_MOCK_COMPANY_ID || env.MOCK_COMPANY_ID || '00000000-0000-4000-8000-000000000001';
const email = env.PERF_LOGIN_EMAIL || env.PERF_USER || 'superadmin@emdad.example';
const password = env.PERF_LOGIN_PASSWORD || env.PERF_PASSWORD || 'demo123';
const warehouseId = env.PERF_WAREHOUSE_ID;
const samples = Number(env.PERF_SAMPLES ?? 3);

async function login() {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const json = await res.json();
  return json.data?.access_token ?? json.data?.accessToken;
}

async function bench(path, params, token) {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { Authorization: `Bearer ${token}`, 'X-Company-Id': companyId };
  const times = [];
  let payloadBytes = 0;
  let itemCount = 0;
  let total = 0;

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const res = await fetch(url, { headers });
    const text = await res.text();
    times.push(performance.now() - start);
    if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 200)}`);
    const json = JSON.parse(text);
    const data = json.data ?? json;
    payloadBytes = text.length;
    itemCount = data.items?.length ?? (Array.isArray(data) ? data.length : 0);
    total = data.total ?? itemCount;
  }

  times.sort((a, b) => a - b);
  const avgMs = Math.round((times.reduce((s, t) => s + t, 0) / times.length) * 10) / 10;
  return {
    params,
    avgMs,
    payloadKB: Math.round((payloadBytes / 1024) * 10) / 10,
    itemCount,
    total,
    under100KB: payloadBytes < 100 * 1024,
  };
}

async function resolveWarehouse(token) {
  if (warehouseId) return warehouseId;
  const res = await fetch(`${base}/warehouses`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Company-Id': companyId },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const items = json.data?.items ?? json.data ?? json.items ?? [];
  return items[0]?.id ?? null;
}

const scenarios = [
  { label: 'returns_legacy_200', path: '/return-orders', params: { limit: 200, offset: 0, companyId } },
  { label: 'returns_page_25', path: '/return-orders', params: { limit: 25, offset: 0, companyId } },
  { label: 'cycle_counts_legacy_200', path: '/cycle-count/counts', params: { limit: 200, offset: 0, companyId } },
  { label: 'cycle_counts_page_25', path: '/cycle-count/counts', params: { limit: 25, offset: 0, companyId } },
  { label: 'cycle_history_legacy_500', path: '/cycle-count/product-history', params: { limit: 500, offset: 0, companyId } },
  { label: 'cycle_history_page_25', path: '/cycle-count/product-history', params: { limit: 25, offset: 0, companyId } },
];

async function main() {
  console.log(`Benchmarking Returns & Cycle Count at ${base}`);
  const token = await login();
  const wh = await resolveWarehouse(token);
  if (!wh) console.warn('No warehouse id — cycle-count scenarios may fail');
  else {
    for (const s of scenarios) {
      if (s.path.includes('cycle-count')) s.params.warehouseId = wh;
    }
  }

  const results = [];
  for (const s of scenarios) {
    process.stdout.write(`  ${s.label}… `);
    try {
      const row = await bench(s.path, s.params, token);
      results.push({ ...s, ...row, ok: true });
      console.log(`${row.payloadKB} KB, ${row.avgMs} ms, ${row.itemCount} items`);
    } catch (e) {
      results.push({ ...s, ok: false, error: String(e.message ?? e) });
      console.log(`FAILED: ${e.message ?? e}`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    apiBase: base,
    warehouseId: wh,
    samples,
    scenarios: results,
  };
  mkdirSync(resolve(root, 'docs/perf'), { recursive: true });
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
