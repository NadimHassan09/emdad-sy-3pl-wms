#!/usr/bin/env node
/**
 * BACKUP-UI-CREATE — API verification for manual backup + download.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/evidence/backup-ui-create');
const BASE = process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001';
const API = `${BASE.replace(/\/$/, '')}/api`;
const EMAIL = process.env.PERF_USER ?? 'superadmin@emdad.example';
const PASSWORD = process.env.PERF_PASSWORD ?? 'demo123';
const LABEL = `BACKUP-UI-CREATE ${new Date().toISOString().slice(0, 19)}`;

mkdirSync(OUT, { recursive: true });

async function api(method, pathSuffix, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${pathSuffix}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function pollStatus(token, jobId, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status, json } = await api('GET', `/backups/${jobId}/status`, { token });
    if (status !== 200) throw new Error(`status poll failed: ${status}`);
    const data = json.data ?? json;
    if (data.status === 'completed' || data.status === 'failed') return data;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error('timeout waiting for backup completion');
}

const results = { generatedAt: new Date().toISOString(), steps: [] };

function record(step, ok, detail) {
  results.steps.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}: ${JSON.stringify(detail)}`);
}

try {
  const login = await api('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!login.json.success) throw new Error('login failed');
  const token = login.json.data.access_token;
  record('login', true, { email: EMAIL });

  const created = await api('POST', '/backups', {
    token,
    body: { label: LABEL, storagePolicy: 'local_only' },
  });
  const createData = created.json.data ?? created.json;
  const okCreate = created.status === 201 && createData.jobId;
  record('create_manual_backup', okCreate, { status: created.status, ...createData });
  if (!okCreate) throw new Error('create failed');

  const final = await pollStatus(token, createData.jobId);
  record('backup_completed', final.status === 'completed', final);

  const downloadUrl = await api('POST', `/backups/${createData.jobId}/download-url`, { token });
  const dlData = downloadUrl.json.data ?? downloadUrl.json;
  record('issue_download_url', downloadUrl.status === 201 && !!dlData.token, {
    status: downloadUrl.status,
    expiresInSec: dlData.expiresInSec,
  });

  const drive = await api('GET', '/integrations/google-drive/status', { token });
  const driveData = drive.json.data ?? drive.json;
  record('drive_status_checked', drive.status === 200, {
    connected: driveData.connected,
    gdriveEnabled: driveData.gdriveEnabled,
    note: 'Drive sync verification requires connected Drive account',
  });

  results.allPass = results.steps.every((s) => s.ok);
} catch (err) {
  record('fatal', false, { message: String(err.message ?? err) });
  results.allPass = false;
}

writeFileSync(path.join(OUT, 'verify-results.json'), JSON.stringify(results, null, 2));
process.exit(results.allPass ? 0 : 1);
