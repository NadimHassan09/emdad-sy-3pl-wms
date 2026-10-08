#!/usr/bin/env node
/**
 * End-to-End Browser & Session Verification for:
 * 1. New frontend build -> Update Modal appears -> Click Refresh -> Session preserved.
 * 2. Backend restart -> Transient 502/network outage -> No forced logout -> Resumes normal operation.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'backend/package.json'));
const puppeteer = require('puppeteer');
const EVIDENCE_DIR = path.join(ROOT, 'docs/evidence/update-e2e');
mkdirSync(EVIDENCE_DIR, { recursive: true });

const ADMIN_URL = 'https://staging-admin.emdadsy.com';
const EMAIL = 'superadmin@emdad.example';
const PASSWORD = 'demo123';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];

function log(step, message, status = 'INFO') {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] [${status}] [${step}] ${message}`);
  results.push({ ts, step, message, status });
}

async function runTests() {
  log('START', 'Starting End-to-End User Experience Verification on Staging');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--host-resolver-rules=MAP staging-admin.emdadsy.com 127.0.0.1, MAP staging-client.emdadsy.com 127.0.0.1',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: User logs into Staging Admin
    // ─────────────────────────────────────────────────────────────────────────
    log('AUTH', `Navigating to ${ADMIN_URL}/login...`);
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });

    log('AUTH', 'Filling login form credentials...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.type('input[type="email"], input[name="email"]', EMAIL);
    await page.type('input[type="password"], input[name="password"]', PASSWORD);

    // Optional: click remember me if present
    const rememberMe = await page.$('input[type="checkbox"]');
    if (rememberMe) await rememberMe.click();

    log('AUTH', 'Clicking submit and waiting for login completion...');
    await Promise.all([
      page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    await sleep(2500);

    const currentUrl = page.url();
    log('AUTH', `Current URL after login: ${currentUrl}`);
    if (currentUrl.includes('/login')) {
      throw new Error(`Login failed, still on ${currentUrl}`);
    }
    log('AUTH', 'User successfully authenticated and on dashboard!', 'PASS');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_logged_in_dashboard.png') });

    // Verify Update Modal is NOT currently visible
    const initialModal = await page.$('[aria-labelledby="update-modal-title"]');
    if (initialModal) {
      throw new Error('Update modal is unexpectedly visible before any build update');
    }
    log('BUILD_TEST', 'Confirmed: Update modal is NOT visible initially', 'PASS');

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Simulate New Build / Deployment
    // ─────────────────────────────────────────────────────────────────────────
    const versionJsonPath = path.join(ROOT, 'frontend/dist/version.json');
    const originalVersionJson = readFileSync(versionJsonPath, 'utf8');
    const parsedOriginal = JSON.parse(originalVersionJson);
    log('BUILD_TEST', `Original version.json: buildId=${parsedOriginal.buildId}`);

    const newBuildId = `test-new-build-${Date.now()}`;
    const updatedVersionJson = JSON.stringify(
      {
        version: parsedOriginal.version,
        buildId: newBuildId,
        buildTime: new Date().toISOString(),
      },
      null,
      2,
    );

    log('BUILD_TEST', `Simulating deployment with new buildId: ${newBuildId}...`);
    writeFileSync(versionJsonPath, updatedVersionJson, 'utf8');

    // Trigger update check via tab focus / visibility change or detector
    log('BUILD_TEST', 'Simulating tab focus / update detector check...');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for the Update Modal to appear
    log('BUILD_TEST', 'Waiting for Update Modal to appear in the UI...');
    await page.waitForSelector('[aria-labelledby="update-modal-title"]', {
      visible: true,
      timeout: 10000,
    });

    const modalText = await page.$eval(
      '[aria-labelledby="update-modal-title"]',
      (el) => el.parentElement?.textContent || '',
    );
    log('BUILD_TEST', `Modal detected! Text content: "${modalText.trim().replace(/\s+/g, ' ')}"`);

    if (
      !modalText.includes("There's a new version available. The system needs to refresh") ||
      !modalText.includes('Refresh')
    ) {
      throw new Error(`Modal text mismatch: ${modalText}`);
    }
    log('BUILD_TEST', 'Modal text and Refresh button verified!', 'PASS');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_update_modal_displayed.png') });

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: User clicks "Refresh" -> Hard Reload -> Session Preserved
    // ─────────────────────────────────────────────────────────────────────────
    log('BUILD_TEST', 'User clicks "Refresh" button in modal...');
    const refreshButton = await page.$(
      '[aria-labelledby="update-modal-title"] button',
    );
    if (!refreshButton) throw new Error('Refresh button not found in modal');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      refreshButton.click(),
    ]);

    await sleep(2000);
    const postRefreshUrl = page.url();
    log('BUILD_TEST', `URL after Refresh reload: ${postRefreshUrl}`);

    if (postRefreshUrl.includes('/login')) {
      throw new Error(`Session was unexpectedly lost after clicking Refresh! Redirected to ${postRefreshUrl}`);
    }

    // Verify user is still authenticated
    const storageToken = await page.evaluate(() => {
      return sessionStorage.getItem('wms.access_token') || localStorage.getItem('wms.access_token');
    });

    if (!storageToken) {
      throw new Error('Access token missing from storage after refresh!');
    }
    log('BUILD_TEST', 'User session preserved! User remains logged in on the new version!', 'PASS');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_session_preserved_after_refresh.png') });

    // Restore original version.json
    writeFileSync(versionJsonPath, originalVersionJson, 'utf8');
    log('BUILD_TEST', 'Restored original version.json.');

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Test Server Restart Resilience (pm2 restart -> No false logout)
    // ─────────────────────────────────────────────────────────────────────────
    log('RESTART_TEST', 'Testing backend restart resilience...');
    log('RESTART_TEST', 'Executing: pm2 restart emdad-wms-backend-staging...');

    execSync('pm2 restart emdad-wms-backend-staging', { cwd: ROOT, stdio: 'inherit' });

    log('RESTART_TEST', 'Staging backend restarted. Making background API calls while server warms up...');

    // Make an API request from the browser context
    const apiCallResult = await page.evaluate(async () => {
      try {
        const token =
          sessionStorage.getItem('wms.access_token') || localStorage.getItem('wms.access_token');
        const res = await fetch('/api/companies', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status, ok: res.ok };
      } catch (err) {
        return { error: String(err) };
      }
    });

    log('RESTART_TEST', `API request during restart handled: ${JSON.stringify(apiCallResult)}`);

    // Give PM2 3 seconds to complete startup
    await sleep(3000);

    // Verify user did NOT get redirected to /login!
    const postRestartUrl = page.url();
    log('RESTART_TEST', `Page URL during/after restart: ${postRestartUrl}`);

    if (postRestartUrl.includes('/login')) {
      throw new Error(`User was falsely logged out during server restart! URL: ${postRestartUrl}`);
    }
    log('RESTART_TEST', 'Confirmed: User was NOT redirected to login during server restart!', 'PASS');

    // Make an authenticated API request now that backend is back online
    const postRestartApi = await page.evaluate(async () => {
      const token =
        sessionStorage.getItem('wms.access_token') || localStorage.getItem('wms.access_token');
      const res = await fetch('/api/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    });

    log('RESTART_TEST', `Authenticated API response after restart: HTTP ${postRestartApi.status}`);
    if (postRestartApi.status !== 200) {
      throw new Error(`API call failed after restart with HTTP ${postRestartApi.status}`);
    }
    log('RESTART_TEST', 'Authenticated requests succeed normally. User continues uninterrupted!', 'PASS');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_resilient_after_restart.png') });

    log('SUCCESS', 'ALL END-TO-END BROWSER TESTS PASSED 100%!', 'PASS');
  } catch (err) {
    log('ERROR', `Test failed: ${err.message}`, 'FAIL');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'error_state.png') }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
