import { test, expect } from '@playwright/test';

import { clientLogin } from '../../helpers/ui';

const CLIENT_SCREENS = [
  { path: '/', pattern: /welcome|home|portal|dashboard/i },
  { path: '/dashboard', pattern: /dashboard|welcome back/i },
  { path: '/products', pattern: /product/i },
  { path: '/inbound-orders', pattern: /inbound|order/i },
  { path: '/outbound-orders', pattern: /outbound|order/i },
  { path: '/stock', pattern: /stock|inventory/i },
  { path: '/billing', pattern: /billing|invoice/i },
  { path: '/notifications', pattern: /notification/i },
];

test.describe('Client Frontend Screen Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await clientLogin(page);
  });

  for (const screen of CLIENT_SCREENS) {
    test(`loads ${screen.path}`, async ({ page }) => {
      await page.goto(screen.path);
      await expect(page.locator('body')).toContainText(screen.pattern, { timeout: 20_000 });
    });
  }
});
