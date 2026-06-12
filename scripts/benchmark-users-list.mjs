#!/usr/bin/env node
/**
 * Users list pagination benchmark.
 *
 * Usage: node scripts/benchmark-users-list.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outFile = resolve(root, 'docs/perf/users-list-benchmark.json');

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
const email = env.PERF_LOGIN_EMAIL || env.PERF_USER || 'superadmin@emdad.example';
const password = env.PERF_LOGIN_PASSWORD || env.PERF_PASSWORD || 'demo123';
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
  const headers = { Authorization: `Bearer ${token}` };
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

const scenarios = [
  { label: 'before_unpaginated_all', params: {} },
  { label: 'after_system_page_20', params: { kind: 'system', limit: 20, offset: 0 } },
  { label: 'after_client_page_20', params: { kind: 'client', limit: 20, offset: 0 } },
  { label: 'after_search_page_20', params: { kind: 'all', search: 'admin', limit: 20, offset: 0 } },
];

async function main() {
  console.log(`Benchmarking GET /users at ${base}`);
  const token = await login();
  const results = [];
  for (const s of scenarios) {
    process.stdout.write(`  ${s.label}… `);
    try {
      const row = await bench('/users', s.params, token);
      results.push({ ...s, ...row, ok: true });
      console.log(`${row.payloadKB} KB, ${row.avgMs} ms, ${row.itemCount}/${row.total} items`);
    } catch (e) {
      results.push({ ...s, ok: false, error: String(e.message ?? e) });
      console.log(`FAILED: ${e.message ?? e}`);
    }
  }

  const legacy = results.find((r) => r.label === 'before_unpaginated_all' && r.ok);
  const optimized = results.find((r) => r.label === 'after_system_page_20' && r.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    apiBase: base,
    samples,
    legacyKB: legacy?.payloadKB ?? null,
    optimized20KB: optimized?.payloadKB ?? null,
    payloadReductionPct:
      legacy?.payloadKB && optimized?.payloadKB
        ? Math.round((1 - optimized.payloadKB / legacy.payloadKB) * 1000) / 10
        : null,
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
