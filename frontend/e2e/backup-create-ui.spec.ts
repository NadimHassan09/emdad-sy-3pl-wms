import { test, expect } from '@playwright/test';

const SUPER_EMAIL = 'superadmin@emdad.example';
const MANAGER_EMAIL = 'manager@emdad.example';
const PASSWORD = 'demo123';

const MOCK_JOB_ID = '00000000-0000-4000-8000-00000000c001';

const SUPER_USER = {
  id: '00000000-0000-4000-8000-0000000000aa',
  email: SUPER_EMAIL,
  fullName: 'Demo Super Admin',
  role: 'super_admin',
  authGroup: 'ADMIN' as const,
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

const MANAGER_USER = {
  id: '00000000-0000-4000-8000-0000000000bb',
  email: MANAGER_EMAIL,
  fullName: 'Demo Manager',
  role: 'wh_manager',
  authGroup: 'ADMIN' as const,
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

async function mockAuth(
  page: import('@playwright/test').Page,
  user: typeof SUPER_USER | typeof MANAGER_USER,
) {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          access_token: 'mock-token',
          token_type: 'Bearer',
          expires_in: 3600,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            authGroup: user.authGroup,
          },
        },
      }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: user }),
    });
  });
}

async function seedAuthStorage(
  page: import('@playwright/test').Page,
  user: typeof SUPER_USER | typeof MANAGER_USER,
) {
  await page.addInitScript((u) => {
    window.sessionStorage.setItem('wms.access_token', 'mock-token');
    window.localStorage.setItem('auth.fullName', u.fullName);
  }, user);
}

async function mockShellApis(page: import('@playwright/test').Page) {
  await page.route('**/api/dashboard/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });

  await page.route('**/api/presence/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [] } }),
    });
  });

  await page.route('**/api/notifications**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], unreadCount: 0 } }),
    });
  });
}

async function mockBackupListApis(page: import('@playwright/test').Page) {
  await page.route('**/api/backups/operations/active', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { busy: false, activeJobId: null, maintenance: false, maintenanceReason: null },
      }),
    });
  });

  await page.route('**/api/backups?**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { items: [], total: 0, limit: 20, offset: 0 },
      }),
    });
  });

  await page.route('**/api/backups/storage-policy', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          defaultPolicy: 'local_only',
          envFallbackPolicy: 'local_only',
          effectiveDefaultPolicy: 'local_only',
          updatedAt: new Date().toISOString(),
          updatedByUserId: null,
        },
      }),
    });
  });

  await page.route('**/api/integrations/google-drive/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          connected: false,
          folderId: null,
          connectedAt: null,
          connectedBy: null,
          rootFolderName: 'EMDAD WMS Backups',
          gdriveEnabled: true,
          gdriveConfigured: true,
          lastSyncedAt: null,
          pendingSyncCount: 0,
          failedSyncCount: 0,
          syncFailures: [],
        },
      }),
    });
  });

  await page.route('**/api/audit-logs?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: 'audit-1',
              action: 'backup.created',
              resourceType: 'backup_job',
              resourceId: MOCK_JOB_ID,
              actorEmail: SUPER_EMAIL,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        },
      }),
    });
  });
}

