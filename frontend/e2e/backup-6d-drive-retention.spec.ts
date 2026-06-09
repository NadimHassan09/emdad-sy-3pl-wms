import { test, expect } from '@playwright/test';

import { MANAGER_USER, setupBackupAdminTest, SUPER_USER } from './helpers/mock-internal-auth';

function settingsTab(page: import('@playwright/test').Page, label: string | RegExp) {
  return page
    .getByRole('navigation', { name: /Settings navigation/i })
    .locator('[role="listitem"]', { hasText: label });
}

const mockDrivePolicies = {
  keepLastDaily: 7,
  keepLastWeekly: 4,
  keepLastMonthly: 6,
  driveRetentionCleanupEnabled: true,
};

const mockDrivePreview = {
  dryRun: true,
  policies: { keepLastDaily: 7, keepLastWeekly: 4, keepLastMonthly: 6 },
  buckets: [
    {
      bucket: 'daily',
      keepLast: 7,
      totalEligible: 12,
      retainedCount: 7,
      expiredCount: 2,
      retainedJobIds: [],
      expiredJobIds: ['a', 'b'],
    },
  ],
  protected: [{ jobId: 'protected-1', type: 'manual', label: null, completedAt: null, reasons: ['latest_successful'] }],
  deletedDriveCount: 2,
  deletedJobCount: 0,
  deletedDriveJobIds: ['a', 'b'],
  deletedJobIds: [],
};

test.describe('BACKUP-6D Drive retention + storage policies — super_admin', () => {
  test.beforeEach(async ({ page }) => {
    await setupBackupAdminTest(page, SUPER_USER);
  });

  test('settings nav includes Storage Policy and Google Drive tabs', async ({ page }) => {
    await page.goto('/settings/backups');
    await expect(settingsTab(page, /Storage Policy/i)).toBeVisible();
    await expect(settingsTab(page, /Google Drive/i)).toBeVisible();
  });

  test('retention page shows local and Drive sections', async ({ page }) => {
    await page.goto('/settings/backups/retention');
    await expect(page.getByRole('heading', { name: /Local retention policies/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Google Drive retention policies/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Drive cleanup preview/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Drive retention audit events/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run local retention cleanup/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run Drive retention cleanup/i })).toBeVisible();
  });

  test('storage policy page shows global policy and usage', async ({ page }) => {
    await page.goto('/settings/backups/storage-policy');
    await expect(page.getByRole('heading', { name: /Global storage policy/i })).toBeVisible();
    await expect(page.getByLabel(/Default policy/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Storage usage/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Google Drive sync status/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save policy/i })).toBeVisible();
  });

  test('schedule modal includes storage policy field', async ({ page }) => {
    await page.goto('/settings/backups/schedules');
    await page.getByRole('button', { name: /Create schedule/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/Storage policy/i)).toBeVisible();
  });

  test('mocked Drive retention preview renders counts', async ({ page }) => {
    await page.route('**/api/backups/retention/drive/policies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockDrivePolicies }),
      });
    });
    await page.route('**/api/backups/retention/drive/preview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockDrivePreview }),
      });
    });

    await page.goto('/settings/backups/retention');
    await expect(page.getByText('7', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Drive file deletions/i)).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  });
});

test.describe('BACKUP-6D Drive retention + storage policies — wh_manager read-only', () => {
  test.beforeEach(async ({ page }) => {
    await setupBackupAdminTest(page, MANAGER_USER);
  });

  test('manager sees read-only backup tabs including Storage Policy and Google Drive', async ({ page }) => {
    await page.goto('/settings/backups');
    await expect(settingsTab(page, /Storage Policy/i)).toBeVisible();
    await expect(settingsTab(page, /Google Drive/i)).toBeVisible();
    await expect(settingsTab(page, /Retention/i)).toBeVisible();
  });

  test('manager can view Drive retention preview but cannot run cleanup', async ({ page }) => {
    await page.goto('/settings/backups/retention');
    await expect(page.getByRole('heading', { name: /Drive cleanup preview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run Drive retention cleanup/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Run local retention cleanup/i })).toHaveCount(0);
  });

  test('manager can view storage policy but cannot save', async ({ page }) => {
    await page.goto('/settings/backups/storage-policy');
    await expect(page.getByRole('heading', { name: /Global storage policy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save policy/i })).toHaveCount(0);
  });

  test('manager can view Google Drive page without mutation buttons', async ({ page }) => {
    await page.goto('/settings/backups/google-drive');
    await expect(page.getByRole('heading', { name: /^Google Drive$/i })).toBeVisible();
    await expect(page.getByText('Connection status', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Drive', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Disconnect Drive', exact: true })).toHaveCount(0);
  });
});
