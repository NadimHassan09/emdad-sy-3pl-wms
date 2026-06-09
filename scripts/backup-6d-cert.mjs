#!/usr/bin/env node
/**
 * BACKUP-6D — Drive retention UI + storage policies API validation.
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/backup-6d');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const SUPER_EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const MANAGER_EMAIL = process.env.QA_MANAGER_EMAIL ?? 'manager@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';

const results = [];
const startedAt = Date.now();

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

function record(phase, name, outcome, detail = {}) {
  results.push({ phase, name, outcome, detail, at: new Date().toISOString() });
}

async function login(email) {
  const res = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
  const token = res.data?.data?.access_token;
  if (!token) throw new Error(`Login failed for ${email}`);
  return token;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'run.log'), '');

  const superToken = await login(SUPER_EMAIL);
  const managerToken = await login(MANAGER_EMAIL);
  record('auth', 'super_admin_login', 'pass');
  record('auth', 'wh_manager_login', 'pass');

  const drivePoliciesSuper = await api('GET', '/backups/retention/drive/policies', {
    headers: auth(superToken),
  });
  writeFileSync(path.join(OUT, '01-drive-policies-super.json'), JSON.stringify(drivePoliciesSuper, null, 2));
  record(
    'drive_retention',
    'policies_super_admin',
    drivePoliciesSuper.status === 200 ? 'pass' : 'fail',
    { status: drivePoliciesSuper.status },
  );

  const drivePoliciesManager = await api('GET', '/backups/retention/drive/policies', {
    headers: auth(managerToken),
  });
  writeFileSync(path.join(OUT, '01-drive-policies-manager.json'), JSON.stringify(drivePoliciesManager, null, 2));
  record(
    'drive_retention',
    'policies_wh_manager_read',
    drivePoliciesManager.status === 200 ? 'pass' : 'fail',
    { status: drivePoliciesManager.status },
  );

  const drivePreviewSuper = await api('GET', '/backups/retention/drive/preview', {
    headers: auth(superToken),
  });
  writeFileSync(path.join(OUT, '02-drive-preview-super.json'), JSON.stringify(drivePreviewSuper, null, 2));
  record(
    'drive_retention',
    'preview_super_admin',
    drivePreviewSuper.status === 200 ? 'pass' : 'fail',
    { status: drivePreviewSuper.status },
  );

  const drivePreviewManager = await api('GET', '/backups/retention/drive/preview', {
    headers: auth(managerToken),
  });
  record(
    'drive_retention',
    'preview_wh_manager_read',
    drivePreviewManager.status === 200 ? 'pass' : 'fail',
    { status: drivePreviewManager.status },
  );

  const driveCleanupManager = await api('POST', '/backups/retention/drive/cleanup', {
    headers: auth(managerToken),
  });
  record(
    'drive_retention',
    'cleanup_wh_manager_denied',
    driveCleanupManager.status === 403 ? 'pass' : 'fail',
    { status: driveCleanupManager.status },
  );

  const driveCleanupSuper = await api('POST', '/backups/retention/drive/cleanup', {
    headers: auth(superToken),
  });
  writeFileSync(path.join(OUT, '03-drive-cleanup-super.json'), JSON.stringify(driveCleanupSuper, null, 2));
  record(
    'drive_retention',
    'cleanup_super_admin',
    driveCleanupSuper.status === 200 || driveCleanupSuper.status === 201 ? 'pass' : 'fail',
    { status: driveCleanupSuper.status },
  );

  const storageGetManager = await api('GET', '/backups/storage-policy', { headers: auth(managerToken) });
  record(
    'storage_policy',
    'get_wh_manager_read',
    storageGetManager.status === 200 ? 'pass' : 'fail',
    { status: storageGetManager.status },
  );

  const storagePutManager = await api('PUT', '/backups/storage-policy', {
    headers: auth(managerToken),
    body: { defaultPolicy: 'local_only' },
  });
  record(
    'storage_policy',
    'put_wh_manager_denied',
    storagePutManager.status === 403 ? 'pass' : 'fail',
    { status: storagePutManager.status },
  );

  const driveStatusManager = await api('GET', '/integrations/google-drive/status', {
    headers: auth(managerToken),
  });
  writeFileSync(path.join(OUT, '04-drive-status-manager.json'), JSON.stringify(driveStatusManager, null, 2));
  record(
    'storage_policy',
    'drive_status_wh_manager_read',
    driveStatusManager.status === 200 ? 'pass' : 'fail',
    { status: driveStatusManager.status },
  );

  const schedules = await api('GET', '/backups/schedules', { headers: auth(superToken) });
  const items = schedules.data?.data?.items ?? schedules.data?.items ?? [];
  const hasStoragePolicyField =
    items.length === 0 || items.every((row) => Object.prototype.hasOwnProperty.call(row, 'storagePolicy'));
  writeFileSync(path.join(OUT, '05-schedules.json'), JSON.stringify(schedules, null, 2));
  record(
    'storage_policy',
    'schedule_storage_policy_field',
    schedules.status === 200 && hasStoragePolicyField ? 'pass' : 'fail',
    { count: items.length, hasStoragePolicyField },
  );

  const passCount = results.filter((r) => r.outcome === 'pass').length;
  const cert = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    passCount,
    total: results.length,
    results,
  };

  writeFileSync(path.join(OUT, 'cert-results.json'), JSON.stringify(cert, null, 2));
  writeFileSync(
    path.join(OUT, 'cert-summary.txt'),
    [
      `BACKUP-6D API validation ${cert.generatedAt}`,
      `Duration: ${(cert.elapsedMs / 1000).toFixed(1)}s`,
      `Pass: ${passCount}/${results.length}`,
      '',
      ...results.map((r) => `${String(r.outcome).toUpperCase().padEnd(8)} [${r.phase}] ${r.name}`),
    ].join('\n'),
  );

  log('DONE', `Pass=${passCount}/${results.length}`);
  console.log(JSON.stringify({ passCount, total: results.length }, null, 2));
  if (passCount < results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
