#!/usr/bin/env node
/**
 * Warehouse task list performance benchmark — before (500-row full) vs after (lean paginated).
 *
 * Usage:
 *   node scripts/benchmark-tasks-list.mjs
 *
 * Env: VITE_API_BASE_URL, PERF_LOGIN_EMAIL, PERF_LOGIN_PASSWORD, VITE_MOCK_COMPANY_ID
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'docs/perf');
const outFile = resolve(outDir, 'tasks-list-benchmark.json');

function loadEnv() {
  const paths = [resolve(root, 'frontend/.env'), resolve(root, 'backend/.env')];
  const env = {};
  for (const p of paths) {
    try {
      const text = readFileSync(p, 'utf8');
      for (const line of text.split('\n')) {
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
  env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  env.API_BASE_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:3000/api';
const companyId = env.VITE_MOCK_COMPANY_ID || env.MOCK_COMPANY_ID;
const email = env.PERF_LOGIN_EMAIL || env.ADMIN_EMAIL || 'admin@emdad.sy';
const password = env.PERF_LOGIN_PASSWORD || env.ADMIN_PASSWORD || 'Admin123!';
const samples = Number(env.PERF_SAMPLES ?? 3);

async function login() {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const json = await res.json();
  return json.data?.access_token ?? json.data?.accessToken ?? json.accessToken;
}

async function fetchTasks(token, params) {
  const url = new URL(`${base}/tasks`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { Authorization: `Bearer ${token}` };
  if (companyId) headers['X-Company-Id'] = companyId;

  const times = [];
  let lastBytes = 0;
  let lastItems = 0;
  let lastTotal = 0;

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const res = await fetch(url, { headers });
    const text = await res.text();
    times.push(performance.now() - start);
    if (!res.ok) throw new Error(`GET /tasks ${res.status}: ${text.slice(0, 200)}`);
    const json = JSON.parse(text);
    const data = json.data ?? json;
    lastBytes = text.length;
    lastItems = data.items?.length ?? 0;
    lastTotal = data.total ?? 0;
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  return {
    params,
    samples: times.length,
    avgMs: Math.round(avg * 10) / 10,
    p50Ms: Math.round(times[Math.floor(times.length / 2)] * 10) / 10,
    payloadBytes: lastBytes,
    payloadKB: Math.round((lastBytes / 1024) * 10) / 10,
    itemCount: lastItems,
    total: lastTotal,
    under100KB: lastBytes < 100 * 1024,
  };
}

const scenarios = [
  {
    label: 'before_legacy_500_full',
    description: 'Legacy UI: limit=500, full rows (no includeRunnability flag — simulates heavy list)',
    params: { limit: 500, offset: 0 },
  },
  {
    label: 'after_page_25_lean',
    description: 'Optimized UI: limit=25, lean summary rows (default)',
    params: { limit: 25, offset: 0 },
  },
  {
    label: 'after_page_50_lean',
    description: 'Optimized UI: limit=50, lean summary rows',
    params: { limit: 50, offset: 0 },
  },
  {
    label: 'after_page_25_with_runnability',
    description: 'Report mode: limit=25 with includeRunnability=true',
    params: { limit: 25, offset: 0, includeRunnability: 'true' },
  },
  {
    label: 'after_filtered_status',
    description: 'Filtered list: status=in_progress, limit=25',
    params: { limit: 25, offset: 0, status: 'in_progress' },
  },
];

async function main() {
  console.log(`Benchmarking GET /tasks at ${base}`);
  const token = await login();
  const results = [];
  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.label}… `);
    try {
      const row = await fetchTasks(token, scenario.params);
      results.push({ ...scenario, ...row, ok: true });
      console.log(`${row.payloadKB} KB, ${row.avgMs} ms avg`);
    } catch (e) {
      results.push({ ...scenario, ok: false, error: String(e.message ?? e) });
      console.log(`FAILED: ${e.message ?? e}`);
    }
  }

  const legacy = results.find((r) => r.label === 'before_legacy_500_full' && r.ok);
  const optimized = results.find((r) => r.label === 'after_page_25_lean' && r.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    apiBase: base,
    samples,
    legacy500KB: legacy?.payloadKB ?? null,
    optimized25KB: optimized?.payloadKB ?? null,
    payloadReductionPct:
      legacy?.payloadBytes && optimized?.payloadBytes
        ? Math.round((1 - optimized.payloadBytes / legacy.payloadBytes) * 1000) / 10
        : null,
    initialLoadUnder100KB: optimized?.under100KB ?? null,
    scenarios: results,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outFile}`);
  if (optimized) {
    console.log(
      `Initial page payload: ${optimized.payloadKB} KB (${optimized.under100KB ? 'under' : 'over'} 100 KB target)`,
    );
  }
  if (legacy && optimized) {
    console.log(
      `Payload reduction vs 500-row load: ${summary.payloadReductionPct}% (${legacy.payloadKB} KB → ${optimized.payloadKB} KB)`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
