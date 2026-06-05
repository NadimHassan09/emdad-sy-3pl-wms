/**
 * RELEASE-R2 — Multi-browser realtime certification (Products, Audit, Returns, Cycle Count, Dashboard).
 */
import { test, expect, type Browser } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { WorkflowApi } from '../../helpers/workflow-fixture';
import { attachRealtimeWsCapture } from '../../helpers/realtime-audit';

function trackGetRequests(page: import('@playwright/test').Page, pathFragment: string) {
  const hits: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'GET' && req.url().includes(pathFragment)) hits.push(req.url());
  });
  return hits;
}

async function openObserver(browser: Browser, route: string, email: string) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await adminLogin(page, email);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { page, ws, ctx };
}

test.describe.configure({ mode: 'serial' });

test.describe('RELEASE-R2 Realtime Readiness', () => {
  test('products — peer list updates on product.created without refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/products', USERS.manager.email);
    const hits = trackGetRequests(observer.page, '/api/products');
    const baseline = hits.length;
    const api = await WorkflowApi.create(request);
    const sku = `R2P-${Date.now().toString(36).toUpperCase()}`;
    const { product } = await api.createProduct(sku);
    await expect.poll(() => observer.ws.events.includes('product.created'), { timeout: 15_000 }).toBe(
      true,
    );
    await expect(observer.page.getByRole('cell', { name: new RegExp(sku) }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(hits.length).toBe(baseline);
    await api.call('DELETE', `/products/${product.id}`);
    await observer.ctx.close();
  });

  test('audit logs — peer tail on audit_log.created without refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/audit-logs', USERS.superAdmin.email);
    const hits = trackGetRequests(observer.page, '/api/audit-logs');
    const baseline = hits.length;
    const api = await WorkflowApi.create(request);
    await api.createProduct();
    await expect.poll(() => observer.ws.events.includes('audit_log.created'), {
      timeout: 15_000,
    }).toBe(true);
    await expect(observer.page.getByRole('cell', { name: /PRODUCT CREATED/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(hits.length).toBe(baseline);
    await observer.ctx.close();
  });

  test('returns — peer list on return.created without refetch', async ({ browser, request }) => {
    const observer = await openObserver(browser, '/returns', USERS.manager.email);
    const hits = trackGetRequests(observer.page, '/api/return-orders');
    const baseline = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 3);
    const { out, stock } = await api.shipOutbound(product.id, 1, locs.warehouseId);
    const create = await api.call('POST', '/return-orders', {
      warehouseId: locs.warehouseId,
      originalOutboundOrderId: out.order.id,
      lines: [{ productId: product.id, expectedQuantity: 1, lotId: stock.lotId }],
    });
    expect(create.status).toBeLessThan(300);
    const orderNumber = String(create.json.data.orderNumber);
    await expect.poll(() => observer.ws.events.includes('return.created'), { timeout: 15_000 }).toBe(
      true,
    );
    await expect(observer.page.getByRole('cell', { name: orderNumber }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(hits.length).toBe(baseline);
    await observer.ctx.close();
  });

  test('cycle count — peer list on cycle_count.created without refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/cycle-count', USERS.manager.email);
    const hits = trackGetRequests(observer.page, '/api/cycle-count/counts');
    const baseline = hits.length;
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 5);
    await api.cancelActiveCycleCounts(locs.warehouseId);
    const create = await api.call('POST', '/cycle-count/counts', {
      warehouseId: locs.warehouseId,
      productIds: [product.id],
      notes: `R2-${Date.now()}`,
    });
    expect(create.status).toBeLessThan(300);
    const whLabel = String(create.json.data.warehouse?.code ?? create.json.data.warehouse?.name ?? '');
    await expect.poll(() => observer.ws.events.includes('cycle_count.created'), {
      timeout: 15_000,
    }).toBe(true);
    await expect(observer.page.locator('tbody tr').filter({ hasText: whLabel }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(hits.length).toBe(baseline);
    await observer.ctx.close();
  });

  test('dashboard — KPI patch on product.created without overview refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/dashboard/overview', USERS.superAdmin.email);
    const hits = trackGetRequests(observer.page, '/dashboard/overview');
    const baseline = hits.length;
    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await expect.poll(
      () =>
        observer.ws.events.some(
          (e) => e === 'product.created' || e === 'dashboard.kpi.updated',
        ),
      { timeout: 15_000 },
    ).toBe(true);
    await observer.page.waitForTimeout(2500);
    expect(hits.length).toBe(baseline);
    await api.call('DELETE', `/products/${product.id}`);
    await observer.ctx.close();
  });
});
