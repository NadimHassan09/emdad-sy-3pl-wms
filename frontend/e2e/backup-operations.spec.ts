import { test, expect } from '@playwright/test';

const SUPER_EMAIL = 'superadmin@emdad.example';
const SUPER_PASSWORD = 'demo123';

async function loginAsSuperAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email, input[type="email"]').first().fill(SUPER_EMAIL);
  await page.locator('#login-password').fill(SUPER_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

test.describe('BACKUP-5B backup operations UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('overview shows restore, factory reset, and upload actions', async ({ page }) => {
    await page.goto('/backups');
    await expect(page.getByRole('navigation', { name: /Backups navigation/i })).toBeVisible();
    await expect(page.getByTestId('restore-backup-btn')).toBeVisible();
    await expect(page.getByTestId('factory-reset-btn')).toBeVisible();
    await expect(page.getByTestId('upload-backup-btn')).toBeVisible();
  });

  test('upload opens modal with drag-and-drop zone', async ({ page }) => {
    await page.goto('/backups');
    await page.getByTestId('upload-backup-btn').click();
    await expect(page.getByText(/Drag and drop a backup file/i)).toBeVisible();
  });

  test('upload rejects non-dump files client-side', async ({ page }) => {
    await page.goto('/backups');
    await page.getByTestId('upload-backup-btn').click();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a dump'),
    });
    await expect(page.getByText(/Validation failed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Only PostgreSQL/i)).toBeVisible();
  });

  test('restore modal requires RESTORE phrase and shows warnings', async ({ page }) => {
    await page.goto('/backups');
    await page.getByTestId('restore-backup-btn').click();
    await expect(page.getByText(/Warnings/i)).toBeVisible();
    await expect(page.getByText(/maintenance mode/i)).toBeVisible();
    await expect(page.getByLabel(/Type RESTORE/i)).toBeVisible();
    const restoreBtn = page.getByRole('button', { name: /Restore database/i });
    await expect(restoreBtn).toBeDisabled();
    await page.getByLabel(/Type RESTORE/i).fill('RESTORE');
    await expect(restoreBtn).toBeDisabled();

    const select = page.getByLabel(/Select backup/i);
    const options = await select.locator('option').count();
    if (options > 1) {
      await select.selectOption({ index: 1 });
      await expect(restoreBtn).toBeEnabled({ timeout: 5_000 });
    }
  });

  test('factory reset modal requires FACTORY RESET phrase', async ({ page }) => {
    await page.goto('/backups');
    await page.getByTestId('factory-reset-btn').click();
    await expect(page.getByText(/Danger zone/i)).toBeVisible();
    await expect(page.getByLabel(/Type FACTORY RESET/i)).toBeVisible();
    const resetBtn = page.getByRole('button', { name: /Factory reset database/i });
    await expect(resetBtn).toBeDisabled();
    await page.getByLabel(/Type FACTORY RESET/i).fill('FACTORY RESET');
    await expect(resetBtn).toBeEnabled();
  });
});
