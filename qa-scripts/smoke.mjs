// Visits every list/detail-less page of a portal like a user would, and reports what a user would notice:
// failed API calls, console errors, blank pages, raw error text, horizontal overflow.
// Usage:  node qa-scripts/smoke.mjs admin|client [--mobile] [--login] [--only=/path1,/path2]
import fs from 'node:fs';
import path from 'node:path';
import { openSite } from './lib/browser.mjs';

const site = process.argv[2];
const routesFile = JSON.parse(fs.readFileSync(new URL('./routes.json', import.meta.url), 'utf8'));
if (!routesFile[site]) throw new Error('First argument must be "admin" or "client".');
const flags = process.argv.slice(3);
const mobile = flags.includes('--mobile');
const only = flags.find((f) => f.startsWith('--only='))?.slice(7).split(',');
const { baseUrl, routes } = routesFile[site];
const list = only ?? routes;

const BAD_TEXT = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Internal server error/i, /Something went wrong/i, /Cannot read properties/i];
const { context, page } = await openSite(site, { mobile });

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
if (flags.includes('--login') || /\/login/.test(page.url())) {
  console.log('Log in in the opened browser window, then press Enter here.');
  await new Promise((r) => process.stdin.once('data', r));
}

const results = [];
for (const route of list) {
  const issues = [];
  const onResponse = (res) => {
    const url = res.url();
    if (res.status() >= 400 && /\/api\//.test(url)) issues.push(`API ${res.status()} ${res.request().method()} ${url.replace(/\?.*/, '')}`);
  };
  const onConsole = (msg) => {
    if (msg.type() === 'error') issues.push(`console: ${msg.text().slice(0, 160)}`);
  };
  const onPageError = (err) => issues.push(`pageerror: ${String(err).slice(0, 160)}`);
  page.on('response', onResponse);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  const started = Date.now();
  try {
    await page.goto(baseUrl + route, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    issues.push(`load: ${String(e).slice(0, 120)}`);
  }
  const info = await page.evaluate(() => ({
    text: document.body?.innerText ?? '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    url: location.pathname,
  }));
  if (info.text.trim().length < 20) issues.push('blank page');
  if (info.overflow) issues.push('horizontal overflow');
  for (const re of BAD_TEXT) if (re.test(info.text)) issues.push(`text matches ${re}`);
  if (info.url !== route) issues.push(`landed on ${info.url}`);
  page.off('response', onResponse);
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  results.push({ route, ms: Date.now() - started, issues: [...new Set(issues)] });
  console.log(`${issues.length ? '✗' : '✓'} ${route} (${Date.now() - started} ms)${issues.length ? '\n    ' + [...new Set(issues)].join('\n    ') : ''}`);
}

const outDir = path.join('qa-scripts', 'out');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `smoke-${site}${mobile ? '-mobile' : ''}-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`);
fs.writeFileSync(file, JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => !r.issues.length).length}/${results.length} pages clean. Report: ${file}`);
await context.close();
