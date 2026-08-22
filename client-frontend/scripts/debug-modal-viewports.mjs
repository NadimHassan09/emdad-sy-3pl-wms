import { chromium } from 'playwright';

const viewports = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1024, height: 768, name: '1024x768' },
  { width: 768, height: 1024, name: '768x1024' },
];

for (const vp of viewports) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto('https://staging-client.emdadsy.com/login');
  await page.locator('input[type=email]').fill('client@acme.example');
  await page.locator('input[type=password]').fill('demo123');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  await page.goto('https://staging-client.emdadsy.com/products');
  // scroll down first
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.getByRole('button', { name: /new product/i }).click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const modal = document.querySelector('[role=dialog]');
    const r = modal?.getBoundingClientRect();
    const outer = document.querySelector('#ds-portal-root > div');
    const o = outer?.getBoundingClientRect();
    return {
      modal: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      outer: o ? { x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.width), h: Math.round(o.height) } : null,
      centered: r && o ? Math.abs(r.x + r.width / 2 - window.innerWidth / 2) < 20 : null,
      topVisible: r ? r.top >= 0 && r.top < 40 : null,
    };
  });
  console.log(vp.name, JSON.stringify(info));
  await browser.close();
}
