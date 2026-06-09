#!/usr/bin/env node
/**
 * BILLING-4A API verification — pagination, filters, dashboard widgets.
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001/api';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL ?? 'superadmin@emdad.example',
      password: process.env.ADMIN_PASSWORD ?? 'demo123',
    }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(`Login failed: ${body.error?.message}`);
  return body.data.access_token;
}

async function apiGet(token, path, label) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ms = Math.round(performance.now() - t0);
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(`${label} failed (${res.status}): ${body.error?.message ?? res.statusText}`);
  }
  return { data: body.data, ms };
}

function assertPageResult(data, label) {
  if (!data || typeof data.total !== 'number' || !Array.isArray(data.items)) {
    throw new Error(`${label}: expected PageResult shape`);
  }
}

async function main() {
  const token = await login();
  const results = [];

  const plans = await apiGet(token, '/billing/plans?limit=10&offset=0&sort_by=companyName&sort_dir=asc', 'plans list');
  assertPageResult(plans.data, 'plans');
  results.push({ endpoint: 'GET /billing/plans', ms: plans.ms, total: plans.data.total });

  const plansSearch = await apiGet(token, '/billing/plans?limit=5&search=demo', 'plans search');
  assertPageResult(plansSearch.data, 'plans search');
  results.push({ endpoint: 'GET /billing/plans?search=', ms: plansSearch.ms, total: plansSearch.data.total });

  const invoices = await apiGet(token, '/billing/invoices?limit=10&offset=0&sort_by=createdAt&sort_dir=desc', 'invoices');
  assertPageResult(invoices.data, 'invoices');
  results.push({ endpoint: 'GET /billing/invoices', ms: invoices.ms, total: invoices.data.total });

  const overdue = await apiGet(token, '/billing/dashboard/overdue-clients?limit=5', 'overdue');
  if (!Array.isArray(overdue.data)) throw new Error('overdue: expected array');
  results.push({ endpoint: 'GET /billing/dashboard/overdue-clients', ms: overdue.ms, count: overdue.data.length });

  const recent = await apiGet(token, '/billing/dashboard/recent-invoices?limit=5', 'recent invoices');
  if (!Array.isArray(recent.data)) throw new Error('recent: expected array');
  results.push({ endpoint: 'GET /billing/dashboard/recent-invoices', ms: recent.ms, count: recent.data.length });

  const suspended = await apiGet(token, '/billing/dashboard/suspended-accounts?limit=5', 'suspended');
  if (!Array.isArray(suspended.data)) throw new Error('suspended: expected array');
  results.push({ endpoint: 'GET /billing/dashboard/suspended-accounts', ms: suspended.ms, count: suspended.data.length });

  const expiring = await apiGet(token, '/billing/cycles/expiring-soon?limit=5', 'expiring');
  if (!Array.isArray(expiring.data)) throw new Error('expiring: expected array');
  results.push({ endpoint: 'GET /billing/cycles/expiring-soon', ms: expiring.ms, count: expiring.data.length });

  console.log('BILLING-4A API verification: PASS');
  for (const r of results) {
    console.log(`  ${r.endpoint} — ${r.ms}ms`, r.total != null ? `(total=${r.total})` : `(count=${r.count})`);
  }

  const slow = results.filter((r) => r.ms > 500);
  if (slow.length) {
    console.warn('WARN: endpoints over 500ms:', slow.map((s) => s.endpoint).join(', '));
  }
}

main().catch((err) => {
  console.error('BILLING-4A API verification: FAIL');
  console.error(err.message);
  process.exit(1);
});
