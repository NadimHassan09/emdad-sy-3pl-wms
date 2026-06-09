#!/usr/bin/env node
/**
 * BACKUP-6C — Google Drive end-to-end certification harness.
 * Extends RELEASE-R4 DR cert with Drive connect, upload, retry, retention, and restore.
 */
import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/backup-6c');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';
const LABEL = 'BACKUP-6C';

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

function pgConn() {
  const url = envVal('DATABASE_URL') ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function sqlScalar(query) {
  const c = pgConn();
  return execSync(
    `psql -h ${c.host} -p ${c.port} -U ${c.user} -d ${c.database} -t -A -c ${JSON.stringify(query)}`,
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: c.password } },
  ).trim() || null;
}

function sqlJson(query) {
  const line = sqlScalar(query);
  return line ? JSON.parse(line) : null;
}

function sqlRows(query) {
  const c = pgConn();
  return execSync(
    `psql -h ${c.host} -p ${c.port} -U ${c.user} -d ${c.database} -c ${JSON.stringify(query)}`,
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: c.password } },
  );
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
    JSON.stringify({ ts: new Date().toISOString(), method, url, status: res.status, elapsedMs: Math.round(performance.now() - t0), body, response: data }) + '\n',
  );
  return { status: res.status, data, elapsedMs: Math.round(performance.now() - t0) };
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-Company-Id': COMPANY_ID };
}

function record(phase, name, outcome, details = {}) {
  results.push({ phase, name, outcome, at: new Date().toISOString(), ...details });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollJob(token, jobId, timeoutMs = 600_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { status, data } = await api('GET', `/backups/${jobId}/status`, { headers: auth(token) });
    if (status === 200) {
      const row = data?.data ?? data;
      if (row.status === 'completed' || row.status === 'failed') return row;
    }
    await sleep(3000);
  }
  throw new Error(`Timeout polling job ${jobId}`);
}

async function waitNotBusy(token) {
  for (let i = 0; i < 200; i++) {
    const { data } = await api('GET', '/backups/operations/active', { headers: auth(token) });
    if (!(data?.data ?? data)?.busy) return;
    await sleep(3000);
  }
  throw new Error('System busy timeout');
}

function auditActions(actions, limit = 15) {
  const list = actions.map((a) => `'${a}'`).join(',');
  return sqlRows(
    `SELECT action, actor_email, resource_id, new_state->>'message' AS message, created_at FROM audit_logs WHERE action IN (${list}) ORDER BY created_at DESC LIMIT ${limit}`,
  );
}

function integrationRow() {
  return sqlJson(
    `SELECT row_to_json(t) FROM (SELECT id, connected_by_user_id, connected_at, left(encrypted_refresh_token, 20) AS token_prefix, left(encrypted_folder_id, 20) AS folder_prefix FROM backup_drive_integrations LIMIT 1) t`,
  );
}

async function createBackup(token, label, storagePolicy) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await api('POST', '/backups', {
      headers: auth(token),
      body: { label, storagePolicy },
    });
    const jobId = res.data?.data?.jobId;
    if (jobId) return { jobId, res };
    const msg = String(res.data?.error?.message ?? '');
    if (msg.includes('cooldown') || res.status === 429) {
      await sleep(65_000);
      continue;
    }
    throw new Error(`Backup create failed: ${msg || res.status}`);
  }
  throw new Error('Backup create failed after retries');
}

