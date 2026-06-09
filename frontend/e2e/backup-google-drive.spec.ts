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

function settingsNav(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: /Settings navigation/i });
}

function settingsTab(page: import('@playwright/test').Page, label: string | RegExp) {
  return settingsNav(page).locator('[role="listitem"]', { hasText: label });
}

test.describe('BACKUP-6C Google Drive admin UI — super_admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SUPER_EMAIL);
  });

  test('settings nav includes Google Drive tab', async ({ page }) => {
    await page.goto('/settings/backups');
    await expect(settingsTab(page, /Google Drive/i)).toBeVisible();
  });

  test('Google Drive page shows connection panel and storage policy', async ({ page }) => {
    await page.goto('/settings/backups/google-drive');
    await expect(page.getByRole('heading', { name: /^Google Drive$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Drive', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test connection', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disconnect Drive', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Storage policy/i })).toBeVisible();
    await expect(page.getByLabel(/Default policy/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Backup sync failures/i })).toBeVisible();
    await expect(page.getByText(/No failed Drive sync jobs/i)).toBeVisible();
  });

  test('shows connection status cards when loaded', async ({ page }) => {
    await page.goto('/settings/backups/google-drive');
    await expect(page.getByText('Connection status', { exact: true })).toBeVisible();
    await expect(page.getByText('Sync status', { exact: true })).toBeVisible();
    await expect(page.getByText('Root folder', { exact: true }).first()).toBeVisible();
    await expect(page.locator('section').filter({ hasText: /Root folder/i }).getByText(/EMDAD WMS Backups/i)).toBeVisible();
  });
});

test.describe('BACKUP-6C Google Drive admin UI — wh_manager', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, MANAGER_EMAIL);
  });

  test('manager cannot access Google Drive settings tab', async ({ page }) => {
    await page.goto('/settings/backups');
    await expect(settingsTab(page, /Google Drive/i)).toHaveCount(0);
  });

  test('direct URL redirects manager away from Google Drive page', async ({ page }) => {
    await page.goto('/settings/backups/google-drive');
    await expect(page).not.toHaveURL(/\/settings\/backups\/google-drive/);
  });
});

test.describe('BACKUP-6C Google Drive — mocked API flows', () => {
  const mockStatus = (connected: boolean, gdriveConfigured = true) => ({
    connected,
    folderId: connected ? 'mock-folder-id-12345' : null,
    connectedAt: connected ? '2026-06-09T00:00:00.000Z' : null,
    connectedBy: connected
      ? { id: '00000000-0000-4000-8000-0000000000ab', email: SUPER_EMAIL, fullName: 'Demo Super Admin' }
      : null,
    rootFolderName: 'EMDAD WMS Backups',
    gdriveEnabled: true,
    gdriveConfigured,
    lastSyncedAt: connected ? '2026-06-09T01:00:00.000Z' : null,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    syncFailures: [],
  });

  test.beforeEach(async ({ page }) => {
    await login(page, SUPER_EMAIL);
  });

  test('Connect Drive redirects to OAuth URL when configured', async ({ page }) => {
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStatus(false, true) }),
      });
    });
    await page.route('**/api/integrations/google-drive/auth-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=mock', state: 'mock-state' },
        }),
      });
    });

    await page.goto('/settings/backups/google-drive');
    await expect(page.getByRole('button', { name: 'Connect Drive', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Connect Drive', exact: true }).click();
    await page.waitForURL(/accounts\.google\.com/, { timeout: 10_000 });
  });

  test('Connect Drive disabled when OAuth not configured', async ({ page }) => {
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStatus(false, false) }),
      });
    });

    await page.goto('/settings/backups/google-drive');
    await expect(page.getByRole('button', { name: 'Connect Drive', exact: true })).toBeDisabled();
    await expect(page.getByText(/OAuth not configured/i)).toBeVisible();
  });

  test('Test connection shows success toast when connected', async ({ page }) => {
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStatus(true) }),
      });
    });
    await page.route('**/api/integrations/google-drive/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ok: true, connected: true, folderName: 'EMDAD WMS Backups', folderId: 'mock-folder-id-12345' },
        }),
      });
    });

    await page.goto('/settings/backups/google-drive');
    await expect(page.getByText(/^Connected$/)).toBeVisible();
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByText(/Connection OK/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Disconnect Drive confirms and updates status', async ({ page }) => {
    let connected = true;
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStatus(connected) }),
      });
    });
    await page.route('**/api/integrations/google-drive', async (route) => {
      if (route.request().method() === 'DELETE') {
        connected = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { disconnected: true } }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/settings/backups/google-drive');
    await page.getByRole('button', { name: 'Disconnect Drive', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /^Disconnect$/i }).click();
    await expect(page.getByText(/Google Drive disconnected/i)).toBeVisible({ timeout: 10_000 });
  });

  test('Save storage policy updates default policy', async ({ page }) => {
    let currentPolicy = 'local_only';
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStatus(true) }),
      });
    });
    await page.route('**/api/backups/storage-policy', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              defaultPolicy: currentPolicy,
              envFallbackPolicy: 'local_and_drive',
              effectiveDefaultPolicy: currentPolicy,
              updatedAt: '2026-06-09T00:00:00.000Z',
              updatedByUserId: null,
            },
          }),
        });
        return;
      }
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as { defaultPolicy: string };
        currentPolicy = body.defaultPolicy;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { defaultPolicy: currentPolicy, updatedAt: '2026-06-09T01:00:00.000Z' },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/settings/backups/google-drive');
    await page.getByLabel(/Default policy/i).selectOption('local_and_drive');
    await page.getByRole('button', { name: /Save policy/i }).click();
    await expect(page.getByText(/Effective: Local \+ Google Drive/i)).toBeVisible();
  });

  test('Retry sync button appears for failed jobs', async ({ page }) => {
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...mockStatus(true),
            failedSyncCount: 1,
            syncFailures: [
              {
                id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                type: 'manual',
                label: 'BACKUP-6C test',
                completedAt: '2026-06-09T00:30:00.000Z',
                storagePolicy: 'local_and_drive',
                gdriveSyncError: 'Simulated upload failure',
                gdriveSyncAttempts: 1,
                gdriveNextRetryAt: '2026-06-09T01:30:00.000Z',
              },
            ],
          },
        }),
      });
    });
    await page.route('**/api/backups/*/sync-drive', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            gdriveSyncStatus: 'synced',
            gdriveFileId: 'mock-file-id',
            gdriveSyncedAt: '2026-06-09T01:00:00.000Z',
            gdriveSyncError: null,
            gdriveSyncAttempts: 2,
            gdriveNextRetryAt: null,
          },
        }),
      });
    });

    await page.goto('/settings/backups/google-drive');
    await expect(page.getByText(/Simulated upload failure/i)).toBeVisible();
    await page.getByRole('button', { name: /Retry sync/i }).click();
    await expect(page.getByText(/Backup synced to Google Drive/i)).toBeVisible({ timeout: 10_000 });
  });

  test('OAuth success redirect shows connected toast', async ({ page }) => {
    await page.route('**/api/integrations/google-drive/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStatus(true) }),
      });
    });

    await page.goto('/settings/backups/google-drive?drive=connected');
    await expect(page.getByText(/Google Drive connected successfully/i)).toBeVisible({ timeout: 10_000 });
  });
});
