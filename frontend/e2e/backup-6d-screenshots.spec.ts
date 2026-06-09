import { test } from '@playwright/test';

import { setupBackupAdminTest, SUPER_USER } from './helpers/mock-internal-auth';

const OUT_DIR = '../docs/evidence/backup-6d/screenshots';

test.describe.configure({ mode: 'serial' });

test.describe('BACKUP-6D evidence screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await setupBackupAdminTest(page, SUPER_USER);
  });

  test('capture retention, storage policy, and google drive pages', async ({ page }) => {
    await page.goto('/settings/backups/retention');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/01-retention-page.png`, fullPage: true });

    await page.goto('/settings/backups/storage-policy');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/02-storage-policy-page.png`, fullPage: true });

    await page.goto('/settings/backups/google-drive');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/03-google-drive-page.png`, fullPage: true });

    await page.goto('/settings/backups/schedules');
    await page.getByRole('button', { name: /Create schedule/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/04-schedule-storage-policy-modal.png`, fullPage: true });
  });
});
