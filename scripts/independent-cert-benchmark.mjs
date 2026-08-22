#!/usr/bin/env node
/**
 * PHASE-CLOSE-3 — Independent production benchmark (fresh, no prior cert trust).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/independent-cert');
const API = 'https://admin.emdadsy.com/api';
const CLIENT_API = 'https://client.emdadsy.com/api/client';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const WAREHOUSE_ID = '00000000-0000-4000-8000-000000000010';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';
const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 15);

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    avg: Math.round(sum / sorted.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: Math.round(pct(sorted, 95)),
    p99: Math.round(pct(sorted, 99)),
  };
}

async function login(base, email) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  return { token: data?.data?.access_token ?? null, status: res.status };
}

async function bench(label, url, headers, samples = SAMPLES) {
  const times = [];
  let lastStatus = 0;
  let payloadBytes = 0;
  let lastError = null;
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers });
      lastStatus = res.status;
      const buf = await res.arrayBuffer();
      payloadBytes = buf.byteLength;
      times.push(performance.now() - t0);
    } catch (e) {
      lastError = String(e);
      times.push(performance.now() - t0);
    }
  }
  return {
    label,
    url,
    status: lastStatus,
    payloadBytes,
    error: lastError,
    ...stats(times),
  };
}

async function securityCheck(label, url, headers, expectStatus) {
  const res = await fetch(url, { headers });
  const body = await res.text();
  const pass = Array.isArray(expectStatus) ? expectStatus.includes(res.status) : res.status === expectStatus;
  return { label, url, status: res.status, pass, bodyLen: body.length };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const startedAt = new Date().toISOString();

  const adminLogin = await login(API, 'superadmin@emdad.example');
  const clientLogin = await login(CLIENT_API, 'client@acme.example');
  const operatorLogin = await login(API, 'testworker@example.com');

  if (!adminLogin.token) throw new Error('Admin login failed');
  const auth = { Authorization: `Bearer ${adminLogin.token}`, 'X-Company-Id': COMPANY_ID };
  const clientAuth = clientLogin.token ? { Authorization: `Bearer ${clientLogin.token}` } : {};
  const opAuth = operatorLogin.token ? { Authorization: `Bearer ${operatorLogin.token}`, 'X-Company-Id': COMPANY_ID } : {};

  const endpoints = [
    // Auth & dashboard
    ['auth/me', `${API}/auth/me`, auth],
    ['dashboard/overview', `${API}/dashboard/overview`, auth],
    // Core modules
    ['products/list', `${API}/products?limit=25&offset=0`, auth],
    ['locations/list', `${API}/locations?warehouseId=${WAREHOUSE_ID}&limit=25`, auth],
    ['warehouses/list', `${API}/warehouses?limit=25`, auth],
    ['inventory/stock', `${API}/inventory/stock?limit=25&offset=0`, auth],
    ['inventory/ledger', `${API}/inventory/ledger?limit=25&offset=0`, auth],
    ['inbound/list', `${API}/inbound-orders?limit=25&offset=0`, auth],
    ['outbound/list', `${API}/outbound-orders?limit=25&offset=0`, auth],
    ['returns/list', `${API}/return-orders?limit=25&offset=0`, auth],
    ['tasks/list', `${API}/tasks?limit=25&offset=0`, auth],
    ['cycle-count/counts', `${API}/cycle-count/counts?limit=25&offset=0`, auth],
    ['adjustments/list', `${API}/adjustments?limit=25&offset=0`, auth],
    ['companies/list', `${API}/companies?limit=25`, auth],
    ['users/list', `${API}/users?limit=25&kind=system`, auth],
    // Reports
    ['reports/policy', `${API}/reports/policy`, auth],
    ['reports/inventory/run', `${API}/reports/inventory/run?limit=25&offset=0&warehouseId=${WAREHOUSE_ID}&companyId=${COMPANY_ID}`, auth],
    ['reports/warehouse-analysis/run', `${API}/reports/warehouse-analysis/run?limit=25&offset=0&warehouseId=${WAREHOUSE_ID}&companyId=${COMPANY_ID}`, auth],
    // Billing
    ['billing/summary', `${API}/billing/dashboard/summary`, auth],
    ['billing/invoices', `${API}/billing/invoices?limit=25&offset=0`, auth],
    ['billing/plans', `${API}/billing/plans?limit=25`, auth],
    // Backup
    ['backups/health', `${API}/backups/health`, auth],
    ['backups/list', `${API}/backups?limit=25&offset=0`, auth],
    ['backups/schedules', `${API}/backups/schedules`, auth],
    ['backups/retention/policies', `${API}/backups/retention/policies`, auth],
    // Audit & notifications
    ['audit-logs/list', `${API}/audit-logs?limit=25&offset=0`, auth],
    ['notifications/list', `${API}/notifications?limit=25&offset=0`, auth],
    // Observability
    ['ops/health/live', `${API}/ops/health/live`, {}],
    ['ops/health/ready', `${API}/ops/health/ready`, {}],
    // Client portal
    ['client/dashboard', `${CLIENT_API}/dashboard/overview`, clientAuth],
    ['client/products', `${CLIENT_API}/products?limit=25&offset=0`, clientAuth],
    ['client/stock', `${CLIENT_API}/stock?limit=25&offset=0`, clientAuth],
    ['client/inbound', `${CLIENT_API}/inbound-orders?limit=25&offset=0`, clientAuth],
    ['client/outbound', `${CLIENT_API}/outbound-orders?limit=25&offset=0`, clientAuth],
    ['client/billing', `${CLIENT_API}/billing/summary`, clientAuth],
    ['client/notifications', `${CLIENT_API}/notifications?limit=25&offset=0`, clientAuth],
  ];

  const benchmarks = [];
  for (const [label, url, headers] of endpoints) {
    benchmarks.push(await bench(label, url, headers));
  }

  const security = [];
  security.push(await securityCheck('no-auth-products', `${API}/products?limit=1`, {}, 401));
  security.push(await securityCheck('no-auth-backups', `${API}/backups/health`, {}, 401));
  security.push(await securityCheck('client-on-admin', `${API}/products?limit=1`, clientAuth, [401, 403]));
  if (opAuth.Authorization) {
    security.push(await securityCheck('operator-backups-deny', `${API}/backups/health`, opAuth, 403));
    security.push(await securityCheck('operator-audit-deny', `${API}/audit-logs?limit=1`, opAuth, 403));
    security.push(await securityCheck('operator-reports-deny', `${API}/reports/policy`, opAuth, 403));
    security.push(await securityCheck('operator-tasks-allow', `${API}/tasks?limit=1`, opAuth, 200));
    security.push(await securityCheck('operator-billing-read', `${API}/billing/dashboard/summary`, opAuth, 200));
  }
  security.push(
    await securityCheck(
      'tenant-spoof-company',
      `${API}/inbound-orders?limit=5`,
      { Authorization: `Bearer ${adminLogin.token}`, 'X-Company-Id': '00000000-0000-4000-8000-000000009999' },
      [403, 404],
    ),
  );

  // JWT malformed
  const badJwt = await fetch(`${API}/auth/me`, { headers: { Authorization: 'Bearer invalid.token.here' } });
  security.push({ label: 'malformed-jwt', url: `${API}/auth/me`, status: badJwt.status, pass: badJwt.status === 401, bodyLen: 0 });

  const byController = {};
  for (const b of benchmarks) {
    const ctrl = b.label.split('/')[0];
    if (!byController[ctrl]) byController[ctrl] = [];
    byController[ctrl].push(b.avg);
  }
  const controllerSummary = Object.entries(byController).map(([controller, avgs]) => ({
    controller,
    endpoints: avgs.length,
    avgMs: Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length),
  }));

  const allAvgs = benchmarks.map((b) => b.avg);
  const overall = stats(allAvgs);

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    samples: SAMPLES,
    controllers: 37,
    endpointsBenchmarked: benchmarks.length,
    overallLatency: overall,
    controllerSummary: controllerSummary.sort((a, b) => b.avgMs - a.avgMs),
    benchmarks,
    security,
    securityPass: security.filter((s) => s.pass).length,
    securityTotal: security.length,
  };

  writeFileSync(path.join(OUT, 'benchmark-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    endpoints: benchmarks.length,
    overallAvg: overall.avg,
    overallP95: overall.p95,
    security: `${report.securityPass}/${report.securityTotal}`,
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
