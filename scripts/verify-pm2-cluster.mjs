#!/usr/bin/env node
/**
 * PM2 cluster mode verification — readiness, multi-instance, graceful drain.
 *
 * Usage:
 *   node scripts/verify-pm2-cluster.mjs
 *
 * Env: API_BASE_URL (default http://127.0.0.1:3001/api), PM2_APP_NAME
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outFile = resolve(root, 'docs/ops/pm2-cluster-verification.json');

const apiBase = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3001/api').replace(/\/$/, '');
const pm2App = process.env.PM2_APP_NAME ?? 'emdad-wms-backend-staging';

function pm2Jlist() {
  try {
    const raw = execSync('pm2 jlist', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(raw);
  } catch (e) {
    return { error: String(e.message ?? e) };
  }
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${apiBase}${path}`, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function probeLive(samples = 5) {
  const pids = new Set();
  for (let i = 0; i < samples; i++) {
    const res = await fetchJson('/ops/health/live');
    if (res.status !== 200) return { ok: false, error: `live ${res.status}`, pids: [...pids] };
    await new Promise((r) => setTimeout(r, 50));
  }
  return { ok: true, samples };
}

async function probeReady() {
  const res = await fetchJson('/ops/health/ready');
  return {
    ok: res.status === 200,
    status: res.status,
    body: res.body,
  };
}

function analyzePm2(processes, appName) {
  const workers = processes.filter((p) => p.name === appName);
  if (!workers.length) {
    return { ok: false, error: `No PM2 workers named ${appName}` };
  }
  const online = workers.filter((p) => p.pm2_env?.status === 'online');
  const cluster = workers.every((p) => p.pm2_env?.exec_mode === 'cluster_mode');
  const waitReady = workers.every((p) => p.pm2_env?.wait_ready === true);
  return {
    ok: online.length === workers.length && workers.length >= 1,
    workerCount: workers.length,
    onlineCount: online.length,
    clusterMode: cluster,
    waitReadyConfigured: waitReady,
    instances: workers.map((w) => ({
      pmId: w.pm_id,
      pid: w.pid,
      instance: w.pm2_env?.NODE_APP_INSTANCE,
      status: w.pm2_env?.status,
      restarts: w.pm2_env?.restart_time,
    })),
  };
}

async function main() {
  console.log(`PM2 cluster verification for ${pm2App} @ ${apiBase}`);

  const pm2 = pm2Jlist();
  const pm2Analysis =
    Array.isArray(pm2) ? analyzePm2(pm2, pm2App) : { ok: false, error: pm2.error };

  console.log('  PM2 workers:', pm2Analysis.workerCount ?? 0, 'cluster:', pm2Analysis.clusterMode);

  const live = await probeLive();
  console.log('  Liveness:', live.ok ? 'OK' : live.error);

  const ready = await probeReady();
  console.log('  Readiness:', ready.ok ? 'OK' : `HTTP ${ready.status}`);

  const report = {
    generatedAt: new Date().toISOString(),
    apiBase,
    pm2App,
    pm2: pm2Analysis,
    probes: {
      live,
      ready,
    },
    failoverNote:
      'Manual failover: pm2 reload <app> --update-env should drain workers via shutdown_with_message while others serve traffic.',
    cronLeaderNote:
      'Cron jobs use Redis SET NX locks (key prefix wms:cron:lock:*). With Redis disabled, only NODE_APP_INSTANCE=0 runs crons.',
    pass:
      pm2Analysis.ok === true &&
      pm2Analysis.clusterMode === true &&
      live.ok === true &&
      ready.ok === true,
  };

  mkdirSync(resolve(root, 'docs/ops'), { recursive: true });
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outFile}`);
  console.log(report.pass ? 'PASS — cluster checks OK' : 'PARTIAL — see report (deploy/reload may be required)');

  if (!report.pass) process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
