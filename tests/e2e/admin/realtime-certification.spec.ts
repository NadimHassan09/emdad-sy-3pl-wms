/**
 * Final Realtime Certification — fresh peer-session measurements + session/presence/roles.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';
import { attachRealtimeWsCapture, REALTIME_EVENT_NAMES } from '../../helpers/realtime-audit';

type CertRow = {
  category: string;
  scenario: string;
  role: string;
  screen: string;
  wsEventsExpected: string[];
  wsEventsReceived: string[];
  peerGetRefetchCount: number;
  pollingDetected: boolean;
  wsInvalidateInHandler: boolean;
  compliant: boolean;
  notes: string;
};

const metrics: CertRow[] = [];
const screensCovered = new Set<string>();
const rolesCovered = new Set<string>();

function trackGet(page: Page, fragment: string) {
  const hits: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET' && req.url().includes(fragment)) hits.push(req.url());
  });
  return hits;
}

async function adminObserver(browser: Browser, route: string, email: string) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await adminLogin(page, email);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  screensCovered.add(route);
  rolesCovered.add(email);
  return { page, ws, ctx };
}

function record(row: Omit<CertRow, 'wsEventsReceived'> & { wsEventsReceived?: string[] }) {
  metrics.push({
    wsEventsReceived: [],
    ...row,
  });
}

function staticWsInvalidate(): boolean {
  const paths = [
    'frontend/src/realtime/RealtimeProvider.tsx',
    'client-frontend/src/realtime/RealtimeProvider.tsx',
  ];
  return paths.some((p) => {
    try {
      return readFileSync(join(process.cwd(), p), 'utf8').includes('invalidateQueries');
    } catch {
      return false;
    }
  });
}

function walkSrc(dir: string): boolean {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory() && name !== 'node_modules' && name !== 'dist') {
      if (walkSrc(p)) return true;
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      if (readFileSync(p, 'utf8').includes('refetchInterval')) return true;
    }
  }
  return false;
}

function staticPolling(): boolean {
  const dirs = ['frontend/src', 'client-frontend/src'];
  for (const d of dirs) {
    try {
      if (walkSrc(join(process.cwd(), d))) return true;
    } catch {
      /* skip */
    }
  }
  return false;
}

test.describe.configure({ mode: 'serial' });

