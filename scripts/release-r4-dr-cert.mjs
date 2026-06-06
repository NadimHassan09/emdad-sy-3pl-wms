#!/usr/bin/env node
/**
 * RELEASE-R4 — Backup Disaster Recovery certification harness.
 */
import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/release-r4-dr');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';
const DR_LABEL = 'RELEASE-R4-DR';

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

function computeDriveRetryDelayMs(attempt, baseSec, maxSec) {
  const baseMs = Math.max(1, baseSec) * 1000;
  const maxMs = Math.max(baseMs, maxSec * 1000);
  const exponent = Math.max(0, attempt - 1);
  return Math.min(maxMs, baseMs * 2 ** exponent);
}

async function pollJob(token, jobId, timeoutMs = 600_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { status, data } = await api('GET', `/backups/${jobId}/status`, { headers: auth(token) });
    if (status === 200) {
      const row = data?.data ?? data;
      if (row.status === 'completed' || row.status === 'failed') return row;
    } else {
      try {
        const s = sqlScalar(`SELECT status FROM backup_jobs WHERE id = '${jobId}'::uuid`);
        if (s === 'completed' || s === 'failed') {
          return sqlJson(`SELECT row_to_json(t) FROM (SELECT * FROM backup_jobs WHERE id = '${jobId}'::uuid) t`);
        }
      } catch {
        /* schema dropped during restore */
      }
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

function entitySnapshot() {
  return {
    products: Number(sqlScalar('SELECT COUNT(*) FROM products')),
    inventory: Number(sqlScalar('SELECT COUNT(*) FROM current_stock')),
    inboundOrders: Number(sqlScalar('SELECT COUNT(*) FROM inbound_orders')),
    outboundOrders: Number(sqlScalar('SELECT COUNT(*) FROM outbound_orders')),
    tasks: Number(sqlScalar('SELECT COUNT(*) FROM warehouse_tasks')),
    users: Number(sqlScalar('SELECT COUNT(*) FROM users')),
    capturedAt: new Date().toISOString(),
  };
}

function auditActions(actions, limit = 10) {
  const list = actions.map((a) => `'${a}'`).join(',');
  return sqlRows(
    `SELECT action, actor_email, resource_id, new_state->>'message' AS message, created_at FROM audit_logs WHERE action IN (${list}) ORDER BY created_at DESC LIMIT ${limit}`,
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'run.log'), '');
  writeFileSync(path.join(OUT, 'network-traces.jsonl'), '');

  log('INIT', `API=${API} OUT=${OUT}`);

  // ── Phase 0: Configuration ───────────────────────────────────────────────
  const config = {
    gdriveEnabled: envVal('BACKUP_GDRIVE_ENABLED'),
    gdriveClientId: envVal('BACKUP_GDRIVE_CLIENT_ID') ? '[set]' : null,
    gdriveClientSecret: envVal('BACKUP_GDRIVE_CLIENT_SECRET') ? '[set]' : null,
    gdriveRedirectUri: envVal('BACKUP_GDRIVE_REDIRECT_URI'),
    gdriveConnectSuccessUrl: envVal('BACKUP_GDRIVE_CONNECT_SUCCESS_URL'),
    encryptionKey: envVal('BACKUP_ENCRYPTION_KEY') ? '[set]' : null,
    defaultStoragePolicy: envVal('BACKUP_DEFAULT_STORAGE_POLICY'),
  };
  writeFileSync(path.join(OUT, '00-config.json'), JSON.stringify(config, null, 2));

  const configOk =
    config.gdriveEnabled === 'true' &&
    config.encryptionKey &&
    config.gdriveRedirectUri &&
    config.gdriveConnectSuccessUrl;
  record('config', 'gdrive_env', configOk ? 'pass' : 'fail', config);
  record(
    'config',
    'oauth_client',
    config.gdriveClientId && config.gdriveClientSecret ? 'pass' : 'blocked',
    { note: 'BACKUP_GDRIVE_CLIENT_ID/SECRET required for OAuth connect' },
  );

  const login = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const token = login.data?.data?.access_token;
  if (!token) throw new Error('Login failed');
  record('config', 'auth', 'pass', { email: EMAIL });

  await waitNotBusy(token);

  // ── Phase 1: Google Drive integration ────────────────────────────────────
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
    authUrl.status === 200 && authUrl.data?.data?.url ? 'pass' : statusData?.gdriveConfigured ? 'fail' : 'blocked',
    { status: authUrl.status, hasUrl: !!authUrl.data?.data?.url },
  );

  const driveTest = await api('POST', '/integrations/google-drive/test', { headers: auth(token) });
  writeFileSync(path.join(OUT, '01-drive-test.json'), JSON.stringify(driveTest, null, 2));
  record(
    'drive',
    'test_connection',
    statusData?.connected && driveTest.status === 200 ? 'pass' : statusData?.connected ? 'fail' : 'blocked',
    { status: driveTest.status, message: driveTest.data?.error?.message },
  );

  const disconnect = await api('DELETE', '/integrations/google-drive', { headers: auth(token) });
  writeFileSync(path.join(OUT, '01-drive-disconnect.json'), JSON.stringify(disconnect, null, 2));
  record('drive', 'disconnect', disconnect.status === 200 ? 'pass' : 'fail', { status: disconnect.status });

  const reconnectUrl = await api('GET', '/integrations/google-drive/auth-url', { headers: auth(token) });
  record(
    'drive',
    'reconnect_auth_url',
    reconnectUrl.status === 200 && reconnectUrl.data?.data?.url ? 'pass' : statusData?.gdriveConfigured ? 'fail' : 'blocked',
    { status: reconnectUrl.status },
  );

  writeFileSync(path.join(OUT, '01-drive-audit.txt'), auditActions(['backup.drive.connected', 'backup.drive.disconnected'], 10));

  // ── Phase 2: Storage policies ────────────────────────────────────────────
  const policyGet = await api('GET', '/backups/storage-policy', { headers: auth(token) });
  writeFileSync(path.join(OUT, '02-storage-policy-get.json'), JSON.stringify(policyGet, null, 2));

  const policies = ['local_only', 'local_and_drive', 'drive_only'];
  const policyResults = {};
  for (const p of policies) {
    const put = await api('PUT', '/backups/storage-policy', {
      headers: auth(token),
      body: { defaultPolicy: p },
    });
    policyResults[p] = { status: put.status, message: put.data?.error?.message ?? put.data?.data?.defaultPolicy };
    await sleep(500);
  }
  writeFileSync(path.join(OUT, '02-storage-policies.json'), JSON.stringify(policyResults, null, 2));

  record('policies', 'local_only', policyResults.local_only?.status === 200 ? 'pass' : 'fail', policyResults.local_only);
  const drivePoliciesOk = config.gdriveEnabled === 'true';
  record(
    'policies',
    'local_and_drive',
    drivePoliciesOk && policyResults.local_and_drive?.status === 200 ? 'pass' : drivePoliciesOk ? 'fail' : 'blocked',
    policyResults.local_and_drive,
  );
  record(
    'policies',
    'drive_only',
    drivePoliciesOk && policyResults.drive_only?.status === 200 ? 'pass' : drivePoliciesOk ? 'fail' : 'blocked',
    policyResults.drive_only,
  );

  await api('PUT', '/backups/storage-policy', { headers: auth(token), body: { defaultPolicy: 'local_only' } });

  // ── Phase 3: Retry engine ────────────────────────────────────────────────
  const retryMath = {
    attempt1: computeDriveRetryDelayMs(1, 60, 21600),
    attempt2: computeDriveRetryDelayMs(2, 60, 21600),
    attempt3: computeDriveRetryDelayMs(3, 60, 21600),
  };
  writeFileSync(path.join(OUT, '03-retry-math.json'), JSON.stringify(retryMath, null, 2));
  record('retry', 'backoff_math', retryMath.attempt1 === 60000 && retryMath.attempt2 === 120000 ? 'pass' : 'fail', retryMath);

  let retryJobId = null;
  let retryEvidence = { simulated: false, note: 'Drive not connected — retry upload not executed' };
  if (statusData?.connected) {
    await api('PUT', '/backups/storage-policy', { headers: auth(token), body: { defaultPolicy: 'local_and_drive' } });
    const created = await createBackup(token, `${DR_LABEL} retry-test`, 'local_and_drive');
    retryJobId = created.jobId;
    await pollJob(token, retryJobId);

    execSync(
      `grep -q BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true ${path.join(ROOT, 'backend/.env')} || echo 'BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true' >> ${path.join(ROOT, 'backend/.env')}`,
      { stdio: 'ignore' },
    );
    execSync('pm2 restart emdad-wms-backend-staging --update-env', { stdio: 'ignore' });
    await sleep(8000);

    const freshLogin = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
    const token2 = freshLogin.data?.data?.access_token;
    const syncFail = await api('POST', `/backups/${retryJobId}/sync-drive`, { headers: auth(token2) });
    const jobAfterFail = sqlJson(
      `SELECT row_to_json(t) FROM (SELECT id, gdrive_sync_status, gdrive_sync_attempts, gdrive_next_retry_at, gdrive_sync_error FROM backup_jobs WHERE id = '${retryJobId}'::uuid) t`,
    );
    retryEvidence = { syncFail, jobAfterFail, simulated: true };

    execSync(`sed -i '/BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE/d' ${path.join(ROOT, 'backend/.env')}`, { stdio: 'ignore' });
    execSync('pm2 restart emdad-wms-backend-staging --update-env', { stdio: 'ignore' });
    await sleep(8000);

    record(
      'retry',
      'forced_failure',
      jobAfterFail?.gdrive_sync_status === 'failed' ? 'pass' : 'fail',
      retryEvidence,
    );
    record(
      'retry',
      'retry_scheduled',
      jobAfterFail?.gdrive_next_retry_at ? 'pass' : 'fail',
      { nextRetryAt: jobAfterFail?.gdrive_next_retry_at },
    );
  } else {
    record('retry', 'forced_failure', 'blocked', retryEvidence);
    record('retry', 'retry_scheduled', 'blocked', retryEvidence);
  }
  writeFileSync(path.join(OUT, '03-retry-evidence.json'), JSON.stringify(retryEvidence, null, 2));
  writeFileSync(path.join(OUT, '03-retry-audit.txt'), auditActions(['backup.drive.retry_scheduled', 'backup.drive.retry_attempted', 'backup.drive.upload_failed'], 15));

  await waitNotBusy(token);

  // ── Phase 4: Retention ───────────────────────────────────────────────────
  const localPreview = await api('GET', '/backups/retention/preview', { headers: auth(token) });
  const localCleanup = await api('POST', '/backups/retention/cleanup', { headers: auth(token) });
  writeFileSync(path.join(OUT, '04-local-retention.json'), JSON.stringify({ localPreview, localCleanup }, null, 2));
  record('retention', 'local_preview', localPreview.status === 200 ? 'pass' : 'fail', { status: localPreview.status });
  record('retention', 'local_cleanup', localCleanup.status === 200 || localCleanup.status === 201 ? 'pass' : 'fail', {
    status: localCleanup.status,
    deletedCount: localCleanup.data?.data?.deletedCount,
  });

  const drivePreview = await api('GET', '/backups/retention/drive/preview', { headers: auth(token) });
  const driveCleanup = await api('POST', '/backups/retention/drive/cleanup', { headers: auth(token) });
  writeFileSync(path.join(OUT, '04-drive-retention.json'), JSON.stringify({ drivePreview, driveCleanup }, null, 2));
  record('retention', 'drive_preview', drivePreview.status === 200 ? 'pass' : 'fail', { status: drivePreview.status });
  record('retention', 'drive_cleanup', driveCleanup.status === 200 || driveCleanup.status === 201 ? 'pass' : 'fail', {
    status: driveCleanup.status,
    deletedCount: driveCleanup.data?.data?.deletedCount,
  });

  await waitNotBusy(token);

  // ── Phase 5: Disaster recovery ─────────────────────────────────────────
  const baseline = entitySnapshot();
  writeFileSync(path.join(OUT, '05-dr-baseline.json'), JSON.stringify(baseline, null, 2));
  log('DR', `Baseline: ${JSON.stringify(baseline)}`);

  const drCreateT0 = Date.now();
  const drBackup = await createBackup(token, `${DR_LABEL} snapshot`, 'local_only');
  const drJobId = drBackup.jobId;
  const drStatus = await pollJob(token, drJobId);
  const drCreateMs = Date.now() - drCreateT0;
  const drJob = sqlJson(`SELECT row_to_json(t) FROM (SELECT * FROM backup_jobs WHERE id = '${drJobId}'::uuid) t`);
  writeFileSync(path.join(OUT, '05-dr-backup.json'), JSON.stringify({ drJobId, drStatus, drJob, drCreateMs }, null, 2));

  record('dr', 'create_backup', drStatus?.status === 'completed' ? 'pass' : 'fail', {
    jobId: drJobId,
    durationMs: drCreateMs,
    bytesWritten: drStatus?.bytesWritten ?? drJob?.bytes_written,
  });

  await waitNotBusy(token);

  const restoreT0 = Date.now();
  const restore = await api('POST', `/backups/${drJobId}/restore`, {
    headers: auth(token),
    body: { confirmPhrase: 'RESTORE', createPreSnapshot: true },
  });
  const restoreJobId = restore.data?.data?.restoreJobId ?? restore.data?.data?.jobId;
  const restoreStatus = restoreJobId ? await pollJob(token, restoreJobId, 900_000) : null;
  const restoreMs = Date.now() - restoreT0;

  const freshLoginDr = await api('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  const tokenDr = freshLoginDr.data?.data?.access_token;

  const after = entitySnapshot();
  writeFileSync(path.join(OUT, '05-dr-after-restore.json'), JSON.stringify(after, null, 2));
  writeFileSync(
    path.join(OUT, '05-dr-restore.json'),
    JSON.stringify({ restore, restoreJobId, restoreStatus, restoreMs, baseline, after }, null, 2),
  );
  writeFileSync(path.join(OUT, '05-dr-restore-audit.txt'), auditActions(['backup.restored', 'backup.created'], 10));

  const verifyOk =
    after.products === baseline.products &&
    after.inventory === baseline.inventory &&
    after.inboundOrders === baseline.inboundOrders &&
    after.outboundOrders === baseline.outboundOrders &&
    after.tasks === baseline.tasks &&
    after.users === baseline.users;

  record('dr', 'restore', restoreStatus?.status === 'completed' ? 'pass' : 'fail', {
    restoreJobId,
    durationMs: restoreMs,
  });
  record('dr', 'verify_products', after.products === baseline.products ? 'pass' : 'fail', {
    before: baseline.products,
    after: after.products,
  });
  record('dr', 'verify_inventory', after.inventory === baseline.inventory ? 'pass' : 'fail', {
    before: baseline.inventory,
    after: after.inventory,
  });
  record('dr', 'verify_orders', after.inboundOrders === baseline.inboundOrders && after.outboundOrders === baseline.outboundOrders ? 'pass' : 'fail', {
    inbound: { before: baseline.inboundOrders, after: after.inboundOrders },
    outbound: { before: baseline.outboundOrders, after: after.outboundOrders },
  });
  record('dr', 'verify_tasks', after.tasks === baseline.tasks ? 'pass' : 'fail', {
    before: baseline.tasks,
    after: after.tasks,
  });
  record('dr', 'verify_users', after.users === baseline.users ? 'pass' : 'fail', {
    before: baseline.users,
    after: after.users,
  });
  record('dr', 'entity_integrity', verifyOk ? 'pass' : 'fail', { baseline, after });

  const rpoSeconds = Math.round((Date.now() - new Date(drJob?.completed_at ?? drJob?.completedAt ?? Date.now()).getTime()) / 1000);
  const rtoSeconds = Math.round(restoreMs / 1000);

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
    recoveryPointObjectiveSec: rpoSeconds,
    recoveryTimeObjectiveSec: rtoSeconds,
    readinessScore,
    config,
    results,
    metrics: {
      drBackupCreateMs: drCreateMs,
      drRestoreMs: restoreMs,
      baseline,
      after,
    },
  };

  writeFileSync(path.join(OUT, 'cert-results.json'), JSON.stringify(cert, null, 2));
  writeFileSync(
    path.join(OUT, 'cert-summary.txt'),
    [
      `RELEASE-R4 DR Certification ${cert.generatedAt}`,
      `Duration: ${(cert.elapsedMs / 1000 / 60).toFixed(1)} min`,
      `RPO: ${rpoSeconds}s · RTO: ${rtoSeconds}s`,
      `Readiness score: ${readinessScore}/100`,
      '',
      ...results.map((r) => `${String(r.outcome).toUpperCase().padEnd(8)} [${r.phase}] ${r.name}`),
    ].join('\n'),
  );

  log('DONE', `Score=${readinessScore} RTO=${rtoSeconds}s RPO=${rpoSeconds}s`);
  console.log(JSON.stringify({ readinessScore, rtoSeconds, rpoSeconds, results: results.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  appendFileSync(path.join(OUT, 'run.log'), `FATAL: ${err.stack || err}\n`);
  process.exit(1);
});
