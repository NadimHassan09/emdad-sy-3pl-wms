import { test, expect } from '@playwright/test';

const SUPER_USER = {
  id: '00000000-0000-4000-8000-00000000aa',
  email: 'superadmin@emdad.example',
  fullName: 'Demo Super Admin',
  role: 'super_admin',
  authGroup: 'ADMIN' as const,
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

const MOCK_WAREHOUSES = [
  {
    id: '00000000-0000-4000-8000-00000000w001',
    name: 'Riyadh Main DC',
    code: 'WH-001',
    address: 'Industrial Area',
    city: 'Riyadh',
    country: 'SA',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-00000000w002',
    name: 'Jeddah Hub',
    code: 'WH-002',
    address: null,
    city: 'Jeddah',
    country: 'SA',
    status: 'inactive',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

async function seedAuthStorage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('wms.access_token', 'mock-token');
    window.localStorage.setItem('auth.fullName', 'Demo Super Admin');
  });
}

function isBackendApiRequest(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

async function mockAllApis(page: import('@playwright/test').Page) {
  await page.route((url) => isBackendApiRequest(url), async (route) => {
    const url = route.request().url();

    if (url.includes('/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: SUPER_USER }),
      });
      return;
    }

    if (url.includes('/warehouses/next-code')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { code: 'WH-099' } }),
      });
      return;
    }

    if (url.includes('/warehouses')) {
      const includeInactive = url.includes('includeInactive=true');
      const data = includeInactive
        ? MOCK_WAREHOUSES
        : MOCK_WAREHOUSES.filter((w) => w.status === 'active');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
      return;
    }

    if (url.includes('/dashboard/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
      return;
    }

    if (url.includes('/notifications')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], unreadCount: 0 } }),
      });
      return;
    }

    if (url.includes('/presence/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

async function openWarehousesPage(page: import('@playwright/test').Page) {
  await seedAuthStorage(page);
  await mockAllApis(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.goto('/warehouses', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.configure({ mode: 'serial' });

test.describe('Warehouses UI', () => {
  test('warehouses page shows list and create action', async ({ page }) => {
    await openWarehousesPage(page);
    await expect(page.getByRole('heading', { name: 'Warehouse sites' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('WH-001')).toBeVisible();
    await expect(page.getByText('Riyadh Main DC')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ New warehouse' })).toBeVisible();
  });

  test('warehouse filters panel is present', async ({ page }) => {
    await openWarehousesPage(page);
    await expect(page.getByText('Warehouse filters')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Search')).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
  });

  test('sidebar includes Warehouses nav link for super_admin', async ({ page }) => {
    await openWarehousesPage(page);
    await expect(page.getByRole('link', { name: 'Warehouses' })).toBeVisible({ timeout: 15_000 });
  });

  test('search filter narrows visible rows', async ({ page }) => {
    await openWarehousesPage(page);
    await page.getByLabel('Search').fill('Riyadh');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('WH-001')).toBeVisible();
    await expect(page.getByText('Jeddah Hub')).toHaveCount(0);
  });
});
