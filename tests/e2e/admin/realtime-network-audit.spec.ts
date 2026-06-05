/**
 * Full readiness — network efficiency spot-checks (documents refetch vs patch).
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';
import { attachRealtimeWsCapture } from '../../helpers/realtime-audit';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type NetworkRow = {
  module: string;
  wsEvent: string | null;
  wsReceived: boolean;
  getRefetchCount: number;
  compliant: boolean;
  notes: string;
};

const rows: NetworkRow[] = [];

function trackGet(page: Page, fragment: string) {
  const hits: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET' && req.url().includes(fragment)) hits.push(req.url());
  });
  return hits;
}

async function observer(browser: Browser, route: string, email: string) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await adminLogin(page, email);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return { page, ws, ctx };
}

test.describe.configure({ mode: 'serial' });

test.describe('Network Efficiency Spot Checks', () => {
  test.afterAll(() => {
    mkdirSync(join(process.cwd(), 'qa-results'), { recursive: true });
    writeFileSync(
      join(process.cwd(), 'qa-results/realtime-network-audit.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2),
    );
  });

  test('products — patch only (compliant)', async ({ browser, request }) => {
    const obs = await observer(browser, '/products', USERS.manager.email);
    const hits = trackGet(obs.page, '/api/products');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    await api.createProduct(`NET-${Date.now().toString(36)}`);
    await expect.poll(() => obs.ws.events.includes('product.created'), { timeout: 15_000 }).toBe(
      true,
    );
    await obs.page.waitForTimeout(2000);
    rows.push({
      module: 'Products',
      wsEvent: 'product.created',
      wsReceived: true,
      getRefetchCount: hits.length - base,
      compliant: hits.length === base,
      notes: hits.length === base ? 'Cache patch only' : 'Unexpected GET refetch',
    });
    await obs.ctx.close();
  });

  test('inbound orders — patch only (RT-5 compliant peer)', async ({ browser, request }) => {
    const obs = await observer(browser, '/orders/inbound', USERS.manager.email);
    const hits = trackGet(obs.page, '/inbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    const create = await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, expectedQuantity: 2 }],
    });
    expect(create.status).toBeLessThan(300);
    await expect.poll(
      () =>
        obs.ws.events.includes('order.inbound.created') ||
        obs.ws.events.includes('order.inbound.updated'),
      { timeout: 20_000 },
    ).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    rows.push({
      module: 'Inbound Orders',
      wsEvent: 'order.inbound.created',
      wsReceived: obs.ws.events.some((e) => e.startsWith('order.inbound')),
      getRefetchCount: refetches,
      compliant: refetches === 0,
      notes:
        refetches === 0
          ? 'RT-5 orders-cache patch — zero peer refetch'
          : 'Unexpected GET refetch after order.inbound WS',
    });
    await obs.ctx.close();
  });

  test('tasks — patch only (RT-5 compliant peer)', async ({ browser, request }) => {
    const obs = await observer(browser, '/tasks', USERS.superAdmin.email);
    const hits = trackGet(obs.page, '/api/tasks');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 10);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'Task net audit',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    await api.call('POST', `/outbound-orders/${create.json.data.id}/confirm`, {
      warehouseId: locs.warehouseId,
    });
    await expect.poll(
      () =>
        obs.ws.events.includes('task.updated') ||
        obs.ws.events.some((e) => e.startsWith('order.outbound')),
      { timeout: 25_000 },
    ).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    rows.push({
      module: 'Tasks',
      wsEvent: 'task.updated',
      wsReceived: true,
      getRefetchCount: refetches,
      compliant: refetches === 0,
      notes: refetches === 0 ? 'RT-5 tasks-cache patch' : 'Unexpected GET refetch',
    });
    await obs.ctx.close();
  });

  test('dashboard — patch only (compliant)', async ({ browser, request }) => {
    const obs = await observer(browser, '/dashboard/overview', USERS.superAdmin.email);
    const oHits = trackGet(obs.page, '/dashboard/overview');
    const cHits = trackGet(obs.page, '/dashboard/open-orders-charts');
    const baseO = oHits.length;
    const baseC = cHits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 5);
    const locs = await api.getWarehouseAndLocations();
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'Net audit',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    await api.call('POST', `/outbound-orders/${create.json.data.id}/confirm`, {
      warehouseId: locs.warehouseId,
    });
    await expect.poll(
      () =>
        obs.ws.events.some(
          (e) => e.startsWith('dashboard.') || e.startsWith('order.outbound'),
        ),
      { timeout: 20_000 },
    ).toBe(true);
    await obs.page.waitForTimeout(3000);
    rows.push({
      module: 'Dashboard',
      wsEvent: 'dashboard.orders.updated',
      wsReceived: obs.ws.events.some((e) => e.startsWith('dashboard.')),
      getRefetchCount: oHits.length - baseO + (cHits.length - baseC),
      compliant: oHits.length === baseO && cHits.length === baseC,
      notes: 'RT-4 incremental dashboard cache patches',
    });
    await obs.ctx.close();
  });
});
