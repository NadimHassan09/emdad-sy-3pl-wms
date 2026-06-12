/**
 * Shared helpers for backup / Google Drive certification harnesses.
 */
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function readEnvFile() {
  try {
    return readFileSync(path.join(ROOT, 'backend/.env'), 'utf8');
  } catch {
    return '';
  }
}

export function envVal(key, envText = readEnvFile()) {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m?.[1]?.trim() ?? process.env[key] ?? null;
}

export function pgConn() {
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

export function sqlScalar(query) {
  const c = pgConn();
  return execSync(
    `psql -h ${c.host} -p ${c.port} -U ${c.user} -d ${c.database} -t -A -c ${JSON.stringify(query)}`,
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: c.password } },
  ).trim() || null;
}

export function sqlJson(query) {
  const line = sqlScalar(query);
  return line ? JSON.parse(line) : null;
}

export function sqlRows(query) {
  const c = pgConn();
  return execSync(
    `psql -h ${c.host} -p ${c.port} -U ${c.user} -d ${c.database} -c ${JSON.stringify(query)}`,
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: c.password } },
  );
}

export function createLogger(outDir) {
  return (section, msg) => {
    const line = `[${new Date().toISOString()}] ${section}: ${msg}`;
    console.log(line);
    appendFileSync(path.join(outDir, 'run.log'), line + '\n');
  };
}

export function createApiClient(apiBase, outDir) {
  return async function api(method, route, { body, headers = {} } = {}) {
    const url = `${apiBase}${route}`;
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
      path.join(outDir, 'network-traces.jsonl'),
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
  };
}

export function authHeaders(token, companyId) {
  return { Authorization: `Bearer ${token}`, 'X-Company-Id': companyId };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function computeDriveRetryDelayMs(attempt, baseSec, maxSec) {
  const baseMs = Math.max(1, baseSec) * 1000;
  const maxMs = Math.max(baseMs, maxSec * 1000);
  const exponent = Math.max(0, attempt - 1);
  return Math.min(maxMs, baseMs * 2 ** exponent);
}

export function entitySnapshot() {
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

export function backupJobRow(jobId) {
  return sqlJson(
    `SELECT row_to_json(t) FROM (
      SELECT id, status, storage_policy, gdrive_sync_status, gdrive_file_id,
             gdrive_synced_at, gdrive_sync_error, gdrive_sync_attempts,
             gdrive_next_retry_at, bytes_written, artifact_path, dump_filename,
             completed_at
      FROM backup_jobs WHERE id = '${jobId}'::uuid
    ) t`,
  );
}

export function resolveLocalDumpPath(jobId, job) {
  const storagePath =
    envVal('BACKUP_STORAGE_PATH') ??
    path.join('/var/lib/emdad-wms/backups', envVal('BACKUP_ENV_ID') ?? 'staging');
  const dir = path.join(storagePath, jobId);
  if (job?.artifact_path && job?.dump_filename) {
    return path.join(job.artifact_path, job.dump_filename);
  }
  return path.join(dir, `${jobId}.dump`);
}

export async function pollBackupJob(api, token, companyId, jobId, timeoutMs = 600_000) {
  const auth = authHeaders(token, companyId);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { status, data } = await api('GET', `/backups/${jobId}/status`, { headers: auth });
    if (status === 200) {
      const row = data?.data ?? data;
      if (row.status === 'completed' || row.status === 'failed') return row;
    } else {
      const db = backupJobRow(jobId);
      if (db?.status === 'completed' || db?.status === 'failed') return db;
    }
    await sleep(3000);
  }
  throw new Error(`Timeout polling backup job ${jobId}`);
}

export async function pollDriveSync(jobId, timeoutMs = 300_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const row = backupJobRow(jobId);
    if (row?.gdrive_sync_status === 'synced' && row?.gdrive_file_id) return row;
    if (row?.gdrive_sync_status === 'failed') {
      throw new Error(`Drive sync failed: ${row.gdrive_sync_error ?? 'unknown'}`);
    }
    await sleep(5000);
  }
  throw new Error(`Timeout waiting for Drive sync on job ${jobId}`);
}

export async function waitNotBusy(api, token, companyId) {
  const auth = authHeaders(token, companyId);
  for (let i = 0; i < 200; i++) {
    const { data } = await api('GET', '/backups/operations/active', { headers: auth });
    if (!(data?.data ?? data)?.busy) return;
    await sleep(3000);
  }
  throw new Error('System busy timeout');
}

export async function createBackup(api, token, companyId, label, storagePolicy) {
  const auth = authHeaders(token, companyId);
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await api('POST', '/backups', {
      headers: auth,
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

export async function login(api, email, password) {
  const res = await api('POST', '/auth/login', { body: { email, password } });
  const token = res.data?.data?.access_token;
  if (!token) throw new Error(`Login failed (${res.status})`);
  return token;
}

export function auditActions(actions, limit = 15) {
  const list = actions.map((a) => `'${a}'`).join(',');
  return sqlRows(
    `SELECT action, actor_email, resource_id, new_state->>'message' AS message, created_at
     FROM audit_logs WHERE action IN (${list})
     ORDER BY created_at DESC LIMIT ${limit}`,
  );
}

export function summarizeResults(results) {
  const counts = { pass: 0, fail: 0, blocked: 0, skip: 0 };
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  return counts;
}

export function buildVerdict(counts) {
  if (counts.fail > 0) return 'FAIL';
  if (counts.blocked > 0) return 'CONDITIONAL_PASS';
  return 'PASS';
}
