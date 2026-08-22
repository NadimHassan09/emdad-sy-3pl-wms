#!/usr/bin/env node
/**
 * Production smoke certification — post-deploy verification.
 * Env: PROD_API (default http://127.0.0.1:3000/api), QA_PASSWORD, COMPANY_ID
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.PROD_API ?? 'http://127.0.0.1:3000/api').replace(/\/$/, '');
const ADMIN_URL = (process.env.PROD_ADMIN_URL ?? 'https://admin.emdadsy.com').replace(/\/$/, '');
const CLIENT_URL = (process.env.PROD_CLIENT_URL ?? 'https://client.emdadsy.com').replace(/\/$/, '');
const CLIENT_API = `${CLIENT_URL}/api/client`;
const COMPANY_ID = process.env.COMPANY_ID ?? '00000000-0000-4000-8000-000000000001';
const WAREHOUSE_ID = process.env.WAREHOUSE_ID ?? '00000000-0000-4000-8000-000000000010';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';
const OUT = path.join(ROOT, 'docs/evidence/production-deploy');

const results = [];

function record(module, name, pass, detail = {}) {
  results.push({ module, name, pass, detail, at: new Date().toISOString() });
}

async function api(base, method, route, { body, headers = {} } = {}) {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

  // Authentication
  const login = await api(API, 'POST', '/auth/login', {
    body: { email: 'superadmin@emdad.example', password: PASSWORD },
  });
  const token = login.data?.data?.access_token;
  record('Authentication', 'admin_login', !!token, { status: login.status });
  if (!token) {
    writeFileSync(path.join(OUT, 'smoke-results.json'), JSON.stringify({ results, pass: 0, fail: results.length }, null, 2));
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${token}`, 'X-Company-Id': COMPANY_ID };

  const me = await api(API, 'GET', '/auth/me', { headers: auth });
  record('Authentication', 'session_me', me.status === 200, { status: me.status });

  // RBAC — finance role exists in user list
  const users = await api(API, 'GET', '/users?limit=5&kind=system', { headers: auth });
  record('RBAC', 'users_list', users.status === 200, { status: users.status });

  // Products
  const products = await api(API, 'GET', '/products?limit=5&offset=0', { headers: auth });
  record('Products', 'list', products.status === 200, { status: products.status });

  // Locations
  const locations = await api(API, 'GET', `/locations?warehouseId=${WAREHOUSE_ID}&limit=5&offset=0`, { headers: auth });
  record('Locations', 'list', locations.status === 200, { status: locations.status });

  // Inventory
  const stock = await api(API, 'GET', '/inventory/stock?limit=5&offset=0', { headers: auth });
  record('Inventory', 'stock', stock.status === 200, { status: stock.status });
  const ledger = await api(API, 'GET', '/inventory/ledger?limit=5&offset=0', { headers: auth });
  record('Inventory', 'ledger', ledger.status === 200, { status: ledger.status });

  // Inbound / Outbound
  const inbound = await api(API, 'GET', '/inbound-orders?limit=5&offset=0', { headers: auth });
  record('Inbound', 'list', inbound.status === 200, { status: inbound.status });
  const outbound = await api(API, 'GET', '/outbound-orders?limit=5&offset=0', { headers: auth });
  record('Outbound', 'list', outbound.status === 200, { status: outbound.status });

  // Returns
  const returns = await api(API, 'GET', '/return-orders?limit=5&offset=0', { headers: auth });
  record('Returns', 'list', returns.status === 200, { status: returns.status });

  // Cycle Count
  const cc = await api(API, 'GET', '/cycle-count/counts?limit=5&offset=0', { headers: auth });
  record('Cycle Count', 'counts', cc.status === 200, { status: cc.status });

  // Tasks
  const tasks = await api(API, 'GET', '/tasks?limit=5&offset=0', { headers: auth });
  record('Tasks', 'list', tasks.status === 200, { status: tasks.status });

  // Reports
  const policy = await api(API, 'GET', '/reports/policy', { headers: auth });
  record('Reports', 'policy', policy.status === 200, { status: policy.status });
  const report = await api(
    API,
    'GET',
    `/reports/inventory/run?limit=5&offset=0&warehouseId=${WAREHOUSE_ID}&companyId=${COMPANY_ID}`,
    { headers: auth },
  );
  record('Reports', 'inventory_run', report.status === 200, { status: report.status });

  // Billing
  const billing = await api(API, 'GET', '/billing/dashboard/summary', { headers: auth });
  record('Billing', 'dashboard_summary', billing.status === 200, { status: billing.status });
  const invoices = await api(API, 'GET', '/billing/invoices?limit=5&offset=0', { headers: auth });
  record('Billing', 'invoices', invoices.status === 200, { status: invoices.status });

  // Backup
  const backupHealth = await api(API, 'GET', '/backups/health', { headers: auth });
  record('Backup', 'health', backupHealth.status === 200, { status: backupHealth.status });
  const backups = await api(API, 'GET', '/backups?limit=5&offset=0', { headers: auth });
  record('Backup', 'history', backups.status === 200, { status: backups.status });

  // Client Portal
  const clientLogin = await api(CLIENT_API, 'POST', '/auth/login', {
    body: { email: process.env.CLIENT_EMAIL ?? 'client@acme.example', password: PASSWORD },
  });
  const clientToken = clientLogin.data?.data?.access_token;
  record('Client Portal', 'client_login', !!clientToken, { status: clientLogin.status });
  if (clientToken) {
    const cAuth = { Authorization: `Bearer ${clientToken}` };
    const dash = await api(CLIENT_API, 'GET', '/dashboard/overview', { headers: cAuth });
    record('Client Portal', 'dashboard', dash.status === 200, { status: dash.status });
    const cStock = await api(CLIENT_API, 'GET', '/stock?limit=5&offset=0', { headers: cAuth });
    record('Client Portal', 'stock', cStock.status === 200, { status: cStock.status });
  }

  // Public SPA shells
  const adminShell = await fetch(`${ADMIN_URL}/`);
  record('Admin SPA', 'shell', adminShell.status === 200, { status: adminShell.status });
  const clientShell = await fetch(`${CLIENT_URL}/`);
  record('Client SPA', 'shell', clientShell.status === 200, { status: clientShell.status });

  const live = await api(API, 'GET', '/ops/health/live');
  record('Ops', 'health_live', live.status === 200, { status: live.status });

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  const summary = { generatedAt: new Date().toISOString(), api: API, pass, fail, total: results.length, results };
  writeFileSync(path.join(OUT, 'smoke-results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pass, fail, total: results.length }, null, 2));
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
