/**
 * Phase RT-2 — operational modules incremental realtime (no list refetch).
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

async function completeCycleCountViaApi(api: WorkflowApi, countId: string, lineId: string) {
  await api.call('POST', `/cycle-count/counts/${countId}/start`);
  await api.call('POST', `/cycle-count/counts/${countId}/lines/${lineId}/count`, {
    actualQuantity: '5',
  });
  await api.call('POST', `/cycle-count/counts/${countId}/submit-review`);
  const reconcile = await api.call('POST', `/cycle-count/counts/${countId}/reconcile`);
  if (reconcile.status < 400) {
    await api.call('POST', `/cycle-count/counts/${countId}/post-reconciliation`);
  }
  return api.call('POST', `/cycle-count/counts/${countId}/complete`);
}

test.describe.configure({ mode: 'serial' });

test.describe('RT-2 Operational Realtime', () => {
  test('return create — visible in peer session without list refetch', async ({ browser, request }) => {
    const observer = await openObserver(browser, '/returns', USERS.manager.email);
    const getHits = trackGetRequests(observer.page, '/api/return-orders');
    const baseline = getHits.length;

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

    await expect.poll(
      () => observer.ws.events.includes('return.created'),
      { timeout: 15_000 },
    ).toBe(true);

    await expect(observer.page.getByRole('cell', { name: orderNumber }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(getHits.length).toBe(baseline);

    await observer.ctx.close();
  });

  test('cycle count complete — status updates in peer session without refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/cycle-count', USERS.manager.email);
    const api = await WorkflowApi.create(request);
    const locs = await api.getWarehouseAndLocations();
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 5);
    await api.cancelActiveCycleCounts(locs.warehouseId);

    const create = await api.call('POST', '/cycle-count/counts', {
      warehouseId: locs.warehouseId,
      productIds: [product.id],
      notes: `RT2-${Date.now()}`,
    });
    expect(create.status).toBeLessThan(300);
    const count = create.json.data;
    const lineId = count.lines[0].id;
    const whLabel = String(count.warehouse?.code ?? count.warehouse?.name ?? '');

    await expect.poll(
      () => observer.ws.events.includes('cycle_count.created'),
      { timeout: 15_000 },
    ).toBe(true);

    const sessionRow = observer.page.locator('tbody tr').filter({ hasText: whLabel }).first();
    await expect(sessionRow.locator('.badge', { hasText: /^scheduled$/i })).toBeVisible({
      timeout: 10_000,
    });

    const getHits = trackGetRequests(observer.page, '/api/cycle-count/counts');
    const baseline = getHits.length;

    const complete = await completeCycleCountViaApi(api, count.id, lineId);
    expect(complete.status).toBeLessThan(300);

    await expect.poll(
      () => observer.ws.events.includes('cycle_count.completed'),
      { timeout: 20_000 },
    ).toBe(true);

    await expect(sessionRow.locator('.badge', { hasText: /^completed$/i })).toBeVisible({
      timeout: 10_000,
    });
    expect(getHits.length).toBe(baseline);

    await observer.ctx.close();
  });
});