async function pollDriveSync(jobId, timeoutMs = 300_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const row = sqlJson(
      `SELECT row_to_json(t) FROM (SELECT gdrive_sync_status, gdrive_file_id, gdrive_synced_at, gdrive_sync_error, local_artifact_purged FROM backup_jobs WHERE id = '${jobId}'::uuid) t`,
    );
    if (row?.gdrive_sync_status === 'synced' || row?.gdrive_sync_status === 'failed') return row;
    await sleep(5000);
  }
  throw new Error(`Timeout waiting for Drive sync on ${jobId}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'run.log'), '');
  writeFileSync(path.join(OUT, 'network-traces.jsonl'), '');

  log('INIT', `API=${API} OUT=${OUT}`);

  const config = {
    gdriveEnabled: envVal('BACKUP_GDRIVE_ENABLED'),
    gdriveClientId: envVal('BACKUP_GDRIVE_CLIENT_ID') ? '[set]' : null,
    gdriveClientSecret: envVal('BACKUP_GDRIVE_CLIENT_SECRET') ? '[set]' : null,
    gdriveRedirectUri: envVal('BACKUP_GDRIVE_REDIRECT_URI'),
    gdriveConnectSuccessUrl: envVal('BACKUP_GDRIVE_CONNECT_SUCCESS_URL'),
    encryptionKey: envVal('BACKUP_ENCRYPTION_KEY') ? '[set]' : null,
    defaultStoragePolicy: envVal('BACKUP_DEFAULT_STORAGE_POLICY'),
    retryMaxAttempts: envVal('BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS'),
    retentionDaily: envVal('BACKUP_GDRIVE_KEEP_LAST_DAILY'),
  };
  writeFileSync(path.join(OUT, '00-config.json'), JSON.stringify(config, null, 2));

  const oauthReady = !!(config.gdriveClientId && config.gdriveClientSecret);
  record('config', 'gdrive_env', config.gdriveEnabled === 'true' && config.encryptionKey ? 'pass' : 'fail', config);
  record('config', 'oauth_client', oauthReady ? 'pass' : 'blocked', {
    note: 'Set BACKUP_GDRIVE_CLIENT_ID/SECRET in backend/.env',
  });

  const login = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const token = login.data?.data?.access_token;
  if (!token) throw new Error('Login failed');
  record('config', 'auth', 'pass', { email: EMAIL });

  await waitNotBusy(token);

  // Phase 1: Drive integration status
  const driveStatus = await api('GET', '/integrations/google-drive/status', { headers: auth(token) });
  const statusData = driveStatus.data?.data ?? driveStatus.data;
  writeFileSync(path.join(OUT, '01-drive-status.json'), JSON.stringify(driveStatus, null, 2));
  record('drive', 'status_api', driveStatus.status === 200 ? 'pass' : 'fail', {
    gdriveEnabled: statusData?.gdriveEnabled,
    gdriveConfigured: statusData?.gdriveConfigured,
    connected: statusData?.connected,
  });

  const authUrl = await api('GET', '/integrations/google-drive/auth-url', { headers: auth(token) });
  writeFileSync(path.join(OUT, '01-drive-auth-url.json'), JSON.stringify(authUrl, null, 2));
  record(
    'drive',
    'connect_auth_url',
    authUrl.status === 200 && authUrl.data?.data?.url ? 'pass' : oauthReady ? 'fail' : 'blocked',
    { status: authUrl.status },
  );

  const driveTest = await api('POST', '/integrations/google-drive/test', { headers: auth(token) });
  writeFileSync(path.join(OUT, '01-drive-test.json'), JSON.stringify(driveTest, null, 2));
  record(
    'drive',
    'test_connection',
    statusData?.connected && driveTest.status === 200 ? 'pass' : statusData?.connected ? 'fail' : 'blocked',
    { status: driveTest.status },
  );

  writeFileSync(path.join(OUT, '01-drive-integration-db.json'), JSON.stringify(integrationRow(), null, 2));
  record(
    'drive',
    'encrypted_credentials',
    integrationRow()?.token_prefix?.startsWith('v1:') ? 'pass' : statusData?.connected ? 'fail' : 'blocked',
    { note: 'encrypted_refresh_token uses v1: AES-GCM prefix' },
  );

  writeFileSync(path.join(OUT, '01-drive-audit.txt'), auditActions(['backup.drive.connected', 'backup.drive.disconnected'], 10));

  // Phase 2: Storage policies
  const policyResults = {};
  for (const p of ['local_only', 'local_and_drive', 'drive_only']) {
    const put = await api('PUT', '/backups/storage-policy', {
      headers: auth(token),
      body: { defaultPolicy: p },
    });
    policyResults[p] = { status: put.status, message: put.data?.error?.message ?? put.data?.data?.defaultPolicy };
    await sleep(300);
  }
  writeFileSync(path.join(OUT, '02-storage-policies.json'), JSON.stringify(policyResults, null, 2));
  record('policies', 'local_only', policyResults.local_only?.status === 200 ? 'pass' : 'fail', policyResults.local_only);
  record(
    'policies',
    'local_and_drive',
    statusData?.connected && policyResults.local_and_drive?.status === 200
      ? 'pass'
      : statusData?.connected
        ? 'fail'
        : 'blocked',
    policyResults.local_and_drive,
  );
  record(
    'policies',
    'drive_only',
    statusData?.connected && policyResults.drive_only?.status === 200
      ? 'pass'
      : statusData?.connected
        ? 'fail'
        : 'blocked',
    policyResults.drive_only,
  );

  // Phase 3: Upload encrypted .dump.enc only
  let uploadJobId = null;
  let uploadEvidence = { note: 'Drive not connected — upload skipped' };
  if (statusData?.connected) {
    await api('PUT', '/backups/storage-policy', { headers: auth(token), body: { defaultPolicy: 'local_and_drive' } });
    const created = await createBackup(token, `${LABEL} upload-test`, 'local_and_drive');
    uploadJobId = created.jobId;
    await pollJob(token, uploadJobId);
    const syncRow = await pollDriveSync(uploadJobId);
    const jobDir = path.join(envVal('BACKUP_STORAGE_PATH') ?? '/var/lib/emdad-wms/backups/staging', uploadJobId);
    let encOnDisk = false;
    try {
      execSync(`test ! -f ${jobDir}/${uploadJobId}.dump.enc`);
    } catch {
      encOnDisk = true;
    }
    uploadEvidence = { uploadJobId, syncRow, encOnDisk, jobDir };
    writeFileSync(path.join(OUT, '03-upload-evidence.json'), JSON.stringify(uploadEvidence, null, 2));
    record(
      'upload',
      'gdrive_synced',
      syncRow?.gdrive_sync_status === 'synced' && syncRow?.gdrive_file_id ? 'pass' : 'fail',
      syncRow,
    );
    record('upload', 'enc_not_retained_locally', !encOnDisk ? 'pass' : 'fail', { encOnDisk });
    writeFileSync(path.join(OUT, '03-upload-audit.txt'), auditActions(['backup.drive.uploaded'], 5));
  } else {
    record('upload', 'gdrive_synced', 'blocked', uploadEvidence);
    record('upload', 'enc_not_retained_locally', 'blocked', uploadEvidence);
  }

  // Phase 4: drive_only lifecycle
  let driveOnlyJobId = null;
  if (statusData?.connected) {
    await api('PUT', '/backups/storage-policy', { headers: auth(token), body: { defaultPolicy: 'drive_only' } });
    const created = await createBackup(token, `${LABEL} drive-only`, 'drive_only');
    driveOnlyJobId = created.jobId;
    await pollJob(token, driveOnlyJobId);
    const syncRow = await pollDriveSync(driveOnlyJobId);
    const jobRow = sqlJson(`SELECT row_to_json(t) FROM (SELECT local_artifact_purged, dump_filename, artifact_path FROM backup_jobs WHERE id = '${driveOnlyJobId}'::uuid) t`);
    writeFileSync(path.join(OUT, '04-drive-only.json'), JSON.stringify({ syncRow, jobRow }, null, 2));
    record(
      'drive_only',
      'local_purged_after_sync',
      syncRow?.gdrive_sync_status === 'synced' && jobRow?.local_artifact_purged ? 'pass' : 'fail',
      jobRow,
    );
  } else {
    record('drive_only', 'local_purged_after_sync', 'blocked', { note: 'Drive not connected' });
  }

  // Phase 5: Retry worker (simulate failure)
  if (statusData?.connected && uploadJobId) {
    execSync(
      `grep -q BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true ${path.join(ROOT, 'backend/.env')} || echo 'BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true' >> ${path.join(ROOT, 'backend/.env')}`,
      { stdio: 'ignore' },
    );
    execSync('pm2 restart emdad-wms-backend-staging --update-env', { stdio: 'ignore' });
    await sleep(8000);

    const freshLogin = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
    const token2 = freshLogin.data?.data?.access_token;
    await api('POST', `/backups/${uploadJobId}/sync-drive`, { headers: auth(token2) }).catch(() => ({}));
    const jobAfterFail = sqlJson(
      `SELECT row_to_json(t) FROM (SELECT gdrive_sync_status, gdrive_sync_attempts, gdrive_next_retry_at FROM backup_jobs WHERE id = '${uploadJobId}'::uuid) t`,
    );
    writeFileSync(path.join(OUT, '05-retry-failure.json'), JSON.stringify(jobAfterFail, null, 2));
    record('retry', 'forced_failure', jobAfterFail?.gdrive_sync_status === 'failed' ? 'pass' : 'fail', jobAfterFail);

    execSync(`sed -i '/BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE/d' ${path.join(ROOT, 'backend/.env')}`, { stdio: 'ignore' });
    execSync('pm2 restart emdad-wms-backend-staging --update-env', { stdio: 'ignore' });
    await sleep(8000);
    writeFileSync(
      path.join(OUT, '05-retry-audit.txt'),
      auditActions(['backup.drive.retry_scheduled', 'backup.drive.retry_attempted', 'backup.drive.upload_failed'], 10),
    );
  } else {
    record('retry', 'forced_failure', 'blocked', { note: 'Drive not connected' });
  }

  // Phase 6: Drive retention
  const drivePreview = await api('GET', '/backups/retention/drive/preview', { headers: auth(token) });
  const driveCleanup = await api('POST', '/backups/retention/drive/cleanup', { headers: auth(token) });
  writeFileSync(path.join(OUT, '06-drive-retention.json'), JSON.stringify({ drivePreview, driveCleanup }, null, 2));
  record('retention', 'drive_preview', drivePreview.status === 200 ? 'pass' : 'fail');
  record('retention', 'drive_cleanup', driveCleanup.status === 200 || driveCleanup.status === 201 ? 'pass' : 'fail');

  // Phase 7: Restore from Drive-backed backup
  if (statusData?.connected && driveOnlyJobId) {
    await waitNotBusy(token);
    const freshLogin = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
    const token3 = freshLogin.data?.data?.access_token;
    const restore = await api('POST', `/backups/${driveOnlyJobId}/restore`, {
      headers: auth(token3),
      body: { confirmPhrase: 'RESTORE', createPreSnapshot: true },
    });
    const restoreJobId = restore.data?.data?.restoreJobId ?? restore.data?.data?.jobId;
    const restoreStatus = restoreJobId ? await pollJob(token3, restoreJobId, 900_000) : null;
    writeFileSync(path.join(OUT, '07-drive-restore.json'), JSON.stringify({ restore, restoreJobId, restoreStatus }, null, 2));
    record('restore', 'drive_backed', restoreStatus?.status === 'completed' ? 'pass' : 'fail', { restoreJobId });
  } else {
    record('restore', 'drive_backed', 'blocked', { note: 'Requires connected Drive + drive_only backup' });
  }

  await api('PUT', '/backups/storage-policy', { headers: auth(token), body: { defaultPolicy: 'local_only' } });

  const weights = { pass: 1, blocked: 0.35, fail: 0, skip: 0.5 };
  let scoreSum = 0;
  let scoreMax = 0;
  for (const r of results) {
    scoreMax += 1;
    scoreSum += weights[r.outcome] ?? 0;
  }
  const readinessScore = Math.round((scoreSum / Math.max(scoreMax, 1)) * 100);

  const cert = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    readinessScore,
    config,
    connected: statusData?.connected ?? false,
    results,
  };

  writeFileSync(path.join(OUT, 'cert-results.json'), JSON.stringify(cert, null, 2));
  writeFileSync(
    path.join(OUT, 'cert-summary.txt'),
    [
      `BACKUP-6C Certification ${cert.generatedAt}`,
      `Duration: ${(cert.elapsedMs / 1000 / 60).toFixed(1)} min`,
      `Readiness score: ${readinessScore}/100`,
      `Drive connected: ${cert.connected}`,
      '',
      ...results.map((r) => `${String(r.outcome).toUpperCase().padEnd(8)} [${r.phase}] ${r.name}`),
    ].join('\n'),
  );

  log('DONE', `Score=${readinessScore} connected=${cert.connected}`);
  console.log(JSON.stringify({ readinessScore, connected: cert.connected, results: results.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  appendFileSync(path.join(OUT, 'run.log'), `FATAL: ${err.stack || err}\n`);
  process.exit(1);
});
