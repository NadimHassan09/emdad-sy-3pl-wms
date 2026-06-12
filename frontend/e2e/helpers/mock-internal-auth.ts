import type { Page } from '@playwright/test';

export type MockInternalUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'wh_manager' | 'wh_operator';
  authGroup: 'ADMIN' | 'OPERATOR';
  tenantCompanyId: string;
  workerId: string | null;
};

export const SUPER_USER: MockInternalUser = {
  id: '00000000-0000-4000-8000-0000000000ab',
  email: 'superadmin@emdad.example',
  fullName: 'Demo Super Admin',
  role: 'super_admin',
  authGroup: 'ADMIN',
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

export const MANAGER_USER: MockInternalUser = {
  id: '00000000-0000-4000-8000-0000000000cd',
  email: 'manager@emdad.example',
  fullName: 'Demo Manager',
  role: 'wh_manager',
  authGroup: 'ADMIN',
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: null,
};

export const OPERATOR_USER: MockInternalUser = {
  id: '00000000-0000-4000-8000-0000000000ef',
  email: 'operator@emdad.example',
  fullName: 'Demo Operator',
  role: 'wh_operator',
  authGroup: 'OPERATOR',
  tenantCompanyId: '00000000-0000-4000-8000-000000000001',
  workerId: '00000000-0000-4000-8000-0000000000f1',
};

export async function mockInternalAuth(page: Page, user: MockInternalUser) {
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

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

export async function seedAuthStorage(page: Page, user: MockInternalUser) {
  await page.addInitScript((u) => {
    window.sessionStorage.setItem('wms.access_token', 'mock-token');
    window.localStorage.setItem('auth.fullName', u.fullName);
  }, user);
}

type SetupOptions = {
  skipDomainMocks?: boolean;
};

export async function setupInternalNavTest(page: Page, user: MockInternalUser) {
  const { mockAppShellApis } = await import('./mock-backup-admin-apis');
  await mockInternalAuth(page, user);
  await seedAuthStorage(page, user);
  await mockAppShellApis(page);

  await page.route('**/api/tasks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
    });
  });

}

export async function setupBackupAdminTest(
  page: Page,
  user: MockInternalUser,
  options: SetupOptions = {},
) {
  const { mockAppShellApis, mockBackupAdminApis } = await import('./mock-backup-admin-apis');
  await mockInternalAuth(page, user);
  await seedAuthStorage(page, user);
  await mockAppShellApis(page);
  if (!options.skipDomainMocks) {
    await mockBackupAdminApis(page);
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}
