import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/evidence/client-ux-1/screenshots');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://staging-client.emdadsy.com/login');
await page.locator('input[type=email]').fill('client@acme.example');
await page.locator('input[type=password]').fill('demo123');
await page.getByRole('button', { name: /sign in|log in|login/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });

await mkdir(outDir, { recursive: true });

await page.goto('https://staging-client.emdadsy.com/products');
await page.getByRole('button', { name: /new product/i }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '06-after-product-modal-centered.png'), fullPage: false });

await page.keyboard.press('Escape');
await page.goto('https://staging-client.emdadsy.com/inbound-orders');
await page.getByRole('button', { name: /new inbound/i }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '07-after-inbound-modal-centered.png'), fullPage: false });

await browser.close();
console.log('Saved modal fix screenshots');