async function openBackupHistory(
  page: import('@playwright/test').Page,
  user: typeof SUPER_USER | typeof MANAGER_USER,
) {
  await seedAuthStorage(page, user);
  await mockShellApis(page);
  await mockAuth(page, user);
  await mockBackupListApis(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.goto('/settings/backups', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/login/);
  if (user.role === 'super_admin') {
    await expect(page.getByTestId('create-backup-btn')).toBeVisible({ timeout: 15_000 });
  }
}

async function mockCreateFlow(
  page: import('@playwright/test').Page,
  finalStatus: 'completed' | 'failed',
) {
  let pollCount = 0;

  await page.route('**/api/backups', async (route, request) => {
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            jobId: MOCK_JOB_ID,
            status: 'pending',
            storagePolicy: 'local_only',
            createdAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route(`**/api/backups/${MOCK_JOB_ID}/status`, async (route) => {
    pollCount += 1;
    const status =
      finalStatus === 'failed' ? 'failed' : pollCount < 2 ? 'running' : 'completed';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: MOCK_JOB_ID,
          status,
          progressPercent: status === 'completed' ? 100 : status === 'running' ? 45 : 0,
          bytesWritten: status === 'completed' ? 8_192_000 : 0,
          errorMessage: status === 'failed' ? 'Mock dump failure' : null,
          startedAt: new Date().toISOString(),
          completedAt: status === 'completed' ? new Date().toISOString() : null,
        },
      }),
    });
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('BACKUP-UI-CREATE — warmup', () => {
  test('warmup application bundles', async ({ page }) => {
    await openBackupHistory(page, SUPER_USER);
  });
});

test.describe('BACKUP-UI-CREATE — super_admin', () => {
  test('history page shows Create backup button and audit panel', async ({ page }) => {
    await openBackupHistory(page, SUPER_USER);
    await expect(page.getByTestId('create-backup-btn')).toBeVisible();
    await expect(page.getByText(/Recent backup audit events/i)).toBeVisible();
  });

  test('create modal shows label and storage policy fields', async ({ page }) => {
    await openBackupHistory(page, SUPER_USER);
    await page.getByTestId('create-backup-btn').click();
    await expect(page.getByTestId('create-backup-modal')).toBeVisible();
    await expect(page.getByTestId('create-backup-label')).toBeVisible();
    const policy = page.getByTestId('create-backup-policy');
    await expect(policy).toBeVisible();
    await expect(page.getByTestId('create-backup-submit')).toBeVisible();
    await expect(policy).toContainText(/Local only|محلي فقط/i);
    await expect(policy).toContainText(/Google Drive only|Drive فقط/i);
    await expect(policy).toContainText(/Local \+ Google Drive|محلي \+ Google Drive/i);
  });

  test('successful create shows progress then success state', async ({ page }) => {
    await mockCreateFlow(page, 'completed');
    await openBackupHistory(page, SUPER_USER);
    await page.getByTestId('create-backup-btn').click();
    await page.getByTestId('create-backup-label').fill('E2E UI create test');
    await page.getByTestId('create-backup-submit').click();
    await expect(page.getByTestId('create-backup-progress')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('create-backup-success')).toBeVisible({ timeout: 15_000 });
  });

  test('failed create shows failure state', async ({ page }) => {
    await mockCreateFlow(page, 'failed');
    await openBackupHistory(page, SUPER_USER);
    await page.getByTestId('create-backup-btn').click();
    await page.getByTestId('create-backup-submit').click();
    const failure = page.getByTestId('create-backup-failure');
    await expect(failure).toBeVisible({ timeout: 15_000 });
    await expect(failure.getByText(/Mock dump failure/i)).toBeVisible();
  });
});

test.describe('BACKUP-UI-CREATE — wh_manager RBAC', () => {
  test('manager can view history but not create backup', async ({ page }) => {
    await openBackupHistory(page, MANAGER_USER);
    await expect(page.getByTestId('create-backup-btn')).toHaveCount(0);
    await expect(page.getByText(/Recent backup audit events/i)).toHaveCount(0);
  });
});

test.describe('BACKUP-UI-CREATE — mocked drive policy', () => {
  test('drive policy options reflect connection state', async ({ page }) => {
    await openBackupHistory(page, SUPER_USER);
    await page.getByTestId('create-backup-btn').click();
    await expect(page.getByTestId('create-backup-policy')).toContainText(
      /Drive not connected|Drive غير متصل/i,
    );
    await page.getByTestId('create-backup-policy').selectOption('drive_only');
    await expect(page.getByTestId('create-backup-submit')).toBeDisabled();
  });
});

test.describe('BACKUP-UI-CREATE — report screenshots', () => {
  test('capture UI screenshots', async ({ page }) => {
    const outDir = '../docs/screenshots/backup-ui-create';
    await seedAuthStorage(page, SUPER_USER);
    await mockShellApis(page);
    await mockAuth(page, SUPER_USER);
    await mockBackupListApis(page);
    await mockCreateFlow(page, 'completed');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.goto('/settings/backups', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('create-backup-btn')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${outDir}/01-history-create-btn.png`, fullPage: true });
    await page.getByTestId('create-backup-btn').click();
    await page.screenshot({ path: `${outDir}/02-create-modal.png`, fullPage: true });
    await page.getByTestId('create-backup-label').fill('UI create screenshot test');
    await page.getByTestId('create-backup-submit').click();
    await expect(page.getByTestId('create-backup-progress')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${outDir}/03-create-progress.png`, fullPage: true });
    await expect(page.getByTestId('create-backup-success')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${outDir}/04-create-success.png`, fullPage: true });
  });
});
