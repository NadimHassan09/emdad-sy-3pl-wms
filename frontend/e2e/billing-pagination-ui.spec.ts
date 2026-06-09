import { test, expect } from '@playwright/test';

const SUPER_EMAIL = 'superadmin@emdad.example';
const PASSWORD = 'demo123';

const SUPER_USER = {
  id: '00000000-0000-4000-8000-0000000000aa',
  email: SUPER_EMAIL,
  fullName: 'Demo Super Admin',
  role: 'super_admin',
  authGroup: 'ADMIN' as const,
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

const MOCK_PLAN_OVERVIEW = {
  items: [
    {
      plan: {
        id: '00000000-0000-4000-8000-00000000b001',
        companyId: '00000000-0000-4000-8000-000000000002',
        active: true,
        cycleLengthDays: 30,
        fixedSubscriptionFee: '500',
        inboundOrderFee: '1',
        outboundOrderFee: '2',
        packagingFee: '0',
        qualityCheckFee: '0',
        excessVolumeFeePerDay: '0',
        excessWeightFeePerDay: '0',
        reservedVolume: '10',
        reservedWeight: '100',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      companyId: '00000000-0000-4000-8000-000000000002',
      companyName: 'Acme Logistics',
      companyStatus: 'active',
      currentCycle: {
        id: '00000000-0000-4000-8000-00000000c001',
        companyId: '00000000-0000-4000-8000-000000000002',
        billingPlanId: '00000000-0000-4000-8000-00000000b001',
        startsAt: '2026-05-01T00:00:00.000Z',
        endsAt: '2026-06-30T00:00:00.000Z',
        status: 'active',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      cycleStart: '2026-05-01T00:00:00.000Z',
      cycleEnd: '2026-06-30T00:00:00.000Z',
      daysRemaining: 21,
      cycleStatus: 'active',
      billingStatus: 'operational',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const MOCK_INVOICES_PAGE = {
  items: [
    {
      id: '00000000-0000-4000-8000-00000000d001',
      companyId: '00000000-0000-4000-8000-000000000002',
      billingCycleId: '00000000-0000-4000-8000-00000000c001',
      invoiceNumber: 'INV-2026-0001',
      status: 'open',
      totalAmount: '750.00',
      issuedAt: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      billingCycle: {
        id: '00000000-0000-4000-8000-00000000c001',
        startsAt: '2026-05-01T00:00:00.000Z',
        endsAt: '2026-06-30T00:00:00.000Z',
        status: 'active',
        rateSnapshot: {},
        billingPlanId: '00000000-0000-4000-8000-00000000b001',
      },
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

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

    if (url.includes('/auth/login')) {
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
      return;
    }

    if (url.includes('/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: SUPER_USER }),
      });
      return;
    }

    if (url.includes('/billing/plans')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_PLAN_OVERVIEW }),
      });
      return;
    }

    if (url.includes('/billing/invoices')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_INVOICES_PAGE }),
      });
      return;
    }

    if (url.includes('/billing/capacity')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalWarehouseVolumeCbm: '1000',
            allocatableCapacityCbm: '900',
            allocatedVolumeCbm: '100',
            remainingAllocatableCbm: '800',
            allocationRatio: 0.9,
          },
        }),
      });
      return;
    }

    if (url.includes('/billing/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    if (url.includes('/companies')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: '00000000-0000-4000-8000-000000000002',
              name: 'Acme Logistics',
              status: 'active',
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/dashboard/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            counters: { itemsInCatalog: 0, totalCustomers: 0 },
            openOrders: { inbound: 0, outbound: 0 },
            openTasksByType: [],
            capacity: {
              totalStorageLocations: 0,
              occupiedLocations: 0,
              consumedPercent: 0,
            },
            soonExpiryLots: [],
            recentOrders: { inbound: [], outbound: [] },
          },
        }),
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

async function openBillingPage(page: import('@playwright/test').Page, path: string) {
  await seedAuthStorage(page);
  await mockAllApis(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe.configure({ mode: 'serial' });

test.describe('Billing pagination UI', () => {
  test('billing plans page shows server-paginated rows', async ({ page }) => {
    await openBillingPage(page, '/billing/plans');
    await expect(page.getByText('Billing plans')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Acme Logistics')).toBeVisible();
    await expect(page.getByText('21d')).toBeVisible();
  });

  test('billing plans filters panel is present', async ({ page }) => {
    await openBillingPage(page, '/billing/plans');
    await expect(page.getByText('Billing plan filters')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Search client')).toBeVisible();
    await expect(page.getByLabel('Expiry from')).toBeVisible();
  });

  test('billing invoices page shows server-paginated rows', async ({ page }) => {
    await openBillingPage(page, '/billing/invoices');
    await expect(page.getByText('Invoices')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('INV-2026-0001')).toBeVisible();
  });

  test('billing invoices filters include cycle and expiry', async ({ page }) => {
    await openBillingPage(page, '/billing/invoices');
    await expect(page.getByText('Invoice filters')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Search invoice')).toBeVisible();
    await expect(page.getByLabel('Cycle status')).toBeVisible();
    await expect(page.getByLabel('Cycle expiry from')).toBeVisible();
  });

  test('dashboard shows billing widget section', async ({ page }) => {
    await openBillingPage(page, '/dashboard/overview');
    await expect(page.getByText('Billing', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Billing cycles expiring soon' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overdue clients' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent invoices' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Suspended accounts' })).toBeVisible();
  });
});
