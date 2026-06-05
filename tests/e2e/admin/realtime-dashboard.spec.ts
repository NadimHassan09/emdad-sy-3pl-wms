/**
 * Phase RT-4 — dashboard KPI/chart cache patches + presence (no refetch).
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

test.describe('RT-4 Dashboard & Presence Realtime', () => {
  test('dashboard overview/charts patch on outbound confirm without refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/dashboard/overview', USERS.superAdmin.email);
    const overviewHits = trackGetRequests(observer.page, '/dashboard/overview');
    const chartHits = trackGetRequests(observer.page, '/dashboard/open-orders-charts');
    const baselineOverview = overviewHits.length;
    const baselineCharts = chartHits.length;

    const api = await WorkflowApi.create(request);
    const { product } = await api.createProduct();
    await api.seedStock(product.id, 10);
    const locs = await api.getWarehouseAndLocations();

    const create = await api.call('POST', '/outbound-orders', {
      companyId: STAGING.companyId,
      destinationAddress: 'RT-4 Dashboard',
      requiredShipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      lines: [{ productId: product.id, requestedQuantity: 1 }],
    });
    expect(create.status).toBeLessThan(300);
    const orderId = create.json.data.id;
    await api.call('POST', `/outbound-orders/${orderId}/confirm`, { warehouseId: locs.warehouseId });

    await expect.poll(
      () =>
        observer.ws.events.some(
          (e) =>
            e === 'dashboard.orders.updated' ||
            e === 'dashboard.kpi.updated' ||
            e.startsWith('order.outbound'),
        ),
      { timeout: 15_000 },
    ).toBe(true);

    await observer.page.waitForTimeout(3000);
    expect(overviewHits.length).toBe(baselineOverview);
    expect(chartHits.length).toBe(baselineCharts);

    await observer.ctx.close();
  });

  test('presence.online updates user activity pill without refetch', async ({ browser }) => {
    const observer = await openObserver(browser, '/users/system', USERS.superAdmin.email);
    const userHits = trackGetRequests(observer.page, '/api/users');
    const baseline = userHits.length;

    const peerCtx = await browser.newContext({ ignoreHTTPSErrors: true });
    const peerPage = await peerCtx.newPage();
    const peerWs = attachRealtimeWsCapture(peerPage);
    await adminLogin(peerPage, USERS.manager.email);
    await peerPage.goto('/dashboard/overview', { waitUntil: 'networkidle' });
    await peerPage.waitForTimeout(2000);

    await expect.poll(() => peerWs.events.includes('presence.online'), { timeout: 15_000 }).toBe(
      true,
    );
    await observer.page.waitForTimeout(2000);
    expect(userHits.length).toBe(baseline);

    await peerCtx.close();
    await observer.ctx.close();
  });
});
