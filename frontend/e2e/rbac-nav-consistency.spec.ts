import { test, expect } from '@playwright/test';

import {
  MANAGER_USER,
  OPERATOR_USER,
  setupInternalNavTest,
} from './helpers/mock-internal-auth';

function tasksNav(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: /Tasks navigation/i });
}

test.describe('RBAC nav consistency — internal transfer', () => {
  test('wh_operator does not see Internal transfer in Tasks sub-nav', async ({ page }) => {
    await setupInternalNavTest(page, OPERATOR_USER);
    await page.goto('/tasks');
    await expect(tasksNav(page)).toBeVisible();
    await expect(tasksNav(page).locator('[role="listitem"]', { hasText: 'Internal transfer' })).toHaveCount(0);
    await expect(tasksNav(page).locator('[role="listitem"]', { hasText: /^Tasks$/ })).toBeVisible();
  });

  test('wh_operator visiting /internal is redirected to /tasks', async ({ page }) => {
    await setupInternalNavTest(page, OPERATOR_USER);
    await page.goto('/internal');
    await expect(page).toHaveURL(/\/tasks$/);
  });

  test('wh_manager sees Internal transfer in Tasks sub-nav', async ({ page }) => {
    await setupInternalNavTest(page, MANAGER_USER);

    await page.route('**/api/inventory/ledger**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
    });

    await page.goto('/tasks');
    await expect(tasksNav(page).locator('[role="listitem"]', { hasText: 'Internal transfer' })).toBeVisible();
  });

  test('wh_manager route guard allows /internal', async ({ page }) => {
    await setupInternalNavTest(page, MANAGER_USER);

    await page.route('**/api/inventory/ledger**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
    });

    await page.goto('/internal');
    await expect(page).toHaveURL(/\/internal$/);
    await expect(page).not.toHaveURL(/\/tasks$/);
  });
});
