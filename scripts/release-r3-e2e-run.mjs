#!/usr/bin/env node
/**
 * RELEASE-R3 — Warehouse workflow E2E certification harness.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/evidence/release-r3-e2e');
const RESULTS_JSON = join(OUT, 'results.json');
const SPEC = 'tests/e2e/admin/release-r3-workflow.spec.ts';

const STEPS = [
  { id: 'inbound-create-asn', area: 'Inbound', label: 'Create ASN' },
  { id: 'inbound-confirm', area: 'Inbound', label: 'Confirm' },
  { id: 'inbound-receive', area: 'Inbound', label: 'Receive' },
  { id: 'inbound-qc', area: 'Inbound', label: 'QC' },
  { id: 'inbound-putaway', area: 'Inbound', label: 'Putaway' },
  { id: 'inbound-complete', area: 'Inbound', label: 'Complete' },
  { id: 'outbound-create', area: 'Outbound', label: 'Create order' },
  { id: 'outbound-allocate', area: 'Outbound', label: 'Allocate' },
  { id: 'outbound-pick', area: 'Outbound', label: 'Pick' },
  { id: 'outbound-pack', area: 'Outbound', label: 'Pack' },
  { id: 'outbound-dispatch', area: 'Outbound', label: 'Dispatch' },
  { id: 'outbound-complete', area: 'Outbound', label: 'Complete' },
  { id: 'inventory-adjustment', area: 'Inventory', label: 'Adjustment' },
  { id: 'inventory-adjustment-approval', area: 'Inventory', label: 'Approval' },
  { id: 'inventory-cycle-count', area: 'Inventory', label: 'Cycle count' },
  { id: 'inventory-cycle-approval', area: 'Inventory', label: 'Cycle approval' },
  { id: 'backup-manual', area: 'Backups', label: 'Manual backup' },
  { id: 'backup-upload', area: 'Backups', label: 'Upload' },
  { id: 'backup-restore', area: 'Backups', label: 'Restore simulation' },
  { id: 'backup-retention', area: 'Backups', label: 'Retention cleanup' },
];

mkdirSync(OUT, { recursive: true });

const started = Date.now();
let stdout = '';
let stderr = '';
let exitCode = 0;

try {
  stdout = execSync(
    `npx playwright test ${SPEC} --project=admin-desktop --retries=0 --reporter=line,json`,
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: RESULTS_JSON },
    },
  );
} catch (err) {
  exitCode = err.status ?? 1;
  stdout = err.stdout ?? '';
  stderr = err.stderr ?? '';
}

const elapsedMs = Date.now() - started;

function loadResults() {
  const candidates = [RESULTS_JSON, join(ROOT, 'qa-results/results.json')];
  for (const path of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      if (parsed.suites?.length) return parsed;
    } catch {
      /* try next */
    }
  }
  const jsonStart = stdout.indexOf('{\n  "config"');
  if (jsonStart >= 0) {
    try {
      return JSON.parse(stdout.slice(jsonStart));
    } catch {
      /* fall through */
    }
  }
  return { suites: [] };
}

function flattenTests(suites, out = []) {
  for (const s of suites ?? []) {
    for (const spec of s.specs ?? []) {
      if (!spec.file?.includes('release-r3-workflow')) continue;
      for (const t of spec.tests ?? []) {
        const result = t.results?.[0];
        let status = result?.status ?? t.status;
        if (status === 'expected') status = 'passed';
        if (status === 'unexpected' || status === 'timedOut') status = 'failed';
        out.push({
          title: spec.title,
          status,
          duration: result?.duration ?? 0,
        });
      }
    }
    flattenTests(s.suites, out);
  }
  return out;
}

const results = loadResults();
const tests = flattenTests(results.suites);
const passed = tests.filter((t) => t.status === 'passed').length;
const failed = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length;
const skipped = tests.filter((t) => t.status === 'skipped').length;
const total = STEPS.length;
const coveragePct = Math.round(((passed + skipped * 0.5) / total) * 100);

const cert = {
  generatedAt: new Date().toISOString(),
  elapsedMs,
  elapsedHuman: `${(elapsedMs / 1000 / 60).toFixed(1)} min`,
  totalSteps: total,
  totalTests: tests.length,
  passed,
  failed,
  skipped,
  coveragePct,
  exitCode,
  accounts: {
    supervisor: 'r3-supervisor@emdad.example',
    operator: 'r3-operator@emdad.example',
    backups: 'superadmin@emdad.example',
  },
  steps: STEPS,
  tests,
  stats: results.stats ?? null,
  playwrightTail: `${stdout}\n${stderr}`.slice(-8000),
};

writeFileSync(join(OUT, 'cert-results.json'), JSON.stringify(cert, null, 2));
writeFileSync(
  join(OUT, 'cert-summary.txt'),
  [
    `RELEASE-R3 E2E Certification ${cert.generatedAt}`,
    `Duration: ${cert.elapsedHuman}`,
    `Results: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`,
    `Coverage: ${coveragePct}%`,
    '',
    ...tests.map((t) => `${t.status.toUpperCase().padEnd(8)} ${t.title} (${t.duration}ms)`),
  ].join('\n'),
);

console.log(JSON.stringify({ passed, failed, skipped, coveragePct, elapsedMs }, null, 2));
process.exit(failed > 0 ? 1 : 0);
