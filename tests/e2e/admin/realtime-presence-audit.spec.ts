/**
 * Phase 5 — Presence & session WS validation (multi-session).
 */
import { test, expect, type Browser } from '@playwright/test';

import { STAGING, USERS } from '../../helpers/constants';
import { adminLogin } from '../../helpers/ui';
import { attachRealtimeWsCapture } from '../../helpers/realtime-audit';

async function openAdmin(browser: Browser, route: string, email: string) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const ws = attachRealtimeWsCapture(page);
  await adminLogin(page, email);
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return { page, ws, ctx };
}

test.describe.configure({ mode: 'serial' });

test.describe('Presence & Session Audit', () => {
  test('presence.online emitted when peer admin connects', async ({ browser }) => {
    const observer = await openAdmin(browser, '/users/system', USERS.superAdmin.email);

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
    await observer.ctx.close();
  });

  test('presence.offline emitted when peer disconnects', async ({ browser }) => {
    const observer = await openAdmin(browser, '/users/system', USERS.superAdmin.email);

    const peerCtx = await browser.newContext({ ignoreHTTPSErrors: true });
    const peerPage = await peerCtx.newPage();
    const peerWs = attachRealtimeWsCapture(peerPage);
    await adminLogin(peerPage, USERS.manager.email);
    await peerPage.goto('/dashboard/overview', { waitUntil: 'networkidle' });
    await expect.poll(() => peerWs.events.includes('presence.online'), { timeout: 15_000 }).toBe(
      true,
    );

    await peerCtx.close();
    await pageWaitForPresenceOffline(observer.ws, 15_000);

    await observer.ctx.close();
  });
});

async function pageWaitForPresenceOffline(
  ws: ReturnType<typeof attachRealtimeWsCapture>,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ws.events.includes('presence.offline')) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('presence.offline not received within timeout');
}
