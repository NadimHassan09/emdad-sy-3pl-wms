/**
 * Visual capture for BACKUP-UI-CREATE-REPORT.md
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/screenshots/backup-ui-create');
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173';

const MOCK_JOB_ID = '00000000-0000-4000-8000-00000000c001';

const SUPER_USER = {
  id: '00000000-0000-4000-8000-0000000000aa',
  email: 'superadmin@emdad.example',
  fullName: 'Demo Super Admin',
  role: 'super_admin',
  authGroup: 'ADMIN',
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

async function mockApis(page) {
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
            id: SUPER_USER.id,
            email: SUPER_USER.email,
            fullName: SUPER_USER.fullName,
            role: SUPER_USER.role,
            authGroup: SUPER_USER.authGroup,
          },
        },
      }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: SUPER_USER }),
    });
  });

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
          gdriveEnabled: true,
          gdriveConfigured: true,
          rootFolderName: 'EMDAD WMS Backups',
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
        data: { items: [], total: 0, limit: 50, offset: 0 },
      }),
    });
  });

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
    const status = pollCount < 2 ? 'running' : 'completed';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: MOCK_JOB_ID,
          status,
          progressPercent: status === 'completed' ? 100 : 55,
          bytesWritten: status === 'completed' ? 8_192_000 : 4_000_000,
          errorMessage: null,
          startedAt: new Date().toISOString(),
          completedAt: status === 'completed' ? new Date().toISOString() : null,
        },
      }),
    });
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('wms.access_token', 'mock-token');
    window.localStorage.setItem('auth.fullName', 'Demo Super Admin');
  });
  await mockApis(page);

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.goto(`${baseUrl}/settings/backups`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByTestId('create-backup-btn').waitFor({ state: 'visible', timeout: 20_000 });
  await page.screenshot({ path: path.join(outDir, '01-history-create-btn.png'), fullPage: true });

  await page.getByTestId('create-backup-btn').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '02-create-modal.png'), fullPage: true });

  await page.getByTestId('create-backup-label').fill('UI create screenshot test');
  await page.getByTestId('create-backup-submit').click();
  await page.waitForSelector('[data-testid="create-backup-progress"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '03-create-progress.png'), fullPage: true });

  await page.waitForSelector('[data-testid="create-backup-success"]', { timeout: 15_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '04-create-success.png'), fullPage: true });

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
