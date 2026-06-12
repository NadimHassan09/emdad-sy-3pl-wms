import { test, expect } from '@playwright/test';

const SUPER_EMAIL = 'superadmin@emdad.example';
const PASSWORD = 'demo123';

const MOCK_NOTIFICATIONS_PAGE = {
  items: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      type: 'admin_inbound_pending_approval',
      title: 'Inbound order needs approval',
      body: 'Acme: inbound order IN-001 is waiting for your approval.',
      referenceType: 'inbound_order',
      referenceId: '00000000-0000-4000-8000-000000000201',
      isRead: false,
      readAt: null,
      createdAt: '2026-06-12T08:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      type: 'admin_sla_breach_l1',
      title: 'Task SLA breached',
      body: 'Pick task is past its SLA.',
      referenceType: 'warehouse_task',
      referenceId: '00000000-0000-4000-8000-000000000301',
      isRead: true,
      readAt: '2026-06-12T09:00:00.000Z',
      createdAt: '2026-06-11T08:00:00.000Z',
    },
  ],
  unreadCount: 1,
  total: 2,
  limit: 20,
  offset: 0,
};

const MOCK_NOTIFICATIONS_UNREAD = {
  ...MOCK_NOTIFICATIONS_PAGE,
  items: [MOCK_NOTIFICATIONS_PAGE.items[0]],
  total: 1,
};

test.describe('Admin notifications center', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'mock-token',
          user: {
            id: '00000000-0000-4000-8000-0000000000aa',
            email: SUPER_EMAIL,
            fullName: 'Demo Super Admin',
            role: 'super_admin',
          },
        }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-0000000000aa',
          email: SUPER_EMAIL,
          fullName: 'Demo Super Admin',
          role: 'super_admin',
          companyId: '00000000-0000-4000-8000-000000000001',
        }),
      });
    });

    await page.route('**/api/notifications**', async (route) => {
      const url = new URL(route.request().url());
      const isRead = url.searchParams.get('isRead');
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_NOTIFICATIONS_PAGE.items[0], isRead: true }),
        });
        return;
      }
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updated: 1 }),
        });
        return;
      }
      const body = isRead === 'false' ? MOCK_NOTIFICATIONS_UNREAD : MOCK_NOTIFICATIONS_PAGE;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/notifications')) return;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(SUPER_EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard/**');
  });

  test('shows notifications page with filters and mark all read', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText('Inbound order needs approval')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark all read' })).toBeVisible();

    await page.getByRole('button', { name: 'Unread' }).click();
    await expect(page.getByText('Inbound order needs approval')).toBeVisible();
    await expect(page.getByText('Task SLA breached')).not.toBeVisible();
  });

  test('sidebar includes notifications link', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('link', { name: 'Notifications' })).toBeVisible();
  });
});
