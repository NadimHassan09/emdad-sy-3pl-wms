#!/usr/bin/env node
/**
 * REPORTS-PERF — Before/after benchmark for server-side reports refactor.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/reports-perf');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json();
  return json.data.access_token;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { status: res.status, bytes: Buffer.byteLength(text, 'utf8'), json: JSON.parse(text) };
}

async function bench(label, url, headers) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const { status, bytes, json } = await fetchJson(url, headers);
    samples.push({
      status,
      bytes,
      ms: Math.round(performance.now() - t0),
      itemCount: json?.data?.items?.length ?? null,
      total: json?.data?.total ?? null,
    });
  }
  const avgMs = Math.round(samples.reduce((s, r) => s + r.ms, 0) / samples.length);
  const avgBytes = Math.round(samples.reduce((s, r) => s + r.bytes, 0) / samples.length);
  return { label, url, samples, avgMs, avgBytes };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const token = await login();
  const headers = { Authorization: `Bearer ${token}`, 'X-Company-Id': COMPANY_ID };

  const warehouses = await fetchJson(`${API}/warehouses`, headers);
  const warehouseId = warehouses.json?.data?.[0]?.id;
  if (!warehouseId) throw new Error('No warehouse found');

  const qs = (params) =>
    '?' +
    new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')),
    ).toString();

  const benchmarks = [];

  // Inventory — before: bulk stock fetch (client runner pattern)
  benchmarks.push(
    await bench(
      'BEFORE inventory stock limit=500',
      `${API}/inventory/stock${qs({ warehouseId, limit: 500, offset: 0 })}`,
      headers,
    ),
  );

  // Inventory — after: server report page
  benchmarks.push(
    await bench(
      'AFTER reports/inventory/run limit=50',
      `${API}/reports/inventory/run${qs({ warehouseId, limit: 50, offset: 0 })}`,
      headers,
    ),
  );

  // Product moves — before: bulk ledger
  benchmarks.push(
    await bench(
      'BEFORE ledger limit=500',
      `${API}/inventory/ledger${qs({ warehouseId, limit: 500, offset: 0 })}`,
      headers,
    ),
  );

  // Product moves — after: server report page
  benchmarks.push(
    await bench(
      'AFTER reports/product-moves/run limit=50',
      `${API}/reports/product-moves/run${qs({ warehouseId, limit: 50, offset: 0 })}`,
      headers,
    ),
  );

  // Export endpoints
  benchmarks.push(
    await bench(
      'AFTER reports/inventory/export csv',
      `${API}/reports/inventory/export${qs({ warehouseId, format: 'csv' })}`,
      headers,
    ),
  );

  const summary = benchmarks.map((b) => ({
    label: b.label,
    avgMs: b.avgMs,
    avgBytes: b.avgBytes,
    avgKb: +(b.avgBytes / 1024).toFixed(1),
    itemCount: b.samples[0]?.itemCount,
    total: b.samples[0]?.total,
  }));

  const invBefore = summary.find((s) => s.label.startsWith('BEFORE inventory'));
  const invAfter = summary.find((s) => s.label.startsWith('AFTER reports/inventory/run'));
  const movesBefore = summary.find((s) => s.label.startsWith('BEFORE ledger'));
  const movesAfter = summary.find((s) => s.label.startsWith('AFTER reports/product-moves'));

  const analysis = {
    inventory: {
      payloadReductionPct: invBefore && invAfter
        ? Math.round((1 - invAfter.avgBytes / invBefore.avgBytes) * 100)
        : null,
      latencyReductionPct: invBefore && invAfter
        ? Math.round((1 - invAfter.avgMs / invBefore.avgMs) * 100)
        : null,
    },
    productMoves: {
      payloadReductionPct: movesBefore && movesAfter
        ? Math.round((1 - movesAfter.avgBytes / movesBefore.avgBytes) * 100)
        : null,
      latencyReductionPct: movesBefore && movesAfter
        ? Math.round((1 - movesAfter.avgMs / movesBefore.avgMs) * 100)
        : null,
    },
    memoryNote:
      'Browser memory no longer holds full 500-row datasets; preview holds one server page (50 rows max).',
  };

  const output = {
    generatedAt: new Date().toISOString(),
    warehouseId,
    benchmarks,
    summary,
    analysis,
  };

  writeFileSync(path.join(OUT, 'benchmark-results.json'), JSON.stringify(output, null, 2));
  writeFileSync(
    path.join(OUT, 'benchmark-summary.txt'),
    [
      `REPORTS-PERF benchmark ${output.generatedAt}`,
      '',
      ...summary.map(
        (s) =>
          `${s.label}: ${s.avgMs}ms avg, ${s.avgKb} KB avg, items=${s.itemCount ?? 'n/a'}, total=${s.total ?? 'n/a'}`,
      ),
      '',
      `Inventory payload reduction: ${analysis.inventory.payloadReductionPct}%`,
      `Inventory latency change: ${analysis.inventory.latencyReductionPct}%`,
      `Product-moves payload reduction: ${analysis.productMoves.payloadReductionPct}%`,
      `Product-moves latency change: ${analysis.productMoves.latencyReductionPct}%`,
    ].join('\n'),
  );

  console.log(JSON.stringify({ summary, analysis }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
