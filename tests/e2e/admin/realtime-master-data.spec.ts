/**
 * Phase RT-1 — master-data incremental realtime (no list refetch).
 */
import { test, expect, type Browser, type Page } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';
import { attachRealtimeWsCapture } from '../../helpers/realtime-audit';

function trackGetRequests(page: Page, pathFragment: string) {
  const hits: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET' && req.url().includes(pathFragment)) {
      hits.push(req.url());
    }
  });
  return hits;
}

async function openObserver(browser: Browser, route: string, email: string) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await adminLogin(page, email);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return { page, ws, ctx };
}

test.describe.configure({ mode: 'serial' });

test.describe('RT-1 Master Data Realtime', () => {
  test('product create — visible in peer session without list refetch', async ({ browser, request }) => {
    const observer = await openObserver(browser, '/products', USERS.manager.email);
    const getHits = trackGetRequests(observer.page, '/api/products');
    const baseline = getHits.length;

    const api = await WorkflowApi.create(request);
    const sku = `RT1-${Date.now().toString(36).toUpperCase()}`;
    const { product } = await api.createProduct(sku);

    await expect.poll(
      () => observer.ws.events.includes('product.created'),
      { timeout: 15_000 },
    ).toBe(true);

    await expect(observer.page.getByRole('cell', { name: new RegExp(sku) }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(getHits.length).toBe(baseline);

    await api.call('DELETE', `/products/${product.id}`);
    await observer.ctx.close();
  });

  test('product update — patched in peer session without refetch', async ({ browser, request }) => {
    const observer = await openObserver(browser, '/products', USERS.manager.email);
    const api = await WorkflowApi.create(request);
    const { product, sku } = await api.createProduct();
    const newName = `RT1-Updated-${Date.now()}`;

    await expect.poll(() => observer.page.getByRole('cell', { name: new RegExp(sku) }).count()).toBeGreaterThan(0);

    const getHits = trackGetRequests(observer.page, '/api/products');
    const baseline = getHits.length;

    await api.call('PATCH', `/products/${product.id}`, { name: newName });

    await expect.poll(
      () => observer.ws.events.includes('product.updated'),
      { timeout: 15_000 },
    ).toBe(true);

    await expect(observer.page.getByRole('cell', { name: newName }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(getHits.length).toBe(baseline);

    await api.call('DELETE', `/products/${product.id}`);
    await observer.ctx.close();
  });

  test('product archive — removed in peer session without refetch', async ({ browser, request }) => {
    const observer = await openObserver(browser, '/products', USERS.manager.email);
    const api = await WorkflowApi.create(request);
    const { product, sku } = await api.createProduct();

    await expect.poll(
      () => observer.page.getByRole('cell', { name: new RegExp(sku) }).count(),
    ).toBeGreaterThan(0);

    const getHits = trackGetRequests(observer.page, '/api/products');
    const baseline = getHits.length;

    await api.call('DELETE', `/products/${product.id}`);

    await expect.poll(
      () => observer.ws.events.includes('product.archived'),
      { timeout: 15_000 },
    ).toBe(true);

    await expect.poll(
      () => observer.page.getByRole('cell', { name: new RegExp(sku) }).count(),
      { timeout: 10_000 },
    ).toBe(0);
    expect(getHits.length).toBe(baseline);

    await observer.ctx.close();
  });

  test('warehouse create — WS event on internal master-data room', async ({ browser, request }) => {
    const observer = await openObserver(browser, '/locations', USERS.superAdmin.email);
    const api = await WorkflowApi.create(request);
    const name = `RT1 WH ${Date.now()}`;
    const res = await api.call('POST', '/warehouses', { name, city: 'Riyadh', country: 'SA' });
    expect(res.status).toBeLessThan(300);

    await expect.poll(
      () => observer.ws.events.includes('warehouse.created'),
      { timeout: 15_000 },
    ).toBe(true);

    await observer.ctx.close();
  });
});
