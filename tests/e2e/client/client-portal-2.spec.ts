import { test, expect } from '@playwright/test';

import { clientLogin } from '../../helpers/ui';

test.describe('Client Portal P2A — Dashboard, Billing, Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await clientLogin(page);
  });

  test('dashboard shows KPI widgets', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/storage utilization|stock volume/i).first()).toBeVisible();
    await expect(page.getByText(/active orders|inbound orders|outbound orders/i).first()).toBeVisible();
  });

  test('dashboard shows recent invoices for client admin', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/recent invoices/i)).toBeVisible();
  });

  test('billing page loads with widgets and invoice history', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible();
    await expect(page.getByText(/days until renewal|current invoice amount|total invoices/i).first()).toBeVisible();
    await expect(page.getByText(/invoice history/i)).toBeVisible();
  });

  test('notifications page loads with filters', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /unread/i })).toBeVisible();
  });

  test('topbar view all navigates to notifications page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /notifications/i }).click();
    await page.getByRole('button', { name: /view all/i }).click();
    await expect(page).toHaveURL(/\/notifications/);
  });
});
