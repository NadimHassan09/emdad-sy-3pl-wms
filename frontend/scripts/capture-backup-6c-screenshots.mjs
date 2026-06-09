#!/usr/bin/env node
/**
 * BACKUP-6C — UI screenshots for Google Drive certification
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/evidence/backup-6c/screenshots');
const baseUrl = process.env.BASE_URL ?? 'https://staging-admin.emdadsy.com';

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-email, input[type="email"]').first().fill('superadmin@emdad.example');
  await page.locator('#login-password').fill('demo123');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  const routes = [
    ['/settings/backups/google-drive', '01-google-drive-overview.png'],
    ['/settings/backups/google-drive', '02-google-drive-connection-panel.png'],
  ];

  for (const [route, file] of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  }

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
