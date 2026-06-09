#!/usr/bin/env node
/**
 * CLIENT-PORTAL-2 — API validation: data isolation + P2A endpoints.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/client-portal-2');
const CLIENT_API = (process.env.CLIENT_BASE_URL ?? 'https://staging-client.emdadsy.com').replace(/\/$/, '') + '/api/client';
const ADMIN_API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_A = '00000000-0000-4000-8000-000000000001';
const COMPANY_B = '00000000-0000-4000-8000-000000000002';
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

async function clientLogin(email) {
  const res = await api(CLIENT_API, 'POST', '/auth/login', {
    body: { email, password: PASSWORD },
  });
  const token = res.data?.data?.access_token;
  if (!token) throw new Error(`Client login failed for ${email}`);
  return token;
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const acmeToken = await clientLogin('client@acme.example');
  record('auth', 'client_admin_login', 'pass');

  const overview = await api(CLIENT_API, 'GET', '/dashboard/overview', {
    headers: { Authorization: `Bearer ${acmeToken}` },
  });
  const ov = overview.data?.data ?? overview.data;
  record('dashboard', 'overview', overview.status === 200 ? 'pass' : 'fail', {
    status: overview.status,
    activeOrders: ov?.activeOrders,
    recentInvoices: ov?.recentInvoices?.length,
    productsCount: ov?.productsCount,
  });

  const notifPage = await api(CLIENT_API, 'GET', '/notifications?limit=10&offset=0', {
    headers: { Authorization: `Bearer ${acmeToken}` },
  });
  const notif = notifPage.data?.data ?? notifPage.data;
  record('notifications', 'paginated_list', notifPage.status === 200 ? 'pass' : 'fail', {
    status: notifPage.status,
    total: notif?.total,
    items: notif?.items?.length,
    hasOffset: notif?.offset === 0,
  });

  const billingSummary = await api(CLIENT_API, 'GET', '/billing/summary', {
    headers: { Authorization: `Bearer ${acmeToken}` },
  });
  record('billing', 'summary', billingSummary.status === 200 ? 'pass' : 'fail', {
    status: billingSummary.status,
  });

  const invoices = await api(CLIENT_API, 'GET', '/billing/invoices?limit=5&offset=0', {
    headers: { Authorization: `Bearer ${acmeToken}` },
  });
  const inv = invoices.data?.data ?? invoices.data;
  record('billing', 'invoices_paginated', invoices.status === 200 ? 'pass' : 'fail', {
    status: invoices.status,
    total: inv?.total,
  });

  const stock = await api(CLIENT_API, 'GET', '/stock', {
    headers: { Authorization: `Bearer ${acmeToken}` },
  });
  const stockBody = stock.data?.data ?? stock.data;
  const items = stockBody?.items ?? stockBody ?? [];
  let isolationOk = stock.status === 200;
  for (const row of items) {
    if (row.companyId && row.companyId !== COMPANY_A) isolationOk = false;
  }
  record('isolation', 'stock_company_scope', isolationOk ? 'pass' : 'fail', {
    rows: items.length,
  });

  const idor = await api(ADMIN_API, 'GET', '/companies', {
    headers: { Authorization: `Bearer ${acmeToken}`, 'X-Company-Id': COMPANY_A },
  });
  record('isolation', 'client_blocked_from_admin', [401, 403].includes(idor.status) ? 'pass' : 'fail', {
    status: idor.status,
  });

  let nahdiToken;
  try {
    nahdiToken = await clientLogin('client@nahdi.example');
  } catch {
    record('isolation', 'nahdi_login', 'skip', { reason: 'nahdi client user not seeded' });
    nahdiToken = null;
  }

  if (nahdiToken) {
    const nahdiStock = await api(CLIENT_API, 'GET', '/stock', {
      headers: { Authorization: `Bearer ${nahdiToken}` },
    });
    const nahdiItems = nahdiStock.data?.data?.items ?? nahdiStock.data?.data ?? [];
    const acmeIds = new Set(items.map((r) => r.id ?? r.productId).filter(Boolean));
    let crossTenant = false;
    for (const row of nahdiItems) {
      const id = row.id ?? row.productId;
      if (id && acmeIds.has(id)) crossTenant = true;
      if (row.companyId && row.companyId !== COMPANY_B) crossTenant = true;
    }
    record('isolation', 'cross_tenant_stock', crossTenant ? 'fail' : 'pass', {
      acmeRows: items.length,
      nahdiRows: nahdiItems.length,
    });
  }

  const summary = {
    sprint: 'CLIENT-PORTAL-2',
    generatedAt: new Date().toISOString(),
    passed: results.filter((r) => r.outcome === 'pass').length,
    failed: results.filter((r) => r.outcome === 'fail').length,
    skipped: results.filter((r) => r.outcome === 'skip').length,
    results,
  };

  writeFileSync(path.join(OUT, 'api-cert.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
