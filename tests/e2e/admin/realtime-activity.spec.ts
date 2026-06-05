/**
 * Phase RT-3 — live activity stream (audit tail + notification counter).
 */
import { test, expect, type Browser, type Page, type APIRequestContext } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { authHeaders, loginClient } from '../../helpers/auth';
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

async function clientCreateProduct(request: APIRequestContext) {
  const session = await loginClient(request);
  const sku = `RT3-${Date.now().toString(36).toUpperCase()}`;
  const res = await request.post(`${STAGING.clientUrl}/api/client/products`, {
    headers: authHeaders(session.accessToken),
    data: {
      name: `RT3 Client Product ${sku}`,
      sku,
      uom: 'piece',
    },
  });
  const json = await res.json();
  return { status: res.status(), json, sku };
}

test.describe.configure({ mode: 'serial' });

test.describe('RT-3 Live Activity Stream', () => {
  test('audit log — new row appears in peer session without refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/audit-logs', USERS.superAdmin.email);
    const getHits = trackGetRequests(observer.page, '/api/audit-logs');
    const baseline = getHits.length;

    const api = await WorkflowApi.create(request);
    await api.createProduct();

    await expect.poll(
      () => observer.ws.events.includes('audit_log.created'),
      { timeout: 15_000 },
    ).toBe(true);

    await expect(observer.page.getByRole('cell', { name: /PRODUCT CREATED/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(getHits.length).toBe(baseline);

    await observer.ctx.close();
  });

  test('notification count — updates in peer session without polling refetch', async ({
    browser,
    request,
  }) => {
    const observer = await openObserver(browser, '/dashboard', USERS.manager.email);
    const bell = observer.page.getByRole('button', { name: /Notifications/i });
    await expect(bell).toBeVisible();

    const getHits = trackGetRequests(observer.page, '/api/notifications');
    const baseline = getHits.length;

    const created = await clientCreateProduct(request);
    expect(created.status).toBeLessThan(300);

    await expect.poll(
      () => observer.ws.events.includes('notification.created'),
      { timeout: 15_000 },
    ).toBe(true);

    await expect
      .poll(async () => {
        const label = (await bell.getAttribute('aria-label')) ?? '';
        return /\d+ unread/.test(label);
      }, { timeout: 10_000 })
      .toBe(true);
    expect(getHits.length).toBe(baseline);

    await observer.ctx.close();
  });
});
