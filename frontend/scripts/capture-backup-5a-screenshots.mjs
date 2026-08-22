/**
 * One-off visual capture for BACKUP-5A-REPORT.md
 * Usage: node scripts/capture-backup-5a-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/screenshots/backup-5a');
const baseUrl = process.env.BASE_URL ?? 'https://staging-admin.emdadsy.com';

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-email, input[type="email"]').first().fill('superadmin@emdad.example');
  await page.locator('#login-password').fill('demo123');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });

  await page.goto(`${baseUrl}/settings/backups`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '01-settings-backup-history.png'), fullPage: true });

  const detailsBtn = page.getByRole('button', { name: /details/i }).first();
  if (await detailsBtn.count()) {
    await detailsBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '02-backup-details-modal.png'), fullPage: true });
    await page.keyboard.press('Escape');
  }

  const search = page.getByLabel(/search/i);
  if (await search.count()) {
    await search.fill('manual');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, '03-backup-filtered-search.png'), fullPage: true });
  }

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
