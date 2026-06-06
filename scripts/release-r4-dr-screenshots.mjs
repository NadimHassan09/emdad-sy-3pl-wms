#!/usr/bin/env node
/**
 * RELEASE-R4 — Backup DR UI screenshots
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(ROOT, 'docs/evidence/release-r4-dr/screenshots');
const baseUrl = process.env.BASE_URL ?? 'https://staging-admin.emdadsy.com';

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-email, input[type="email"]').first().fill('superadmin@emdad.example');
  await page.locator('#login-password').fill('demo123');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

async function shot(page, route, file) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  await shot(page, '/settings/backups/google-drive', '01-google-drive.png');
  await shot(page, '/settings/backups', '02-backup-history.png');
  await shot(page, '/settings/backups/retention', '03-local-retention.png');
  await shot(page, '/settings/backups/restore', '04-restore.png');
  await shot(page, '/settings/backups/health', '05-health.png');

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
