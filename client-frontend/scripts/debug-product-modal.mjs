import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Check which assets staging serves
const html = await (await fetch('https://staging-client.emdadsy.com/products')).text();
const cssMatch = html.match(/assets\/index-[^"]+\.css/);
const jsMatch = html.match(/assets\/index-[^"]+\.js/);
console.log('Live CSS:', cssMatch?.[0]);
console.log('Live JS:', jsMatch?.[0]);

await page.goto('https://staging-client.emdadsy.com/login');
await page.locator('input[type=email]').fill('client@acme.example');
await page.locator('input[type=password]').fill('demo123');
await page.getByRole('button', { name: /sign in|log in|login/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
await page.goto('https://staging-client.emdadsy.com/products');
await page.getByRole('button', { name: /new product/i }).click();
await page.waitForTimeout(1200);

const info = await page.evaluate(() => {
  const modal = document.querySelector('[role=dialog]');
  const rect = modal?.getBoundingClientRect();
  const outer = document.querySelector('#ds-portal-root > div');
  const outerRect = outer?.getBoundingClientRect();
  const outerStyle = outer ? getComputedStyle(outer) : null;
  return {
    modalRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
    outerRect: outerRect ? { x: outerRect.x, y: outerRect.y, w: outerRect.width, h: outerRect.height } : null,
    outerClasses: outer?.className,
    outerDisplay: outerStyle?.display,
    outerAlignItems: outerStyle?.alignItems,
    outerJustify: outerStyle?.justifyContent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: '/tmp/product-modal-current.png' });
await browser.close();
