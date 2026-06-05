import type { Page } from '@playwright/test';

import { STAGING, USERS } from './constants';

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function adminLogin(page: Page, email = USERS.superAdmin.email, password = STAGING.password) {
  await fillLoginForm(page, email, password);
  await page.waitForURL(/\/(dashboard|orders|products|tasks)/, { timeout: 30_000 });
}

export async function clientLogin(page: Page, email = USERS.clientAdmin.email, password = STAGING.password) {
  await fillLoginForm(page, email, password);
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}