test.describe('Final Realtime Certification', () => {
  test.afterAll(() => {
    mkdirSync(join(process.cwd(), 'qa-results'), { recursive: true });

    const staticPath = join(process.cwd(), 'qa-results/realtime-certification-static.json');
    const staticAudit = existsSync(staticPath)
      ? JSON.parse(readFileSync(staticPath, 'utf8'))
      : null;

    const peerRows = metrics.filter((m) => m.category === 'peer-session');
    const peerCompliant = peerRows.every((r) => r.compliant);
    const zeroRefetch = peerRows.filter((r) => r.peerGetRefetchCount === 0).length;
    const zeroRefetchPct =
      peerRows.length > 0 ? Math.round((zeroRefetch / peerRows.length) * 100) : 0;

    const wsInvalidate = staticWsInvalidate();
    const polling = staticPolling();

    const readinessScore = Math.min(
      100,
      Math.round(
        (peerCompliant ? 35 : 0) +
          (!wsInvalidate ? 20 : 0) +
          (!polling ? 15 : 0) +
          (staticAudit?.eventsSynced ? 10 : 0) +
          (metrics.some((m) => m.wsEventsReceived.includes('presence.online')) ? 10 : 0) +
          (metrics.some((m) => m.wsEventsReceived.includes('auth.session.changed')) ? 10 : 0),
      ),
    );

    const networkScore = Math.min(
      100,
      peerRows.length > 0
        ? Math.round((zeroRefetch / peerRows.length) * 100)
        : 0,
    );

    const allCriteriaMet =
      peerCompliant &&
      !wsInvalidate &&
      !polling &&
      staticAudit?.adminEventsWithPatch === 39;

    const output = {
      generatedAt: new Date().toISOString(),
      auditType: 'final-realtime-certification',
      scores: {
        realtimeReadiness: readinessScore,
        networkEfficiency: networkScore,
        zeroRefreshCoverage: zeroRefetchPct,
      },
      verdict: allCriteriaMet && readinessScore >= 85
        ? 'Realtime Layer Production Ready'
        : 'Realtime Layer Not Production Ready',
      successCriteria: {
        noPeerGetRefetchAfterWs: peerCompliant,
        noPollingOnRealtimePages: !polling,
        noInvalidateQueriesInWsHandlers: !wsInvalidate,
        all39EventsPatchOrDocumented: staticAudit?.adminEventsWithPatch === 39,
        presenceVerified: metrics.some((m) =>
          m.wsEventsReceived.includes('presence.online'),
        ),
        sessionEventsVerified: metrics.some((m) =>
          m.wsEventsReceived.includes('auth.session.changed'),
        ),
      },
      measured: {
        peerSessionScenarios: peerRows.length,
        peerGetRefetchesTotal: peerRows.reduce((s, r) => s + r.peerGetRefetchCount, 0),
        screensCovered: [...screensCovered],
        rolesCovered: [...rolesCovered],
        wsEventsCatalogSize: REALTIME_EVENT_NAMES.length,
      },
      staticAudit,
      certificationRows: metrics,
    };

    writeFileSync(
      join(process.cwd(), 'qa-results/realtime-certification-metrics.json'),
      JSON.stringify(output, null, 2),
    );
  });

  test('static — WS providers have zero invalidateQueries', async () => {
    const bad = staticWsInvalidate();
    record({
      category: 'static',
      scenario: 'WS handler invalidateQueries scan',
      role: 'N/A',
      screen: 'RealtimeProvider',
      wsEventsExpected: [],
      wsEventsReceived: [],
      peerGetRefetchCount: 0,
      pollingDetected: false,
      wsInvalidateInHandler: bad,
      compliant: !bad,
      notes: bad ? 'invalidateQueries found in RealtimeProvider' : 'Patch-only WS handlers',
    });
    expect(bad).toBe(false);
  });

  test('static — no refetchInterval polling in app source', async () => {
    const polling = staticPolling();
    record({
      category: 'static',
      scenario: 'refetchInterval scan',
      role: 'N/A',
      screen: 'all realtime pages',
      wsEventsExpected: [],
      wsEventsReceived: [],
      peerGetRefetchCount: 0,
      pollingDetected: polling,
      wsInvalidateInHandler: false,
      compliant: !polling,
      notes: polling ? 'Polling detected in source' : 'Zero refetchInterval in src',
    });
    expect(polling).toBe(false);
  });

  test('presence.online + presence.offline verified', async ({ browser }) => {
    const observer = await adminObserver(browser, '/users/system', USERS.superAdmin.email);
    const peerCtx = await browser.newContext({ ignoreHTTPSErrors: true });
    const peerPage = await peerCtx.newPage();
    const peerWs = attachRealtimeWsCapture(peerPage);
    await adminLogin(peerPage, USERS.manager.email);
    await peerPage.goto('/dashboard/overview', { waitUntil: 'networkidle' });

    await expect.poll(() => peerWs.events.includes('presence.online'), { timeout: 15_000 }).toBe(
      true,
    );
    await expect
      .poll(() => observer.ws.events.includes('presence.online'), { timeout: 15_000 })
      .toBe(true);

    await peerCtx.close();
    await expect
      .poll(() => observer.ws.events.includes('presence.offline'), { timeout: 15_000 })
      .toBe(true);

    record({
      category: 'presence',
      scenario: 'peer connect/disconnect',
      role: USERS.superAdmin.email,
      screen: '/users/system',
      wsEventsExpected: ['presence.online', 'presence.offline'],
      wsEventsReceived: observer.ws.events.filter((e) => e.startsWith('presence.')),
      peerGetRefetchCount: 0,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: true,
      notes: 'Presence pills fed by patchPresenceOnline/Offline',
    });

    await observer.ctx.close();
  });

  test('auth.session.changed on peer logout', async ({ browser }) => {
    const observer = await adminObserver(browser, '/users/system', USERS.superAdmin.email);
    const peerCtx = await browser.newContext({ ignoreHTTPSErrors: true });
    const peerPage = await peerCtx.newPage();
    await adminLogin(peerPage, USERS.manager.email);
    await peerPage.goto('/dashboard/overview', { waitUntil: 'networkidle' });
    await peerPage.waitForTimeout(1500);

    const logoutRes = await peerPage.request.post(`${STAGING.adminUrl}/api/auth/logout`);
    expect(logoutRes.status()).toBeLessThan(300);

    await expect
      .poll(() => observer.ws.events.includes('auth.session.changed'), { timeout: 15_000 })
      .toBe(true);

    record({
      category: 'session',
      scenario: 'peer logout emits auth.session.changed',
      role: USERS.superAdmin.email,
      screen: '/users/system',
      wsEventsExpected: ['auth.session.changed'],
      wsEventsReceived: observer.ws.events.filter((e) => e === 'auth.session.changed'),
      peerGetRefetchCount: 0,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: true,
      notes: 'Internal room receives session.changed; target user gets CustomEvent',
    });

    await peerCtx.close();
    await observer.ctx.close();
  });

  test('peer master-data product create — manager observer, 0 GET refetch', async ({
    browser,
    request,
  }) => {
    const obs = await adminObserver(browser, '/products', USERS.manager.email);
    const hits = trackGet(obs.page, '/api/products');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const sku = `CERT-${Date.now().toString(36)}`;
    const { product } = await api.createProduct(sku);
    await expect.poll(() => obs.ws.events.includes('product.created'), { timeout: 15_000 }).toBe(
      true,
    );
    await obs.page.waitForTimeout(2500);
    const refetches = hits.length - base;
    record({
      category: 'peer-session',
      scenario: 'product.created',
      role: USERS.manager.email,
      screen: '/products',
      wsEventsExpected: ['product.created'],
      wsEventsReceived: obs.ws.events.filter((e) => e === 'product.created'),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'master-data-cache patch',
    });
    expect(refetches).toBe(0);
    await api.call('DELETE', `/products/${product.id}`);
    await obs.ctx.close();
  });

  test('peer inbound create — super admin observer, 0 GET refetch', async ({
    browser,
    request,
  }) => {
    const obs = await adminObserver(browser, '/orders/inbound', USERS.superAdmin.email);
    const hits = trackGet(obs.page, '/inbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    const create = await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, expectedQuantity: 2 }],
    });
    expect(create.status).toBeLessThan(300);
    await expect.poll(() => obs.ws.events.includes('order.inbound.created'), {
      timeout: 20_000,
    }).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    record({
      category: 'peer-session',
      scenario: 'order.inbound.created',
      role: USERS.superAdmin.email,
      screen: '/orders/inbound',
      wsEventsExpected: ['order.inbound.created'],
      wsEventsReceived: obs.ws.events.filter((e) => e.startsWith('order.inbound')),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'orders-cache patchInboundCreated',
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer outbound create — manager observer, 0 GET refetch', async ({
    browser,
    request,
  }) => {
    const obs = await adminObserver(browser, '/orders/outbound', USERS.manager.email);
    const hits = trackGet(obs.page, '/outbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 5);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'Cert audit',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    expect(create.status).toBeLessThan(300);
    await expect.poll(() => obs.ws.events.includes('order.outbound.created'), {
      timeout: 20_000,
    }).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    record({
      category: 'peer-session',
      scenario: 'order.outbound.created',
      role: USERS.manager.email,
      screen: '/orders/outbound',
      wsEventsExpected: ['order.outbound.created'],
      wsEventsReceived: obs.ws.events.filter((e) => e.startsWith('order.outbound')),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'orders-cache patchOutboundCreated',
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer tasks — wh_manager on tasks screen, 0 GET refetch', async ({ browser, request }) => {
    const obs = await adminObserver(browser, '/tasks', USERS.manager.email);
    const hits = trackGet(obs.page, '/api/tasks');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 8);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'Operator cert',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    await api.call('POST', `/outbound-orders/${create.json.data.id}/confirm`, {
      warehouseId: locs.warehouseId,
    });
    await expect.poll(() => obs.ws.events.includes('task.updated'), { timeout: 25_000 }).toBe(
      true,
    );
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    record({
      category: 'peer-session',
      scenario: 'task.updated',
      role: USERS.manager.email,
      screen: '/tasks',
      wsEventsExpected: ['task.updated'],
      wsEventsReceived: obs.ws.events.filter((e) => e === 'task.updated'),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'tasks-cache patchTaskUpdated — wh_manager role',
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer inventory stock-by-product — 0 GET refetch', async ({ browser, request }) => {
    const obs = await adminObserver(browser, '/inventory/stock-by-product', USERS.manager.email);
    const hits = trackGet(obs.page, '/inventory/stock-by-product');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 12);
    await expect
      .poll(() => obs.ws.events.includes('inventory.changed'), { timeout: 20_000 })
      .toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    record({
      category: 'peer-session',
      scenario: 'inventory.changed',
      role: USERS.manager.email,
      screen: '/inventory/stock-by-product',
      wsEventsExpected: ['inventory.changed'],
      wsEventsReceived: obs.ws.events.filter((e) => e === 'inventory.changed'),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'inventory-cache patchInventoryChanged',
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer dashboard — 0 GET refetch on KPI patch', async ({ browser, request }) => {
    const obs = await adminObserver(browser, '/dashboard/overview', USERS.superAdmin.email);
    const oHits = trackGet(obs.page, '/dashboard/overview');
    const base = oHits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 3);
    const locs = await api.getWarehouseAndLocations();
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'Dashboard cert',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    await api.call('POST', `/outbound-orders/${create.json.data.id}/confirm`, {
      warehouseId: locs.warehouseId,
    });
    await expect
      .poll(
        () => obs.ws.events.some((e) => e.startsWith('dashboard.')),
        { timeout: 20_000 },
      )
      .toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = oHits.length - base;
    record({
      category: 'peer-session',
      scenario: 'dashboard.orders.updated',
      role: USERS.superAdmin.email,
      screen: '/dashboard/overview',
      wsEventsExpected: ['dashboard.orders.updated'],
      wsEventsReceived: obs.ws.events.filter((e) => e.startsWith('dashboard.')),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'dashboard-cache incremental patches',
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('client portal — inbound create peer, 0 GET refetch', async ({ browser, request }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const ws = attachRealtimeWsCapture(page);
    await page.goto(`${STAGING.clientUrl}/login`, { waitUntil: 'networkidle' });
    await page.locator('#login-email').fill(USERS.clientAdmin.email);
    await page.locator('#login-password').fill(STAGING.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    await page.goto(`${STAGING.clientUrl}/orders/inbound`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    screensCovered.add('client:/orders/inbound');
    rolesCovered.add(USERS.clientAdmin.email);

    const hits = trackGet(page, '/inbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    const create = await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, expectedQuantity: 1 }],
    });
    expect(create.status).toBeLessThan(300);
    await expect.poll(() => ws.events.includes('order.inbound.created'), { timeout: 20_000 }).toBe(
      true,
    );
    await page.waitForTimeout(3000);
    const refetches = hits.length - base;
    record({
      category: 'peer-session',
      scenario: 'client order.inbound.created',
      role: USERS.clientAdmin.email,
      screen: 'client:/orders/inbound',
      wsEventsExpected: ['order.inbound.created'],
      wsEventsReceived: ws.events.filter((e) => e.startsWith('order.inbound')),
      peerGetRefetchCount: refetches,
      pollingDetected: false,
      wsInvalidateInHandler: false,
      compliant: refetches === 0,
      notes: 'client orders-cache patch',
    });
    expect(refetches).toBe(0);
    await ctx.close();
  });
});
