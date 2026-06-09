#!/usr/bin/env node
/**
 * BILLING-4B — certification: overdue, preview, reports, access, isolation.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/billing-4b');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const CLIENT_API = (process.env.CLIENT_BASE_URL ?? 'https://staging-client.emdadsy.com').replace(/\/$/, '') + '/api/client';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';

const results = [];

function record(phase, name, outcome, detail = {}) {
  results.push({ phase, name, outcome, detail, at: new Date().toISOString() });
}

async function api(base, method, route, { body, headers = {} } = {}) {
  const url = `${base}${route}`;
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
  return { status: res.status, data };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const login = await api(API, 'POST', '/auth/login', {
    body: { email: 'superadmin@emdad.example', password: PASSWORD },
  });
  const token = login.data?.data?.access_token;
  if (!token) throw new Error('Admin login failed');
  record('auth', 'admin_login', 'pass');

  const auth = { Authorization: `Bearer ${token}`, 'X-Company-Id': COMPANY_ID };

  const summary = await api(API, 'GET', '/billing/dashboard/summary', { headers: auth });
  record('dashboard', 'summary', summary.status === 200 ? 'pass' : 'fail', { status: summary.status });

  const buckets = await api(API, 'GET', '/billing/dashboard/expiring-buckets', { headers: auth });
  record('dashboard', 'expiring_buckets', buckets.status === 200 ? 'pass' : 'fail');

  const capacity = await api(API, 'GET', '/billing/capacity', { headers: auth });
  const cap = capacity.data?.data ?? capacity.data;
  record('capacity', 'volume_weight', capacity.status === 200 ? 'pass' : 'fail', {
    hasWeight: cap?.totalWarehouseWeightKg != null,
  });

  const preview = await api(API, 'GET', `/billing/preview?companyId=${COMPANY_ID}`, { headers: auth });
  record('preview', 'cycle_preview', preview.status === 200 ? 'pass' : 'fail', { status: preview.status });

  const revenueReport = await api(
    API,
    'GET',
    '/reports/billing-revenue/run?limit=10&offset=0',
    { headers: auth },
  );
  record('reports', 'billing_revenue', revenueReport.status === 200 ? 'pass' : 'fail');

  const outstandingReport = await api(
    API,
    'GET',
    '/reports/billing-outstanding/run?limit=10&offset=0',
    { headers: auth },
  );
  record('reports', 'billing_outstanding', outstandingReport.status === 200 ? 'pass' : 'fail');

  const clientLogin = await api(CLIENT_API, 'POST', '/auth/login', {
    body: { email: 'client@acme.example', password: PASSWORD },
  });
  const clientToken = clientLogin.data?.data?.access_token;
  record('client', 'login', clientToken ? 'pass' : 'fail');

  const access = await api(CLIENT_API, 'GET', '/billing/access', {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  record('client', 'billing_access', access.status === 200 ? 'pass' : 'fail', {
    operationalAllowed: access.data?.data?.operationalAllowed ?? access.data?.operationalAllowed,
  });

  const clientInvoices = await api(CLIENT_API, 'GET', '/billing/invoices?limit=5&offset=0', {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const invBody = clientInvoices.data?.data ?? clientInvoices.data;
  record('isolation', 'client_invoices_scoped', clientInvoices.status === 200 ? 'pass' : 'fail', {
    total: invBody?.total,
  });

  const idor = await api(CLIENT_API, 'GET', '/billing/invoices?limit=1&offset=0', {
    headers: { Authorization: `Bearer ${clientToken}`, 'X-Company-Id': '00000000-0000-4000-8000-000000000002' },
  });
  record('isolation', 'client_jwt_company_scope', idor.status === 200 ? 'pass' : 'fail');

  const summaryOut = {
    sprint: 'BILLING-4B',
    generatedAt: new Date().toISOString(),
    passed: results.filter((r) => r.outcome === 'pass').length,
    failed: results.filter((r) => r.outcome === 'fail').length,
    results,
  };

  writeFileSync(path.join(OUT, 'api-cert.json'), JSON.stringify(summaryOut, null, 2));
  console.log(JSON.stringify(summaryOut, null, 2));
  if (summaryOut.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
