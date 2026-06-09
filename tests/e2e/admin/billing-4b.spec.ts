import { test, expect } from '@playwright/test';

import { adminLogin } from '../../helpers/ui';

test.describe('Billing 4B — Dashboard and invoice actions', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('billing dashboard loads KPIs', async ({ page }) => {
    await page.goto('/billing/dashboard');
    await expect(page.getByRole('heading', { name: /billing dashboard/i })).toBeVisible();
    await expect(page.getByText(/outstanding|month revenue|open invoices/i).first()).toBeVisible();
  });

  test('billing plan detail shows cycle preview', async ({ page }) => {
    await page.goto('/billing/plans');
    await page.locator('table tbody tr').first().click();
    await expect(page.getByText(/current cycle preview/i)).toBeVisible({ timeout: 20_000 });
  });
});
