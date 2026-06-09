#!/usr/bin/env node
/**
 * WAREHOUSES-COMPLETE API verification — CRUD, filters, integrations, audit.
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

async function api(token, method, path, data) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const ms = Math.round(performance.now() - t0);
  const body = await res.json();
  return { status: res.status, body, ms };
}

function assertOk(label, { status, body }) {
  if (status >= 400 || !body.success) {
    throw new Error(`${label} failed (${status}): ${body.error?.message ?? 'unknown'}`);
  }
}

async function main() {
  const token = await login();
  const results = [];
  const stamp = Date.now();

  const activeList = await api(token, 'GET', '/warehouses');
  assertOk('list active', activeList);
  results.push({ step: 'GET /warehouses (active only)', ms: activeList.ms, count: activeList.body.data.length });

  const allList = await api(token, 'GET', '/warehouses?includeInactive=true');
  assertOk('list includeInactive', allList);
  results.push({
    step: 'GET /warehouses?includeInactive=true',
    ms: allList.ms,
    count: allList.body.data.length,
  });

  const nextCode = await api(token, 'GET', '/warehouses/next-code');
  assertOk('next-code', nextCode);
  results.push({ step: 'GET /warehouses/next-code', ms: nextCode.ms, code: nextCode.body.data.code });

  const created = await api(token, 'POST', '/warehouses', {
    name: `P1B Verify WH ${stamp}`,
    city: 'Riyadh',
    country: 'SA',
  });
  assertOk('create', created);
  const whId = created.body.data.id;
  results.push({ step: 'POST /warehouses', ms: created.ms, id: whId, code: created.body.data.code });

  const updated = await api(token, 'PATCH', `/warehouses/${whId}`, {
    name: `P1B Verify WH ${stamp} (updated)`,
    address: 'Test address',
  });
  assertOk('update', updated);
  results.push({ step: 'PATCH /warehouses/:id', ms: updated.ms });

  const deactivated = await api(token, 'DELETE', `/warehouses/${whId}`);
  assertOk('deactivate', deactivated);
  results.push({ step: 'DELETE /warehouses/:id', ms: deactivated.ms, status: deactivated.body.data.status });

  const reactivated = await api(token, 'PATCH', `/warehouses/${whId}/status`, { status: 'active' });
  assertOk('reactivate', reactivated);
  results.push({ step: 'PATCH /warehouses/:id/status', ms: reactivated.ms });

  const audit = await api(
    token,
    'GET',
    `/audit-logs?resource_type=warehouse&resource_id=${whId}&limit=10&offset=0`,
  );
  assertOk('audit logs', audit);
  const auditItems = audit.body.data?.items ?? [];
  const actions = new Set(auditItems.map((r) => r.action));
  for (const expected of ['WAREHOUSE_CREATED', 'WAREHOUSE_UPDATED', 'WAREHOUSE_DEACTIVATED', 'WAREHOUSE_STATUS_CHANGED']) {
    if (!actions.has(expected)) {
      throw new Error(`Missing audit action: ${expected}`);
    }
  }
  results.push({ step: 'GET /audit-logs (warehouse)', ms: audit.ms, count: auditItems.length });

  const warehouseId = activeList.body.data[0]?.id;
  if (warehouseId) {
    const companies = await api(token, 'GET', '/companies');
    assertOk('companies list', companies);
    const companyId = companies.body.data?.[0]?.id ?? companies.body.data?.items?.[0]?.id;
    const tenantQs = companyId ? `&companyId=${companyId}` : '';

    const stock = await api(
      token,
      'GET',
      `/inventory/stock?warehouseId=${warehouseId}&limit=5&offset=0${tenantQs}`,
    );
    assertOk('inventory stock', stock);
    results.push({
      step: 'GET /inventory/stock?warehouseId=',
      ms: stock.ms,
      total: stock.body.data?.total ?? stock.body.data?.items?.length ?? 0,
    });

    const inbound = await api(
      token,
      'GET',
      `/inbound-orders?warehouseId=${warehouseId}&limit=5&offset=0${tenantQs}`,
    );
    assertOk('inbound list', inbound);
    results.push({
      step: 'GET /inbound-orders?warehouseId=',
      ms: inbound.ms,
      total: inbound.body.data?.total ?? 0,
    });

    const outbound = await api(
      token,
      'GET',
      `/outbound-orders?warehouseId=${warehouseId}&limit=5&offset=0${tenantQs}`,
    );
    assertOk('outbound list', outbound);
    results.push({
      step: 'GET /outbound-orders?warehouseId=',
      ms: outbound.ms,
      total: outbound.body.data?.total ?? 0,
    });
  }

  console.log('WAREHOUSES-COMPLETE verification: PASS');
  for (const r of results) {
    console.log(`  ${r.step} — ${r.ms}ms`, JSON.stringify(r).replace(/"step":"[^"]*"\s*,?\s*/g, '').replace(/"ms":\d+,?\s*/g, ''));
  }
}

main().catch((err) => {
  console.error('WAREHOUSES-COMPLETE verification: FAIL');
  console.error(err.message);
  process.exit(1);
});
