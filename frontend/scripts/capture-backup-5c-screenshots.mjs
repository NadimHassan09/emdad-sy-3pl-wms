/**
 * Visual capture for BACKUP-5C-REPORT.md
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/screenshots/backup-5c');
const baseUrl = process.env.BASE_URL ?? 'https://staging-admin.emdadsy.com';

async function login(page, email = 'superadmin@emdad.example') {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-email, input[type="email"]').first().fill(email);
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
    ['/settings/backups/schedules', '01-scheduled-backups.png'],
    ['/settings/backups/retention', '02-retention-policies.png'],
    ['/settings/backups/health', '03-health-dashboard.png'],
    ['/settings/backups/schedules', '04-schedule-create-modal.png', async () => {
      await page.getByRole('button', { name: /Create schedule/i }).click();
      await page.waitForTimeout(400);
    }],
  ];

  for (const entry of shots) {
    const [route, file, hook] = entry;
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    if (hook) await hook();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  }

  const managerPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(managerPage, 'manager@emdad.example');
  await managerPage.goto(`${baseUrl}/settings/backups/schedules`, { waitUntil: 'networkidle' });
  await managerPage.waitForTimeout(800);
  await managerPage.screenshot({
    path: path.join(outDir, '05-manager-readonly-schedules.png'),
    fullPage: true,
  });

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
