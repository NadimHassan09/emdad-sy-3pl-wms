/**
 * Visual capture for BACKUP-5B-REPORT.md
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/screenshots/backup-5b');
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

  const shots = [
    ['/settings/backups/upload', '01-upload-backup.png'],
    ['/settings/backups/restore', '02-restore-backup.png'],
    ['/settings/backups/factory-reset', '03-factory-reset-danger.png'],
  ];

  for (const [route, file] of shots) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  }

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
