#!/usr/bin/env node
/**
 * REPORTS-PERF — API validation for server-side reports module.
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/reports-perf');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';

const results = [];

function record(phase, name, outcome, detail = {}) {
  results.push({ phase, name, outcome, detail, at: new Date().toISOString() });
}

async function api(method, route, { body, headers = {} } = {}) {
  const url = `${API}${route}`;
  const opts = { method, headers: { ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const login = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const token = login.data?.data?.access_token;
  if (!token) throw new Error('Login failed');
  record('auth', 'login', 'pass');

  const auth = { Authorization: `Bearer ${token}`, 'X-Company-Id': COMPANY_ID };
  const wh = await api('GET', '/warehouses', { headers: auth });
  const warehouseId = wh.data?.data?.[0]?.id;
  if (!warehouseId) throw new Error('No warehouse');

  const policy = await api('GET', '/reports/policy', { headers: auth });
  record('policy', 'get', policy.status === 200 ? 'pass' : 'fail', { status: policy.status });

  const invRun = await api(
    'GET',
    `/reports/inventory/run?warehouseId=${warehouseId}&limit=25&offset=0`,
    { headers: auth },
  );
  record('run', 'inventory_paginated', invRun.status === 200 ? 'pass' : 'fail', {
    status: invRun.status,
    total: invRun.data?.data?.total,
    items: invRun.data?.data?.items?.length,
  });

  const movesRun = await api(
    'GET',
    `/reports/product-moves/run?warehouseId=${warehouseId}&limit=25&offset=0`,
    { headers: auth },
  );
  record('run', 'product_moves_paginated', movesRun.status === 200 ? 'pass' : 'fail', {
    status: movesRun.status,
  });

  const whRun = await api(
    'GET',
    `/reports/warehouse-analysis/run?warehouseId=${warehouseId}&limit=10&offset=0`,
    { headers: auth },
  );
  record('run', 'warehouse_analysis', whRun.status === 200 ? 'pass' : 'fail', { status: whRun.status });

  const agg = await api(
    'GET',
    `/reports/inventory/aggregate?warehouseId=${warehouseId}&groupBy=client`,
    { headers: auth },
  );
  record('aggregate', 'inventory_by_client', agg.status === 200 ? 'pass' : 'fail', { status: agg.status });

  const kpis = await api(
    'GET',
    `/reports/warehouse-analysis/kpis?warehouseId=${warehouseId}`,
    { headers: auth },
  );
  record('kpis', 'warehouse_analysis', kpis.status === 200 ? 'pass' : 'fail', {
    status: kpis.status,
    count: kpis.data?.data?.length,
  });

  const csv = await api(
    'GET',
    `/reports/inventory/export?warehouseId=${warehouseId}&format=csv`,
    { headers: auth },
  );
  record('export', 'inventory_csv', csv.status === 200 ? 'pass' : 'fail', {
    status: csv.status,
    rows: csv.headers.get('x-export-row-count'),
  });

  const xls = await api(
    'GET',
    `/reports/inventory/export?warehouseId=${warehouseId}&format=xls`,
    { headers: auth },
  );
  record('export', 'inventory_xls', xls.status === 200 ? 'pass' : 'fail', { status: xls.status });

  const passCount = results.filter((r) => r.outcome === 'pass').length;
  writeFileSync(
    path.join(OUT, 'cert-results.json'),
    JSON.stringify({ passCount, total: results.length, results }, null, 2),
  );
  appendFileSync(
    path.join(OUT, 'cert-summary.txt'),
    `\nAPI cert ${new Date().toISOString()}: ${passCount}/${results.length} PASS\n`,
  );
  console.log(`Pass=${passCount}/${results.length}`);
  if (passCount < results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
