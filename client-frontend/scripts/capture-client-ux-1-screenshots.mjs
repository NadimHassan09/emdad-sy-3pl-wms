#!/usr/bin/env node
/**
 * CLIENT-UX-1 — capture before/after client portal screenshots.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/evidence/client-ux-1/screenshots');
const baseUrl = process.env.CLIENT_BASE_URL ?? 'https://staging-client.emdadsy.com';
const email = process.env.CLIENT_EMAIL ?? 'client@acme.example';
const password = process.env.CLIENT_PASSWORD ?? 'demo123';

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25_000 });
  await page.waitForTimeout(1000);
}

async function shot(page, route, file) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table, .card, h1', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
}

async function main() {
  const phase = process.argv[2] ?? 'after';
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  if (phase === 'before') {
    await shot(page, '/', '01-before-home.png');
    await shot(page, '/stock', '02-before-stock-pagination.png');
    await shot(page, '/products', '03-before-products.png');
  } else {
    await shot(page, '/dashboard', '01-after-dashboard.png');
    await shot(page, '/stock', '02-after-stock-pagination.png');
    await shot(page, '/products', '03-after-products.png');
    await shot(page, '/inbound-orders', '04-after-inbound-orders.png');
    await shot(page, '/billing', '05-after-billing-invoices.png');
  }

  await browser.close();
  console.log(`${phase} screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
