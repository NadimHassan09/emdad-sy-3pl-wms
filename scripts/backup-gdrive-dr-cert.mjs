#!/usr/bin/env node
/**
 * Google Drive Disaster Recovery certification harness.
 * Validates infrastructure, API routes, health checks, and UI-facing fields.
 * Live OAuth/sync steps are BLOCKED until BACKUP_GDRIVE_CLIENT_ID/SECRET are set
 * and a super_admin completes Connect Drive in the admin UI.
 */
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/backup-gdrive-dr');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const PUBLIC_ADMIN = process.env.STAGING_ADMIN_URL ?? 'https://staging-admin.emdadsy.com';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';
const EXPECTED_CALLBACK_SUFFIX = '/api/integrations/google-drive/callback';

const results = [];
const startedAt = Date.now();

function readEnv() {
  try {
    return readFileSync(path.join(ROOT, 'backend/.env'), 'utf8');
  } catch {
    return '';
  }
}

function envVal(key) {
  const m = readEnv().match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m?.[1]?.trim() ?? process.env[key] ?? null;
}

function record(phase, name, outcome, details = {}) {
  results.push({ phase, name, outcome, at: new Date().toISOString(), ...details });
}

function log(section, msg) {
  const line = `[${new Date().toISOString()}] ${section}: ${msg}`;
  console.log(line);
  appendFileSync(path.join(OUT, 'run.log'), line + '\n');
}

