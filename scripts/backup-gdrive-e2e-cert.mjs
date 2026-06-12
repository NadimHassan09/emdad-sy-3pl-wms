#!/usr/bin/env node
/**
 * Google Drive Backup Recovery — full end-to-end certification.
 *
 * Phases:
 *   0 — prerequisites (OAuth configured, Drive connected)
 *   1 — upload verification (local_and_drive backup → Drive synced)
 *   2 — retry mechanism (simulated failure → schedule → recovery sync)
 *   3 — retention cleanup (Drive preview + cleanup APIs)
 *   4 — restore path (delete local dump → restore from Drive copy)
 *
 * Evidence: docs/evidence/backup-gdrive-e2e/
 * Report:   BACKUP-GDRIVE-E2E-CERTIFICATION.md
 *
 * Usage:
 *   node scripts/backup-gdrive-e2e-cert.mjs
 *   SKIP_RESTORE=1 node scripts/backup-gdrive-e2e-cert.mjs   # skip destructive restore phase
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  ROOT,
  auditActions,
  authHeaders,
  backupJobRow,
  buildVerdict,
  computeDriveRetryDelayMs,
  createApiClient,
  createBackup,
  createLogger,
  entitySnapshot,
  envVal,
  login,
  pollBackupJob,
  pollDriveSync,
  readEnvFile,
  resolveLocalDumpPath,
  sleep,
  summarizeResults,
  waitNotBusy,
} from './lib/backup-cert-common.mjs';

const OUT = path.join(ROOT, 'docs/evidence/backup-gdrive-e2e');
const REPORT = path.join(ROOT, 'BACKUP-GDRIVE-E2E-CERTIFICATION.md');
const DIAG = path.join(OUT, 'FAILURE-DIAGNOSTICS.md');
const API = (process.env.STAGING_API_DIRECT ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api';
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.QA_EMAIL ?? 'superadmin@emdad.example';
const PASSWORD = process.env.QA_PASSWORD ?? 'demo123';
const LABEL = 'GDRIVE-E2E';
const SKIP_RESTORE = ['1', 'true', 'yes'].includes(String(process.env.SKIP_RESTORE ?? '').toLowerCase());

const results = [];
const diagnostics = [];
const startedAt = Date.now();
let simulateWasEnabled = false;

function record(phase, name, outcome, details = {}) {
  results.push({ phase, name, outcome, at: new Date().toISOString(), ...details });
  if (outcome === 'fail') {
    diagnostics.push({ phase, name, at: new Date().toISOString(), ...details });
  }
}

function envPath() {
  return path.join(ROOT, 'backend/.env');
}

function setSimulateFailure(enabled) {
  const file = envPath();
  const flag = 'BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true';
  const content = readEnvFile();
  if (enabled) {
    if (!content.includes(flag)) {
      execSync(`echo '${flag}' >> '${file}'`, { stdio: 'ignore' });
    }
    execSync('pm2 restart emdad-wms-backend-staging --update-env', { stdio: 'ignore' });
    simulateWasEnabled = true;
  } else if (simulateWasEnabled || content.includes('BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE')) {
    execSync(`sed -i '/BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE/d' '${file}'`, { stdio: 'ignore' });
    execSync('pm2 restart emdad-wms-backend-staging --update-env', { stdio: 'ignore' });
    simulateWasEnabled = false;
  }
}

function writeDiagnostics(log) {
  if (diagnostics.length === 0) {
    writeFileSync(DIAG, '# Failure Diagnostics\n\nNo failures recorded.\n');
    return;
  }
  const lines = [
    '# Google Drive E2E — Failure Diagnostics',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `${diagnostics.length} failure(s) detected during certification.`,
    '',
  ];
  for (const d of diagnostics) {
    lines.push(`### [${d.phase}] ${d.name}`, '');
    lines.push(`- **Time:** ${d.at}`);
    if (d.error) lines.push(`- **Error:** ${d.error}`);
    if (d.note) lines.push(`- **Note:** ${d.note}`);
    if (d.status !== undefined) lines.push(`- **HTTP status:** ${d.status}`);
    if (d.job) lines.push('- **Job state:**', '```json', JSON.stringify(d.job, null, 2), '```');
    if (d.message) lines.push(`- **Message:** ${d.message}`);
    lines.push('');
  }
  lines.push('## Troubleshooting', '', '| Symptom | Likely cause | Action |', '|---------|--------------|--------|');
  lines.push(
    '| Upload blocked | Drive not connected | Set OAuth credentials, Connect Drive in UI |',
    '| Sync timeout | Network or quota | Check Drive status page, retry manual sync |',
    '| Retry not scheduled | Simulate flag not loaded | Confirm PM2 restart after env change |',
    '| Restore failed | Local + Drive copy missing | Verify gdrive_file_id and connection |',
    '| Retention cleanup error | Drive API error | Check audit logs, folder permissions |',
    '',
    '## Raw evidence',
    '',
    `- Network traces: \`docs/evidence/backup-gdrive-e2e/network-traces.jsonl\``,
    `- Run log: \`docs/evidence/backup-gdrive-e2e/run.log\``,
    `- Summary JSON: \`docs/evidence/backup-gdrive-e2e/summary.json\``,
    '',
  );
  writeFileSync(DIAG, lines.join('\n'));
  log('DIAG', `Wrote ${diagnostics.length} failure diagnostic(s) to ${DIAG}`);
}

function writeReport(cert, log) {
  const { counts, verdict } = cert;
  const failed = results.filter((r) => r.outcome === 'fail');
  const blocked = results.filter((r) => r.outcome === 'blocked');

  const md = [
    '# Google Drive Backup Recovery — E2E Certification Report',
    '',
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '**Environment:** staging',
    '**Harness:** `scripts/backup-gdrive-e2e-cert.mjs`',
    '**Evidence:** `docs/evidence/backup-gdrive-e2e/`',
    '',
    '---',
    '',
    `## Verdict: ${verdict}`,
    '',
    '| Outcome | Count |',
    '|---------|-------|',
    `| Pass | ${counts.pass} |`,
    `| Blocked | ${counts.blocked} |`,
    `| Fail | ${counts.fail} |`,
    `| Skip | ${counts.skip} |`,
    '',
    `**Duration:** ${cert.elapsedSec}s`,
    '',
    '---',
    '',
    '## Test Phases',
    '',
    '| Phase | Description |',
    '|-------|-------------|',
    '| 0 | Prerequisites — OAuth, Drive connection |',
    '| 1 | Upload — create backup, verify Drive sync + file ID |',
    '| 2 | Retry — simulated failure, backoff schedule, recovery |',
    '| 3 | Retention — Drive preview + cleanup APIs |',
    '| 4 | Restore — delete local dump, restore from Drive copy |',
    '',
    '---',
    '',
    '## Results',
    '',
    '| Phase | Test | Outcome |',
    '|-------|------|---------|',
    ...results.map((r) => `| ${r.phase} | ${r.name} | ${r.outcome} |`),
    '',
  ];

  if (blocked.length > 0) {
    md.push('### Blocked tests', '', '| Test | Reason |', '|------|--------|');
    for (const r of blocked) {
      md.push(`| ${r.name} | ${r.note ?? r.reason ?? 'Drive not ready'} |`);
    }
    md.push('');
  }

  if (failed.length > 0) {
    md.push('### Failures', '', 'See [`docs/evidence/backup-gdrive-e2e/FAILURE-DIAGNOSTICS.md`](docs/evidence/backup-gdrive-e2e/FAILURE-DIAGNOSTICS.md).', '');
  }

  if (cert.metrics?.uploadJobId) {
    md.push(
      '---',
      '',
      '## Metrics',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Upload job ID | \`${cert.metrics.uploadJobId}\` |`,
      `| Drive file ID | \`${cert.metrics.driveFileId ?? '—'}\` |`,
      `| Upload duration | ${cert.metrics.uploadMs ?? '—'} ms |`,
      `| Restore duration | ${cert.metrics.restoreMs ?? '—'} ms |`,
      `| RPO (approx) | ${cert.metrics.rpoSec ?? '—'} s |`,
      `| RTO (approx) | ${cert.metrics.rtoSec ?? '—'} s |`,
      '',
    );
  }

  md.push(
    '---',
    '',
    '## Re-run',
    '',
    '```bash',
    'node scripts/backup-gdrive-e2e-cert.mjs',
    'SKIP_RESTORE=1 node scripts/backup-gdrive-e2e-cert.mjs  # non-destructive',
    '```',
    '',
    '*Auto-generated by backup-gdrive-e2e-cert.mjs*',
    '',
  );

  writeFileSync(REPORT, md.join('\n'));
  log('REPORT', `Wrote ${REPORT}`);
}

let log;

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'run.log'), '');
  writeFileSync(path.join(OUT, 'network-traces.jsonl'), '');
  log = createLogger(OUT);

  const api = createApiClient(API, OUT);
  const metrics = {};

  log('INIT', `API=${API} SKIP_RESTORE=${SKIP_RESTORE}`);

  try {
    // ── Phase 0: Prerequisites ─────────────────────────────────────────────
    const config = {
      gdriveEnabled: envVal('BACKUP_GDRIVE_ENABLED'),
      gdriveClientId: envVal('BACKUP_GDRIVE_CLIENT_ID') ? '[set]' : null,
      gdriveClientSecret: envVal('BACKUP_GDRIVE_CLIENT_SECRET') ? '[set]' : null,
      encryptionKey: envVal('BACKUP_ENCRYPTION_KEY') ? '[set]' : null,
      storagePath: envVal('BACKUP_STORAGE_PATH'),
      retryMaxAttempts: envVal('BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS') ?? '8',
      retryBaseSec: envVal('BACKUP_GDRIVE_RETRY_BASE_SEC') ?? '60',
      retryMaxSec: envVal('BACKUP_GDRIVE_RETRY_MAX_SEC') ?? '21600',
    };
    writeFileSync(path.join(OUT, '00-config.json'), JSON.stringify(config, null, 2));

    record(
      'prereq',
      'oauth_credentials',
      config.gdriveClientId && config.gdriveClientSecret ? 'pass' : 'blocked',
      { note: 'Set BACKUP_GDRIVE_CLIENT_ID and BACKUP_GDRIVE_CLIENT_SECRET in server .env' },
    );

    let token;
    try {
      token = await login(api, EMAIL, PASSWORD);
      record('prereq', 'auth', 'pass', { email: EMAIL });
    } catch (err) {
      record('prereq', 'auth', 'fail', { error: String(err) });
      throw err;
    }

    await waitNotBusy(api, token, COMPANY_ID);

    const driveStatusRes = await api('GET', '/integrations/google-drive/status', {
      headers: authHeaders(token, COMPANY_ID),
    });
    const driveStatus = driveStatusRes.data?.data ?? driveStatusRes.data;
    writeFileSync(path.join(OUT, '00-drive-status.json'), JSON.stringify(driveStatusRes, null, 2));

    const runtimeEnabled = driveStatus?.gdriveEnabled === true || config.gdriveEnabled === 'true';
    record('prereq', 'gdrive_enabled', runtimeEnabled ? 'pass' : 'fail', {
      env: config.gdriveEnabled,
      runtime: driveStatus?.gdriveEnabled,
    });
    record('prereq', 'encryption_key', config.encryptionKey || runtimeEnabled ? 'pass' : 'blocked', {
      note: config.encryptionKey ? undefined : 'BACKUP_ENCRYPTION_KEY not in .env file; inferred from runtime',
    });
    record('prereq', 'drive_status_api', driveStatusRes.status === 200 ? 'pass' : 'fail');
    record(
      'prereq',
      'drive_connected',
      driveStatus?.connected ? 'pass' : 'blocked',
      { note: 'Connect Drive under Settings → Backups → Google Drive', connected: driveStatus?.connected },
    );

    const driveReady = runtimeEnabled && driveStatus?.gdriveConfigured && driveStatus?.connected;

    // ── Phase 1: Upload verification ─────────────────────────────────────────
    let uploadJobId = null;

    if (!driveReady) {
      record('upload', 'create_backup', 'blocked', { note: 'Drive not connected' });
      record('upload', 'backup_completed', 'blocked', {});
      record('upload', 'drive_sync_status', 'blocked', {});
      record('upload', 'drive_file_id', 'blocked', {});
      record('upload', 'drive_test_connection', 'blocked', {});
    } else {
      await api('PUT', '/backups/storage-policy', {
        headers: authHeaders(token, COMPANY_ID),
        body: { defaultPolicy: 'local_and_drive' },
      });

      const uploadT0 = Date.now();
      const created = await createBackup(api, token, COMPANY_ID, `${LABEL}-upload`, 'local_and_drive');
      uploadJobId = created.jobId;
      metrics.uploadJobId = uploadJobId;
      record('upload', 'create_backup', 'pass', { jobId: uploadJobId });

      const backupStatus = await pollBackupJob(api, token, COMPANY_ID, uploadJobId);
      writeFileSync(path.join(OUT, '01-backup-status.json'), JSON.stringify(backupStatus, null, 2));
      record(
        'upload',
        'backup_completed',
        backupStatus?.status === 'completed' ? 'pass' : 'fail',
        { status: backupStatus?.status, bytesWritten: backupStatus?.bytes_written ?? backupStatus?.bytesWritten },
      );

      try {
        const synced = await pollDriveSync(uploadJobId);
        metrics.uploadMs = Date.now() - uploadT0;
        metrics.driveFileId = synced.gdrive_file_id;
        writeFileSync(path.join(OUT, '01-drive-sync.json'), JSON.stringify(synced, null, 2));
        record('upload', 'drive_sync_status', synced.gdrive_sync_status === 'synced' ? 'pass' : 'fail', {
          job: synced,
        });
        record('upload', 'drive_file_id', synced.gdrive_file_id ? 'pass' : 'fail', {
          fileId: synced.gdrive_file_id,
        });
      } catch (err) {
        record('upload', 'drive_sync_status', 'fail', { error: String(err), job: backupJobRow(uploadJobId) });
        record('upload', 'drive_file_id', 'fail', { error: String(err) });
      }

      const driveTest = await api('POST', '/integrations/google-drive/test', {
        headers: authHeaders(token, COMPANY_ID),
      });
      writeFileSync(path.join(OUT, '01-drive-test.json'), JSON.stringify(driveTest, null, 2));
      const testOk = driveTest.status === 200 && (driveTest.data?.data?.ok ?? driveTest.data?.ok) !== false;
      record('upload', 'drive_test_connection', testOk ? 'pass' : 'fail', { status: driveTest.status });
    }

    // ── Phase 2: Retry mechanism ─────────────────────────────────────────────
    const baseSec = Number(config.retryBaseSec);
    const maxSec = Number(config.retryMaxSec);
    const retryMath = {
      attempt1: computeDriveRetryDelayMs(1, baseSec, maxSec),
      attempt2: computeDriveRetryDelayMs(2, baseSec, maxSec),
      attempt3: computeDriveRetryDelayMs(3, baseSec, maxSec),
    };
    writeFileSync(path.join(OUT, '02-retry-math.json'), JSON.stringify(retryMath, null, 2));
    record(
      'retry',
      'backoff_schedule',
      retryMath.attempt1 === baseSec * 1000 && retryMath.attempt2 === baseSec * 2 * 1000 ? 'pass' : 'fail',
      retryMath,
    );

    if (!driveReady || !uploadJobId) {
      record('retry', 'simulated_failure', 'blocked', { note: 'Requires completed upload job' });
      record('retry', 'retry_scheduled', 'blocked', {});
      record('retry', 'recovery_sync', 'blocked', {});
    } else {
      let retryJobId = uploadJobId;
      try {
        setSimulateFailure(true);
        await sleep(8000);
        token = await login(api, EMAIL, PASSWORD);

        const syncFail = await api('POST', `/backups/${retryJobId}/sync-drive`, {
          headers: authHeaders(token, COMPANY_ID),
        });
        await sleep(3000);
        const jobAfterFail = backupJobRow(retryJobId);
        writeFileSync(
          path.join(OUT, '02-retry-failure.json'),
          JSON.stringify({ syncFail, jobAfterFail }, null, 2),
        );

        record(
          'retry',
          'simulated_failure',
          jobAfterFail?.gdrive_sync_status === 'failed' ? 'pass' : 'fail',
          { job: jobAfterFail, syncStatus: syncFail.status },
        );
        record(
          'retry',
          'retry_scheduled',
          jobAfterFail?.gdrive_next_retry_at ? 'pass' : 'fail',
          { nextRetryAt: jobAfterFail?.gdrive_next_retry_at, attempts: jobAfterFail?.gdrive_sync_attempts },
        );

        setSimulateFailure(false);
        await sleep(8000);
        token = await login(api, EMAIL, PASSWORD);

        const syncRecover = await api('POST', `/backups/${retryJobId}/sync-drive`, {
          headers: authHeaders(token, COMPANY_ID),
        });
        const recovered = await pollDriveSync(retryJobId, 180_000);
        writeFileSync(
          path.join(OUT, '02-retry-recovery.json'),
          JSON.stringify({ syncRecover, recovered }, null, 2),
        );
        record(
          'retry',
          'recovery_sync',
          recovered?.gdrive_sync_status === 'synced' ? 'pass' : 'fail',
          { job: recovered },
        );
      } catch (err) {
        record('retry', 'simulated_failure', 'fail', { error: String(err) });
        record('retry', 'retry_scheduled', 'fail', { error: String(err) });
        record('retry', 'recovery_sync', 'fail', { error: String(err) });
      } finally {
        setSimulateFailure(false);
      }

      writeFileSync(
        path.join(OUT, '02-retry-audit.txt'),
        auditActions(
          ['backup.drive.upload_failed', 'backup.drive.retry_scheduled', 'backup.drive.retry_attempted'],
          20,
        ),
      );
    }

    await waitNotBusy(api, token, COMPANY_ID);

    // ── Phase 3: Retention cleanup ───────────────────────────────────────────
    const policies = await api('GET', '/backups/retention/drive/policies', {
      headers: authHeaders(token, COMPANY_ID),
    });
    writeFileSync(path.join(OUT, '03-drive-policies.json'), JSON.stringify(policies, null, 2));
    record('retention', 'drive_policies_api', policies.status === 200 ? 'pass' : 'fail');

    const drivePreview = await api('GET', '/backups/retention/drive/preview', {
      headers: authHeaders(token, COMPANY_ID),
    });
    writeFileSync(path.join(OUT, '03-drive-preview.json'), JSON.stringify(drivePreview, null, 2));
    record('retention', 'drive_preview', drivePreview.status === 200 ? 'pass' : 'fail', {
      eligible: drivePreview.data?.data?.deletedDriveCount ?? drivePreview.data?.deletedDriveCount,
    });

    if (!driveReady) {
      record('retention', 'drive_cleanup', 'blocked', { note: 'Drive not connected' });
    } else {
      const driveCleanup = await api('POST', '/backups/retention/drive/cleanup', {
        headers: authHeaders(token, COMPANY_ID),
      });
      writeFileSync(path.join(OUT, '03-drive-cleanup.json'), JSON.stringify(driveCleanup, null, 2));
      const cleanupData = driveCleanup.data?.data ?? driveCleanup.data;
      record(
        'retention',
        'drive_cleanup',
        driveCleanup.status === 200 || driveCleanup.status === 201 ? 'pass' : 'fail',
        {
          status: driveCleanup.status,
          deletedDriveCount: cleanupData?.deletedDriveCount,
          deletedJobCount: cleanupData?.deletedJobCount,
        },
      );
      writeFileSync(
        path.join(OUT, '03-retention-audit.txt'),
        auditActions(['backup.drive.retention_cleanup'], 10),
      );
    }

    // ── Phase 4: Restore from Drive ──────────────────────────────────────────
    if (SKIP_RESTORE) {
      record('restore', 'baseline_snapshot', 'skip', { note: 'SKIP_RESTORE=1' });
      record('restore', 'local_dump_removed', 'skip', {});
      record('restore', 'restore_from_drive', 'skip', {});
      record('restore', 'entity_integrity', 'skip', {});
    } else if (!driveReady || !uploadJobId) {
      record('restore', 'baseline_snapshot', 'blocked', { note: 'Requires synced upload job' });
      record('restore', 'local_dump_removed', 'blocked', {});
      record('restore', 'restore_from_drive', 'blocked', {});
      record('restore', 'entity_integrity', 'blocked', {});
    } else {
      const restoreJobId = uploadJobId;
      const syncedJob = backupJobRow(restoreJobId);
      if (syncedJob?.gdrive_sync_status !== 'synced' || !syncedJob?.gdrive_file_id) {
        record('restore', 'baseline_snapshot', 'blocked', { note: 'Upload job not synced to Drive' });
        record('restore', 'local_dump_removed', 'blocked', {});
        record('restore', 'restore_from_drive', 'blocked', {});
        record('restore', 'entity_integrity', 'blocked', {});
      } else {
        const baseline = entitySnapshot();
        writeFileSync(path.join(OUT, '04-baseline.json'), JSON.stringify(baseline, null, 2));
        record('restore', 'baseline_snapshot', 'pass', baseline);

        const dumpPath = resolveLocalDumpPath(restoreJobId, syncedJob);
        let removed = false;
        try {
          if (existsSync(dumpPath)) {
            unlinkSync(dumpPath);
            removed = true;
          }
          const encPath = dumpPath.replace(/\.dump$/, '.dump.enc');
          if (existsSync(encPath)) unlinkSync(encPath);
        } catch (err) {
          record('restore', 'local_dump_removed', 'fail', { error: String(err), dumpPath });
        }

        const stillExists = existsSync(dumpPath);
        writeFileSync(
          path.join(OUT, '04-local-removal.json'),
          JSON.stringify({ dumpPath, removed, stillExists, gdriveFileId: syncedJob.gdrive_file_id }, null, 2),
        );
        record('restore', 'local_dump_removed', !stillExists ? 'pass' : 'fail', { dumpPath, stillExists });

        await waitNotBusy(api, token, COMPANY_ID);

        const restoreT0 = Date.now();
        const restoreRes = await api('POST', `/backups/${restoreJobId}/restore`, {
          headers: authHeaders(token, COMPANY_ID),
          body: { confirmPhrase: 'RESTORE', createPreSnapshot: true },
        });
        const newRestoreJobId =
          restoreRes.data?.data?.restoreJobId ?? restoreRes.data?.data?.jobId ?? restoreRes.data?.restoreJobId;

        let restoreStatus = null;
        if (newRestoreJobId) {
          try {
            restoreStatus = await pollBackupJob(api, token, COMPANY_ID, newRestoreJobId, 900_000);
          } catch (err) {
            record('restore', 'restore_from_drive', 'fail', {
              error: String(err),
              restoreJobId: newRestoreJobId,
            });
          }
        }

        metrics.restoreMs = Date.now() - restoreT0;
        metrics.rtoSec = Math.round(metrics.restoreMs / 1000);
        metrics.rpoSec = syncedJob.completed_at
          ? Math.round((Date.now() - new Date(syncedJob.completed_at).getTime()) / 1000)
          : null;

        token = await login(api, EMAIL, PASSWORD);
        const after = entitySnapshot();
        writeFileSync(path.join(OUT, '04-after-restore.json'), JSON.stringify(after, null, 2));
        writeFileSync(
          path.join(OUT, '04-restore-result.json'),
          JSON.stringify({ restoreRes, newRestoreJobId, restoreStatus, baseline, after }, null, 2),
        );
        writeFileSync(
          path.join(OUT, '04-restore-audit.txt'),
          auditActions(['backup.restored', 'backup.created', 'backup.restore_failed'], 10),
        );

        record(
          'restore',
          'restore_from_drive',
          restoreStatus?.status === 'completed' ? 'pass' : 'fail',
          { restoreJobId: newRestoreJobId, status: restoreStatus?.status, httpStatus: restoreRes.status },
        );

        const integrity =
          after.products === baseline.products &&
          after.inventory === baseline.inventory &&
          after.inboundOrders === baseline.inboundOrders &&
          after.outboundOrders === baseline.outboundOrders &&
          after.tasks === baseline.tasks &&
          after.users === baseline.users;

        record('restore', 'entity_integrity', integrity ? 'pass' : 'fail', { baseline, after });
      }
    }
  } catch (fatal) {
    log('FATAL', String(fatal));
    diagnostics.push({ phase: 'fatal', name: 'uncaught', error: String(fatal), stack: fatal.stack });
    record('fatal', 'uncaught', 'fail', { error: String(fatal) });
  } finally {
    setSimulateFailure(false);
  }

  const counts = summarizeResults(results);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const cert = {
    ranAt: new Date().toISOString(),
    elapsedSec,
    counts,
    verdict: buildVerdict(counts),
    results,
    metrics,
    skipRestore: SKIP_RESTORE,
  };

  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(cert, null, 2));
  writeDiagnostics(log);
  writeReport(cert, log);

  log('DONE', `verdict=${cert.verdict} pass=${counts.pass} fail=${counts.fail} blocked=${counts.blocked} (${elapsedSec}s)`);
  console.log('\nEvidence:', OUT);
  console.log('Report:', REPORT);
  process.exit(counts.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
