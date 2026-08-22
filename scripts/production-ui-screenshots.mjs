#!/usr/bin/env node
/**
 * Capture production UI screenshots + console/network errors for smoke test report.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/production-smoke-test/screenshots');
const ADMIN_URL = (process.env.PROD_ADMIN_URL ?? 'https://admin.emdadsy.com').replace(/\/$/, '');
const CLIENT_URL = (process.env.PROD_CLIENT_URL ?? 'https://client.emdadsy.com').replace(/\/$/, '');
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';

const consoleErrors = [];
const networkFailures = [];
const pages = [];

async function capture(page, label, url, waitMs = 2500) {
  const failures = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ label, text: msg.text() });
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      networkFailures.push({ label, url: res.url(), status: res.status() });
    }
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(waitMs);
  const ms = Date.now() - t0;
  const file = path.join(OUT, `${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  pages.push({ label, url, ms, screenshot: `screenshots/${label}.png` });
}

async function loginAdmin(page) {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[name="email"]', 'superadmin@emdad.example');
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|products|\/$/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function loginClient(page) {
  await page.goto(`${CLIENT_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[name="email"]', 'client@acme.example');
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|\/$/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const adminRoutes = [
    ['admin-login', `${ADMIN_URL}/login`, false],
    ['admin-dashboard', `${ADMIN_URL}/dashboard/overview`, true],
    ['admin-products', `${ADMIN_URL}/products`, true],
    ['admin-locations', `${ADMIN_URL}/locations`, true],
    ['admin-inventory', `${ADMIN_URL}/inventory/stock`, true],
    ['admin-inbound', `${ADMIN_URL}/inbound`, true],
    ['admin-outbound', `${ADMIN_URL}/outbound`, true],
    ['admin-returns', `${ADMIN_URL}/returns`, true],
    ['admin-cycle-count', `${ADMIN_URL}/cycle-count`, true],
    ['admin-tasks', `${ADMIN_URL}/tasks`, true],
    ['admin-reports', `${ADMIN_URL}/reports`, true],
    ['admin-billing', `${ADMIN_URL}/billing`, true],
    ['admin-backup', `${ADMIN_URL}/settings/backups`, true],
    ['admin-audit-logs', `${ADMIN_URL}/audit-logs`, true],
  ];

  const adminPage = await context.newPage();
  for (const [label, url, needsAuth] of adminRoutes) {
    if (needsAuth && !pages.some((p) => p.label === 'admin-dashboard')) {
      await loginAdmin(adminPage);
    }
    if (label === 'admin-login') {
      await capture(adminPage, label, url);
    } else if (needsAuth) {
      await capture(adminPage, label, url);
    }
  }

  const clientRoutes = [
    ['client-login', `${CLIENT_URL}/login`, false],
    ['client-dashboard', `${CLIENT_URL}/dashboard`, true],
    ['client-products', `${CLIENT_URL}/products`, true],
    ['client-inventory', `${CLIENT_URL}/inventory`, true],
    ['client-inbound', `${CLIENT_URL}/inbound`, true],
    ['client-outbound', `${CLIENT_URL}/outbound`, true],
    ['client-billing', `${CLIENT_URL}/billing`, true],
    ['client-notifications', `${CLIENT_URL}/notifications`, true],
  ];

  const clientPage = await context.newPage();
  for (const [label, url, needsAuth] of clientRoutes) {
    if (needsAuth && !pages.some((p) => p.label === 'client-dashboard')) {
      await loginClient(clientPage);
    }
    if (label === 'client-login') {
      await capture(clientPage, label, url);
    } else if (needsAuth) {
      await capture(clientPage, label, url);
    }
  }

  const operatorPage = await context.newPage();
  await operatorPage.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded' });
  await operatorPage.fill('input[type="email"], input[name="email"]', 'testworker@example.com');
  await operatorPage.fill('input[type="password"], input[name="password"]', PASSWORD);
  await operatorPage.click('button[type="submit"]');
  await operatorPage.waitForURL(/tasks|dashboard|\/$/, { timeout: 30000 }).catch(() => {});
  await operatorPage.waitForTimeout(2000);
  await capture(operatorPage, 'admin-operator-tasks-nav', `${ADMIN_URL}/tasks`);

  await browser.close();

  const summary = {
    capturedAt: new Date().toISOString(),
    pages,
    consoleErrors: [...new Map(consoleErrors.map((e) => [e.label + e.text, e])).values()],
    networkFailures: [...new Map(networkFailures.map((f) => [f.url + f.status, f])).values()],
  };
  writeFileSync(path.join(ROOT, 'docs/evidence/production-smoke-test/ui-evidence.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pages: pages.length, consoleErrors: summary.consoleErrors.length, networkFailures: summary.networkFailures.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
