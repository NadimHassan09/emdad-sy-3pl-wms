import { test, expect } from '@playwright/test';

const SUPER_EMAIL = 'superadmin@emdad.example';
const MANAGER_EMAIL = 'manager@emdad.example';
const PASSWORD = 'demo123';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email, input[type="email"]').first().fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

function settingsTab(page: import('@playwright/test').Page, label: string | RegExp) {
  return page
    .getByRole('navigation', { name: /Settings navigation/i })
    .locator('[role="listitem"]', { hasText: label });
}

test.describe('BACKUP-5C backup admin UI — super_admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SUPER_EMAIL);
  });

  test('settings shows all backup tabs including schedules, retention, health', async ({ page }) => {
    await page.goto('/settings/backups');
    const nav = page.getByRole('navigation', { name: /Settings navigation/i });
    await expect(settingsTab(page, /History/i)).toBeVisible();
    await expect(settingsTab(page, /^Upload$/i)).toBeVisible();
    await expect(settingsTab(page, /Restore/i)).toBeVisible();
    await expect(settingsTab(page, /Factory Reset/i)).toBeVisible();
    await expect(settingsTab(page, /Scheduled Backups/i)).toBeVisible();
    await expect(settingsTab(page, /Retention/i)).toBeVisible();
    await expect(settingsTab(page, /Health/i)).toBeVisible();
  });

  test('schedules page shows table and create button', async ({ page }) => {
    await page.goto('/settings/backups/schedules');
    await expect(page.getByRole('heading', { name: /Scheduled backups/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create schedule/i })).toBeVisible();
    await expect(page.getByText(/Frequency/i)).toBeVisible();
    await expect(page.getByText(/Next run/i)).toBeVisible();
  });

  test('schedule create modal shows required fields', async ({ page }) => {
    await page.goto('/settings/backups/schedules');
    await page.getByRole('button', { name: /Create schedule/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/Frequency/i)).toBeVisible();
    await expect(page.getByLabel(/Hour/i)).toBeVisible();
    await expect(page.getByLabel(/Minute/i)).toBeVisible();
    await expect(page.getByLabel(/Retention days/i)).toBeVisible();
  });

  test('retention page shows policies and preview', async ({ page }) => {
    await page.goto('/settings/backups/retention');
    await expect(page.getByRole('heading', { name: /Retention policies/i })).toBeVisible();
    await expect(page.getByText(/Daily/i)).toBeVisible();
    await expect(page.getByText(/Pre-snapshot protection/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cleanup preview/i })).toBeVisible();
    await expect(page.getByText(/Eligible backups/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Run retention cleanup/i })).toBeVisible();
  });

  test('health dashboard shows status cards and alerts section', async ({ page }) => {
    await page.goto('/settings/backups/health');
    await expect(page.getByRole('heading', { name: /Backup health dashboard/i })).toBeVisible();
    await expect(page.getByText(/Health status/i)).toBeVisible();
    await expect(page.getByText(/Storage used/i)).toBeVisible();
    await expect(page.getByText(/Hours since success/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Recent health monitoring events/i })).toBeVisible();
  });
});

test.describe('BACKUP-5C backup admin UI — wh_manager read-only', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, MANAGER_EMAIL);
  });

  test('manager sees read-only backup tabs', async ({ page }) => {
    await page.goto('/settings/backups');
    const nav = page.getByRole('navigation', { name: /Settings navigation/i });
    await expect(settingsTab(page, /Scheduled Backups/i)).toBeVisible();
    await expect(settingsTab(page, /Retention/i)).toBeVisible();
    await expect(settingsTab(page, /Health/i)).toBeVisible();
    await expect(settingsTab(page, /^Upload$/i)).toHaveCount(0);
    await expect(settingsTab(page, /Restore/i)).toHaveCount(0);
    await expect(settingsTab(page, /Factory Reset/i)).toHaveCount(0);
  });

  test('manager cannot mutate schedules', async ({ page }) => {
    await page.goto('/settings/backups/schedules');
    await expect(page.getByRole('button', { name: /Create schedule/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Run now/i })).toHaveCount(0);
  });

  test('manager cannot run retention cleanup', async ({ page }) => {
    await page.goto('/settings/backups/retention');
    await expect(page.getByRole('heading', { name: /Cleanup preview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run retention cleanup/i })).toHaveCount(0);
  });

  test('manager can view health dashboard', async ({ page }) => {
    await page.goto('/settings/backups/health');
    await expect(page.getByRole('heading', { name: /Backup health dashboard/i })).toBeVisible();
  });
});