async function api(method, route, { body, headers = {} } = {}) {
  const url = `${API}${route}`;
  const opts = { method, headers: { ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const t0 = performance.now();
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  appendFileSync(
    path.join(OUT, 'network-traces.jsonl'),
    JSON.stringify({
      ts: new Date().toISOString(),
      method,
      url,
      status: res.status,
      elapsedMs: Math.round(performance.now() - t0),
      body,
      response: data,
    }) + '\n',
  );
  return { status: res.status, data, elapsedMs: Math.round(performance.now() - t0) };
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-Company-Id': COMPANY_ID };
}

function summarize() {
  const counts = { pass: 0, fail: 0, blocked: 0, skip: 0 };
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  return counts;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'run.log'), '');
  writeFileSync(path.join(OUT, 'network-traces.jsonl'), '');

  log('INIT', `API=${API} PUBLIC=${PUBLIC_ADMIN}`);

  // ── Phase 0: Configuration & source checks ───────────────────────────────
  const config = {
    gdriveEnabled: envVal('BACKUP_GDRIVE_ENABLED'),
    gdriveClientId: envVal('BACKUP_GDRIVE_CLIENT_ID') ? '[set]' : null,
    gdriveClientSecret: envVal('BACKUP_GDRIVE_CLIENT_SECRET') ? '[set]' : null,
    gdriveRedirectUri: envVal('BACKUP_GDRIVE_REDIRECT_URI'),
    gdriveConnectSuccessUrl: envVal('BACKUP_GDRIVE_CONNECT_SUCCESS_URL'),
    encryptionKey: envVal('BACKUP_ENCRYPTION_KEY') ? '[set]' : null,
    defaultStoragePolicy: envVal('BACKUP_DEFAULT_STORAGE_POLICY'),
    startupStrict: envVal('BACKUP_GDRIVE_STARTUP_STRICT'),
  };
  writeFileSync(path.join(OUT, '00-config.json'), JSON.stringify(config, null, 2));

  record('config', 'gdrive_enabled', config.gdriveEnabled === 'true' ? 'pass' : 'fail', config);
  record(
    'config',
    'redirect_uri_suffix',
    config.gdriveRedirectUri?.endsWith(EXPECTED_CALLBACK_SUFFIX) ? 'pass' : 'fail',
    { redirectUri: config.gdriveRedirectUri },
  );
  record(
    'config',
    'encryption_key',
    config.encryptionKey ? 'pass' : 'fail',
    { note: 'BACKUP_ENCRYPTION_KEY required for OAuth token storage' },
  );
  record(
    'config',
    'oauth_client',
    config.gdriveClientId && config.gdriveClientSecret ? 'pass' : 'blocked',
    { note: 'Set BACKUP_GDRIVE_CLIENT_ID/SECRET from Google Cloud Console' },
  );

  const startupService = path.join(ROOT, 'backend/src/modules/backups/backup-gdrive-startup.service.ts');
  record(
    'config',
    'startup_validation_service',
    existsSync(startupService) ? 'pass' : 'fail',
    { path: startupService },
  );

  const envExample = readFileSync(path.join(ROOT, 'backend/.env.example'), 'utf8');
  record(
    'config',
    'env_example_documented',
    envExample.includes('BACKUP_GDRIVE_STARTUP_STRICT') && envExample.includes('BACKUP_GDRIVE_CLIENT_ID')
      ? 'pass'
      : 'fail',
  );

  // ── Phase 1: Public callback route ─────────────────────────────────────────
  const callbackUrl = `${PUBLIC_ADMIN.replace(/\/$/, '')}${EXPECTED_CALLBACK_SUFFIX}`;
  try {
    const cbRes = await fetch(callbackUrl, { redirect: 'manual' });
    writeFileSync(
      path.join(OUT, '01-callback-response.json'),
      JSON.stringify({ url: callbackUrl, status: cbRes.status }, null, 2),
    );
    record('routes', 'oauth_callback_public', cbRes.status !== 403 && cbRes.status !== 401 ? 'pass' : 'fail', {
      status: cbRes.status,
      note: 'Public route reachable; 400/503 without code is expected when OAuth is incomplete',
    });
  } catch (err) {
    record('routes', 'oauth_callback_public', 'fail', { error: String(err) });
  }

  // ── Phase 2: Authenticated API ───────────────────────────────────────────
  const login = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const token = login.data?.data?.access_token;
  if (!token) {
    record('auth', 'login', 'fail', { status: login.status });
    throw new Error('Login failed — cannot continue API checks');
  }
  record('auth', 'login', 'pass', { email: EMAIL });

  const driveStatus = await api('GET', '/integrations/google-drive/status', { headers: auth(token) });
  const statusData = driveStatus.data?.data ?? driveStatus.data;
  writeFileSync(path.join(OUT, '02-drive-status.json'), JSON.stringify(driveStatus, null, 2));

  record('api', 'drive_status', driveStatus.status === 200 ? 'pass' : 'fail', {
    gdriveEnabled: statusData?.gdriveEnabled,
    gdriveConfigured: statusData?.gdriveConfigured,
    connected: statusData?.connected,
  });

  record(
    'api',
    'drive_configured_flag',
    statusData?.gdriveConfigured === (config.gdriveClientId && config.gdriveClientSecret) ? 'pass' : 'blocked',
    { gdriveConfigured: statusData?.gdriveConfigured },
  );

  const health = await api('GET', '/backups/health', { headers: auth(token) });
  const healthData = health.data?.data ?? health.data;
  writeFileSync(path.join(OUT, '02-health.json'), JSON.stringify(health, null, 2));

  record('api', 'health_dashboard', health.status === 200 ? 'pass' : 'fail');
  record(
    'api',
    'health_drive_status',
    health.status === 200 && healthData?.driveStatus && typeof healthData.driveStatus.enabled === 'boolean'
      ? 'pass'
      : 'fail',
    { driveStatus: healthData?.driveStatus },
  );

  const gdriveAlerts = (healthData?.alerts ?? []).filter((a) => String(a.code).startsWith('gdrive_'));
  record(
    'api',
    'health_gdrive_alerts',
    config.gdriveEnabled === 'true' && !statusData?.gdriveConfigured ? (gdriveAlerts.length > 0 ? 'pass' : 'fail') : 'skip',
    { alerts: gdriveAlerts.map((a) => a.code) },
  );

  const evaluate = await api('POST', '/backups/health/evaluate-alerts', { headers: auth(token) });
  writeFileSync(path.join(OUT, '02-evaluate-alerts.json'), JSON.stringify(evaluate, null, 2));
  record('api', 'evaluate_alerts', evaluate.status === 201 || evaluate.status === 200 ? 'pass' : 'fail', {
    status: evaluate.status,
  });

  const backups = await api('GET', '/backups?limit=5', { headers: auth(token) });
  const items = backups.data?.data?.items ?? backups.data?.items ?? [];
  writeFileSync(path.join(OUT, '02-backup-list.json'), JSON.stringify(backups, null, 2));
  const sample = items[0];
  record(
    'api',
    'backup_list_sync_fields',
    sample
      ? 'storagePolicy' in sample && 'gdriveSyncStatus' in sample
        ? 'pass'
        : 'fail'
      : 'skip',
    { sampleFields: sample ? Object.keys(sample) : [] },
  );

  const authUrl = await api('GET', '/integrations/google-drive/auth-url', { headers: auth(token) });
  writeFileSync(path.join(OUT, '02-auth-url.json'), JSON.stringify(authUrl, null, 2));
  if (statusData?.gdriveConfigured) {
    record(
      'oauth',
      'auth_url',
      authUrl.status === 200 && authUrl.data?.data?.url ? 'pass' : 'fail',
      { status: authUrl.status },
    );
  } else {
    record('oauth', 'auth_url', 'blocked', { note: 'Requires OAuth client credentials' });
  }

  if (statusData?.connected) {
    const driveTest = await api('POST', '/integrations/google-drive/test', { headers: auth(token) });
    writeFileSync(path.join(OUT, '02-drive-test.json'), JSON.stringify(driveTest, null, 2));
    record(
      'sync',
      'test_connection',
      driveTest.status === 200 && (driveTest.data?.data?.ok ?? driveTest.data?.ok) !== false ? 'pass' : 'fail',
      { status: driveTest.status },
    );

    const pending = Number(statusData.pendingSyncCount ?? 0);
    record(
      'sync',
      'live_sync',
      pending === 0 && Number(statusData.failedSyncCount ?? 0) === 0 ? 'pass' : 'fail',
      {
        pendingSyncCount: statusData.pendingSyncCount,
        failedSyncCount: statusData.failedSyncCount,
        lastSyncedAt: statusData.lastSyncedAt,
      },
    );
  } else {
    record('sync', 'test_connection', 'blocked', { note: 'Connect Drive in admin UI first' });
    record('sync', 'live_sync', 'blocked', { note: 'Requires connected Google account' });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const counts = summarize();
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const summary = {
    ranAt: new Date().toISOString(),
    elapsedSec,
    counts,
    results,
    verdict:
      counts.fail > 0
        ? 'FAIL'
        : counts.blocked > 0
          ? 'CONDITIONAL_PASS'
          : 'PASS',
  };
  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  log('DONE', `verdict=${summary.verdict} pass=${counts.pass} fail=${counts.fail} blocked=${counts.blocked} (${elapsedSec}s)`);
  console.log('\nResults written to', OUT);
  process.exit(counts.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
