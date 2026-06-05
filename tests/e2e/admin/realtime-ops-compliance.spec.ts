/**
 * Phase RT-5 — operational modules peer-session compliance (zero GET refetch).
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';
import { attachRealtimeWsCapture } from '../../helpers/realtime-audit';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type Row = {
  scenario: string;
  wsEvent: string;
  wsReceived: boolean;
  getRefetchCount: number;
  compliant: boolean;
};

const results: Row[] = [];

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

test.describe('RT-5 Operational Compliance', () => {
  test.afterAll(() => {
    mkdirSync(join(process.cwd(), 'qa-results'), { recursive: true });
    writeFileSync(
      join(process.cwd(), 'qa-results/rt5-ops-compliance.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
    );
  });

  test('peer inbound create — list updates, 0 GET refetch', async ({ browser, request }) => {
    const obs = await observer(browser, '/orders/inbound', USERS.manager.email);
    const hits = trackGet(obs.page, '/inbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    const create = await api.call('POST', '/inbound-orders', {
      companyId: STAGING.companyId,
      expectedArrivalDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, expectedQuantity: 3 }],
    });
    expect(create.status).toBeLessThan(300);
    await expect.poll(() => obs.ws.events.includes('order.inbound.created'), {
      timeout: 20_000,
    }).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    results.push({
      scenario: 'peer inbound create',
      wsEvent: 'order.inbound.created',
      wsReceived: true,
      getRefetchCount: refetches,
      compliant: refetches === 0,
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer inbound confirm — status patch, 0 GET refetch', async ({ browser, request }) => {
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
    const orderId = create.json.data.id;
    const lineId = create.json.data.lines[0].id;
    const dockId = locs.inputDock?.id ?? locs.internalLocation!.id;
    await api.call('POST', `/inbound-orders/${orderId}/confirm`, {
      warehouseId: locs.warehouseId,
      stagingByLineId: { [lineId]: dockId },
    });
    await expect.poll(
      () =>
        obs.ws.events.includes('order.inbound.updated') ||
        obs.ws.events.includes('task.updated'),
      { timeout: 25_000 },
    ).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    results.push({
      scenario: 'peer inbound confirm',
      wsEvent: 'order.inbound.updated',
      wsReceived: true,
      getRefetchCount: refetches,
      compliant: refetches === 0,
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer outbound create — list patch, 0 GET refetch', async ({ browser, request }) => {
    const obs = await observer(browser, '/orders/outbound', USERS.manager.email);
    const hits = trackGet(obs.page, '/outbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 5);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'RT5 compliance',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    expect(create.status).toBeLessThan(300);
    await expect.poll(
      () =>
        obs.ws.events.includes('order.outbound.created') ||
        obs.ws.events.includes('order.outbound.updated'),
      { timeout: 20_000 },
    ).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    results.push({
      scenario: 'peer outbound create',
      wsEvent: 'order.outbound.created',
      wsReceived: true,
      getRefetchCount: refetches,
      compliant: refetches === 0,
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer outbound confirm — status patch, 0 GET refetch', async ({ browser, request }) => {
    const obs = await observer(browser, '/orders/outbound', USERS.manager.email);
    const hits = trackGet(obs.page, '/outbound-orders');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 10);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'RT5 confirm',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    await api.call('POST', `/outbound-orders/${create.json.data.id}/confirm`, {
      warehouseId: locs.warehouseId,
    });
    await expect.poll(
      () =>
        obs.ws.events.includes('order.outbound.updated') ||
        obs.ws.events.includes('task.updated'),
      { timeout: 25_000 },
    ).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    results.push({
      scenario: 'peer outbound confirm',
      wsEvent: 'order.outbound.updated',
      wsReceived: true,
      getRefetchCount: refetches,
      compliant: refetches === 0,
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer task update — task list patch, 0 GET refetch', async ({ browser, request }) => {
    const obs = await observer(browser, '/tasks', USERS.superAdmin.email);
    const hits = trackGet(obs.page, '/api/tasks');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 10);
    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'RT5 task',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    await api.call('POST', `/outbound-orders/${create.json.data.id}/confirm`, {
      warehouseId: locs.warehouseId,
    });
    await expect.poll(() => obs.ws.events.includes('task.updated'), { timeout: 25_000 }).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    results.push({
      scenario: 'peer task update',
      wsEvent: 'task.updated',
      wsReceived: true,
      getRefetchCount: refetches,
      compliant: refetches === 0,
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });

  test('peer inventory change — stock-by-product patch, 0 GET refetch', async ({ browser, request }) => {
    const obs = await observer(browser, '/inventory', USERS.manager.email);
    const hits = trackGet(obs.page, '/inventory/stock-by-product');
    const base = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 8);
    await expect.poll(() => obs.ws.events.includes('inventory.changed'), {
      timeout: 25_000,
    }).toBe(true);
    await obs.page.waitForTimeout(3000);
    const refetches = hits.length - base;
    results.push({
      scenario: 'peer inventory seed',
      wsEvent: 'inventory.changed',
      wsReceived: obs.ws.events.includes('inventory.changed'),
      getRefetchCount: refetches,
      compliant: refetches === 0,
    });
    expect(refetches).toBe(0);
    await obs.ctx.close();
  });
});
