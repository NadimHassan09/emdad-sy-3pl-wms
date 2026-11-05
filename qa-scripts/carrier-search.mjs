// READ-ONLY lookup of one test order in a carrier portal. It types the order code in the portal's search
// box first, and only reports if exactly one row is left. It never clicks cancel/delete.
// Usage:  node qa-scripts/carrier-search.mjs <carrier> <ORDER-CODE>
// Selectors for each portal live in qa-scripts/carriers.config.json (fill them after looking at the portal once).
import fs from 'node:fs';
import { openSite } from './lib/browser.mjs';
import { assertSingleMatch } from './lib/guard.mjs';

const [carrier, code] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(new URL('./carriers.config.json', import.meta.url), 'utf8'))[carrier];
if (!config || !code) throw new Error('Usage: carrier-search.mjs <carrier> <ORDER-CODE>');
if (!config.searchInput || !config.rows) throw new Error(`Fill searchInput and rows for ${carrier} in carriers.config.json first.`);

const { context, page } = await openSite(`carrier-${carrier}`);
await page.goto(config.url, { waitUntil: 'domcontentloaded' });
if (/login|signin/i.test(page.url())) {
  console.log('Log in in the opened window, then press Enter here.');
  await new Promise((r) => process.stdin.once('data', r));
  await page.goto(config.url, { waitUntil: 'domcontentloaded' });
}
await page.fill(config.searchInput, code);
await page.keyboard.press('Enter');
await page.waitForTimeout(config.settleMs ?? 2000);
const rows = (await page.locator(config.rows).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
const row = assertSingleMatch(rows, code);
console.log(JSON.stringify({ carrier, code, row }, null, 2));
await context.close();
